/**
 * Social Updates Module — Manifest
 *
 * Registers the Social Updates module with the platform.
 * Provides REST API routes for dashboard management, validation, sandbox triggers,
 * and modular Discord slash commands.
 */

import { ModuleManifest } from '../../core/types.js';
import { SocialSubscriptionRepository } from './SocialSubscriptionRepository.js';
import { ProviderManager } from './ProviderManager.js';
import { TemplateEngine } from './TemplateEngine.js';
import { NotificationService } from './NotificationService.js';
import { Scheduler } from './Scheduler.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { InstagramFetcher } from './providers/InstagramFetcher.js';
import { NotificationQueue } from './NotificationQueue.js';

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

export const SocialUpdatesManifest: ModuleManifest = {
  id: 'social_updates',
  name: 'Social Updates',
  version: '1.0.0',
  description: 'Monitor YouTube channels and Instagram accounts, sending customizable Discord notifications for new content.',

  configSchema: {
    requiredFields: [],
    validate: (_config: Record<string, any>, _registry: any) => {
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
          description: 'Action: status, list, forcecheck, validate, statistics',
          required: true,
          choices: [
            { name: 'status', value: 'status' },
            { name: 'list', value: 'list' },
            { name: 'forcecheck', value: 'forcecheck' },
            { name: 'validate', value: 'validate' },
            { name: 'statistics', value: 'statistics' }
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

        if (action === 'list') {
          const subs = await SocialSubscriptionRepository.findAll(guildId);
          if (subs.length === 0) {
            return interaction.reply({ content: '📡 **Social Updates** — No subscriptions configured. Use the Web Dashboard to add channels.', flags: 64 });
          }
          const lines = subs.map(s =>
            `• **${s.provider.toUpperCase()}** \`${s.sourceName}\` → <#${s.discordChannelId}> — ${s.enabled ? '✅ Active' : '⏸ Paused'} (Health: **${s.validationStatus}**)`
          );
          await interaction.reply({ content: `📡 **Social Updates Subscriptions**\n${lines.join('\n')}`, flags: 64 });
        } else if (action === 'status') {
          const subs = await SocialSubscriptionRepository.findAll(guildId);
          const active = subs.filter(s => s.enabled).length;
          await interaction.reply({ content: `📡 **Social Updates Status**\nActive Subscriptions: **${active}** / **${subs.length}**\nSystem diagnostics: OK.`, flags: 64 });
        } else if (action === 'forcecheck') {
          if (_scheduler) {
            _scheduler.triggerImmediateCheck();
            await interaction.reply({ content: '⚡ **Force check** triggered globally across all subscriptions.', flags: 64 });
          } else {
            await interaction.reply({ content: '❌ Scheduler not running.', flags: 64 });
          }
        } else if (action === 'validate') {
          await interaction.deferReply({ flags: 64 });
          const subs = await SocialSubscriptionRepository.findAll(guildId);
          let successCount = 0;
          for (const sub of subs) {
            const ok = await SubscriptionManager.validateSubscription(sub.id).catch(() => false);
            if (ok) successCount++;
          }
          await interaction.editReply({ content: `✅ Subscriptions validated. **${successCount}** / **${subs.length}** passed checks.` });
        } else if (action === 'statistics') {
          const analytics = await SocialSubscriptionRepository.getAnalytics(guildId);
          await interaction.reply({
            content: `📊 **Social Updates Statistics**\n` +
                     `• Total Subscriptions: **${analytics.totalSubscriptions}**\n` +
                     `• Active Subscriptions: **${analytics.activeSubscriptions}**\n` +
                     `• Notifications Sent: **${analytics.totalNotificationsSent}**\n` +
                     `• Failed Attempts: **${analytics.totalFailedAttempts}**\n` +
                     `• Avg Delivery Time: **${analytics.avgDeliveryTimeMs}ms**`,
            flags: 64
          });
        }
      }
    },
    {
      name: 'ready',
      handler: async (client: any, _: any, context: any) => {
        const scheduler = getScheduler(client, (msg, type) => {
          if (context?.logSyncEvent) context.logSyncEvent(msg, type);
        });
        scheduler.updateClient(client);
        SubscriptionManager.setScheduler(scheduler);
      }
    }
  ],

  routes: [
    // ── GET /status ─────────────────────────────────────────────────────────
    {
      path: '/status',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const { guildId, client, logSyncEvent } = context;
        await SocialSubscriptionRepository.ensureTable().catch(() => {});

        // Ensure scheduler is active
        getScheduler(client, logSyncEvent);

        const subs = await SocialSubscriptionRepository.findAll(guildId);
        const analytics = await SocialSubscriptionRepository.getAnalytics(guildId);
        const auditLogs = await SocialSubscriptionRepository.getAuditLogs(guildId, 25);

        res.json({
          subscriptions: subs.map(s => SubscriptionManager.deserialize(s)),
          analytics,
          auditLogs,
          queueLength: NotificationQueue.getQueueLength()
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

        // Ensure scheduler is initialized
        getScheduler(client, logSyncEvent);

        const result = await SubscriptionManager.addSubscription(guildId, provider, sourceId, discordChannelId, {
          embedConfig,
          mentionRoles,
          pollingMode,
          contentTypes
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({
          success: true,
          subscription: result.subscription
        });
      }
    },

    // ── POST /unsubscribe ────────────────────────────────────────────────────
    {
      path: '/unsubscribe',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId } = context;
        const { id } = req.body;

        if (!id) return res.status(400).json({ error: 'id is required' });

        const result = await SubscriptionManager.removeSubscription(guildId, id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({ success: true });
      }
    },

    // ── POST /update ─────────────────────────────────────────────────────────
    {
      path: '/update',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { guildId } = context;
        const { id, ...updates } = req.body;

        if (!id) return res.status(400).json({ error: 'id is required' });

        const result = await SubscriptionManager.updateSubscription(guildId, id, updates);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({
          success: true,
          subscription: result.subscription
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

    // ── POST /sandbox/trigger ────────────────────────────────────────────────
    {
      path: '/sandbox/trigger',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { client, logSyncEvent } = context;
        const { username, type, title } = req.body;

        if (!username || !type) {
          return res.status(400).json({ error: 'username and type are required' });
        }

        const validTypes = ['post', 'reel', 'carousel', 'story'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: `Invalid type. Choose from: ${validTypes.join(', ')}` });
        }

        try {
          const item = InstagramFetcher.triggerUpload(username, type, title);

          // Force scheduler check immediately to discover the new mock item
          const scheduler = getScheduler(client, logSyncEvent);
          scheduler.triggerImmediateCheck();

          res.json({
            success: true,
            message: `Mock Instagram ${type} triggered for @${username}.`,
            item
          });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
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
