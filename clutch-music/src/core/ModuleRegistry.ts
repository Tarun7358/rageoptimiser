import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModuleState, DiscordResourceRegistry, ModuleManifest, LogEntry } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../../backend/src/database.json');

export class ModuleRegistry {
  private modules: ModuleState[] = [];
  private registry!: DiscordResourceRegistry;
  private syncLogs: LogEntry[] = [];
  private manifests: Map<string, ModuleManifest> = new Map();
  private globalSettings: Record<string, any> = { maintenanceMode: false };

  constructor(
    private broadcast: (msg: any) => void
  ) {
    this.loadDatabase();
  }

  public registerModule(manifest: ModuleManifest) {
    this.manifests.set(manifest.id, manifest);
    
    // Add default state structure if not present in loaded database
    let modState = this.modules.find(m => m.id === manifest.id);
    if (!modState) {
      modState = {
        id: manifest.id,
        name: manifest.name,
        status: 'not_configured',
        progress: 0,
        errors: [],
        config: {}
      };
      this.modules.push(modState);
    }
  }

  public getModulesState(): ModuleState[] {
    return this.modules;
  }

  public getRegistry(): DiscordResourceRegistry {
    return this.registry;
  }

  public setRegistry(reg: DiscordResourceRegistry) {
    this.registry = reg;
    this.saveDatabase();
  }

  public getSyncLogs(): LogEntry[] {
    return this.syncLogs;
  }

  public logSyncEvent(msg: string, type: 'info' | 'warn' | 'success' = 'info') {
    const time = new Date().toTimeString().split(' ')[0];
    const log: LogEntry = { time, msg, type };
    this.syncLogs.unshift(log);
    if (this.syncLogs.length > 100) this.syncLogs.pop();
    this.saveDatabase();
    this.broadcast({ type: 'SYNC_LOG', log });
  }

  public getGlobalSettings() {
    return this.globalSettings;
  }

  public setGlobalSettings(settings: Record<string, any>) {
    this.globalSettings = { ...this.globalSettings, ...settings };
    this.saveDatabase();
    this.broadcast({ type: 'GLOBAL_SETTINGS_UPDATE', settings: this.globalSettings });
  }

  public reevaluateAllModules() {
    this.modules.forEach(mod => {
      const manifest = this.manifests.get(mod.id);
      if (manifest) {
        if (!manifest.configSchema) {
          console.error(`FATAL: Manifest for ${mod.id} is missing configSchema!`);
        }
        const { progress, errors } = manifest.configSchema.validate(mod.config, this.registry);
        mod.progress = progress;
        mod.errors = errors;

        // Lifecycle transition rules
        if (errors.length > 0) {
          mod.status = 'validation_failed';
        } else if (progress >= 100) {
          if (mod.status === 'not_configured' || mod.status === 'validation_failed') {
            mod.status = 'ready';
          }
        } else {
          mod.status = 'not_configured';
        }
      }
    });
    this.saveDatabase();
  }

  public updateModuleConfig(id: string, config: Record<string, any>): ModuleState | null {
    const mod = this.modules.find(m => m.id === id);
    if (!mod) return null;

    mod.config = { ...mod.config, ...config };
    this.reevaluateAllModules();
    this.broadcast({ type: 'STATE_UPDATE', modules: this.modules, registry: this.registry });
    return mod;
  }

  public toggleModule(id: string, enabledOverride?: boolean): ModuleState | null {
    const mod = this.modules.find(m => m.id === id);
    if (!mod) return null;

    const targetEnabled = enabledOverride !== undefined ? enabledOverride : (mod.status !== 'enabled');

    if (targetEnabled) {
      if (mod.progress < 100 || mod.errors.length > 0) {
        return null;
      }
      mod.status = 'enabled';
      this.logSyncEvent(`Module "${mod.name}" was activated (Status: running).`, 'success');
    } else {
      mod.status = 'ready';
      this.logSyncEvent(`Module "${mod.name}" was deactivated (Status: paused).`, 'warn');
    }

    this.saveDatabase();
    this.broadcast({ type: 'STATE_UPDATE', modules: this.modules, registry: this.registry });
    return mod;
  }

