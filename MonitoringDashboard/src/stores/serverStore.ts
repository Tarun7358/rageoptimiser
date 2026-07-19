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
const initialServers: GuildServer[] = [
  {
    id: '8749204058302058',
    name: 'Clutch Nation Official',
    memberCount: 12400,
    onlineMembers: 3120,
    commandsToday: 184,
    eventsToday: 2450,
    health: 'healthy',
    activeAlertsCount: 0,
  },
  {
    id: '9204859302059302',
    name: 'Tamil Aura Guild',
    memberCount: 5820,
    onlineMembers: 1450,
    commandsToday: 95,
    eventsToday: 1100,
    health: 'warning',
    activeAlertsCount: 1,
  },
  {
    id: '1294820593020592',
    name: 'Rage Optimiser Support',
    memberCount: 2450,
    onlineMembers: 840,
    commandsToday: 42,
    eventsToday: 320,
    health: 'healthy',
    activeAlertsCount: 0,
  },
];

export const useServerStore = create<ServerState>((set) => ({
  servers: initialServers,
  setServers: (servers) => set({ servers }),
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
