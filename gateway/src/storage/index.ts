import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { logger } from '../logging/index.js';

export class Storage {
  private static isConnected = false;
  private static dbInstance: sqlite3.Database | null = null;

  public static async connect(): Promise<void> {
    if (this.isConnected) return;

    const dbPath = path.resolve(config.DATABASE_PATH);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.dbInstance = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          logger.error({ err }, 'Failed to open SQLite database');
          return reject(err);
        }
        logger.info(`SQLite database opened at: ${dbPath}`);
        this.isConnected = true;

        try {
          await this.initializeSchemas();
          logger.info('Gateway SQLite database schemas initialized successfully');
          resolve();
        } catch (schemaErr) {
          reject(schemaErr);
        }
      });
    });
  }

  public static run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.dbInstance) return reject(new Error('Database not connected'));
      this.dbInstance.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID || 0, changes: this.changes || 0 });
      });
    });
  }

  public static get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.dbInstance) return reject(new Error('Database not connected'));
      this.dbInstance.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  public static all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.dbInstance) return reject(new Error('Database not connected'));
      this.dbInstance.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  public static exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.dbInstance) return reject(new Error('Database not connected'));
      this.dbInstance.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private static async initializeSchemas(): Promise<void> {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_events_session ON events (sessionId, sequence);`,
      
      `CREATE TABLE IF NOT EXISTS metrics_cache (
        botId TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        metrics TEXT NOT NULL,
        health TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS session_states (
        sessionId TEXT PRIMARY KEY,
        botId TEXT NOT NULL,
        connectedSince TEXT NOT NULL,
        lastHeartbeat TEXT NOT NULL,
        gatewayVersion TEXT NOT NULL,
        monitoringVersion TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        platform TEXT NOT NULL,
        os TEXT NOT NULL,
        nodeVersion TEXT NOT NULL,
        ip TEXT NOT NULL,
        status TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        botId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolvedAt TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_bot ON alerts (botId);`
    ];

    for (const schema of schemas) {
      await this.exec(schema);
    }
  }
}
