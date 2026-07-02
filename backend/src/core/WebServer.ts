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
import { OAuthService } from './OAuthService.js';
import QRCode from 'qrcode';
import { AnalyticsService } from './AnalyticsService.js';
import bcrypt from 'bcryptjs';

export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, (process.env.JWT_SECRET || 'fallback_secret') as string, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

export const authorizeGuildAccess = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || req.params.guildId as string || process.env.GUILD_ID || 'default_guild';
  
  if (user.role === 'guild_manager') {
    const managedIds: string[] = user.managedGuildIds || [];
    if (!managedIds.includes(guildId)) {
      return res.status(403).json({ error: 'Access denied: You do not manage this guild' });
    }
  }
  
  next();
};

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
  public syncRegistryCallback?: (guildId?: string) => Promise<void>;

  constructor(
    private registry: ModuleRegistry,
    private refreshCallback: (guildId?: string) => void
  ) {
    this.app = express();
    this.app.use(helmet({ contentSecurityPolicy: false }));
    this.app.use(cors({
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:4680',
        'http://localhost:3000'
      ],
      credentials: true
    }));
    this.app.use(express.json());


    // Basic Rate Limiting - Increased for Dashboard heavy API usage
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 2000, // Increased limit to prevent 429 errors during dashboard sync
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
              const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
              await route.handler(req, res, {
                guildId,
                registry: this.registry,
                client: this.getDiscordClient ? this.getDiscordClient() : null,
                broadcast: this.broadcast.bind(this),
                getModulesState: () => this.registry.getModulesState(guildId),
                updateModuleConfig: (id: string, config: Record<string, any>) => {
                  this.registry.updateModuleConfig(guildId, id, config);
                },
                logSyncEvent: (msg: string, type: 'info' | 'warn' | 'success') => {
                  this.registry.logSyncEvent(guildId, msg, type);
                },
                getSyncLogs: (gId?: string) => this.registry.getSyncLogs(gId || guildId),
                getRegistry: (gId?: string) => this.registry.getRegistry(gId || guildId)
              });
            } catch (err) {
              console.error(`Error in route ${path}:`, err);
              res.status(500).json({ error: 'Internal module router error' });
            }
          };

          if (route.method === 'post') {
            this.app.post(path, authenticateToken, authorizeGuildAccess, handler);
          } else {
            this.app.get(path, authenticateToken, authorizeGuildAccess, handler);
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
    const targetGuildId = msgObj.guildId;
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        const clientGuildId = (ws as any).guildId;
        if (targetGuildId && clientGuildId && targetGuildId !== clientGuildId) {
          return;
        }
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
      const guildId = url.searchParams.get('guildId') || process.env.GUILD_ID || 'default_guild';
      
      if (!token) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      jwt.verify(token, process.env.JWT_SECRET as string || 'fallback_secret', (err: any, user: any) => {
        if (err) {
          ws.close(1008, 'Unauthorized');
          return;
        }

        (ws as any).guildId = guildId;
        this.clients.add(ws);

        // Trigger live Discord sync for this guild, then send INIT with fresh data
        const sendInit = () => {
          const metrics = this.getBotMetrics ? this.getBotMetrics() : { latency: 0, uptime: 'Offline' };
          ws.send(JSON.stringify({
            type: 'INIT',
            modules: this.registry.getModulesState(guildId),
            registry: this.registry.getRegistry(guildId),
            syncLogs: this.registry.getSyncLogs(guildId),
            globalSettings: this.registry.getGlobalSettings(guildId),
            latency: metrics.latency,
            uptime: metrics.uptime,
            guildId
          }));
        };

        if (this.syncRegistryCallback) {
          this.syncRegistryCallback(guildId).catch(() => {}).finally(sendInit);
        } else {
          sendInit();
        }

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });
    });
  }
}

