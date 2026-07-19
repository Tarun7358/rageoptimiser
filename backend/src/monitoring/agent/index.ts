import { Gateway } from '../../core/Gateway.js';
import { ModuleRegistry } from '../../core/ModuleRegistry.js';
import { WebServer } from '../../core/WebServer.js';
import { Database } from '../../core/Database.js';
import { MonitoringEventBus } from '../events/EventBus.js';
import { SystemCollector } from '../metrics/SystemCollector.js';
import { DiscordCollector } from '../metrics/DiscordCollector.js';
import { HealthService } from '../health/HealthService.js';
import { TelemetryWebSocketClient } from '../websocket/WebSocketClient.js';
import { ConsoleMirror } from '../utils/ConsoleMirror.js';
import { MonitoringEvent } from '../types/index.js';

export class MonitoringAgent {
  private static instance: MonitoringAgent | null = null;

  private gateway!: Gateway;
  private registry!: ModuleRegistry;
  private webServer!: WebServer;

  private eventBus = MonitoringEventBus.getInstance();
  private systemCollector = new SystemCollector();
  private discordCollector!: DiscordCollector;
  private healthService = new HealthService();
  private wsClient = new TelemetryWebSocketClient();

  private isStarted = false;
  private statsInterval: NodeJS.Timeout | null = null;

  private constructor(gateway: Gateway, registry: ModuleRegistry, webServer: WebServer) {
    this.gateway = gateway;
    this.registry = registry;
    this.webServer = webServer;
    this.discordCollector = new DiscordCollector(gateway);
  }

  public static start(gateway: Gateway, registry: ModuleRegistry, webServer: WebServer): MonitoringAgent {
    if (this.instance) return this.instance;
    this.instance = new MonitoringAgent(gateway, registry, webServer);
    
    // Defer initialization to next tick to ensure we are completely non-blocking
    setImmediate(() => {
      try {
        this.instance!.initialize();
      } catch (err) {
        ConsoleMirror.error(`Failed to initialize monitoring agent: ${err}`);
      }
    });

    return this.instance;
  }

