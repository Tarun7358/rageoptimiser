import { HeartbeatPayload } from '../types/index.js';
import { Storage } from '../storage/index.js';
import { logger } from '../logging/index.js';

export interface MetricsCacheEntry {
  botId: string;
  timestamp: string;
  payload: HeartbeatPayload;
}

export class MetricsCache {
  private static cache = new Map<string, MetricsCacheEntry>();

  public static async initialize(): Promise<void> {
    try {
      const rows = await Storage.all(`SELECT * FROM metrics_cache`);
      for (const row of rows) {
        this.cache.set(row.botId, {
          botId: row.botId,
          timestamp: row.timestamp,
          payload: {
            timestamp: row.timestamp,
            metrics: JSON.parse(row.metrics),
            health: JSON.parse(row.health),
          },
        });
      }
      logger.info('MetricsCache initialized and database state cached');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize MetricsCache');
    }
  }

  public static async setLatestMetrics(botId: string, heartbeat: HeartbeatPayload): Promise<void> {
    const entry: MetricsCacheEntry = {
      botId,
      timestamp: heartbeat.timestamp,
      payload: heartbeat,
    };

    this.cache.set(botId, entry);

    // Save to SQLite
    await Storage.run(
      `INSERT OR REPLACE INTO metrics_cache (botId, timestamp, metrics, health) VALUES (?, ?, ?, ?)`,
      [
        botId,
        heartbeat.timestamp,
        JSON.stringify(heartbeat.metrics),
        JSON.stringify(heartbeat.health),
      ]
    ).catch((err) => logger.error({ err }, 'Failed to persist metrics cache'));
  }

  public static getLatestMetrics(botId: string): MetricsCacheEntry | undefined {
    return this.cache.get(botId);
  }

  public static getAllMetrics(): MetricsCacheEntry[] {
    return Array.from(this.cache.values());
  }

  public static removeMetrics(botId: string): void {
    this.cache.delete(botId);
    Storage.run(`DELETE FROM metrics_cache WHERE botId = ?`, [botId])
      .catch((err) => logger.error({ err }, 'Failed to remove metrics cache entry'));
  }
}
