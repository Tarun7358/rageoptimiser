import { ModuleState, DiscordResourceRegistry, ModuleManifest, LogEntry } from './types.js';
import { Database } from './Database.js';


export class ModuleRegistry {
  private guildStates: Map<string, {
    modules: ModuleState[];
    registry: DiscordResourceRegistry;
    syncLogs: LogEntry[];
    globalSettings: Record<string, any>;
    whitelistAudit: any[];
    whitelistActivity: any[];
  }> = new Map();

  private manifests: Map<string, ModuleManifest> = new Map();

  constructor(
    private broadcast: (msg: any) => void
  ) {
    // Eagerly load the default guild state
    const defaultGuildId = process.env.GUILD_ID || 'default_guild';
    this.getGuildState(defaultGuildId);
  }

  public registerModule(manifest: ModuleManifest) {
    this.manifests.set(manifest.id, manifest);
  }

  private unsubscribeMap: Map<string, () => void> = new Map();

  private fillManifestModules(modules: ModuleState[]) {
    this.manifests.forEach(manifest => {
      if (!modules.find(m => m.id === manifest.id)) {
        modules.push({
          id: manifest.id,
          name: manifest.name,
          status: 'enabled',
          progress: 0,
          errors: [],
          config: {}
        });
      }
    });
  }

  public getGuildState(guildId?: string) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const cached = this.guildStates.get(id);

    // If already loaded in-memory and has a live listener, return from cache immediately
    if (cached && this.unsubscribeMap.has(id)) {
      return cached;
    }

    // 1. Initialize default state structure if not present
    let state = cached;
    if (!state) {
      state = {
        modules: this.createDefaultModulesState(),
        registry: this.getDefaultRegistry(),
        syncLogs: [],
        globalSettings: { maintenanceMode: false },
        whitelistAudit: [],
        whitelistActivity: []
      };
      this.guildStates.set(id, state);
      this.fillManifestModules(state.modules);
    }

    // 2. Setup real-time Firestore listener if not already active
    const db = Database.getDb();
    if (db && !this.unsubscribeMap.has(id)) {
      const docRef = db.collection('guild_configs').doc(id);

      const unsubscribe = docRef.onSnapshot((doc) => {
        if (doc.exists) {
          const dbData = doc.data();
          const current = this.guildStates.get(id);
          if (current && dbData) {
            // Keep status as enabled as required by the "default-enabled" policy
            current.modules = (dbData.modules || current.modules).map((m: any) => {
              const existing = current.modules.find((cm) => cm.id === m.id);
              return {
                ...m,
                status: 'enabled',
                progress: existing?.progress ?? m.progress ?? 0,
                errors: existing?.errors ?? m.errors ?? []
              };
            });
            current.globalSettings = dbData.globalSettings || current.globalSettings;
            
            if (dbData.whitelistAudit) current.whitelistAudit = dbData.whitelistAudit;
            if (dbData.whitelistActivity) current.whitelistActivity = dbData.whitelistActivity;

            // Ensure manifest entries exist
            this.fillManifestModules(current.modules);

            // Synchronize legacy upmSnapshot metadata from upm_snapshots collection if missing
            const secMod = current.modules.find((m: any) => m.id === 'security');
            if (secMod && secMod.config && !secMod.config.upmSnapshot) {
              db.collection('upm_snapshots').doc(id).get().then((snapDoc) => {
                if (snapDoc.exists) {
                  const snap = snapDoc.data();
                  if (snap) {
                    secMod.config.upmSnapshot = {
                      timestamp: snap.timestamp,
                      channelsCount: snap.channels?.length || 0,
                      rolesCount: snap.roles?.length || 0
                    };
                    this.reevaluateAllModules(id);
                    this.broadcast({ type: 'STATE_UPDATE', modules: current.modules, registry: current.registry, guildId: id });
                  }
                }
              }).catch(e => console.error(`Failed to load legacy upmSnapshot from db for guild ${id}:`, e));
            }

            this.reevaluateAllModules(id);
            this.broadcast({ type: 'STATE_UPDATE', modules: current.modules, registry: current.registry, guildId: id });
          }
        } else {
          // Initialize document in Firestore for new guild
          db.collection('guild_configs').doc(id).set(state).catch(e => console.error(`Firestore save failed for new guild ${id}:`, e));
        }
      }, (error) => {
        console.error(`Firestore real-time listener error for guild ${id}:`, error);
      });

      this.unsubscribeMap.set(id, unsubscribe);
    }

