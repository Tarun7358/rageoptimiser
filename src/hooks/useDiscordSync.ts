import { useState, useEffect, useRef } from 'react';

// Interfaces for synchronized resources
export interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  membersCount: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'category' | 'announcement' | 'stage' | 'forum' | 'thread';
  category?: string;
  permissions: string[];
}

export interface DiscordResourceRegistry {
  roles: DiscordRole[];
  channels: DiscordChannel[];
  emojis: { name: string; url: string }[];
  stickers: { name: string; url: string }[];
  lastSyncTime: string;
  memberCount?: number;
  onlineCount?: number;
}

export interface ModuleState {
  id: string;
  name: string;
  status: 'not_configured' | 'config_required' | 'validation_failed' | 'ready' | 'enabled' | 'error';
  progress: number; // 0 - 100
  errors: string[];
  config: Record<string, any>;
  connectionStatus?: string;
  connectedChannelId?: string | null;
  connectionDuration?: string;
  reconnectAttempts?: number;
  voiceGatewayStatus?: string;
}

// Initial empty/zero configurations representing Zero Operational Defaults
export const INITIAL_MODULES: ModuleState[] = [
  { id: 'security', name: 'Security Guard', status: 'config_required', progress: 0, errors: ['No Quarantine Role selected', 'No alert channel configured', 'No exceptions defined'], config: {} },
  { id: 'moderation', name: 'Moderation Console', status: 'config_required', progress: 0, errors: ['No Log Channel configured', 'No Moderator Roles selected'], config: {} },
  { id: 'community', name: 'Community Hub', status: 'config_required', progress: 0, errors: ['No Welcome Channel selected', 'No reaction role templates configured'], config: {} },
  { id: 'tickets', name: 'Ticket Management', status: 'config_required', progress: 0, errors: ['No Support Category specified', 'No Claimed Staff Roles selected'], config: {} },
  { id: 'verification', name: 'Verification Gate', status: 'config_required', progress: 0, errors: ['No Verified Member role selected', 'No Unverified Role selected'], config: {} },
  { id: 'logging', name: 'System Logs Timeline', status: 'config_required', progress: 0, errors: ['No central log channel configured'], config: {} },
  { id: 'backups', name: 'Backup Hub', status: 'config_required', progress: 0, errors: ['No status notification channel configured'], config: {} },
  { id: 'automation', name: 'Automation Studio', status: 'config_required', progress: 0, errors: ['No default Auto Roles configured'], config: {} },
  { id: 'voice', name: 'Voice Presence', status: 'config_required', progress: 0, errors: ['No dedicated voice channel configured'], config: {} },
  { id: 'bot_whitelist', name: 'Bot Whitelist', status: 'not_configured', progress: 0, errors: [], config: {} },
  { id: 'member_whitelist', name: 'Member Whitelist', status: 'not_configured', progress: 0, errors: [], config: {} },
  { id: 'role_whitelist', name: 'Role Whitelist', status: 'not_configured', progress: 0, errors: [], config: {} },
  { id: 'reaction_roles', name: 'Reaction Roles', status: 'not_configured', progress: 100, errors: [], config: {} },
  { id: 'leveling', name: 'Leveling & XP', status: 'not_configured', progress: 100, errors: [], config: {} },
  { id: 'automod', name: 'AI Automod', status: 'not_configured', progress: 0, errors: [], config: {} },
  { id: 'music', name: 'Music System', status: 'not_configured', progress: 0, errors: [], config: {} },
  { id: 'discord-dashboard', name: 'Discord Dashboard', status: 'config_required', progress: 0, errors: ['No target channel configured'], config: {} }
];