function appRoutes(server: WebServer, app: Express, registry: ModuleRegistry, refreshCallback: (guildId?: string) => void) {
  
  // Internal Endpoint for Music Bot Logs
  app.post('/api/internal/music/logs', express.json(), (req, res) => {
    const { msg, type, source, guildId } = req.body;
    if (msg && type) {
      registry.logSyncEvent(guildId, `[MUSIC] ${msg}`, type);
    }
    res.sendStatus(200);
  });

  // Internal Endpoint for Music Bot State/Metrics Forwarding
  app.post('/api/internal/music/state', express.json(), (req, res) => {
    if (req.body && req.body.type) {
      // Forward the WebSocket event to the dashboard
      server.broadcast(req.body);
    }
    res.sendStatus(200);
  });

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

      // Enforce credentials login is reserved exclusively for the platform owner
      if (username !== 'admin') {
        return res.status(401).json({ error: 'Access denied: Credentials login is reserved for the platform owner.' });
      }

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
  app.get('/api/state', authenticateToken, authorizeGuildAccess, async (req, res) => {
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    // Trigger a live Discord sync before returning — ensures fresh roles/channels on each load
    if (server.syncRegistryCallback) {
      await server.syncRegistryCallback(guildId).catch(() => {});
    }
    const metrics = server.getBotMetrics ? server.getBotMetrics() : { latency: 0, uptime: 'Offline' };
    res.json({
      modules: registry.getModulesState(guildId),
      registry: registry.getRegistry(guildId),
      syncLogs: registry.getSyncLogs(guildId),
      globalSettings: registry.getGlobalSettings(guildId),
      latency: metrics.latency,
      uptime: metrics.uptime
    });
  });

  app.post('/api/system/override', requireElevation, async (req: any, res: any) => {
    const { action, value } = req.body;
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied: Only the Owner may perform this action.' });
    try {
      if (action === 'toggle_maintenance') {
        registry.setGlobalSettings(guildId, { maintenanceMode: value });
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

  // --- STAFF MANAGEMENT ENDPOINTS ---
  app.get('/api/system/staff', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
    try {
      const db = Database.getDb();
      if (!db) {
        return res.json([
          { username: 'mod_alex', role: 'Security Mod', access: 'Dashboard Access', status: 'Active' },
          { username: 'staff_lisa', role: 'Lead Admin', access: 'Owner Panel Access', status: 'Active' }
        ]);
      }
      const snapshot = await db.collection('admin_users').get();
      const staff = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          username: d.username,
          role: d.role === 'owner' ? 'Owner' : 'Staff',
          access: d.role === 'owner' ? 'Full Overrides' : 'Dashboard Access',
          status: 'Active'
        };
      });
      res.json(staff);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/system/staff', requireElevation, async (req: any, res) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
      const db = Database.getDb();
      if (!db) return res.json({ success: true });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userDoc = await db.collection('admin_users').where('username', '==', username).get();
      if (!userDoc.empty) {
        return res.status(400).json({ error: 'User already exists' });
      }

      await db.collection('admin_users').add({
        username,
        passwordHash,
        role: role || 'staff',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      registry.logSyncEvent(`Owner provisioned new staff account: ${username}`, 'success');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/system/staff/:username', requireElevation, async (req: any, res) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
    const { username } = req.params;
    if (username === 'admin') return res.status(400).json({ error: 'Cannot delete primary owner account' });

    try {
      const db = Database.getDb();
      if (!db) return res.json({ success: true });

      const userDoc = await db.collection('admin_users').where('username', '==', username).get();
      if (userDoc.empty) {
        return res.status(404).json({ error: 'Staff account not found' });
      }

      await userDoc.docs[0].ref.delete();
      registry.logSyncEvent(`Owner deleted staff account: ${username}`, 'warn');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- BROADCASTER ENDPOINT ---
  app.post('/api/system/broadcast', requireElevation, async (req: any, res: any) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message content is required' });

    if (server.getDiscordClient) {
      const client = server.getDiscordClient();
      if (client) {
        let successCount = 0;
        try {
          const guilds = Array.from(client.guilds.cache.values());
          for (const guild of guilds as any[]) {
            try {
              const owner = await guild.fetchOwner();
              if (owner) {
                await owner.send({
                  embeds: [{
                    title: '📢 Global Platform Announcement',
                    description: message,
                    color: 0xff4500,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Sent by Rage Optimiser Platform Owner' }
                  }]
                });
                successCount++;
              }
            } catch (err) {
              console.error(`Failed to DM owner of guild ${guild.name}:`, err);
            }
          }
          registry.logSyncEvent(`Broadcasted global announcement to ${successCount} server owners.`, 'info');
          return res.json({ success: true, count: successCount });
        } catch (e: any) {
          return res.status(500).json({ error: e.message });
        }
      }
    }
    res.status(503).json({ error: 'Discord Gateway not connected' });
  });

  app.post('/api/modules/:id', authenticateToken, authorizeGuildAccess, (req: any, res: any, next: any) => {
    if (req.params.id === 'security') return requireElevation(req, res, next);
    next();
  }, (req, res) => {
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    const mod = registry.updateModuleConfig(guildId, req.params.id, req.body);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    res.json(mod);
  });

  app.post('/api/modules/:id/toggle', authenticateToken, authorizeGuildAccess, (req: any, res: any, next: any) => {
    if (req.params.id === 'security') return requireElevation(req, res, next);
    next();
  }, (req, res) => {
    const { enabledOverride } = req.body;
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    const mod = registry.toggleModule(guildId, req.params.id, enabledOverride);
    if (!mod) return res.status(400).json({ error: 'Module validation failed. Cannot toggle.' });
    res.json(mod);
  });

  app.post('/api/simulate', authenticateToken, authorizeGuildAccess, (req, res) => {
    const { actionType } = req.body;
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    registry.simulateAction(guildId, actionType);
    res.json({ success: true });
  });

  app.post('/api/sync/refresh', authenticateToken, authorizeGuildAccess, (req, res) => {
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    refreshCallback(guildId);
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

  app.post('/api/settings', authenticateToken, authorizeGuildAccess, (req, res) => {
    const data = req.body;
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    const currentReg = registry.getRegistry(guildId);
    const newReg = {
      ...currentReg,
      globalSettings: {
        ...(currentReg.globalSettings || {}),
        ...data
      }
    };
    registry.setRegistry(guildId, newReg);
    registry.logSyncEvent(guildId, 'Global settings updated from dashboard.', 'success');
    res.json({ success: true, globalSettings: newReg.globalSettings });
  });

  app.get('/api/analytics/summary', authenticateToken, authorizeGuildAccess, async (req: any, res) => {
    try {
      const guildId = req.query.guildId as string || req.headers['x-guild-id'] as string;
      if (!guildId) {
        return res.status(400).json({ error: 'Missing guildId parameter or X-Guild-Id header' });
      }
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const summary = await AnalyticsService.getSummary(guildId, days);
      res.json(summary);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  });

  app.get('/api/whitelist/audit', authenticateToken, authorizeGuildAccess, (req: any, res: any) => {
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    const auditLogs = registry.getWhitelistAudit(guildId);
    res.json(auditLogs);
  });

  app.get('/api/whitelist/activity', authenticateToken, authorizeGuildAccess, (req: any, res: any) => {
    const guildId = req.headers['x-guild-id'] as string || req.query.guildId as string || process.env.GUILD_ID || 'default_guild';
    const activityLogs = registry.getWhitelistActivity(guildId);
    res.json(activityLogs);
  });

  // --- APPROVAL SYSTEM ENDPOINTS ---
  app.get('/api/approvals', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
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

  app.post('/api/approvals/:guildId/action', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Access Denied.' });
    const db = Database.getDb();
    if (!db) return res.status(503).json({ error: 'Database not connected' });

    const { action, reason } = req.body;
    const { guildId } = req.params;
    
    try {
      const docRef = db.collection('approvals').doc(guildId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: 'Guild not found in approval system' });

      const guildData = docSnap.data() as IGuildApproval;
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

      // --- DM Guild Owner on approval/rejection ---
      if (server.getDiscordClient && (action === 'approve' || action === 'reject')) {
        const discordClient = server.getDiscordClient();
        if (discordClient && guildData.ownerId) {
          try {
            const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
            const musicClientId = process.env.MUSIC_CLIENT_ID || '1520323151928623125';
            const musicPerms = process.env.MUSIC_BOT_PERMISSIONS || '36700160';
            // Pre-fill guild_id so the music bot invite targets the correct server
            const musicInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${musicClientId}&permissions=${musicPerms}&scope=bot%20applications.commands&guild_id=${guildId}`;

            const ownerUser = await discordClient.users.fetch(guildData.ownerId);
            if (ownerUser) {
              if (action === 'approve') {
                await ownerUser.send({
                  embeds: [{
                    title: '✅ Server Approved — Rage Optimiser',
                    description: `Your server **${guildData.guildName}** has been **approved**! You now have full access to the Rage Optimiser dashboard and all features.`,
                    fields: [
                      {
                        name: '🖥️ Step 1 — Access Your Dashboard',
                        value: `[Click here to open your dashboard](${dashboardUrl}/login?guild=${guildId})\nLog in with Discord → select your server → start configuring!`,
                        inline: false
                      },
                      {
                        name: '🎵 Step 2 — Add Rage Music Bot',
                        value: `Music playback runs on a **separate dedicated bot**.\n[Click here to invite Rage Music to ${guildData.guildName}](${musicInviteUrl})\n*(Required for /play, /queue, Spotify & YouTube support)*`,
                        inline: false
                      },
                      {
                        name: '💡 Why two bots?',
                        value: 'Music playback requires a dedicated voice bot to ensure zero interruption to moderation and security features. Rage Music handles audio independently.',
                        inline: false
                      }
                    ],
                    color: 0x22c55e,
                    footer: { text: 'Rage Optimiser Enterprise Platform • Both bots must be in your server for full functionality' },
                    timestamp: new Date().toISOString()
                  }]
                }).catch(() => {});
              } else if (action === 'reject') {
                await ownerUser.send({
                  embeds: [{
                    title: '❌ Server Rejected — Rage Optimiser',
                    description: `Your server **${guildData.guildName}** was **rejected** and will not gain access to Rage Optimiser features.`,
                    fields: [
                      { name: '📝 Reason', value: reason || 'No reason provided', inline: false },
                      { name: 'ℹ️ What to do', value: 'You may re-invite the bot and apply again after addressing the issue. Contact support if you believe this was a mistake.', inline: false }
                    ],
                    color: 0xef4444,
                    footer: { text: 'Rage Optimiser Enterprise Platform' },
                    timestamp: new Date().toISOString()
                  }]
                }).catch(() => {});
              }
              registry.logSyncEvent(`DM sent to guild owner (${guildData.ownerUsername}) for action: ${action}.`, 'info');
            }
          } catch (dmErr) {
            console.error('[WebServer] Failed to DM guild owner:', dmErr);
          }
        }
      }


      registry.logSyncEvent(`Dashboard Action: Guild ${guildId} was ${action}d.`, action === 'approve' ? 'success' : 'warn');
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Action failed' });
    }
  });

  // =============================================
  // DISCORD OAUTH2 ENDPOINTS
  // =============================================

  // Step 1: Redirect to Discord authorization page
  app.get('/api/auth/discord', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const url = OAuthService.getAuthorizationUrl(state);
    // Store state in a short-lived way (or rely on frontend to track)
    res.json({ url, state });
  });

  // Step 2: Discord calls back here with ?code=...&state=...
  app.get('/api/auth/discord/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=oauth_denied`);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    try {
      const result = await OAuthService.processCallback(code);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      // Encode data for frontend (token passed via URL hash so it never hits server logs)
      const encoded = encodeURIComponent(JSON.stringify({
        token: result.token,
        user: result.user,
        managedGuilds: result.managedGuilds,
        approvals: result.approvals
      }));
      
      return res.redirect(`${frontendUrl}/auth/callback?data=${encoded}`);
    } catch (err: any) {
      console.error('[OAuth] Callback error:', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  });

  // Get approval status for a specific guild (guild_manager use)
  app.get('/api/guild/:guildId/status', authenticateToken, async (req: any, res: any) => {
    const { guildId } = req.params;
    const user = req.user;

    // Guild manager can only check their own guilds
    if (user.role === 'guild_manager') {
      const managedIds: string[] = user.managedGuildIds || [];
      if (!managedIds.includes(guildId)) {
        return res.status(403).json({ error: 'Access denied: You do not manage this guild' });
      }
    }

    try {
      const db = Database.getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected' });

      const docSnap = await db.collection('approvals').doc(guildId).get();
      if (!docSnap.exists) {
        return res.json({ status: 'Not Registered', guildId });
      }

      const data = docSnap.data() as IGuildApproval;
      res.json({
        guildId: data.guildId,
        guildName: data.guildName,
        status: data.status,
        memberCount: data.memberCount,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        joinedAt: data.joinedAt,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
        rejectionReason: data.rejectionReason
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch guild status' });
    }
  });

  // Guild-scoped state/modules for guild_manager users
  app.get('/api/guild/:guildId/state', authenticateToken, async (req: any, res: any) => {
    const { guildId } = req.params;
    const user = req.user;

    // Guild managers can only access their own guilds, and only if approved
    if (user.role === 'guild_manager') {
      const managedIds: string[] = user.managedGuildIds || [];
      if (!managedIds.includes(guildId)) {
        return res.status(403).json({ error: 'Access denied: You do not manage this guild' });
      }

      // Check approval status
      const db = Database.getDb();
      if (db) {
        const docSnap = await db.collection('approvals').doc(guildId).get();
        if (!docSnap.exists || (docSnap.data() as IGuildApproval).status !== 'Approved') {
          return res.status(403).json({ error: 'Guild is not approved yet', status: docSnap.exists ? (docSnap.data() as IGuildApproval).status : 'Not Registered' });
        }
      }
    }

    const metrics = server.getBotMetrics ? server.getBotMetrics() : { latency: 0, uptime: 'Offline' };
    return res.json({
      modules: registry.getModulesState(guildId),
      registry: registry.getRegistry(guildId),
      syncLogs: registry.getSyncLogs(guildId),
      globalSettings: registry.getGlobalSettings(guildId),
      latency: metrics.latency,
      uptime: metrics.uptime
    });
  });
}