  private initialize(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    ConsoleMirror.info('Initializing operational monitoring telemetry...');

    // 1. Connect WebSocket Client to Dashboard Server
    try {
      this.wsClient.connect();
    } catch (wsErr) {
      ConsoleMirror.warn(`WebSocket connect initiation failed: ${wsErr}`);
    }

    // 2. Subscribe Event Bus to WebSocket Telemetry streaming
    this.eventBus.subscribe((event) => {
      // Mirror to local console output
      this.mirrorToConsole(event);
      
      // Dispatch to WS client
      try {
        this.wsClient.sendEvent(event);
      } catch (err) {
        // Prevent telemetry delivery failures from interrupting execution
      }
    });

    // 3. Hook into Discord Client events
    this.setupDiscordHooks();

    // 4. Hook SQLite database methods to capture db events/errors
    this.setupDatabaseHooks();

    // 5. Setup global error handlers
    this.setupErrorHooks();

    // 6. Setup periodic statistics & health heartbeat
    this.startHeartbeatLoop();
    this.triggerInitialHeartbeat();

    // Emit initial successful start event
    this.publishEvent({
      type: 'AGENT_STARTED',
      category: 'system',
      severity: 'success',
      title: 'Monitoring Agent Started',
      description: 'Telemetry Monitoring Agent successfully hooked into bot execution lifecycle.',
      metadata: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  }

  private publishEvent(data: Omit<MonitoringEvent, 'timestamp'>): void {
    try {
      const event: MonitoringEvent = {
        ...data,
        timestamp: new Date().toISOString(),
      };
      this.eventBus.publish(event);
    } catch {
      // Prevent telemetry publishing errors from propagating
    }
  }

  private setupDiscordHooks(): void {
    const client = this.gateway.client;
    if (!client) return;

    // Listen to standard gateway lifecycle events
    client.on('shardReady', (shardId) => {
      this.publishEvent({
        type: 'GATEWAY_SHARD_READY',
        category: 'gateway',
        severity: 'success',
        title: 'Gateway Shard Ready',
        description: `Discord gateway connection established for Shard ${shardId}.`,
        metadata: { shardId },
      });
    });

    client.on('shardDisconnect', (event, shardId) => {
      this.publishEvent({
        type: 'GATEWAY_SHARD_DISCONNECT',
        category: 'gateway',
        severity: 'error',
        title: 'Gateway Shard Disconnected',
        description: `Discord gateway connection closed for Shard ${shardId} (code: ${event.code}).`,
        metadata: { shardId, code: event.code, reason: event.reason },
      });
    });

    client.on('shardReconnecting', (shardId) => {
      this.publishEvent({
        type: 'GATEWAY_SHARD_RECONNECTING',
        category: 'gateway',
        severity: 'warn',
        title: 'Gateway Shard Reconnecting',
        description: `Discord gateway attempting to reconnect for Shard ${shardId}.`,
        metadata: { shardId },
      });
    });

    // Monkey patch client.emit to capture interaction & message activities transparently
    try {
      const originalEmit = client.emit;
      const self = this;

      client.emit = function (event: string, ...args: any[]) {
        try {
          self.discordCollector.eventsCount++;

          if (event === 'interactionCreate') {
            const interaction = args[0];
            if (interaction) {
              self.discordCollector.interactionsCount++;
              
              if (interaction.isChatInputCommand()) {
                self.discordCollector.commandsCount++;
                self.publishEvent({
                  type: 'SLASH_COMMAND_EXECUTED',
                  category: 'discord',
                  severity: 'info',
                  guildId: interaction.guildId || undefined,
                  guildName: interaction.guild?.name || undefined,
                  title: `Command Executed: /${interaction.commandName}`,
                  description: `User ${interaction.user.username} executed command /${interaction.commandName}.`,
                  metadata: {
                    user: interaction.user.username,
                    userId: interaction.user.id,
                    command: interaction.commandName,
                  },
                });
              }
            }
          } else if (event === 'messageCreate') {
            const message = args[0];
            if (message && !message.author?.bot) {
              self.discordCollector.messagesCount++;
            }
          }
        } catch (err) {
          // Catch and ignore monkey patch telemetry failures silently
        }

        // Delegate to original emitter
        return originalEmit.apply(this, [event, ...args]);
      };
    } catch (err) {
      ConsoleMirror.warn(`Could not setup client event monitoring hook: ${err}`);
    }
  }

  private setupDatabaseHooks(): void {
    try {
      const self = this;

      // Wrap Database.run
      const originalRun = Database.run;
      Database.run = async function (sql: string, params: any[] = []) {
        try {
          return await originalRun.call(Database, sql, params);
        } catch (err: any) {
          self.publishEvent({
            type: 'DATABASE_QUERY_ERROR',
            category: 'database',
            severity: 'error',
            title: 'Database Query Failure',
            description: `SQLite query failed: ${err.message || err}`,
            metadata: { sql, params, errorMessage: err.message },
          });
          throw err;
        }
      };

      // Wrap Database.get
      const originalGet = Database.get;
      Database.get = async function <T = any>(sql: string, params: any[] = []): Promise<T | null> {
        try {
          return await originalGet.call(Database, sql, params) as any;
        } catch (err: any) {
          self.publishEvent({
            type: 'DATABASE_QUERY_ERROR',
            category: 'database',
            severity: 'error',
            title: 'Database Query Failure',
            description: `SQLite query failed: ${err.message || err}`,
            metadata: { sql, params, errorMessage: err.message },
          });
          throw err;
        }
      };

      // Wrap Database.all
      const originalAll = Database.all;
      Database.all = async function <T = any>(sql: string, params: any[] = []): Promise<T[]> {
        try {
          return await originalAll.call(Database, sql, params) as any;
        } catch (err: any) {
          self.publishEvent({
            type: 'DATABASE_QUERY_ERROR',
            category: 'database',
            severity: 'error',
            title: 'Database Query Failure',
            description: `SQLite query failed: ${err.message || err}`,
            metadata: { sql, params, errorMessage: err.message },
          });
          throw err;
        }
      };

      // Wrap Database.exec
      const originalExec = Database.exec;
      Database.exec = async function (sql: string) {
        try {
          return await originalExec.call(Database, sql);
        } catch (err: any) {
          self.publishEvent({
            type: 'DATABASE_EXEC_ERROR',
            category: 'database',
            severity: 'error',
            title: 'Database Execution Failure',
            description: `SQLite schema exec failed: ${err.message || err}`,
            metadata: { sql, errorMessage: err.message },
          });
          throw err;
        }
      };

      ConsoleMirror.success('Database Connected - Telemetry hooks installed on SQLite driver.');
    } catch (err) {
      ConsoleMirror.warn(`Could not hook Database driver: ${err}`);
    }
  }

  private setupErrorHooks(): void {
    // Intercept uncaughtException
    process.on('uncaughtException', (err) => {
      this.publishEvent({
        type: 'UNCAUGHT_EXCEPTION',
        category: 'error',
        severity: 'error',
        title: 'Uncaught Exception Caught',
        description: err?.message || 'Unknown uncaught exception.',
        metadata: {
          errorName: err?.name,
          errorMessage: err?.message,
          stack: err?.stack,
        },
      });
    });

    // Intercept unhandledRejection
    process.on('unhandledRejection', (reason: any) => {
      const message = reason?.message || String(reason || '');
      this.publishEvent({
        type: 'UNHANDLED_REJECTION',
        category: 'error',
        severity: 'error',
        title: 'Unhandled Rejection Caught',
        description: message || 'Unknown promise rejection.',
        metadata: {
          reason: typeof reason === 'object' ? JSON.stringify(reason) : String(reason),
          stack: reason?.stack,
        },
      });
    });
  }

  private startHeartbeatLoop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      try {
        const systemMetrics = await this.systemCollector.collect();
        const discordMetrics = await this.discordCollector.collect();
        const healthStatus = this.healthService.check();

        // 1. Emit WS Heartbeat
        this.wsClient.sendHeartbeat({
          timestamp: new Date().toISOString(),
          metrics: {
            system: systemMetrics,
            discord: discordMetrics,
          },
          health: healthStatus,
        });

        // 2. Perform system safety monitoring alerts
        if (systemMetrics.memoryPercentage > 90) {
          this.publishEvent({
            type: 'SYSTEM_RESOURCE_ALERT',
            category: 'system',
            severity: 'warn',
            title: 'Memory Usage High',
            description: `System RAM utilization is critical at ${systemMetrics.memoryPercentage}%.`,
            metadata: { ...systemMetrics },
          });
        }
      } catch (err) {
        // Prevent heartbeat interval failure
      }
    }, 5000); // Poll and heartbeat every 5 seconds
  }

  private async triggerInitialHeartbeat(): Promise<void> {
    try {
      const systemMetrics = await this.systemCollector.collect();
      const discordMetrics = await this.discordCollector.collect();
      const healthStatus = this.healthService.check();

      this.wsClient.sendHeartbeat({
        timestamp: new Date().toISOString(),
        metrics: {
          system: systemMetrics,
          discord: discordMetrics,
        },
        health: healthStatus,
      });
    } catch (err) {
      // Ignore initial boot telemetry failures
    }
  }


  private mirrorToConsole(event: MonitoringEvent): void {
    const formattedMsg = `${event.title} - ${event.description}`;
    switch (event.severity) {
      case 'success':
        ConsoleMirror.success(formattedMsg);
        break;
      case 'warn':
        ConsoleMirror.warn(formattedMsg);
        break;
      case 'error':
        ConsoleMirror.error(formattedMsg);
        break;
      case 'info':
      default:
        ConsoleMirror.info(formattedMsg);
        break;
    }
  }
}
export { MonitoringEventBus };