  public simulateAction(actionType: string) {
    if (actionType === 'delete_role') {
      const len = this.registry.roles.length;
      this.registry.roles = this.registry.roles.filter(r => r.id !== 'r-5'); // Delete Verified Member
      if (this.registry.roles.length < len) {
        this.logSyncEvent('Simulation: Deleted Role "Verified Member" (ID: r-5) inside Discord.', 'warn');
      }
    } else if (actionType === 'delete_channel') {
      const len = this.registry.channels.length;
      this.registry.channels = this.registry.channels.filter(c => c.id !== 'c-3'); // Delete audit-logs
      if (this.registry.channels.length < len) {
        this.logSyncEvent('Simulation: Deleted Channel "audit-logs" (ID: c-3) inside Discord.', 'warn');
      }
    } else if (actionType === 'rename_channel') {
      const chan = this.registry.channels.find(c => c.id === 'c-2');
      if (chan) {
        const old = chan.name;
        chan.name = 'mod-chat-renamed';
        this.logSyncEvent(`Simulation: Renamed Channel #${old} to #${chan.name}`, 'info');
      }
    } else if (actionType === 'create_role') {
      this.registry.roles.push({
        id: `r-${Date.now()}`,
        name: 'New Dynamic Role',
        color: '#ff00ff',
        membersCount: 1,
        permissions: []
      });
      this.logSyncEvent('Simulation: Created new role "New Dynamic Role" in Discord server.', 'success');
    }

    this.reevaluateAllModules();
    this.broadcast({ type: 'STATE_UPDATE', modules: this.modules, registry: this.registry });
  }

  private loadDatabase() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const data = JSON.parse(raw);
        this.modules = data.modules || [];
        this.registry = data.registry || this.getDefaultRegistry();
        this.syncLogs = data.syncLogs || [];
        this.globalSettings = data.globalSettings || { maintenanceMode: false };
      } else {
        this.registry = this.getDefaultRegistry();
        this.saveDatabase();
      }
    } catch (err) {
      console.error('Failed to load database.json:', err);
      this.registry = this.getDefaultRegistry();
    }
  }

  public saveDatabase() {
    // Clutch Music Bot: Read-only access to prevent race conditions with Core Backend.
    // Sync logs are pushed via HTTP, config updates are made via Dashboard/Core.
  }

  private getDefaultRegistry(): DiscordResourceRegistry {
    return {
      roles: [
        { id: 'r-1', name: 'Server Owner', color: '#ff4444', membersCount: 1, permissions: ['ADMINISTRATOR'] },
        { id: 'r-2', name: 'Co-Owner', color: '#ff8800', membersCount: 2, permissions: ['ADMINISTRATOR'] },
        { id: 'r-3', name: 'Moderator Staff', color: '#33ccff', membersCount: 8, permissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MANAGE_MESSAGES'] },
        { id: 'r-4', name: 'Community Assistant', color: '#99ff33', membersCount: 14, permissions: ['MANAGE_MESSAGES'] },
        { id: 'r-5', name: 'Verified Member', color: '#5533ff', membersCount: 842, permissions: [] },
        { id: 'r-6', name: 'Muted Quarantine', color: '#555555', membersCount: 0, permissions: [] }
      ],
      channels: [
        { id: 'c-1', name: 'general-chat', type: 'text', category: 'TEXT CHANNELS' },
        { id: 'c-2', name: 'staff-discussion', type: 'text', category: 'STAFF ONLY' },
        { id: 'c-3', name: 'audit-logs', type: 'text', category: 'STAFF ONLY' },
        { id: 'c-4', name: 'security-alerts', type: 'text', category: 'STAFF ONLY' },
        { id: 'c-5', name: 'welcome-lobby', type: 'text', category: 'WELCOME' },
        { id: 'c-6', name: 'Support Tickets', type: 'category', category: '' }
      ],
      emojis: [],
      stickers: [],
      lastSyncTime: 'Just now'
    };
  }
}
