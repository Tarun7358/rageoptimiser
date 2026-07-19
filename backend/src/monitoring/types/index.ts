export interface MonitoringEvent {
  timestamp: string;
  type: string;
  category: 'gateway' | 'system' | 'discord' | 'database' | 'error' | 'music' | 'tickets';
  severity: 'info' | 'success' | 'warn' | 'error';
  guildId?: string;
  guildName?: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface SystemMetrics {
  cpuUsage: number;
  ramUsage: number; // in MB
  memoryPercentage: number;
  diskUsage: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  nodeVersion: string;
  pid: number;
  eventLoopDelay: number; // in ms
  networkStatus: 'connected' | 'disconnected';
}

export interface DiscordStats {
  guildCount: number;
  memberCount: number;
  onlineMembers: number;
  cachedChannels: number;
  cachedRoles: number;
  cachedEmojis: number;
  cachedThreads: number;
  commandsExecuted: number;
  messagesProcessed: number;
  interactions: number;
  eventsPerSecond: number;
  activeVoiceConnections: number;
  openTickets: number;
  activeMusicSessions: number;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'degraded' | 'error';
  databaseStatus: 'connected' | 'disconnected' | 'error';
  redisStatus: 'online' | 'offline' | 'unconfigured';
  uptime: number; // in seconds
}

export interface HeartbeatPayload {
  timestamp: string;
  metrics: {
    system: SystemMetrics;
    discord: DiscordStats;
  };
  health: HealthStatus;
}
