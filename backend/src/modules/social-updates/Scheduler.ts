/**
 * Social Updates Module — Scheduler
 *
 * Manages polling timers for each active social subscription.
 * On each tick: fetches latest content → detects new items → sends Discord notifications.
 *
 * Polling modes:
 *   fast   → 2 minutes  (high API usage)
 *   normal → 10 minutes (balanced)
 *   slow   → 30 minutes (minimal API usage)
 */

import { SocialSubscriptionRepository } from './SocialSubscriptionRepository.js';
import { ProviderManager } from './ProviderManager.js';
import { NotificationService } from './NotificationService.js';
import { TemplateEngine } from './TemplateEngine.js';
import type { ContentTypeFilter } from './providers/BaseProvider.js';

const POLLING_INTERVALS: Record<string, number> = {
  fast:   30 * 1000,        // 30 seconds (super-fast, like Koya)
  normal: 10 * 60 * 1000,   // 10 minutes
  slow:   30 * 60 * 1000    // 30 minutes
};

export class Scheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private client: any = null;
  private logFn: ((msg: string, type: 'info' | 'warn' | 'success') => void) | null = null;

  constructor(client: any, logFn?: (msg: string, type: 'info' | 'warn' | 'success') => void) {
    this.client = client;
    this.logFn = logFn || null;
  }

  private log(msg: string, type: 'info' | 'warn' | 'success' = 'info') {
    if (this.logFn) this.logFn(`[SocialUpdates] ${msg}`, type);
    else console.log(`[SocialUpdates] ${msg}`);
  }

  /**
   * Start (or restart) the scheduler for a specific subscription.
   */
  startSubscription(subscriptionId: string) {
    this.stopSubscription(subscriptionId);

    // C-3 FIX: Only ONE initial poll — run it immediately, then schedule
    // the repeating cycle. Do NOT call pollSubscription again inside reschedule's
    // first invocation, which was previously causing a double-fire on startup.
    const reschedule = async () => {
      await this.pollSubscription(subscriptionId).catch(err =>
        this.log(`Poll error for ${subscriptionId}: ${err.message}`, 'warn')
      );

      const sub = await SocialSubscriptionRepository.findById(subscriptionId).catch(() => null);
      if (!sub || !sub.enabled) {
        this.timers.delete(subscriptionId);
        return;
      }
      const interval = POLLING_INTERVALS[sub.pollingMode] || POLLING_INTERVALS.fast;
      const timer = setTimeout(reschedule, interval);
      this.timers.set(subscriptionId, timer);
    };

    // Run immediately once (non-blocking) then start the recurring timer chain
    this.pollSubscription(subscriptionId)
      .catch(err => this.log(`Initial poll error for ${subscriptionId}: ${err.message}`, 'warn'))
      .then(async () => {
        const sub = await SocialSubscriptionRepository.findById(subscriptionId).catch(() => null);
        if (!sub || !sub.enabled) return;
        const interval = POLLING_INTERVALS[sub.pollingMode] || POLLING_INTERVALS.fast;
        const timer = setTimeout(reschedule, interval);
        this.timers.set(subscriptionId, timer);
      });
  }

  /**
   * Stop the scheduler for a specific subscription.
   */
  stopSubscription(subscriptionId: string) {
    const existing = this.timers.get(subscriptionId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(subscriptionId);
    }
  }

  /**
   * Initialize all enabled subscriptions from DB.
   */
  async initAll() {
    try {
      await SocialSubscriptionRepository.ensureTable();
      const subs = await SocialSubscriptionRepository.findAllEnabled();
      for (const sub of subs) {
        this.startSubscription(sub.id);
      }
      this.log(`Initialized scheduler for ${subs.length} active subscriptions`, 'success');
    } catch (err: any) {
      this.log(`Failed to initialize scheduler: ${err.message}`, 'warn');
    }
  }

  /**
   * Stop all running timers (for graceful shutdown).
   */
  stopAll() {
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Core polling logic for a single subscription.
   */
  private async pollSubscription(subscriptionId: string): Promise<void> {
    let sub = await SocialSubscriptionRepository.findById(subscriptionId).catch(() => null);
    if (!sub || !sub.enabled) return;

    if (!this.client) return;

    try {
      const provider = ProviderManager.getProvider(sub.provider);
      const items = await provider.fetchLatest(sub.sourceId, 15);

      // Parse content types filter
      let contentFilter: ContentTypeFilter;
      try {
        contentFilter = JSON.parse(sub.contentTypes);
      } catch {
        contentFilter = { videos: true, shorts: true, streams: true, premieres: true, communityPosts: false, posts: true, reels: true };
      }

      // Apply filter
      const filteredItems = provider.filterByContentType(items, contentFilter);

      // Detect new items
      const newItems = provider.detectNew(filteredItems, sub.lastProcessedId || null);

      if (!sub.lastProcessedId) {
        // First run: just initialize lastProcessedId with the latest item ID to avoid accidental pings
        const latestItem = filteredItems[0] || items[0];
        if (latestItem) {
          await SocialSubscriptionRepository.update(subscriptionId, {
            lastProcessedId: latestItem.id,
            lastSyncTimestamp: new Date().toISOString()
          });
          this.log(`Initialized first processed ID for ${sub.provider}:${sub.sourceName} to: ${latestItem.id}`, 'info');
        }
        return;
      }

      if (newItems.length === 0) {
        // Still update lastSyncTimestamp
        await SocialSubscriptionRepository.update(subscriptionId, {
          lastSyncTimestamp: new Date().toISOString()
        });
        return;
      }

      // Parse embed config
      let embedConfig: any = {};
      try {
        embedConfig = JSON.parse(sub.embedConfig);
      } catch {}

      // Process each new item (most recent last, to keep lastProcessedId as newest)
      const reversed = [...newItems].reverse();
      for (const item of reversed) {
        const templateData = provider.prepareTemplateData(item, {
          sourceId: sub.sourceId,
          sourceName: sub.sourceName,
          sourceAvatar: sub.sourceAvatar
        });

        // Add Discord context (try to get guild/channel name)
        try {
          const channel = await this.client.channels.fetch(sub.discordChannelId).catch(() => null);
          const guild = channel?.guild;
          templateData['discord.guild'] = guild?.name || '';
          templateData['server.name'] = guild?.name || '';
          templateData['discord.channel'] = channel ? `#${channel.name}` : '';
          const mentionRoles: string[] = JSON.parse(sub.mentionRoles || '[]');
          templateData['role.mention'] = mentionRoles
            .map((r: string) => r === 'everyone' ? '@everyone' : r === 'here' ? '@here' : `<@&${r}>`)
            .join(' ');
        } catch {}

        const result = await NotificationService.send(
          this.client,
          sub.discordChannelId,
          { ...embedConfig, mentionRoles: JSON.parse(sub.mentionRoles || '[]') },
          templateData
        );

        if (result.success) {
          await SocialSubscriptionRepository.recordSuccess(
            subscriptionId,
            item.id,
            result.deliveryTime || 0
          );
          this.log(`Sent notification for ${sub.provider}:${sub.sourceName} → ${item.title}`, 'success');
        } else {
          await SocialSubscriptionRepository.recordFailure(subscriptionId, result.error || 'Unknown error');
          this.log(`Failed to send notification for ${sub.sourceName}: ${result.error}`, 'warn');
        }

        // Re-fetch sub to get updated lastProcessedId for next item
        sub = await SocialSubscriptionRepository.findById(subscriptionId).catch(() => sub);
        if (!sub) break;
      }
    } catch (err: any) {
      await SocialSubscriptionRepository.recordFailure(subscriptionId, err.message || 'Poll error');
      this.log(`Poll failed for subscription ${subscriptionId}: ${err.message}`, 'warn');
    }
  }

  /**
   * Update the Discord client reference (called when Gateway reconnects).
   */
  updateClient(client: any) {
    this.client = client;
  }
}
