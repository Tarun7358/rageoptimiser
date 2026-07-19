import { RawData, WebSocket } from 'ws';
import { FastifyRequest } from 'fastify';
import { Authentication } from '../authentication/index.js';
import { SessionManager } from '../sessions/index.js';
import { MetricsCache } from '../cache/index.js';
import { AlertEngine, AlertEngine as AlertManager } from '../alerts/index.js';
import { ResumeBuffer } from '../events/index.js';
import { HealthHelper } from '../health/index.js';
import { logger } from '../logging/index.js';
import { IncomingPacket, ProtocolValidator } from '../protocol/validator.js';
import { Alert, GatewayPacket, HeartbeatPayload, MonitoringEvent } from '../types/index.js';

export class WebSocketService {
  private static dashboardClients = new Set<WebSocket>();
  private static agentSessions = new Map<string, { socket: WebSocket; sessionId: string; botId: string }>();

  public static initialize(): void {
    // Hook alerts from AlertEngine to broadcast to dashboard clients
    AlertEngine.setOnAlertTriggered((alert: Alert) => {
      const activeSession = SessionManager.getActiveSessions().find(s => s.botId === alert.botId);
      const sId = activeSession ? activeSession.sessionId : 'global';
      
      // Map Alert payload to expected dashboard TelemetryAlert structure
      const dashboardAlert = {
        alertId: alert.id,
        sequence: 0,
        timestamp: alert.timestamp,
        category: 'SYSTEM',
        severity: alert.severity,
        sourceModule: alert.type,
        title: alert.title,
        description: alert.description,
        metadata: {},
        status: alert.resolved ? 'resolved' : 'active'
      };

      this.broadcastToDashboards('ALERT', dashboardAlert, alert.botId, sId);
    });

    // Start a liveness interval to check for dead agent heartbeats (Bot Offline detection)
    setInterval(() => {
      this.checkAgentLiveness();
    }, 10000);
  }

  public static handleConnection(socket: WebSocket, request: FastifyRequest): void {
    const ip = request.ip || '127.0.0.1';
    
    // Extract token safely from query
    const urlObj = new URL(request.url, 'http://localhost');
    const token = urlObj.searchParams.get('token');

    // 1. Authenticate connection
    const isAgent = Authentication.authenticateAgent(token);
    const dashboardUser = isAgent ? null : Authentication.authenticateDashboard(token);

    if (!isAgent && !dashboardUser) {
      logger.warn({ ip, url: request.url }, 'WebSocket connection rejected: Invalid authentication credentials');
      socket.close(4001, 'Unauthorized');
      return;
    }

    if (isAgent) {
      this.handleAgentConnection(socket, ip);
    } else if (dashboardUser) {
      this.handleDashboardConnection(socket, ip, dashboardUser);
    }
  }

