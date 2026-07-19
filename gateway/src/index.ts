import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { config } from './config/index.js';
import { logger } from './logging/index.js';
import { Storage } from './storage/index.js';
import { SessionManager } from './sessions/index.js';
import { MetricsCache } from './cache/index.js';
import { AlertEngine } from './alerts/index.js';
import { ResumeBuffer } from './events/index.js';
import { WebSocketService } from './websocket/index.js';
import { registerRoutes } from './api/index.js';

const fastify = Fastify({
  logger: false, // We use our own customized pino logger
  disableRequestLogging: true,
});

async function bootstrap() {
  try {
    logger.info('Gateway Starting...');
    logger.info('Loading Configuration...');
    logger.info('Connecting Database...');

    // 1. Establish Database Connection & Initialize schemas
    await Storage.connect();

    logger.info('Starting WebSocket Server...');

    // 2. Initialize Internal Services
    await SessionManager.initialize();
    await MetricsCache.initialize();
    await AlertEngine.initialize();
    await ResumeBuffer.initialize();
    
    // 3. Initialize WebSocket router state
    WebSocketService.initialize();

    // 4. Register WebSocket support
    await fastify.register(fastifyWebsocket, {
      options: {
        maxPayload: 10 * 1024 * 1024, // 10MB limit
      }
    });

    // WebSocket multiplex route /telemetry
    fastify.register(async function (fastifyInstance) {
      fastifyInstance.get('/telemetry', { websocket: true }, (connection, req) => {
        const socket = (connection as any).socket || connection;
        WebSocketService.handleConnection(socket, req);
      });
    });

    // 5. Register REST Endpoints
    await registerRoutes(fastify);

    // 6. Bind Server Listener
    await fastify.listen({ port: config.PORT, host: config.HOST });
    logger.info(`Listening on PORT ${config.PORT}...`);
    logger.info('Gateway Ready.');
  } catch (err) {
    logger.fatal({ err }, 'Gateway bootstrap crash failure');
    process.exit(1);
  }
}

// Global process exception listeners to log crashes cleanly
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception captured');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection captured');
});

bootstrap();
export { fastify };
