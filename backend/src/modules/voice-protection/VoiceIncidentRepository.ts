import { Database } from '../../core/Database.js';

export interface VoiceIncident {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  channelId: string;
  channelName: string;
  loudness: number;
  peakLoudness: number;
  action: string;
  reason: string;
  timestamp: string;
}

export class VoiceIncidentRepository {
  static async ensureTable(): Promise<void> {
    await Database.exec(`
      CREATE TABLE IF NOT EXISTS voice_incidents (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        channelId TEXT NOT NULL,
        channelName TEXT NOT NULL,
        loudness INTEGER NOT NULL,
        peakLoudness INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'Excessive volume detected',
        timestamp TEXT NOT NULL
      )
    `);
    await Database.exec(`
      CREATE INDEX IF NOT EXISTS idx_voice_incidents_guild_user ON voice_incidents (guildId, userId)
    `).catch(() => {});
  }

  static async insert(incident: VoiceIncident): Promise<void> {
    await this.ensureTable();
    await Database.run(
      `INSERT INTO voice_incidents (
        id, guildId, userId, username, channelId, channelName, loudness, peakLoudness, action, reason, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.id,
        incident.guildId,
        incident.userId,
        incident.username,
        incident.channelId,
        incident.channelName,
        incident.loudness,
        incident.peakLoudness,
        incident.action,
        incident.reason,
        incident.timestamp
      ]
    );
  }

  static async getRecentCountForUser(guildId: string, userId: string, sinceMs: number): Promise<number> {
    await this.ensureTable();
    const sinceTime = new Date(Date.now() - sinceMs).toISOString();
    const result = await Database.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM voice_incidents WHERE guildId = ? AND userId = ? AND timestamp >= ?',
      [guildId, userId, sinceTime]
    );
    return result?.count ?? 0;
  }

  static async findRecent(guildId: string, limit = 50): Promise<VoiceIncident[]> {
    await this.ensureTable();
    return Database.all<VoiceIncident>(
      'SELECT * FROM voice_incidents WHERE guildId = ? ORDER BY timestamp DESC LIMIT ?',
      [guildId, limit]
    );
  }
}