  private static handleAgentConnection(socket: WebSocket, ip: string): void {
    let sessionId = '';
    let botId = '';
    let isRegistered = false;

    logger.info({ ip }, 'Monitoring Agent WebSocket connected');

    socket.on('message', async (data: RawData) => {
      const packet = ProtocolValidator.validate(data.toString());
      if (!packet) {
        logger.warn({ ip, rawData: data.toString().substring(0, 200) }, 'Rejected malformed protocol packet from agent');
        return;
      }

      logger.info(`Agent → Gateway: ${packet.type} | sessionId: ${sessionId || 'unknown'} | timestamp: ${new Date().toISOString()}`);

      try {
        if (packet.type === 'PING') {
          // Reply PONG
          socket.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          return;
        }

        if (packet.type === 'HEARTBEAT') {
          const payload = packet.payload as HeartbeatPayload;
          
          // Lazily initialize session if this is the first heartbeat
          if (!isRegistered) {
            botId = `bot_${payload.metrics.system.pid || 'main'}`;
            const capabilities = ['metrics', 'events', 'alerts', 'voice', 'music'];
            
            const session = await SessionManager.createSession(
              botId,
              ip,
              '1.0.0', // Gateway Version
              '1.0.0', // Monitoring Version
              capabilities,
              process.platform,
              payload.metrics.system.nodeVersion, // OS summary fallback
              payload.metrics.system.nodeVersion
            );

            sessionId = session.sessionId;
            isRegistered = true;
            this.agentSessions.set(sessionId, { socket, sessionId, botId });

            // Send HELLO packet back to agent
            socket.send(JSON.stringify({
              type: 'HELLO',
              version: '1.0.0',
              sessionId,
              timestamp: new Date().toISOString(),
              sequence: 0,
              payload: {
                agentVersion: '1.0.0',
                botVersion: '1.0.0',
                botName: 'Rage Optimiser',
                environment: process.env.NODE_ENV || 'production',
                machineIdentity: {
                  machineId: botId,
                  hostname: payload.metrics.system.nodeVersion || 'localhost',
                  os: process.platform,
                  architecture: process.arch,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  nodeVersion: payload.metrics.system.nodeVersion,
                },
                supportedCapabilities: capabilities,
              }
            }));

            // Notify all dashboards of new bot session
            this.broadcastToDashboards('HELLO', {
              agentVersion: '1.0.0',
              botVersion: '1.0.0',
              botName: 'Rage Optimiser',
              environment: process.env.NODE_ENV || 'production',
              machineIdentity: {
                machineId: botId,
                hostname: payload.metrics.system.nodeVersion || 'localhost',
                os: process.platform,
                architecture: process.arch,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                nodeVersion: payload.metrics.system.nodeVersion,
              },
              supportedCapabilities: capabilities,
            }, botId, sessionId);
          }

          // Update heartbeat timestamp in SessionManager
          await SessionManager.updateHeartbeat(sessionId);

          // Evaluate alerts (CPU, RAM, Database status)
          await AlertEngine.evaluateHeartbeat(botId, payload);

          // Update metrics cache
          await MetricsCache.setLatestMetrics(botId, payload);

          // Map and broadcast HEARTBEAT to dashboards
          this.broadcastToDashboards('HEARTBEAT', {
            uptime: payload.health.uptime,
            gatewayStatus: 'connected',
            gatewayPing: 10,
            lastSequenceReceived: 0
          }, botId, sessionId);

          // Map and broadcast HEALTH (system metrics) to dashboards
          this.broadcastToDashboards('HEALTH', {
            cpu: {
              usagePercentage: payload.metrics.system.cpuUsage,
              cores: 1
            },
            memory: {
              processRSS: payload.metrics.system.ramUsage,
              hostUsed: payload.metrics.system.ramUsage,
              hostTotal: 16384,
              percentage: payload.metrics.system.memoryPercentage
            },
            disk: {
              totalGB: payload.metrics.system.diskUsage.total / 1024,
              usedGB: payload.metrics.system.diskUsage.used / 1024,
              freeGB: payload.metrics.system.diskUsage.free / 1024,
              percentage: payload.metrics.system.diskUsage.percentage
            },
            eventLoopDelayMs: payload.metrics.system.eventLoopDelay,
            services: {
              database: payload.health.databaseStatus,
              redis: payload.health.redisStatus,
              websocket: 'healthy'
            }
          }, botId, sessionId);

          // Map and broadcast METRICS (bot stats) to dashboards
          this.broadcastToDashboards('METRICS', {
            guildCount: payload.metrics.discord.guildCount,
            userCount: payload.metrics.discord.memberCount,
            onlineUserCount: payload.metrics.discord.onlineMembers,
            commandsPerMinute: payload.metrics.discord.commandsExecuted,
            eventsPerSecond: payload.metrics.discord.eventsPerSecond,
            activeVoiceSessions: payload.metrics.discord.activeVoiceConnections,
            activeMusicSessions: payload.metrics.discord.activeMusicSessions,
            openTicketsCount: payload.metrics.discord.openTickets
          }, botId, sessionId);
        }

        if (packet.type === 'EVENT') {
          const payload = packet.payload as MonitoringEvent;
          // Map and relay EVENT to dashboards
          this.broadcastToDashboards('EVENT', {
            eventId: `ev_${Date.now()}`,
            sequence: 0,
            timestamp: payload.timestamp,
            category: payload.category.toUpperCase() as any,
            severity: payload.severity.toUpperCase() as any,
            sourceModule: payload.category,
            guildId: payload.guildId,
            guildName: payload.guildName,
            action: payload.title,
            description: payload.description,
            metadata: payload.metadata
          }, botId, sessionId);
        }
      } catch (err) {
        logger.error({ err }, 'Error handling message from agent');
      }
    });

    socket.on('close', async () => {
      logger.info({ sessionId, botId }, 'Agent disconnected');
      if (sessionId) {
        this.agentSessions.delete(sessionId);
        await SessionManager.closeSession(sessionId);
        this.triggerBotOfflineAlert(botId);
      }
    });
  }

