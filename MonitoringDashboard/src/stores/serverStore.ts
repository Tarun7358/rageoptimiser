import { create } from 'zustand';

export interface GuildServer {
  id: string;
  name: string;
  memberCount: number;
  onlineMembers: number;
  commandsToday: number;
  eventsToday: number;
  health: 'healthy' | 'warning' | 'degraded';
  activeAlertsCount: number;
}

interface ServerState {
  servers: GuildServer[];
  setServers: (servers: GuildServer[]) => void;
  recordServerActivity: (guildId: string, guildName: string, isCommand: boolean) => void;
  clearServers: () => void;
}

// Initial mock servers matching actual user context (Clutch Nation, Tamil Aura, etc.)
const initialServers: GuildServer[] = [];

export const useServerStore = create<ServerState>((set) => ({
  servers: initialServers,
  setServers: (servers) =>
    set((state) => {
      const merged = servers.map((newS) => {
        const existing = state.servers.find((s) => s.id === newS.id);
        if (existing) {
          return {
            ...newS,
            commandsToday: existing.commandsToday || newS.commandsToday,
            eventsToday: existing.eventsToday || newS.eventsToday,
            activeAlertsCount: existing.activeAlertsCount || newS.activeAlertsCount,
            health: existing.health || newS.health,
          };
        }
        return newS;
      });
      return { servers: merged };
    }),
  recordServerActivity: (guildId, guildName, isCommand) =>
    set((state) => {
      const serverExists = state.servers.some((s) => s.id === guildId);

      if (!serverExists) {
        // Dynamically add new server if not present
        const newServer: GuildServer = {
          id: guildId,
          name: guildName,
          memberCount: 100,
          onlineMembers: 20,
          commandsToday: isCommand ? 1 : 0,
          eventsToday: 1,
          health: 'healthy',
          activeAlertsCount: 0,
        };
        return { servers: [...state.servers, newServer] };
      }

      return {
        servers: state.servers.map((s) => {
          if (s.id === guildId) {
            return {
              ...s,
              name: guildName, // Keep name synchronized
              commandsToday: isCommand ? s.commandsToday + 1 : s.commandsToday,
              eventsToday: s.eventsToday + 1,
            };
          }
          return s;
        }),
      };
    }),
  clearServers: () => set({ servers: [] }),
}));
