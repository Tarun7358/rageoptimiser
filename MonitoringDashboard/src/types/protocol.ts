export type EventCategory =
  | 'SYSTEM'
  | 'DISCORD'
  | 'GATEWAY'
  | 'DATABASE'
  | 'CACHE'
  | 'API'
  | 'COMMAND'
  | 'GUILD'
  | 'MEMBER'
  | 'VOICE'
  | 'MUSIC'
  | 'SECURITY'
  | 'WELCOME'
  | 'TICKETS'
  | 'SOCIAL'
  | 'YOUTUBE'
  | 'INSTAGRAM'
  | 'LEVELING'
  | 'AUTOMATION'
  | 'BACKUP'
  | 'RECOVERY'
  | 'CONFIGURATION'
  | 'PERMISSIONS'
  | 'OWNER'
  | 'UPDATE';

export type SeverityLevel =
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'EMERGENCY';

export interface MachineIdentity {
  machineId: string;
  hostname: string;
  os: string;
  architecture: string;
  timezone: string;
  nodeVersion: string;
}

export interface TelemetryEvent {
  eventId: string;
  sequence: number;
  timestamp: string;
  category: EventCategory;
  severity: SeverityLevel;
  sourceModule: string;
  guildId?: string;
  guildName?: string;
  userId?: string;
  action: string;
  description: string;
  metadata: Record<string, any>;
  isPinned?: boolean;
}

export interface TelemetryAlert {
  alertId: string;
  sequence: number;
  timestamp: string;
  category: EventCategory;
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  sourceModule: string;
  guildId?: string;
  guildName?: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  resolvedAt?: string;
}

export interface SystemMetrics {
  cpu: {
    usagePercentage: number;
    cores: number;
  };
  memory: {
    processRSS: number; // MB
    hostUsed: number; // MB
    hostTotal: number; // MB
    percentage: number;
  };
  disk: {
    totalGB: number;
    usedGB: number;
    freeGB: number;
    percentage: number;
  };
  eventLoopDelayMs: number;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'online' | 'offline' | 'unconfigured';
    websocket: 'healthy' | 'unhealthy';
  };
}

export interface BotMetrics {
  guildCount: number;
  userCount: number;
  onlineUserCount: number;
  commandsPerMinute: number;
  eventsPerSecond: number;
  activeVoiceSessions: number;
  activeMusicSessions: number;
  openTicketsCount: number;
}

export type Packet =
  | {
      type: 'HELLO';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: {
        agentVersion: string;
        botVersion: string;
        botName: string;
        environment: string;
        machineIdentity: MachineIdentity;
        supportedCapabilities: string[];
      };
    }
  | {
      type: 'HEARTBEAT';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: {
        uptime: number;
        gatewayStatus: 'connected' | 'disconnected';
        gatewayPing: number;
        lastSequenceReceived: number;
      };
    }
  | {
      type: 'HEALTH';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: SystemMetrics;
    }
  | {
      type: 'EVENT';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: TelemetryEvent;
    }
  | {
      type: 'ALERT';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: TelemetryAlert;
    }
  | {
      type: 'METRICS';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: BotMetrics;
    }
  | {
      type: 'ERROR';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: {
        errorCode: string;
        module: string;
        message: string;
        severity: SeverityLevel;
        recoverable: boolean;
        suggestedAction?: string;
      };
    }
  | {
      type: 'RESPONSE';
      version: string;
      sessionId: string;
      timestamp: string;
      sequence: number;
      payload: {
        status: 'ok' | 'error';
        message?: string;
      };
    };
