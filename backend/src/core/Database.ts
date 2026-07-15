import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export class Database {
  private static isConnected = false;
  private static dbInstance: sqlite3.Database | null = null;

  public static async connect(): Promise<void> {
    if (this.isConnected) return;

    let dbPath = path.resolve(process.cwd(), '../database.sqlite');
    if (fs.existsSync(path.resolve(process.cwd(), 'docker-compose.yml'))) {
      dbPath = path.resolve(process.cwd(), 'database.sqlite');
    }

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.dbInstance = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error('❌ Failed to open SQLite database:', err.message);
          return reject(err);
        }
        console.log(`[Database] SQLite database opened at: ${dbPath}`);
        this.isConnected = true;
        
        try {
          await this.initializeSchemas();
          console.log('✅ SQLite schemas initialized successfully.');
          resolve();
        } catch (schemaErr) {
          reject(schemaErr);
        }
      });
    });
  }

  /**
   * Returns the raw sqlite3 Database instance, or null if not yet connected.
   * Use this when you need an actual nullable guard (if (!db) return ...).
   * For direct queries, prefer the static Database.run/get/all methods.
   */
  public static getDb(): typeof Database | null {
    if (!this.isConnected || !this.dbInstance) return null;
    return this;
  }

  // Promise-based wrappers for sqlite3
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
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        totpEnabled INTEGER DEFAULT 0,
        totpSecret TEXT,
        recoveryCodes TEXT,
        failedAttempts INTEGER DEFAULT 0,
        lockedUntil TEXT,
        lastLogin TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS guild_configs (
        guildId TEXT PRIMARY KEY,
        modules TEXT NOT NULL,
        globalSettings TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS approvals (
        guildId TEXT PRIMARY KEY,
        guildName TEXT NOT NULL,
        ownerId TEXT,
        ownerUsername TEXT,
        memberCount INTEGER DEFAULT 0,
        botCount INTEGER DEFAULT 0,
        humanCount INTEGER DEFAULT 0,
        verificationLevel INTEGER DEFAULT 0,
        premiumTier INTEGER DEFAULT 0,
        premiumSubscriptionCount INTEGER DEFAULT 0,
        riskScore INTEGER DEFAULT 0,
        riskLevel TEXT,
        status TEXT DEFAULT 'Pending',
        blacklistedBy TEXT,
        blacklistedAt INTEGER,
        approvedBy TEXT,
        approvedAt INTEGER,
        rejectedBy TEXT,
        rejectedAt INTEGER,
        rejectionReason TEXT,
        notes TEXT,
        joinedAt INTEGER,
        lastUpdated INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS guild_backups (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        guildId TEXT NOT NULL,
        guildName TEXT NOT NULL,
        createdByName TEXT,
        channelsCount INTEGER DEFAULT 0,
        rolesCount INTEGER DEFAULT 0,
        emojisCount INTEGER DEFAULT 0,
        data TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS upm_snapshots (
        guildId TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        channels TEXT,
        roles TEXT,
        guildSettings TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS guild_warnings (
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        warnings TEXT NOT NULL,
        PRIMARY KEY (guildId, userId)
      );`,
      `CREATE TABLE IF NOT EXISTS guild_verifications (
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        verifiedAt TEXT NOT NULL,
        PRIMARY KEY (guildId, userId)
      );`,
      `CREATE TABLE IF NOT EXISTS guild_afk (
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        reason TEXT,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (guildId, userId)
      );`,
      `CREATE TABLE IF NOT EXISTS guild_xp (
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (guildId, userId)
      );`,
      `CREATE TABLE IF NOT EXISTS guild_economy (
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        balance INTEGER DEFAULT 0,
        lastDaily INTEGER DEFAULT 0,
        lastWork INTEGER DEFAULT 0,
        inventory TEXT,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (guildId, userId)
      );`,
      `CREATE TABLE IF NOT EXISTS discord_sessions (
        discordId TEXT PRIMARY KEY,
        discordUsername TEXT NOT NULL,
        discordAvatar TEXT,
        accessToken TEXT NOT NULL,
        managedGuildIds TEXT NOT NULL,
        loginAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS public_feed (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS upm_rollbacks (
        id TEXT PRIMARY KEY,
        roles TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS guild_analytics (
        guildId TEXT NOT NULL,
        date TEXT NOT NULL,
        joins INTEGER DEFAULT 0,
        leaves INTEGER DEFAULT 0,
        messages INTEGER DEFAULT 0,
        voiceMinutes INTEGER DEFAULT 0,
        commands INTEGER DEFAULT 0,
        PRIMARY KEY (guildId, date)
      );`
    ];

    for (const schema of schemas) {
      await this.exec(schema);
    }
  }
}
