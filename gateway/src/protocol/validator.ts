import { z } from 'zod';

// Sub-schemas matching bot agent types
export const SystemMetricsSchema = z.object({
  cpuUsage: z.number(),
  ramUsage: z.number(),
  memoryPercentage: z.number(),
  diskUsage: z.object({
    total: z.number(),
    free: z.number(),
    used: z.number(),
    percentage: z.number(),
  }),
  nodeVersion: z.string(),
  pid: z.number(),
  eventLoopDelay: z.number(),
  networkStatus: z.enum(['connected', 'disconnected']),
});

export const DiscordStatsSchema = z.object({
  guildCount: z.number(),
  memberCount: z.number(),
  onlineMembers: z.number(),
  cachedChannels: z.number(),
  cachedRoles: z.number(),
  cachedEmojis: z.number(),
  cachedThreads: z.number(),
  commandsExecuted: z.number(),
  messagesProcessed: z.number(),
  interactions: z.number(),
  eventsPerSecond: z.number(),
  activeVoiceConnections: z.number(),
  openTickets: z.number(),
  activeMusicSessions: z.number(),
});

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'warning', 'degraded', 'error']),
  databaseStatus: z.enum(['connected', 'disconnected', 'error']),
  redisStatus: z.enum(['online', 'offline', 'unconfigured']),
  uptime: z.number(),
});

export const HeartbeatPayloadSchema = z.object({
  timestamp: z.string(),
  metrics: z.object({
    system: SystemMetricsSchema,
    discord: DiscordStatsSchema,
  }),
  health: HealthStatusSchema,
});

export const MonitoringEventSchema = z.object({
  timestamp: z.string(),
  type: z.string(),
  category: z.enum(['gateway', 'system', 'discord', 'database', 'error', 'music', 'tickets']),
  severity: z.enum(['info', 'success', 'warn', 'error']),
  guildId: z.string().optional(),
  guildName: z.string().optional(),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.any()).optional().default({}),
});

// Incoming message envelope schemas
export const AgentPingSchema = z.object({
  type: z.literal('PING'),
  timestamp: z.string(),
});

export const AgentHeartbeatSchema = z.object({
  type: z.literal('HEARTBEAT'),
  payload: HeartbeatPayloadSchema,
});

export const AgentEventSchema = z.object({
  type: z.literal('EVENT'),
  payload: MonitoringEventSchema,
});

export const DashboardResumeSchema = z.object({
  type: z.literal('RESUME'),
  sessionId: z.string(),
  lastSequence: z.number(),
});

export const DashboardResponseSchema = z.object({
  type: z.literal('RESPONSE'),
  version: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  sequence: z.number().optional(),
  payload: z.object({
    status: z.string(),
  }).optional(),
});

// Discriminated union of all incoming packets
export const IncomingPacketSchema = z.discriminatedUnion('type', [
  AgentPingSchema,
  AgentHeartbeatSchema,
  AgentEventSchema,
  DashboardResumeSchema,
  DashboardResponseSchema,
]);

export type IncomingPacket = z.infer<typeof IncomingPacketSchema>;

export class ProtocolValidator {
  public static validate(dataStr: string): IncomingPacket | null {
    try {
      const parsed = JSON.parse(dataStr);
      const result = IncomingPacketSchema.safeParse(parsed);
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch {
      return null;
    }
  }
}
