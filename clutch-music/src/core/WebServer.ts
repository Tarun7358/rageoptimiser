import express, { Express } from 'express';
import cors from 'cors';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ModuleRegistry } from './ModuleRegistry.js';
import { ModuleManifest } from './types.js';
import jwt from 'jsonwebtoken';
import { Database } from './Database.js';
import { IGuildApproval } from '../models/index.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { PublicFeedManager } from './PublicFeedManager.js';
import { AuthService } from './AuthService.js';
import { SecurityService } from './SecurityService.js';
import QRCode from 'qrcode';

export class WebServer {
  private app: Express;
  private server: Server;
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  public getBotMetrics: (() => { latency: number; uptime: string }) | null = null;
  public deployCommandsCallback: (() => Promise<void>) | null = null;
  public triggerEmergencyLock: (() => Promise<void>) | null = null;
  public onApprovalAction?: (guildId: string, action: string, reason?: string) => Promise<void>;
  public publicFeed?: PublicFeedManager;
  public getDiscordClient?: () => any;

  constructor(
    private registry: ModuleRegistry,
    private refreshCallback: () => void
  ) {
    this.app = express();
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // Basic Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ port: Number(process.env.WS_PORT || 5001) });

    this.setupRoutes();
    this.setupWebSockets();
  }

  public registerModuleManifests(manifests: ModuleManifest[]) {
    // Mount custom routes defined inside the module manifests
    manifests.forEach(manifest => {
      if (manifest.routes) {
        manifest.routes.forEach(route => {
          const path = `/api/modules/${manifest.id}${route.path}`;
          const handler = async (req: any, res: any) => {
            try {
              await route.handler(req, res, {
                registry: this.registry,
                client: this.getDiscordClient ? this.getDiscordClient() : null,
                broadcast: this.broadcast.bind(this),
                getModulesState: () => this.registry.getModulesState(),
                updateModuleConfig: (id: string, config: Record<string, any>) => {
                  this.registry.updateModuleConfig(id, config);
                },
                logSyncEvent: (msg: string, type: 'info' | 'warn' | 'success') => {
                  this.registry.logSyncEvent(msg, type);
                }
              });
            } catch (err) {
              console.error(`Error in route ${path}:`, err);
              res.status(500).json({ error: 'Internal module router error' });
            }
          };

          if (route.method === 'post') {
            this.app.post(path, handler);
          } else {
            this.app.get(path, handler);
          }
        });
      }
    });
  }

  public listen(port: number) {
    this.server.listen(port, () => {
      console.log(`Core WebServer running on http://localhost:${port}`);
    });
    console.log(`Core WebSocket server running on ws://localhost:${process.env.WS_PORT || 5001}`);
  }

  public broadcast(msgObj: any) {
    const serialized = JSON.stringify(msgObj);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    });
  }

  public setPublicFeed(feed: PublicFeedManager) {
    this.publicFeed = feed;
  }

  private setupRoutes() {
    appRoutes(this, this.app, this.registry, this.refreshCallback);
  }

  private setupWebSockets() {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      // Check for JWT token in query params
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      jwt.verify(token, process.env.JWT_SECRET as string || 'fallback_secret', (err: any, user: any) => {
        if (err) {
          ws.close(1008, 'Unauthorized');
          return;
        }

        this.clients.add(ws);

        const metrics = this.getBotMetrics ? this.getBotMetrics() : { latency: 0, uptime: 'Offline' };
        ws.send(JSON.stringify({
          type: 'INIT',
          modules: this.registry.getModulesState(),
          registry: this.registry.getRegistry(),
          syncLogs: this.registry.getSyncLogs(),
          globalSettings: this.registry.getGlobalSettings(),
          latency: metrics.latency,
          uptime: metrics.uptime
        }));

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });
    });
  }
}