  private static handleDashboardConnection(socket: WebSocket, ip: string, user: any): void {
    logger.info({ ip, user: user.username }, 'Dashboard client connected');
    this.dashboardClients.add(socket);
    HealthHelper.incrementDashboardConnections();

    // Send immediate HELLO back to client
    const activeSessions = SessionManager.getActiveSessions();
    const activeBotSession = activeSessions[0]; // Target first active session

    socket.send(JSON.stringify({
      type: 'HELLO',
      version: '1.0.0',
      sessionId: activeBotSession ? activeBotSession.sessionId : 'no_active_agent',
      timestamp: new Date().toISOString(),
      sequence: 0,
      payload: {
        agentVersion: '1.0.0',
        botVersion: '1.0.0',
        botName: 'Rage Optimiser',
        environment: process.env.NODE_ENV || 'production',
        machineIdentity: {
          machineId: activeBotSession ? activeBotSession.botId : 'gateway',
          hostname: activeBotSession ? activeBotSession.ip : 'localhost',
          os: process.platform,
          architecture: process.arch,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          nodeVersion: process.version,
        },
        supportedCapabilities: ['metrics', 'events', 'alerts', 'voice', 'music'],
      }
    }));

    // If an agent is active, immediately dump its cached status to the client
    if (activeBotSession) {
      const cachedEntry = MetricsCache.getLatestMetrics(activeBotSession.botId);
      if (cachedEntry) {
        const payload = cachedEntry.payload;
        // Dump HEARTBEAT
        socket.send(JSON.stringify({
          type: 'HEARTBEAT',
          version: '1.0.0',
          sessionId: activeBotSession.sessionId,
          timestamp: new Date().toISOString(),
          sequence: 0,
          payload: {
            uptime: payload.health.uptime,
            gatewayStatus: 'connected',
            gatewayPing: 10,
            lastSequenceReceived: 0
          }
        }));

        // Dump HEALTH (system metrics)
        socket.send(JSON.stringify({
          type: 'HEALTH',
          version: '1.0.0',
          sessionId: activeBotSession.sessionId,
          timestamp: new Date().toISOString(),
          sequence: 0,
          payload: {
            cpu: { usagePercentage: payload.metrics.system.cpuUsage, cores: 1 },
            memory: {
              processRSS: payload.metrics.system.ramUsage,
              hostUsed: payload.metrics.system.ramUsage,
              hostTotal: 16384,
              percentage: payload.metrics.system.memoryPercentage
            },
            disk: {
              totalGB: payload.metrics.system.diskUsage.total / 1024,
              usedGB: payload.metrics.system.diskUsage.used / 1024,
              freeGB: payload.metrics.system.diskUsage.free / 1024,
              percentage: payload.metrics.system.diskUsage.percentage
            },
            eventLoopDelayMs: payload.metrics.system.eventLoopDelay,
            services: {
              database: payload.health.databaseStatus,
              redis: payload.health.redisStatus,
              websocket: 'healthy'
            }
          }
        }));

        // Dump METRICS
        socket.send(JSON.stringify({
          type: 'METRICS',
          version: '1.0.0',
          sessionId: activeBotSession.sessionId,
          timestamp: new Date().toISOString(),
          sequence: 0,
          payload: {
            guildCount: payload.metrics.discord.guildCount,
            userCount: payload.metrics.discord.memberCount,
            onlineUserCount: payload.metrics.discord.onlineMembers,
            commandsPerMinute: payload.metrics.discord.commandsExecuted,
            eventsPerSecond: payload.metrics.discord.eventsPerSecond,
            activeVoiceSessions: payload.metrics.discord.activeVoiceConnections,
            activeMusicSessions: payload.metrics.discord.activeMusicSessions,
            openTicketsCount: payload.metrics.discord.openTickets
          }
        }));
      }

      // Dump Active Alerts
      const alerts = AlertEngine.getActiveAlerts();
      for (const alert of alerts) {
        socket.send(JSON.stringify({
          type: 'ALERT',
          version: '1.0.0',
          sessionId: activeBotSession.sessionId,
          timestamp: alert.timestamp,
          sequence: 0,
          payload: {
            alertId: alert.id,
            sequence: 0,
            timestamp: alert.timestamp,
            category: 'SYSTEM',
            severity: alert.severity,
            sourceModule: alert.type,
            title: alert.title,
            description: alert.description,
            metadata: {},
            status: alert.resolved ? 'resolved' : 'active'
          }
        }));
      }
    }

    socket.on('message', async (data: RawData) => {
      const packet = ProtocolValidator.validate(data.toString());
      if (!packet) return;

      if (packet.type === 'RESUME') {
        const { sessionId, lastSequence } = packet;
        logger.info({ sessionId, lastSequence }, 'Dashboard requested telemetry resume stream');
        const missing = await ResumeBuffer.getMissingEvents(sessionId, lastSequence);
        for (const ev of missing) {
          socket.send(JSON.stringify({
            type: 'EVENT',
            version: '1.0.0',
            sessionId,
            timestamp: ev.timestamp,
            sequence: ev.sequence,
            payload: ev.payload
          }));
        }
      }
    });

    socket.on('close', () => {
      logger.info({ user: user.username }, 'Dashboard client disconnected');
      this.dashboardClients.delete(socket);
      HealthHelper.decrementDashboardConnections();
    });
  }