    return state;
  }

  public getModulesState(guildId?: string): ModuleState[] {
    return this.getGuildState(guildId).modules;
  }

  public getRegistry(guildId?: string): DiscordResourceRegistry {
    return this.getGuildState(guildId).registry;
  }

  public setRegistry(guildId: string | undefined, reg: DiscordResourceRegistry) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    state.registry = reg;
  }

  public getSyncLogs(guildId?: string): LogEntry[] {
    return this.getGuildState(guildId).syncLogs;
  }

  public logSyncEvent(msgOrGuildId: string | undefined, msgOrType?: string, type?: 'info' | 'warn' | 'success') {
    let finalGuildId: string | undefined = undefined;
    let finalMsg = '';
    let finalType: 'info' | 'warn' | 'success' = 'info';

    if (type !== undefined) {
      finalGuildId = msgOrGuildId;
      finalMsg = msgOrType || '';
      finalType = type;
    } else {
      finalMsg = msgOrGuildId || '';
      finalType = (msgOrType as any) || 'info';
    }

    const id = finalGuildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    const time = new Date().toTimeString().split(' ')[0];
    const log: LogEntry = { time, msg: finalMsg, type: finalType };
    state.syncLogs.unshift(log);
    if (state.syncLogs.length > 100) state.syncLogs.pop();
    this.broadcast({ type: 'SYNC_LOG', log, guildId: id });
  }

  public getWhitelistAudit(guildId?: string): any[] {
    return this.getGuildState(guildId).whitelistAudit || [];
  }

  public getWhitelistActivity(guildId?: string): any[] {
    return this.getGuildState(guildId).whitelistActivity || [];
  }

  public logWhitelistAudit(guildId: string | undefined, audit: any) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    if (!state.whitelistAudit) state.whitelistAudit = [];
    state.whitelistAudit.unshift(audit);
    if (state.whitelistAudit.length > 200) state.whitelistAudit.pop();
  }

  public logWhitelistActivity(guildId: string | undefined, activity: any) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    if (!state.whitelistActivity) state.whitelistActivity = [];
    state.whitelistActivity.unshift(activity);
    if (state.whitelistActivity.length > 200) state.whitelistActivity.pop();
  }

  public getGlobalSettings(guildId?: string) {
    return this.getGuildState(guildId).globalSettings;
  }

  public setGlobalSettings(guildId: string | undefined, settings: Record<string, any>) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    state.globalSettings = { ...state.globalSettings, ...settings };
    this.saveGuildState(id, state);
    this.broadcast({ type: 'GLOBAL_SETTINGS_UPDATE', settings: state.globalSettings, guildId: id });
  }

  public reevaluateAllModules(guildId?: string) {
    const id = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(id);
    
    state.modules.forEach(mod => {
      const manifest = this.manifests.get(mod.id);
      if (manifest) {
        if (!manifest.configSchema) {
          console.error(`FATAL: Manifest for ${mod.id} is missing configSchema!`);
          return;
        }
        const { progress, errors } = manifest.configSchema.validate(mod.config, state.registry);
        mod.progress = progress;
        mod.errors = errors;

        // Lifecycle transition rules
        mod.status = 'enabled';
      }
    });
  }

  public updateModuleConfig(guildId: string | undefined, id: string, config: Record<string, any>): ModuleState | null {
    const gId = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(gId);
    const mod = state.modules.find(m => m.id === id);
    if (!mod) return null;

    mod.config = { ...mod.config, ...config };
    this.reevaluateAllModules(gId);
    this.saveGuildState(gId, state);
    this.broadcast({ type: 'STATE_UPDATE', modules: state.modules, registry: state.registry, guildId: gId });
    return mod;
  }

  public toggleModule(guildId: string | undefined, id: string, enabledOverride?: boolean): ModuleState | null {
    const gId = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(gId);
    const mod = state.modules.find(m => m.id === id);
    if (!mod) return null;

    if (enabledOverride !== undefined) {
      // Explicit override: true = enabled, false = disabled
      mod.status = enabledOverride ? 'enabled' : 'disabled';
    } else {
      // Flip current state
      mod.status = mod.status === 'enabled' ? 'disabled' : 'enabled';
    }

    this.saveGuildState(gId, state);
    this.broadcast({ type: 'STATE_UPDATE', modules: state.modules, registry: state.registry, guildId: gId });
    return mod;
  }

  public simulateAction(guildId: string | undefined, actionType: string) {
    const gId = guildId || process.env.GUILD_ID || 'default_guild';
    const state = this.getGuildState(gId);

    if (actionType === 'delete_role') {
      const len = state.registry.roles.length;
      state.registry.roles = state.registry.roles.filter(r => r.id !== 'r-5'); // Delete Verified Member
      if (state.registry.roles.length < len) {
        this.logSyncEvent(gId, 'Simulation: Deleted Role "Verified Member" (ID: r-5) inside Discord.', 'warn');
      }
    } else if (actionType === 'delete_channel') {
      const len = state.registry.channels.length;
      state.registry.channels = state.registry.channels.filter(c => c.id !== 'c-3'); // Delete audit-logs
      if (state.registry.channels.length < len) {
        this.logSyncEvent(gId, 'Simulation: Deleted Channel "audit-logs" (ID: c-3) inside Discord.', 'warn');
      }
    } else if (actionType === 'rename_channel') {
      const chan = state.registry.channels.find(c => c.id === 'c-2');
      if (chan) {
        const old = chan.name;
        chan.name = 'mod-chat-renamed';
        this.logSyncEvent(gId, `Simulation: Renamed Channel #${old} to #${chan.name}`, 'info');
      }
    } else if (actionType === 'create_role') {
      state.registry.roles.push({
        id: `r-${Date.now()}`,
        name: 'New Dynamic Role',
        color: '#ff00ff',
        membersCount: 1,
        permissions: []
      });
      this.logSyncEvent(gId, 'Simulation: Created new role "New Dynamic Role" in Discord server.', 'success');
    }

    this.reevaluateAllModules(gId);
    this.broadcast({ type: 'STATE_UPDATE', modules: state.modules, registry: state.registry, guildId: gId });
  }

  private saveGuildStateLocally(_guildId: string, _state: any) {
    // Local file storage removed — Firestore is the only persistent storage
  }

  public saveGuildState(guildId: string, state: any) {
    this.saveGuildStateLocally(guildId, state);
    const db = Database.getDb();
    if (db) {
      // Save only persistent configurations and states to Firestore to prevent quota exhaustion
      const persistentState = {
        modules: state.modules.map((m: any) => ({
          id: m.id,
          name: m.name,
          status: m.status,
          config: m.config || {}
        })),
        globalSettings: state.globalSettings || {}
      };
      db.collection('guild_configs').doc(guildId).set(persistentState).catch(e => console.error(`Firestore save failed for guild ${guildId}:`, e));
    }
  }

  private createDefaultModulesState(): ModuleState[] {
    const states: ModuleState[] = [];
    this.manifests.forEach(manifest => {
      states.push({
        id: manifest.id,
        name: manifest.name,
        status: 'enabled',
        progress: 0,
        errors: [],
        config: {}
      });
    });
    return states;
  }

  private getDefaultRegistry(): DiscordResourceRegistry {
    return {
      roles: [
        { id: 'r-1', name: 'Server Owner', color: '#ff4444', membersCount: 1, permissions: ['ADMINISTRATOR'], position: 1 },
        { id: 'r-2', name: 'Co-Owner', color: '#ff8800', membersCount: 2, permissions: ['ADMINISTRATOR'], position: 2 },
        { id: 'r-3', name: 'Moderator Staff', color: '#33ccff', membersCount: 8, permissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MANAGE_MESSAGES'], position: 3 },
        { id: 'r-4', name: 'Community Assistant', color: '#99ff33', membersCount: 14, permissions: ['MANAGE_MESSAGES'], position: 4 },
        { id: 'r-5', name: 'Verified Member', color: '#5533ff', membersCount: 842, permissions: [], position: 5 },
        { id: 'r-6', name: 'Muted Quarantine', color: '#555555', membersCount: 0, permissions: [], position: 6 }
      ],
      channels: [
        { id: 'c-1', name: 'general-chat', type: 'text', category: 'TEXT CHANNELS', permissions: [] },
        { id: 'c-2', name: 'staff-discussion', type: 'text', category: 'STAFF ONLY', permissions: [] },
        { id: 'c-3', name: 'audit-logs', type: 'text', category: 'STAFF ONLY', permissions: [] },
        { id: 'c-4', name: 'security-alerts', type: 'text', category: 'STAFF ONLY', permissions: [] },
        { id: 'c-5', name: 'welcome-lobby', type: 'text', category: 'WELCOME', permissions: [] },
        { id: 'c-6', name: 'Support Tickets', type: 'category', category: '', permissions: [] }
      ],
      emojis: [],
      stickers: [],
      lastSyncTime: 'Just now'
    };
  }
}

