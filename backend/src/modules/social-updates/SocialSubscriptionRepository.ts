/**
 * Social Updates Module — SocialSubscriptionRepository
 *
 * All database operations for social_subscriptions table.
 * This repository is the single source of truth for subscription persistence.
 */

import { Database } from '../../core/Database.js';

export interface SocialSubscription {
  id: string;
  guildId: string;
  provider: string;               // 'youtube' | 'instagram'
  sourceId: string;               // YouTube channel ID or IG username
  sourceName: string;
  sourceAvatar?: string;
  discordChannelId: string;
  embedConfig: string;            // JSON serialized EmbedConfig
  notificationTemplate?: string; // Plain text before embed
  mentionRoles: string;           // JSON array of role IDs
  pollingMode: string;            // 'fast' | 'normal' | 'slow'
  contentTypes: string;           // JSON: {videos, shorts, streams, premieres, posts, reels}
  enabled: number;                // 0 | 1
  lastProcessedId?: string;
  lastSyncTimestamp?: string;
  failedAttempts: number;
  lastError?: string;
  totalNotificationsSent: number;
  totalDeliveryTimeMs: number;    // For average calculation
  createdAt: string;
  updatedAt: string;
}

export class SocialSubscriptionRepository {
  static async ensureTable(): Promise<void> {
    await Database.exec(`
      CREATE TABLE IF NOT EXISTS social_subscriptions (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        provider TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        sourceName TEXT NOT NULL DEFAULT '',
        sourceAvatar TEXT,
        discordChannelId TEXT NOT NULL,
        embedConfig TEXT NOT NULL DEFAULT '{}',
        notificationTemplate TEXT,
        mentionRoles TEXT NOT NULL DEFAULT '[]',
        pollingMode TEXT NOT NULL DEFAULT 'normal',
        contentTypes TEXT NOT NULL DEFAULT '{"videos":true,"shorts":true,"streams":true,"premieres":true,"communityPosts":false,"posts":true,"reels":true}',
        enabled INTEGER NOT NULL DEFAULT 1,
        lastProcessedId TEXT,
        lastSyncTimestamp TEXT,
        failedAttempts INTEGER NOT NULL DEFAULT 0,
        lastError TEXT,
        totalNotificationsSent INTEGER NOT NULL DEFAULT 0,
        totalDeliveryTimeMs INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    // Add analytics columns if upgrading from an older schema
    await Database.exec(`
      CREATE INDEX IF NOT EXISTS idx_social_guild ON social_subscriptions (guildId)
    `).catch(() => {});
  }

  static async findAll(guildId: string): Promise<SocialSubscription[]> {
    return Database.all<SocialSubscription>(
      'SELECT * FROM social_subscriptions WHERE guildId = ? ORDER BY createdAt ASC',
      [guildId]
    );
  }

  static async findByProvider(guildId: string, provider: string): Promise<SocialSubscription[]> {
    return Database.all<SocialSubscription>(
      'SELECT * FROM social_subscriptions WHERE guildId = ? AND provider = ? ORDER BY createdAt ASC',
      [guildId, provider]
    );
  }

  static async findById(id: string): Promise<SocialSubscription | null> {
    return Database.get<SocialSubscription>(
      'SELECT * FROM social_subscriptions WHERE id = ?',
      [id]
    );
  }

  static async findAllEnabled(): Promise<SocialSubscription[]> {
    return Database.all<SocialSubscription>(
      'SELECT * FROM social_subscriptions WHERE enabled = 1'
    );
  }

  static async findBySourceId(guildId: string, provider: string, sourceId: string): Promise<SocialSubscription | null> {
    return Database.get<SocialSubscription>(
      'SELECT * FROM social_subscriptions WHERE guildId = ? AND provider = ? AND sourceId = ?',
      [guildId, provider, sourceId]
    );
  }

  static async insert(sub: Omit<SocialSubscription, 'failedAttempts' | 'totalNotificationsSent' | 'totalDeliveryTimeMs'>): Promise<void> {
    const now = new Date().toISOString();
    await Database.run(
      `INSERT INTO social_subscriptions (
        id, guildId, provider, sourceId, sourceName, sourceAvatar,
        discordChannelId, embedConfig, notificationTemplate, mentionRoles,
        pollingMode, contentTypes, enabled,
        lastProcessedId, lastSyncTimestamp, failedAttempts, lastError,
        totalNotificationsSent, totalDeliveryTimeMs, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, null, 0, 0, ?, ?)`,
      [
        sub.id, sub.guildId, sub.provider, sub.sourceId, sub.sourceName,
        sub.sourceAvatar || null, sub.discordChannelId,
        sub.embedConfig, sub.notificationTemplate || null,
        sub.mentionRoles, sub.pollingMode, sub.contentTypes,
        sub.enabled ? 1 : 0, sub.lastProcessedId || null,
        sub.lastSyncTimestamp || null, now, now
      ]
    );
  }

  static async update(id: string, fields: Partial<SocialSubscription>): Promise<void> {
    const now = new Date().toISOString();
    const setClauses: string[] = [];
    const params: any[] = [];

    const allowed = [
      'discordChannelId', 'embedConfig', 'notificationTemplate', 'mentionRoles',
      'pollingMode', 'contentTypes', 'enabled', 'lastProcessedId',
      'lastSyncTimestamp', 'failedAttempts', 'lastError',
      'totalNotificationsSent', 'totalDeliveryTimeMs', 'sourceName', 'sourceAvatar'
    ];

    for (const key of allowed) {
      if (fields[key as keyof SocialSubscription] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(fields[key as keyof SocialSubscription]);
      }
    }

    if (setClauses.length === 0) return;

    setClauses.push('updatedAt = ?');
    params.push(now);
    params.push(id);

    await Database.run(
      `UPDATE social_subscriptions SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
  }

  static async recordSuccess(id: string, newLastId: string, deliveryTimeMs: number): Promise<void> {
    const now = new Date().toISOString();
    await Database.run(
      `UPDATE social_subscriptions 
       SET lastProcessedId = ?, lastSyncTimestamp = ?, failedAttempts = 0, lastError = null,
           totalNotificationsSent = totalNotificationsSent + 1,
           totalDeliveryTimeMs = totalDeliveryTimeMs + ?,
           updatedAt = ?
       WHERE id = ?`,
      [newLastId, now, deliveryTimeMs, now, id]
    );
  }

  static async recordFailure(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await Database.run(
      `UPDATE social_subscriptions 
       SET failedAttempts = failedAttempts + 1, lastError = ?, lastSyncTimestamp = ?, updatedAt = ?
       WHERE id = ?`,
      [error.substring(0, 500), now, now, id]
    );
  }

  static async delete(id: string): Promise<void> {
    await Database.run('DELETE FROM social_subscriptions WHERE id = ?', [id]);
  }

  static async getAnalytics(guildId: string): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalNotificationsSent: number;
    totalFailedAttempts: number;
    avgDeliveryTimeMs: number;
    byProvider: Record<string, number>;
  }> {
    const subs = await this.findAll(guildId);

    const totalNotifications = subs.reduce((s, x) => s + (x.totalNotificationsSent || 0), 0);
    const totalDelivery = subs.reduce((s, x) => s + (x.totalDeliveryTimeMs || 0), 0);
    const totalFailed = subs.reduce((s, x) => s + (x.failedAttempts || 0), 0);
    const byProvider: Record<string, number> = {};
    for (const sub of subs) {
      byProvider[sub.provider] = (byProvider[sub.provider] || 0) + 1;
    }

    return {
      totalSubscriptions: subs.length,
      activeSubscriptions: subs.filter(s => s.enabled).length,
      totalNotificationsSent: totalNotifications,
      totalFailedAttempts: totalFailed,
      avgDeliveryTimeMs: totalNotifications > 0 ? Math.round(totalDelivery / totalNotifications) : 0,
      byProvider
    };
  }
}