  private static async broadcastToDashboards(
    type: 'HELLO' | 'HEARTBEAT' | 'HEALTH' | 'EVENT' | 'ALERT' | 'METRICS',
    payload: any,
    botId: string,
    sessionId: string = 'global'
  ): Promise<void> {
    // 1. Save to Resume Buffer if it is a telemetry event
    let sequence = 0;
    if (type === 'EVENT' || type === 'ALERT') {
      sequence = await ResumeBuffer.appendEvent(sessionId, type, payload);
    }

    const packet: GatewayPacket = {
      type,
      version: '1.0.0',
      sessionId,
      timestamp: new Date().toISOString(),
      sequence: sequence > 0 ? sequence : undefined,
      payload
    };

    const serialized = JSON.stringify(packet);
    logger.info(`Gateway → Dashboard: ${type} | sessionId: ${sessionId} | sequence: ${sequence || 0} | timestamp: ${packet.timestamp}`);
    for (const client of this.dashboardClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  private static async checkAgentLiveness(): Promise<void> {
    const heartbeatTimeoutMs = 40000; // 40 seconds liveness timeout
    const staleSessionIds = await SessionManager.clearStaleSessions(heartbeatTimeoutMs);
    
    for (const sessionId of staleSessionIds) {
      // Find matching session information to trigger the offline alert
      const botId = `bot_main`; // Fallback botId
      this.triggerBotOfflineAlert(botId);
    }
  }

  private static triggerBotOfflineAlert(botId: string): void {
    AlertEngine.triggerAlert(
      botId,
      'BOT_OFFLINE',
      'EMERGENCY',
      'Rage Optimiser Offline',
      'The monitoring heartbeat connection has been lost. The Discord bot might be stopped or crashing.'
    ).catch((err) => logger.error({ err }, 'Failed to trigger bot offline alert'));

    // Notify dashboards that the bot is offline by broadcasting an alert
    this.broadcastToDashboards('ALERT', {
      alertId: `alert_${Date.now()}`,
      sequence: 0,
      timestamp: new Date().toISOString(),
      category: 'GATEWAY',
      severity: 'EMERGENCY',
      sourceModule: 'gateway',
      title: 'Rage Optimiser Offline',
      description: 'The monitoring heartbeat connection has been lost. The Discord bot might be stopped or crashing.',
      metadata: {},
      status: 'active'
    }, botId);
  }
}
