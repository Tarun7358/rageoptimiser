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

  // Privileged Action Elevation Middleware
  const requireElevation = (req: any, res: any, next: any) => {
    // 1. Verify standard token first
    authenticateToken(req, res, async () => {
      const user = req.user;
      
      // 2. Fetch user from DB to check if TOTP is enabled
      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });
      
      const userDoc = await db.collection('admin_users').where('username', '==', user.username).get();
      if (userDoc.empty) return res.status(401).json({ error: 'User not found' });
      
      const adminData = userDoc.docs[0].data();
      
      // If TOTP is not enabled, we just allow the action for now.
      // But based on spec, Owner MUST have TOTP enabled for privileged actions. 
      // If they don't, they can't do it. But to prevent lockouts, if they haven't set it up, they can't do privileged actions.
      if (!adminData.totpEnabled) {
        // Enforce TOTP setup for owner
        if (user.role === 'owner') {
           return res.status(403).json({ error: 'ELEVATION_REQUIRED_SETUP', message: 'You must enable Two-Factor Authentication in Settings -> Security to perform this action.' });
        }
        return next(); // non-owners without TOTP can proceed if they are allowed by the endpoint (role checks should be in the endpoint)
      }

      // 3. Check for elevated token
      const elevatedToken = req.headers['x-elevated-token'];
      if (!elevatedToken) {
        return res.status(403).json({ error: 'ELEVATION_REQUIRED', message: 'Privileged action requires TOTP verification.' });
      }

      // 4. Verify elevated token
      jwt.verify(elevatedToken, (process.env.JWT_SECRET || 'fallback_secret') as string, (err: any, elevatedData: any) => {
        if (err || elevatedData.type !== 'elevation' || elevatedData.username !== user.username) {
          return res.status(403).json({ error: 'ELEVATION_EXPIRED', message: 'Elevated session expired or invalid.' });
        }
        next();
      });
    });
  };

  // Login Route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

      const user = await AuthService.authenticate(username, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role }, 
        process.env.JWT_SECRET || 'fallback_secret', 
        { expiresIn: '1d' }
      );
      
      res.json({ token, role: user.role, username: user.username });
    } catch (err: any) {
      if (err.message === 'ACCOUNT_LOCKED') {
        return res.status(403).json({ error: 'Account locked. Too many failed attempts.' });
      }
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- TOTP Authentication Endpoints ---

  app.get('/api/auth/totp/status', authenticateToken, async (req: any, res: any) => {
    try {
      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });
      
      const userDoc = await db.collection('admin_users').where('username', '==', req.user.username).get();
      if (userDoc.empty) return res.status(404).json({ error: 'User not found' });
      
      const adminData = userDoc.docs[0].data();
      res.json({ enabled: !!adminData.totpEnabled });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch TOTP status.' });
    }
  });

  app.get('/api/auth/totp/setup', authenticateToken, async (req: any, res: any) => {
    try {
      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Only the Owner can setup TOTP.' });

      const userDoc = await db.collection('admin_users').where('username', '==', req.user.username).get();
      if (userDoc.empty) return res.status(404).json({ error: 'User not found' });
      
      const adminData = userDoc.docs[0].data();
      if (adminData.totpEnabled) {
        return res.status(400).json({ error: 'TOTP is already enabled.' });
      }

      // Generate secret and QR
      const { secret, uri } = SecurityService.generateTotpSecret(req.user.username);
      const qrCodeDataUrl = await QRCode.toDataURL(uri);

      // Save encrypted secret temporarily (until verified)
      const encryptedSecret = SecurityService.encrypt(secret);
      await userDoc.docs[0].ref.update({
        totpSecret: encryptedSecret
      });

      res.json({ secret, qrCodeUrl: qrCodeDataUrl });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to generate TOTP setup.' });
    }
  });

  app.post('/api/auth/totp/verify-setup', authenticateToken, async (req: any, res: any) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Code is required' });

      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });

      const userDoc = await db.collection('admin_users').where('username', '==', req.user.username).get();
      const adminData = userDoc.docs[0].data();

      if (!adminData.totpSecret) return res.status(400).json({ error: 'No TOTP setup found.' });

      const secret = SecurityService.decrypt(adminData.totpSecret);
      const isValid = await SecurityService.verifyTotpToken(code, secret);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Google Authenticator code.' });
      }

      const recoveryCodes = SecurityService.generateRecoveryCodes();
      
      await userDoc.docs[0].ref.update({
        totpEnabled: true,
        recoveryCodes: recoveryCodes // In a real prod environment, these should be hashed. Storing plaintext for this MVP so owner can view if needed.
      });

      registry.logSyncEvent(`Owner enabled Two-Factor Authentication (TOTP).`, 'success');

      res.json({ success: true, recoveryCodes });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to verify TOTP setup.' });
    }
  });

  app.post('/api/auth/elevate', authenticateToken, async (req: any, res: any) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Code is required' });

      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });

      const userDoc = await db.collection('admin_users').where('username', '==', req.user.username).get();
      const adminData = userDoc.docs[0].data();

      if (!adminData.totpEnabled || !adminData.totpSecret) {
        return res.status(400).json({ error: 'TOTP is not enabled on this account.' });
      }

      const secret = SecurityService.decrypt(adminData.totpSecret);
      const isValid = await SecurityService.verifyTotpToken(code, secret);

      if (!isValid) {
        registry.logSyncEvent(`Failed privileged elevation attempt for ${req.user.username}. Invalid code.`, 'warn');
        return res.status(400).json({ error: 'Invalid Google Authenticator code.' });
      }

      // Generate a short-lived token (5 minutes)
      const elevatedToken = jwt.sign(
        { username: req.user.username, type: 'elevation' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '5m' }
      );

      registry.logSyncEvent(`User ${req.user.username} successfully elevated session for privileged actions.`, 'info');
      res.json({ success: true, elevatedToken });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to elevate session.' });
    }
  });

  app.post('/api/auth/totp/disable', requireElevation, async (req: any, res: any) => {
    try {
      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });

      const userDoc = await db.collection('admin_users').where('username', '==', req.user.username).get();
      
      await userDoc.docs[0].ref.update({
        totpEnabled: false,
        totpSecret: null,
        recoveryCodes: null
      });

      registry.logSyncEvent(`Owner completely disabled Two-Factor Authentication.`, 'warn');
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to disable TOTP.' });
    }
  });

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

  app.post('/api/system/override', requireElevation, async (req: any, res: any) => {
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
    if (req.params.id === 'security') return requireElevation(req, res, next);
    next();
  }, (req, res) => {
    const mod = registry.updateModuleConfig(req.params.id, req.body);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    res.json(mod);
  });

  app.post('/api/modules/:id/toggle', authenticateToken, (req: any, res: any, next: any) => {
    if (req.params.id === 'security') return requireElevation(req, res, next);
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

  app.post('/api/commands/sync', requireElevation, async (req: any, res: any) => {
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
      
      const snapshot = await db.collection('approvals').orderBy('joinedAt', 'desc').get();
      const approvals = snapshot.docs.map(doc => doc.data() as IGuildApproval);
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
      const docRef = db.collection('approvals').doc(guildId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: 'Guild not found in approval system' });

      const updateData: Partial<IGuildApproval> = { lastUpdated: Date.now() };

      if (action === 'approve') {
        updateData.status = 'Approved';
        updateData.approvedAt = Date.now();
        updateData.approvedBy = 'Dashboard Admin';
      } else if (action === 'reject') {
        updateData.status = 'Rejected';
        updateData.rejectedAt = Date.now();
        updateData.rejectionReason = reason;
      } else if (action === 'suspend') {
        updateData.status = 'Suspended';
      } else if (action === 'blacklist') {
        updateData.status = 'Blacklisted';
        updateData.blacklistedAt = Date.now();
        updateData.notes = reason;
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      await docRef.update(updateData);
      
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
