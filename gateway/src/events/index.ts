import { Storage } from '../storage/index.js';
import { logger } from '../logging/index.js';

export interface BufferedEvent {
  sequence: number;
  sessionId: string;
  timestamp: string;
  type: string;
  payload: any;
}

export class ResumeBuffer {
  private static nextSequence = 1;
  private static memoryCache: BufferedEvent[] = [];
  private static MAX_MEMORY_CACHE_SIZE = 5000;
  private static MAX_BUFFER_SIZE = 100000;

  public static async initialize(): Promise<void> {
    try {
      // Find the highest sequence number in the database
      const row = await Storage.get(`SELECT MAX(sequence) as maxSeq FROM events`);
      if (row && row.maxSeq) {
        this.nextSequence = row.maxSeq + 1;
      }
      
      // Load recent events into memory cache
      const recentEvents = await Storage.all<any>(
        `SELECT * FROM events ORDER BY sequence DESC LIMIT ?`,
        [this.MAX_MEMORY_CACHE_SIZE]
      );
      
      this.memoryCache = recentEvents.reverse().map((e) => ({
        sequence: e.sequence,
        sessionId: e.sessionId,
        timestamp: e.timestamp,
        type: e.type,
        payload: JSON.parse(e.payload),
      }));

      logger.info({ nextSequence: this.nextSequence, cachedEvents: this.memoryCache.length }, 'ResumeBuffer initialized');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize ResumeBuffer');
    }
  }

  public static async appendEvent(sessionId: string, type: string, payload: any): Promise<number> {
    const sequence = this.nextSequence++;
    const timestamp = new Date().toISOString();

    const event: BufferedEvent = {
      sequence,
      sessionId,
      timestamp,
      type,
      payload,
    };

    // Push to memory cache
    this.memoryCache.push(event);
    if (this.memoryCache.length > this.MAX_MEMORY_CACHE_SIZE) {
      this.memoryCache.shift();
    }

    // Persist in SQLite
    await Storage.run(
      `INSERT INTO events (sequence, sessionId, timestamp, type, payload) VALUES (?, ?, ?, ?, ?)`,
      [sequence, sessionId, timestamp, type, JSON.stringify(payload)]
    ).catch((err) => logger.error({ err }, 'Failed to persist event in resume buffer'));

    // Periodically prune SQLite history to keep max 100,000 entries
    if (sequence % 5000 === 0) {
      this.pruneBuffer();
    }

    return sequence;
  }

  private static pruneBuffer(): void {
    const pruneThreshold = this.nextSequence - this.MAX_BUFFER_SIZE;
    if (pruneThreshold <= 0) return;

    Storage.run(`DELETE FROM events WHERE sequence < ?`, [pruneThreshold])
      .then((res) => {
        if (res.changes > 0) {
          logger.info({ prunedCount: res.changes }, 'Pruned historical events from SQLite resume buffer');
        }
      })
      .catch((err) => logger.error({ err }, 'Failed to prune event resume buffer'));
  }

  public static async getMissingEvents(sessionId: string, lastSequence: number): Promise<BufferedEvent[]> {
    // 1. Try to fetch from memory cache first
    const fromMemory = this.memoryCache.filter((e) => e.sessionId === sessionId && e.sequence > lastSequence);
    if (fromMemory.length > 0 && fromMemory[0].sequence === lastSequence + 1) {
      return fromMemory;
    }

    // 2. Fall back to database query if lastSequence is older than memory cache
    try {
      const rows = await Storage.all<any>(
        `SELECT * FROM events WHERE sessionId = ? AND sequence > ? ORDER BY sequence ASC LIMIT 500`,
        [sessionId, lastSequence]
      );
      return rows.map((r) => ({
        sequence: r.sequence,
        sessionId: r.sessionId,
        timestamp: r.timestamp,
        type: r.type,
        payload: JSON.parse(r.payload),
      }));
    } catch (err) {
      logger.error({ err, sessionId, lastSequence }, 'Failed to query historical events from database');
      return [];
    }
  }
}
