/**
 * Social Updates Module — Manifest
 *
 * Registers the Social Updates module with the Rage Optimiser module system.
 * Provides REST API routes for subscription management, validation, testing, and analytics.
 *
 * Module ID: social_updates
 * API prefix: /api/modules/social_updates/
 */

import { ModuleManifest } from '../../core/types.js';
import { SocialSubscriptionRepository } from './SocialSubscriptionRepository.js';
import { ProviderManager } from './ProviderManager.js';
import { TemplateEngine } from './TemplateEngine.js';
import { NotificationService } from './NotificationService.js';
import { Scheduler } from './Scheduler.js';

// Module-scoped scheduler singleton (persists across route calls via closure)
let _scheduler: Scheduler | null = null;

function getScheduler(client: any, logFn?: (msg: string, type: any) => void): Scheduler {
  if (!_scheduler) {
    _scheduler = new Scheduler(client, logFn);
    _scheduler.initAll().catch(err => console.error('[SocialUpdates] Scheduler init failed:', err));
  } else if (client) {
    _scheduler.updateClient(client);
  }
  return _scheduler;
}

function generateId(): string {
  return `su_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export const SocialUpdatesManifest: ModuleManifest = {
  id: 'social_updates',
  name: 'Social Updates',
  version: '1.0.0',
  description: 'Monitor YouTube channels and Instagram accounts, sending customizable Discord notifications for new content.',

  configSchema: {
    requiredFields: [],
    validate: (_config: Record<string, any>, _registry: any) => {
      // No required global config — subscriptions are stored per-subscription in DB
      return { progress: 100, errors: [] };
    }
  },

  commands: [
    {
      name: 'social-updates',
      description: 'Manage Social Updates subscriptions',
      options: [
        {
          name: 'action',
          type: 3,
          description: 'Action: status, list',
          required: true,
          choices: [
            { name: 'status', value: 'status' },
            { name: 'list', value: 'list' }
          ]
        }
      ]
    }
  ],

  events: [
    {
      name: 'command_social-updates',
      handler: async (client: any, interaction: any, context: any) => {
        const action = interaction.options.getString('action');
        const isAdmin = interaction.member?.permissions?.has?.('ManageGuild') ||
                        interaction.guild?.ownerId === interaction.user?.id;

        if (!isAdmin) {
          return interaction.reply({ content: '🔒 Requires Manage Server permission.', flags: 64 });
        }

        const guildId = interaction.guildId;
        await SocialSubscriptionRepository.ensureTable().catch(() => {});
        const subs = await SocialSubscriptionRepository.findAll(guildId).catch(() => []);

        if (action === 'list' || action === 'status') {
          if (subs.length === 0) {
            return interaction.reply({ content: '📡 **Social Updates** — No subscriptions configured. Use the Web Dashboard to add channels.', flags: 64 });
          }
          const lines = subs.map(s =>
            `• **${s.provider.toUpperCase()}** \`${s.sourceName}\` → <#${s.discordChannelId}> — ${s.enabled ? '✅ Active' : '⏸ Paused'}`
          );
          await interaction.reply({ content: `📡 **Social Updates Subscriptions**\n${lines.join('\n')}`, flags: 64 });
        }
      }
    },
    {
      // Hook into ready event to initialize scheduler with live Discord client
      name: 'ready',
      handler: async (client: any, _: any, context: any) => {
        const scheduler = getScheduler(client, (msg, type) => {
          if (context?.logSyncEvent) context.logSyncEvent(msg, type);
        });
        scheduler.updateClient(client);
      }
    }
  ],

  routes: [
    // ── GET /status ─────────────────────────────────────────────────────────
    {
      path: '/status',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const { guildId } = context;
        await SocialSubscriptionRepository.ensureTable().catch(() => {});

        const subs = await SocialSubscriptionRepository.findAll(guildId);
        const analytics = await SocialSubscriptionRepository.getAnalytics(guildId);

        res.json({
          subscriptions: subs.map(s => ({
            ...s,
            embedConfig: JSON.parse(s.embedConfig || '{}'),
            mentionRoles: JSON.parse(s.mentionRoles || '[]'),
            contentTypes: JSON.parse(s.contentTypes || '{}')
          })),
          analytics
        });
      }
    },

    // ── POST /validate ───────────────────────────────────────────────────────
    {
      path: '/validate',
      method: 'post',
      handler: async (req: any, res: any, _context: any) => {
        const { provider, input } = req.body;
        if (!provider || !input) {
          return res.status(400).json({ error: 'provider and input are required' });
        }

        if (!ProviderManager.has(provider)) {
          return res.status(400).json({ error: `Unknown provider: ${provider}` });
        }

        try {
          const providerInstance = ProviderManager.getProvider(provider);
          const validation = await providerInstance.validate(input);
          res.json(validation);
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      }
    },

    // ── POST /subscribe ──────────────────────────────────────────────────────
    {
      path: '/subscribe',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId, client, logSyncEvent } = context;
        const {
          provider, sourceId, sourceName, sourceAvatar,
          discordChannelId, embedConfig, notificationTemplate,
          mentionRoles, pollingMode, contentTypes
        } = req.body;

        if (!provider || !sourceId || !discordChannelId) {
          return res.status(400).json({ error: 'provider, sourceId, and discordChannelId are required' });
        }

        await SocialSubscriptionRepository.ensureTable().catch(() => {});

        // Duplicate guard — prevent adding the same channel/account twice for this guild
        const existing = await SocialSubscriptionRepository.findBySourceId(guildId, provider, sourceId);
        if (existing) {
          return res.status(409).json({
            error: `This ${provider === 'youtube' ? 'YouTube channel' : 'Instagram account'} is already subscribed in this server. You can configure it from the existing card.`
          });
        }

        const id = generateId();
        await SocialSubscriptionRepository.insert({
          id,
          guildId,
          provider,
          sourceId,
          sourceName: sourceName || sourceId,
          sourceAvatar: sourceAvatar || null,
          discordChannelId,
          embedConfig: JSON.stringify(embedConfig || {}),
          notificationTemplate: notificationTemplate || null,
          mentionRoles: JSON.stringify(mentionRoles || []),
          pollingMode: pollingMode || 'fast',
          contentTypes: JSON.stringify(contentTypes || {
            videos: true, shorts: true, streams: true,
            premieres: true, communityPosts: false, posts: true, reels: true
          }),
          enabled: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Start scheduler for this new subscription
        const scheduler = getScheduler(client, logSyncEvent);
        scheduler.startSubscription(id);

        if (logSyncEvent) logSyncEvent(`Social Updates: Added ${provider} subscription for ${sourceName || sourceId}`, 'success');

        const sub = await SocialSubscriptionRepository.findById(id);
        res.json({
          success: true,
          subscription: {
            ...sub,
            embedConfig: JSON.parse(sub?.embedConfig || '{}'),
            mentionRoles: JSON.parse(sub?.mentionRoles || '[]'),
            contentTypes: JSON.parse(sub?.contentTypes || '{}')
          }
        });
      }
    },

    // ── POST /unsubscribe ────────────────────────────────────────────────────
    {
      path: '/unsubscribe',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId, logSyncEvent } = context;
        const { id } = req.body;

        if (!id) return res.status(400).json({ error: 'id is required' });

        const sub = await SocialSubscriptionRepository.findById(id);
        if (!sub || sub.guildId !== guildId) {
          return res.status(404).json({ error: 'Subscription not found' });
        }

        if (_scheduler) _scheduler.stopSubscription(id);
        await SocialSubscriptionRepository.delete(id);
        if (logSyncEvent) logSyncEvent(`Social Updates: Removed ${sub.provider} subscription for ${sub.sourceName}`, 'warn');

        res.json({ success: true });
      }
    },

    // ── POST /update ─────────────────────────────────────────────────────────
    {
      path: '/update',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId, client, logSyncEvent } = context;
        const { id, ...updates } = req.body;

        if (!id) return res.status(400).json({ error: 'id is required' });

        const sub = await SocialSubscriptionRepository.findById(id);
        if (!sub || sub.guildId !== guildId) {
          return res.status(404).json({ error: 'Subscription not found' });
        }

        const patch: Record<string, any> = {};
        if (updates.discordChannelId !== undefined) patch.discordChannelId = updates.discordChannelId;
        if (updates.embedConfig !== undefined) patch.embedConfig = JSON.stringify(updates.embedConfig);
        if (updates.notificationTemplate !== undefined) patch.notificationTemplate = updates.notificationTemplate;
        if (updates.mentionRoles !== undefined) patch.mentionRoles = JSON.stringify(updates.mentionRoles);
        if (updates.pollingMode !== undefined) patch.pollingMode = updates.pollingMode;
        if (updates.contentTypes !== undefined) patch.contentTypes = JSON.stringify(updates.contentTypes);
        if (updates.enabled !== undefined) patch.enabled = updates.enabled ? 1 : 0;

        await SocialSubscriptionRepository.update(id, patch);

        // Restart scheduler if polling mode or enabled state changed
        if (updates.pollingMode !== undefined || updates.enabled !== undefined) {
          if (_scheduler) {
            _scheduler.stopSubscription(id);
            if (updates.enabled !== false) {
              const scheduler = getScheduler(client, logSyncEvent);
              scheduler.startSubscription(id);
            }
          }
        }

        const updated = await SocialSubscriptionRepository.findById(id);
        res.json({
          success: true,
          subscription: {
            ...updated,
            embedConfig: JSON.parse(updated?.embedConfig || '{}'),
            mentionRoles: JSON.parse(updated?.mentionRoles || '[]'),
            contentTypes: JSON.parse(updated?.contentTypes || '{}')
          }
        });
      }
    },

    // ── POST /test ────────────────────────────────────────────────────────────
    {
      path: '/test',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId, client } = context;
        const { id } = req.body;

        if (!id) return res.status(400).json({ error: 'id is required' });

        const sub = await SocialSubscriptionRepository.findById(id);
        if (!sub || sub.guildId !== guildId) {
          return res.status(404).json({ error: 'Subscription not found' });
        }

        if (!client) return res.status(503).json({ error: 'Discord client not connected' });

        try {
          let embedConfig: any = {};
          try { embedConfig = JSON.parse(sub.embedConfig); } catch {}

          const sampleData = TemplateEngine.getSampleData(sub.provider as 'youtube' | 'instagram');

          // Get channel/guild info for discord context
          const channel = await client.channels.fetch(sub.discordChannelId).catch(() => null);
          const guild = channel?.guild;
          if (guild) {
            sampleData['discord.guild'] = guild.name;
            sampleData['server.name'] = guild.name;
          }
          if (channel) {
            sampleData['discord.channel'] = `#${channel.name}`;
          }

          const result = await NotificationService.send(
            client,
            sub.discordChannelId,
            { ...embedConfig, mentionRoles: JSON.parse(sub.mentionRoles || '[]') },
            sampleData
          );

          res.json(result);
        } catch (err: any) {
          res.status(500).json({ success: false, error: err.message });
        }
      }
    },

    // ── GET /analytics ────────────────────────────────────────────────────────
    {
      path: '/analytics',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const { guildId } = context;
        await SocialSubscriptionRepository.ensureTable().catch(() => {});
        const analytics = await SocialSubscriptionRepository.getAnalytics(guildId);
        res.json(analytics);
      }
    },

    // ── GET /providers ────────────────────────────────────────────────────────
    {
      path: '/providers',
      method: 'get',
      handler: async (_req: any, res: any, _context: any) => {
        res.json({
          providers: ProviderManager.getRegisteredTypes().map(t => {
            const p = ProviderManager.getProvider(t);
            return { type: t, displayName: p.displayName };
          })
        });
      }
    }
  ]
};