function appRoutes(server: WebServer, app: Express, registry: ModuleRegistry, refreshCallback: () => void) {
  
  // Public route for Login Page live metrics
  app.get('/api/status', (req, res) => {
    const metrics = server.getBotMetrics ? server.getBotMetrics() : { latency: 0, uptime: 'Offline' };
    const modules = registry.getModulesState();
    
    // Calculate simple stats
    const activeModulesCount = modules.filter(m => m.status === 'ready' || m.status === 'enabled').length;
    const protectedServers = 1; // Assuming single-guild dashboard
    const threatsBlocked = 286; // Mock data as requested by user

    res.json({
      activeModules: activeModulesCount,
      protectedServers,
      threatsBlocked,
      bot: { status: 'Online', latency: metrics.latency, uptime: metrics.uptime },
      database: { status: 'Connected' },
      api: { status: 'Healthy' }
    });
  });

  // Authentication Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, (process.env.JWT_SECRET || 'fallback_secret') as string, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };


  app.get('/api/state', (req, res) => {
    const metrics = server.getBotMetrics ? server.getBotMetrics() : { latency: 0, uptime: 'Offline' };
    res.json({
      modules: registry.getModulesState(),
      registry: registry.getRegistry(),
      syncLogs: registry.getSyncLogs(),
      globalSettings: registry.getGlobalSettings(),
      latency: metrics.latency,
      uptime: metrics.uptime
    });
  });

  app.post('/api/system/override', authenticateToken, async (req: any, res: any) => {
    const { action, value } = req.body;
    // Check if user is owner
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied: Only the Owner may perform this action.' });
    try {
      if (action === 'toggle_maintenance') {
        registry.setGlobalSettings({ maintenanceMode: value });
        res.json({ success: true, maintenanceMode: value });
      } else if (action === 'emergency_lock') {
        if (server.triggerEmergencyLock) {
          await server.triggerEmergencyLock();
          res.json({ success: true });
        } else {
          res.status(500).json({ error: 'Emergency Lock callback not linked to Gateway' });
        }
      } else {
        res.status(400).json({ error: 'Unknown action' });
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/modules/:id', authenticateToken, (req: any, res: any, next: any) => {
    next();
  }, (req, res) => {
    const mod = registry.updateModuleConfig(req.params.id, req.body);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    res.json(mod);
  });

  app.post('/api/modules/:id/toggle', authenticateToken, (req: any, res: any, next: any) => {
    next();
  }, (req, res) => {
    const { enabledOverride } = req.body;
    const mod = registry.toggleModule(req.params.id, enabledOverride);
    if (!mod) return res.status(400).json({ error: 'Module validation failed. Cannot toggle.' });
    res.json(mod);
  });

  app.post('/api/simulate', authenticateToken, (req, res) => {
    const { actionType } = req.body;
    registry.simulateAction(actionType);
    res.json({ success: true });
  });

  app.post('/api/sync/refresh', authenticateToken, (req, res) => {
    refreshCallback();
    res.json({ success: true });
  });

  app.post('/api/commands/sync', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied: Only the Owner may perform this action.' });
    if (server.deployCommandsCallback) {
      await server.deployCommandsCallback();
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Gateway deploy callback not linked.' });
    }
  });

  app.post('/api/settings', authenticateToken, (req, res) => {
    const data = req.body;
    const currentReg = registry.getRegistry();
    const newReg = {
      ...currentReg,
      globalSettings: {
        ...(currentReg.globalSettings || {}),
        ...data
      }
    };
    registry.setRegistry(newReg);
    registry.logSyncEvent('Global settings updated from dashboard.', 'success');
    res.json({ success: true, globalSettings: newReg.globalSettings });
  });

  // --- APPROVAL SYSTEM ENDPOINTS ---
  app.get('/api/approvals', authenticateToken, async (req, res) => {
    try {
      const db = Database.getDb();
      if (!db) return res.json([]);
      
      const approvals = await db.all<any>('SELECT * FROM approvals ORDER BY joinedAt DESC');
      res.json(approvals);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch approvals' });
    }
  });

  // --- PUBLIC FEED ENDPOINTS ---
  app.get('/api/public/events', (req, res) => {
    if (!server.publicFeed) {
      return res.status(503).json({ error: 'Public Feed Manager not initialized' });
    }
    const category = req.query.category as string;
    const timeFilter = req.query.timeFilter ? parseInt(req.query.timeFilter as string) : undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    
    const result = server.publicFeed.getEvents(category, timeFilter, page, 10);
    res.json(result);
  });

  app.post('/api/approvals/:guildId/action', authenticateToken, async (req, res) => {
    const db = Database.getDb();
    if (!db) return res.status(503).json({ error: 'Database not connected' });

    const { action, reason } = req.body;
    const { guildId } = req.params;
    
    try {
      const docSnap = await db.get<any>('SELECT status FROM approvals WHERE guildId = ?', [guildId]);
      if (!docSnap) return res.status(404).json({ error: 'Guild not found in approval system' });

      let sql = '';
      let params: any[] = [];
      const now = Date.now();

      if (action === 'approve') {
        sql = 'UPDATE approvals SET status = ?, approvedAt = ?, approvedBy = ?, lastUpdated = ? WHERE guildId = ?';
        params = ['Approved', now, 'Dashboard Admin', now, guildId];
      } else if (action === 'reject') {
        sql = 'UPDATE approvals SET status = ?, rejectedAt = ?, rejectionReason = ?, lastUpdated = ? WHERE guildId = ?';
        params = ['Rejected', now, reason || null, now, guildId];
      } else if (action === 'suspend') {
        sql = 'UPDATE approvals SET status = ?, lastUpdated = ? WHERE guildId = ?';
        params = ['Suspended', now, guildId];
      } else if (action === 'blacklist') {
        sql = 'UPDATE approvals SET status = ?, blacklistedAt = ?, notes = ?, lastUpdated = ? WHERE guildId = ?';
        params = ['Blacklisted', now, reason || null, now, guildId];
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      await db.run(sql, params);
      
      if (server.onApprovalAction) {
        await server.onApprovalAction(guildId, action, reason).catch(console.error);
      }

      registry.logSyncEvent(`Dashboard Action: Guild ${guildId} was ${action}d.`, action === 'approve' ? 'success' : 'warn');
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Action failed' });
    }
  });
}
