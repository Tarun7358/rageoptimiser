import { FastifyInstance } from 'fastify';
import { HealthHelper } from '../health/index.js';
import { SessionManager } from '../sessions/index.js';
import { MetricsCache } from '../cache/index.js';
import { AlertEngine } from '../alerts/index.js';
import { Storage } from '../storage/index.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // GET /health
  fastify.get('/health', async (request, reply) => {
    return HealthHelper.getReport();
  });

  // GET /api/health
  fastify.get('/api/health', async (request, reply) => {
    return HealthHelper.getReport();
  });

  // GET /api/bots
  fastify.get('/api/bots', async (request, reply) => {
    return SessionManager.getActiveSessions();
  });

  // GET /api/bots/:id
  fastify.get('/api/bots/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Find session
    const activeSessions = SessionManager.getActiveSessions();
    const session = activeSessions.find(s => s.botId === id || s.sessionId === id);
    if (!session) {
      return reply.status(404).send({ error: 'Bot session not found' });
    }

    const cachedMetrics = MetricsCache.getLatestMetrics(session.botId);
    return {
      session,
      metrics: cachedMetrics ? cachedMetrics.payload : null
    };
  });

  // GET /api/metrics
  fastify.get('/api/metrics', async (request, reply) => {
    return MetricsCache.getAllMetrics();
  });

  // GET /api/alerts
  fastify.get('/api/alerts', async (request, reply) => {
    return AlertEngine.getActiveAlerts();
  });

  // GET /api/events
  fastify.get('/api/events', async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string; sessionId?: string };
    const limit = parseInt(query.limit || '50', 10);
    const offset = parseInt(query.offset || '0', 10);
    
    try {
      let events;
      if (query.sessionId) {
        events = await Storage.all(
          `SELECT * FROM events WHERE sessionId = ? ORDER BY sequence DESC LIMIT ? OFFSET ?`,
          [query.sessionId, limit, offset]
        );
      } else {
        events = await Storage.all(
          `SELECT * FROM events ORDER BY sequence DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      return events.map((e: any) => ({
        sequence: e.sequence,
        sessionId: e.sessionId,
        timestamp: e.timestamp,
        type: e.type,
        payload: JSON.parse(e.payload)
      }));
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to retrieve events history', message: err.message });
    }
  });
}
