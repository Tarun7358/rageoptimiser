export interface SystemMetrics {
  cpuUsage: number;
  ramUsage: number;
  memoryPercentage: number;
  diskUsage: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  nodeVersion: string;
  pid: number;
  eventLoopDelay: number;
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
  uptime: number;
}

export interface HeartbeatPayload {
  timestamp: string;
  metrics: {
    system: SystemMetrics;
    discord: DiscordStats;
  };
  health: HealthStatus;
}

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

export interface SessionState {
  sessionId: string;
  botId: string;
  connectedSince: string;
  lastHeartbeat: string;
  gatewayVersion: string;
  monitoringVersion: string;
  capabilities: string[];
  platform: string;
  os: string;
  nodeVersion: string;
  ip: string;
  status: 'online' | 'offline';
}

export interface Alert {
  id: string;
  botId: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  resolved: number;
  resolvedAt?: string;
}

export interface GatewayPacket {
  type: 'HELLO' | 'HEARTBEAT' | 'HEALTH' | 'EVENT' | 'ALERT' | 'METRICS' | 'ERROR' | 'PONG';
  version?: string;
  sessionId?: string;
  timestamp?: string;
  sequence?: number;
  payload: any;
}
