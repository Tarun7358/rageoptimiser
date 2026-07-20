import { v4 as uuidv4 } from 'uuid';
import { SessionState } from '../types/index.js';
import { Storage } from '../storage/index.js';
import { logger } from '../logging/index.js';

export class SessionManager {
  private static sessions = new Map<string, SessionState>();

  public static async initialize(): Promise<void> {
    try {
      // BUG FIX: Load any previously 'online' sessions from DB BEFORE marking them offline.
      // The original code ran UPDATE first then SELECT WHERE status='online', which always
      // returned 0 rows because all sessions were already set to offline by the UPDATE.
      // We load them first so we can at least know which bots were connected before restart.
      const rows = await Storage.all(`SELECT * FROM session_states WHERE status = 'online'`);
      for (const row of rows) {
        this.sessions.set(row.sessionId, {
          ...row,
          capabilities: JSON.parse(row.capabilities),
        });
      }

      // Now mark all previously unresolved sessions as offline (they are stale after restart)
      await Storage.run(`UPDATE session_states SET status = 'offline' WHERE status = 'online'`);

      // Clear in-memory sessions — they are now marked offline and can no longer receive data
      this.sessions.clear();

      logger.info('SessionManager initialized and database state synchronized');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize SessionManager state');
    }
  }

  public static async createSession(
    botId: string,
    ip: string,
    gatewayVersion: string,
    monitoringVersion: string,
    capabilities: string[],
    platform: string,
    os: string,
    nodeVersion: string
  ): Promise<SessionState> {
    // If there is an existing active session for this botId, terminate it
    const existing = Array.from(this.sessions.values()).find((s) => s.botId === botId && s.status === 'online');
    if (existing) {
      logger.info({ botId, oldSessionId: existing.sessionId }, 'Terminating duplicate session for bot');
      await this.closeSession(existing.sessionId);
    }

    const sessionId = uuidv4();
    const nowStr = new Date().toISOString();

    const session: SessionState = {
      sessionId,
      botId,
      connectedSince: nowStr,
      lastHeartbeat: nowStr,
      gatewayVersion,
      monitoringVersion,
      capabilities,
      platform,
      os,
      nodeVersion,
      ip,
      status: 'online',
    };

    this.sessions.set(sessionId, session);

    // Save to SQLite
    await Storage.run(
      `INSERT OR REPLACE INTO session_states (
        sessionId, botId, connectedSince, lastHeartbeat, gatewayVersion,
        monitoringVersion, capabilities, platform, os, nodeVersion, ip, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.sessionId,
        session.botId,
        session.connectedSince,
        session.lastHeartbeat,
        session.gatewayVersion,
        session.monitoringVersion,
        JSON.stringify(session.capabilities),
        session.platform,
        session.os,
        session.nodeVersion,
        session.ip,
        session.status,
      ]
    ).catch((err) => logger.error({ err }, 'Failed to persist session creation'));

    logger.info({ botId, sessionId }, 'Telemetry session established');
    return session;
  }

  public static async updateHeartbeat(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const nowStr = new Date().toISOString();
    session.lastHeartbeat = nowStr;

    await Storage.run(
      `UPDATE session_states SET lastHeartbeat = ? WHERE sessionId = ?`,
      [nowStr, sessionId]
    ).catch((err) => logger.error({ err }, 'Failed to persist heartbeat update'));
  }

  public static getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  public static getActiveSessions(): SessionState[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'online');
  }

  public static async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'offline';
    this.sessions.delete(sessionId);

    await Storage.run(
      `UPDATE session_states SET status = 'offline' WHERE sessionId = ?`,
      [sessionId]
    ).catch((err) => logger.error({ err, sessionId }, 'Failed to close session in database'));

    logger.info({ botId: session.botId, sessionId }, 'Telemetry session closed');
  }

  public static async clearStaleSessions(heartbeatTimeoutMs: number): Promise<string[]> {
    const now = Date.now();
    const staleSessionIds: string[] = [];

    for (const session of this.sessions.values()) {
      const lastHbTime = new Date(session.lastHeartbeat).getTime();
      if (now - lastHbTime > heartbeatTimeoutMs) {
        staleSessionIds.push(session.sessionId);
      }
    }

    for (const sessionId of staleSessionIds) {
      logger.warn({ sessionId }, 'Closing stale session due to heartbeat timeout');
      await this.closeSession(sessionId);
    }

    return staleSessionIds;
  }
}