export function useDiscordSync() {
  // Read auth token directly — re-runs when auth changes
  const [token, setToken] = useState<string | null>(localStorage.getItem('cn_token'));
  const [guildId, setGuildId] = useState<string | null>(localStorage.getItem('cn_active_guild'));

  const [registry, setRegistry] = useState<DiscordResourceRegistry>({
    roles: [],
    channels: [],
    emojis: [],
    stickers: [],
    lastSyncTime: 'Just now'
  });

  const [modules, setModules] = useState<ModuleState[]>(INITIAL_MODULES);
  const [syncLogs, setSyncLogs] = useState<{ time: string; msg: string; type: 'info' | 'warn' | 'success' }[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Record<string, any>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Poll for token and guild changes (login/logout, server select) since localStorage doesn't fire events in-tab
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('cn_token');
      setToken(prev => (prev !== currentToken ? currentToken : prev));

      const currentGuild = localStorage.getItem('cn_active_guild');
      setGuildId(prev => (prev !== currentGuild ? currentGuild : prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch and reconnect WebSocket whenever token or guild ID changes
  useEffect(() => {
    // Close any existing WS connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!token) {
      // Logged out — reset to defaults
      setModules(INITIAL_MODULES);
      setRegistry({ roles: [], channels: [], emojis: [], stickers: [], lastSyncTime: 'Just now' });
      setSyncLogs([]);
      setGlobalSettings({});
      return;
    }

    // Fetch initial HTTP state
    const fetchInitialState = async () => {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`
        };
        if (guildId) {
          headers['X-Guild-Id'] = guildId;
        }
        const res = await fetch('http://localhost:5000/api/state', { headers });
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules);
          setRegistry(data.registry);
          setSyncLogs(data.syncLogs);
          setGlobalSettings(data.globalSettings || {});
        }
      } catch (err) {
        console.error('Failed to load initial state from API server:', err);
      }
    };

    fetchInitialState();

    // Setup live WebSocket channel
    const connectWS = () => {
      const currentToken = localStorage.getItem('cn_token');
      const currentGuild = localStorage.getItem('cn_active_guild');
      if (!currentToken) return;

      const wsUrl = `ws://localhost:5001?token=${currentToken}${currentGuild ? `&guildId=${currentGuild}` : ''}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only process updates that match our selected guild, or generic updates if no guild selected
          if (data.guildId && currentGuild && data.guildId !== currentGuild) {
            return;
          }

          if (data.type === 'INIT') {
            setModules(data.modules);
            setRegistry(data.registry);
            setSyncLogs(data.syncLogs);
            if (data.globalSettings) setGlobalSettings(data.globalSettings);
          } else if (data.type === 'STATE_UPDATE') {
            setModules(data.modules);
            setRegistry(data.registry);
          } else if (data.type === 'SYNC_LOG') {
            setSyncLogs(prev => [data.log, ...prev].slice(0, 100));
          } else if (data.type === 'GLOBAL_SETTINGS_UPDATE') {
            setGlobalSettings(data.settings);
          }
        } catch (e) {
          console.error('WebSocket parsing error:', e);
        }
      };

      socket.onclose = () => {
        // Only auto-reconnect if we still have a valid token
        if (localStorage.getItem('cn_token')) {
          setTimeout(connectWS, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [token, guildId]);


  const addSyncLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    // Add client-side visual log immediately, or rely on WS
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncLogs(prev => [{ time, msg, type }, ...prev]);
  };

  const refreshSync = async () => {
    try {
      const token = localStorage.getItem('cn_token');
      const currentGuild = localStorage.getItem('cn_active_guild');
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      if (currentGuild) {
        headers['X-Guild-Id'] = currentGuild;
      }
      await fetch('http://localhost:5000/api/sync/refresh', { 
        method: 'POST',
        headers
      });
    } catch (err) {
      console.error('Failed to trigger sync refresh:', err);
      addSyncLog('Sync Refresh failed: API server unreachable.', 'warn');
    }
  };

  const updateModuleConfig = async (moduleId: string, newConfig: Record<string, any>, enabledOverride?: boolean) => {
    try {
      const token = localStorage.getItem('cn_token');
      const currentGuild = localStorage.getItem('cn_active_guild');
      const elevatedToken = localStorage.getItem('cn_elevated_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (elevatedToken) headers['X-Elevated-Token'] = elevatedToken;
      if (currentGuild) headers['X-Guild-Id'] = currentGuild;

      // If toggling active status
      if (enabledOverride !== undefined) {
        await fetch(`http://localhost:5000/api/modules/${moduleId}/toggle`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ enabledOverride })
        });
      } else {
        // Just save config fields
        await fetch(`http://localhost:5000/api/modules/${moduleId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(newConfig)
        });
      }
    } catch (err) {
      console.error(`Failed to update config for module ${moduleId}:`, err);
      addSyncLog(`Update failed for ${moduleId}: API server offline.`, 'warn');
    }
  };

  const simulateDiscordAction = async (actionType: 'delete_role' | 'delete_channel' | 'rename_channel' | 'create_role') => {
    try {
      const token = localStorage.getItem('cn_token');
      const currentGuild = localStorage.getItem('cn_active_guild');
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (currentGuild) headers['X-Guild-Id'] = currentGuild;

      await fetch('http://localhost:5000/api/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ actionType })
      });
    } catch (err) {
      console.error('Simulation request failed:', err);
      addSyncLog('Simulation failed: API server offline.', 'warn');
    }
  };

  return {
    registry,
    modules,
    syncLogs,
    globalSettings,
    refreshSync,
    updateModuleConfig,
    simulateDiscordAction,
    addSyncLog
  };
}
