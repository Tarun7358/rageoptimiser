import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const OwnerManifest: ModuleManifest = {
  id: 'owner_commands',
  name: 'Owner Commands',
  version: '1.0.0',
  description: 'Bot owner-only commands: announce, status, servers, reload, shutdown, broadcast.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      return { progress: 100, errors: [] };
    }
  },
  commands: [
    {
      name: 'owner',
      description: 'Bot owner commands',
      options: [
        {
          name: 'status',
          description: 'View full bot status across all guilds',
          type: 1
        },
        {
          name: 'servers',
          description: 'List all servers the bot is in',
          type: 1,
          options: [{ name: 'page', type: 4, description: 'Page number', required: false }]
        },
        {
          name: 'broadcast',
          description: 'Send an announcement to all server log channels',
          type: 1,
          options: [
            { name: 'message', type: 3, description: 'Message to broadcast', required: true },
            { name: 'embed', type: 5, description: 'Send as embed?', required: false }
          ]
        },
        {
          name: 'reload',
          description: 'Reload a module',
          type: 1,
          options: [{ name: 'module', type: 3, description: 'Module ID to reload', required: true }]
        },
        {
          name: 'setpresence',
          description: 'Set the bot presence/activity',
          type: 1,
          options: [
            { name: 'type', type: 3, description: 'Activity type', required: true, choices: [{ name: 'Playing', value: 'PLAYING' }, { name: 'Watching', value: 'WATCHING' }, { name: 'Listening', value: 'LISTENING' }, { name: 'Competing', value: 'COMPETING' }] },
            { name: 'text', type: 3, description: 'Activity text', required: true },
            { name: 'status', type: 3, description: 'Bot status', required: false, choices: [{ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'DND', value: 'dnd' }, { name: 'Invisible', value: 'invisible' }] }
          ]
        },
        {
          name: 'globalban',
          description: 'Ban a user from all bot-moderated servers',
          type: 1,
          options: [
            { name: 'user_id', type: 3, description: 'User ID to globally ban', required: true },
            { name: 'reason', type: 3, description: 'Reason', required: false }
          ]
        },
        {
          name: 'maintenance',
          description: 'Toggle bot maintenance mode',
          type: 1,
          options: [{ name: 'enabled', type: 5, description: 'Enable maintenance mode?', required: true }]
        },
        {
          name: 'leave',
          description: 'Force the bot to leave a server',
          type: 1,
          options: [{ name: 'guild_id', type: 3, description: 'Guild ID to leave', required: true }]
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_owner',
      handler: async (client: any, interaction: any, context: any) => {
        // Owner-only check via env or role
        const ownerIds: string[] = (process.env.OWNER_IDS || process.env.OWNER_ID || '').split(',').map(s => s.trim());
        if (!ownerIds.includes(interaction.user.id)) {
          return interaction.reply({ content: '🔒 **Owner Only.** This command is restricted to the bot owner.', flags: 64 });
        }

        const sub = interaction.options.getSubcommand(false);

        if (sub === 'status') {
          const memory = process.memoryUsage();
          const uptime = process.uptime();
          const days = Math.floor(uptime / 86400);
          const hours = Math.floor(uptime / 3600) % 24;
          const minutes = Math.floor(uptime / 60) % 60;

          const embed = new EmbedBuilder()
            .setTitle('🤖 Bot Status')
            .setColor('#2ecc71')
            .addFields(
              { name: 'Guilds', value: `${client.guilds.cache.size}`, inline: true },
              { name: 'Users', value: `${client.users.cache.size}`, inline: true },
              { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
              { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
              { name: 'Memory', value: `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
              { name: 'Node.js', value: process.version, inline: true }
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'servers') {
          const page = (interaction.options.getInteger('page') || 1) - 1;
          const guilds = [...client.guilds.cache.values()];
          const perPage = 10;
          const start = page * perPage;
          const slice = guilds.slice(start, start + perPage);

          const lines = slice.map((g: any, i: number) => `**${start + i + 1}.** ${g.name} (${g.id}) — ${g.memberCount} members`);
          return interaction.reply({
            content: `🌐 **Servers (${guilds.length} total) — Page ${page + 1}:**\n${lines.join('\n')}`,
            flags: 64
          });
        }

        if (sub === 'broadcast') {
          const message = interaction.options.getString('message');
          const useEmbed = interaction.options.getBoolean('embed') || false;
          await interaction.deferReply({ flags: 64 });

          const modules = context.getModulesState ? context.getModulesState() : [];
          let sent = 0, failed = 0;

          for (const [, guild] of client.guilds.cache) {
            try {
              // Try system/announcement channel first, then first text channel
              const channel = guild.systemChannel || guild.channels.cache.find((c: any) => c.type === 0 && c.viewable);
              if (channel) {
                if (useEmbed) {
                  const embed = new EmbedBuilder()
                    .setTitle('📢 Bot Announcement')
                    .setDescription(message)
                    .setColor('#4f8cff')
                    .setTimestamp();
                  await channel.send({ embeds: [embed] });
                } else {
                  await channel.send(`📢 **Bot Announcement:** ${message}`);
                }
                sent++;
              } else { failed++; }
            } catch { failed++; }
          }

          context.logSyncEvent(`[Owner] Broadcast sent to ${sent} guilds. Failed: ${failed}.`, 'info');
          return interaction.editReply({ content: `✅ Broadcast sent to **${sent}** guilds. Failed: **${failed}**.` });
        }

        if (sub === 'reload') {
          const moduleId = interaction.options.getString('module');
          context.logSyncEvent(`[Owner] Module reload requested: ${moduleId} by ${interaction.user.tag}.`, 'warn');
          return interaction.reply({ content: `🔄 Module reload for \`${moduleId}\` queued. Note: Full reload requires process restart.`, flags: 64 });
        }

        if (sub === 'setpresence') {
          const type = interaction.options.getString('type');
          const text = interaction.options.getString('text');
          const status = interaction.options.getString('status') || 'online';

          const ActivityType: Record<string, number> = { PLAYING: 0, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
          client.user?.setPresence({
            status: status as any,
            activities: [{ name: text, type: ActivityType[type] || 0 }]
          });

          context.logSyncEvent(`[Owner] Presence updated: ${type} ${text} (${status}).`, 'info');
          return interaction.reply({ content: `✅ Presence set: **${type}** "${text}" (${status}).`, flags: 64 });
        }

        if (sub === 'globalban') {
          const userId = interaction.options.getString('user_id');
          const reason = interaction.options.getString('reason') || 'Global ban by bot owner';
          await interaction.deferReply({ flags: 64 });

          let count = 0;
          for (const [, guild] of client.guilds.cache) {
            await guild.members.ban(userId, { reason }).catch(() => {});
            count++;
          }

          context.logSyncEvent(`[Owner] Global ban of ${userId} across ${count} guilds by ${interaction.user.tag}.`, 'warn');
          return interaction.editReply({ content: `🔨 Globally banned user \`${userId}\` from **${count}** servers.` });
        }

        if (sub === 'maintenance') {
          const enabled = interaction.options.getBoolean('enabled');
          context.updateModuleConfig('owner_commands', { maintenanceMode: enabled });
          context.logSyncEvent(`[Owner] Maintenance mode: ${enabled ? 'ENABLED' : 'DISABLED'} by ${interaction.user.tag}.`, 'warn');
          return interaction.reply({ content: `${enabled ? '🔧 **Maintenance Mode ENABLED.**' : '✅ **Maintenance Mode DISABLED.**'}`, flags: 64 });
        }

        if (sub === 'leave') {
          const guildId = interaction.options.getString('guild_id');
          const targetGuild = client.guilds.cache.get(guildId);
          if (!targetGuild) return interaction.reply({ content: `❌ Guild \`${guildId}\` not found.`, flags: 64 });
          const name = targetGuild.name;
          await targetGuild.leave();
          context.logSyncEvent(`[Owner] Left guild "${name}" (${guildId}) by ${interaction.user.tag}.`, 'warn');
          return interaction.reply({ content: `✅ Left server **${name}**.`, flags: 64 });
        }
      }
    }
  ]
};
