import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { checkWhitelistPermission, getGuildAndCheckPermission, protections } from '../../utils/whitelistCheck.js';

export interface BotWhitelistRecord {
  id: string; // The database ID (usually same as userId)
  userId: string;
  tag: string;
  managedRoleId: string;
  status: 'active' | 'inactive' | 'pending';
  autoConfigure: boolean;
  autoRestore: boolean;
  enabledModules?: string[];
  lastJoined?: string;
  lastLeft?: string;
  notes?: string;
}

export const BotWhitelistManifest: ModuleManifest = {
  id: 'bot_whitelist',
  name: 'Bot Whitelist',
  version: '1.0.0',
  description: 'Manage trusted third-party bots and enforce strict single-role permissions.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      let progress = 100;
      return { progress, errors: [] };
    }
  },
  commands: [
    {
      name: 'bot',
      description: 'Bot Whitelist Management',
      options: [
        {
          name: 'whitelist',
          description: 'Manage whitelisted bots',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            {
              name: 'add',
              description: 'Add a bot to the whitelist',
              type: 1, // SUB_COMMAND
              options: [
                { name: 'bot_user', type: 6, description: 'The bot to whitelist', required: true },
                { name: 'managed_role', type: 8, description: 'The single managed role to assign', required: true },
                { name: 'notes', type: 3, description: 'Purpose of this bot', required: false }
              ]
            },
            {
              name: 'remove',
              description: 'Remove a bot from the whitelist',
              type: 1,
              options: [
                { name: 'bot_user', type: 6, description: 'The bot to remove', required: true }
              ]
            },
            {
              name: 'list',
              description: 'List all whitelisted bots',
              type: 1
            },
            {
              name: 'info',
              description: 'Get info on a specific bot',
              type: 1,
              options: [
                { name: 'bot_user', type: 6, description: 'The bot to inspect', required: true }
              ]
            },
            {
              name: 'sync',
              description: 'Force sync a bots roles (strip non-managed, apply managed)',
              type: 1,
              options: [
                { name: 'bot_user', type: 6, description: 'The bot to sync', required: true }
              ]
            }
          ]
        },
        {
          name: 'role',
          description: 'Manage a bots managed role',
          type: 2,
          options: [
            {
              name: 'change',
              description: 'Change the managed role for a whitelisted bot',
              type: 1,
              options: [
                { name: 'bot_user', type: 6, description: 'The bot', required: true },
                { name: 'new_role', type: 8, description: 'The new managed role', required: true }
              ]
            }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'guildMemberAdd',
      handler: async (client: any, member: any, context: any) => {
        if (!member.user.bot) return;

        const modules = context.getModulesState ? context.getModulesState() : [];
        const bwModule = modules.find((m: any) => m.id === 'bot_whitelist');
        if (!bwModule || bwModule.status !== 'enabled') return;

        const bots = bwModule.config.bots || [];
        const botRecord = bots.find((b: BotWhitelistRecord) => b.userId === member.user.id);

        if (botRecord) {
          // Trusted bot rejoining
          botRecord.status = 'active';
          botRecord.lastJoined = new Date().toISOString();
          
          if (botRecord.autoConfigure) {
            try {
              const rolesToRemove = member.roles.cache.filter((r: any) => r.name !== '@everyone' && !r.managed && r.id !== botRecord.managedRoleId);
              for (const [id, role] of rolesToRemove) {
                await member.roles.remove(id).catch(() => {});
              }
              await member.roles.add(botRecord.managedRoleId).catch(() => {});
              context.logSyncEvent(`[Bot Whitelist] Auto-configured rejoined bot ${member.user.tag}. Restored managed role.`, 'success');
            } catch (e) {
              console.error(e);
            }
          } else {
            context.logSyncEvent(`[Bot Whitelist] Whitelisted bot ${member.user.tag} rejoined (Auto-configure disabled).`, 'info');
          }
          
          // Update state and write to DB collection conceptually
          context.updateModuleConfig('bot_whitelist', { bots });
        } else {
          // Untracked bot joined
          context.logSyncEvent(`[Bot Whitelist] Alert: Untracked bot ${member.user.tag} joined the server. It is ignored by the Whitelist system.`, 'warn');
        }
      }
    },
    {
      name: 'guildMemberRemove',
      handler: async (client: any, member: any, context: any) => {
        if (!member.user.bot) return;

        const modules = context.getModulesState ? context.getModulesState() : [];
        const bwModule = modules.find((m: any) => m.id === 'bot_whitelist');
        if (!bwModule || bwModule.status !== 'enabled') return;

        const bots = bwModule.config.bots || [];
        const botRecord = bots.find((b: BotWhitelistRecord) => b.userId === member.user.id);

        if (botRecord) {
          botRecord.status = 'inactive';
          botRecord.lastLeft = new Date().toISOString();
          context.updateModuleConfig('bot_whitelist', { bots });
          context.logSyncEvent(`[Bot Whitelist] Whitelisted bot ${member.user.tag} left the server. Status marked Inactive.`, 'warn');
        }
      }
    },
    {
      name: 'command_bot',
      handler: async (client: any, interaction: any, context: any) => {
        const hasPermission = await checkWhitelistPermission(interaction.user.id, interaction.guild, context);
        if (!hasPermission) {
          return interaction.reply({ content: '🔒 **Access Denied** — Only the Server Owner and whitelisted users can manage the whitelist.', flags: 64 });
        }

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const modules = context.getModulesState ? context.getModulesState() : [];
        const bwModule = modules.find((m: any) => m.id === 'bot_whitelist');
        
        if (!bwModule || bwModule.status !== 'enabled') {
          return interaction.reply({ content: '❌ Bot Whitelist module is not enabled in the dashboard.', flags: 64 });
        }
        
        let bots = bwModule.config.bots || [];

        if (group === 'whitelist' && subcommand === 'add') {
          const targetBot = interaction.options.getUser('bot_user', true);
          const role = interaction.options.getRole('managed_role', true);
          const notes = interaction.options.getString('notes') || '';
          
          if (!targetBot.bot) return interaction.reply({ content: '❌ Target user is not a bot.', flags: 64 });
          
          let botRecord = bots.find((b: BotWhitelistRecord) => b.userId === targetBot.id);
          
          if (!botRecord) {
            botRecord = {
              id: targetBot.id,
              userId: targetBot.id,
              tag: targetBot.tag,
              managedRoleId: role.id,
              status: 'pending',
              autoConfigure: true,
              autoRestore: true,
              enabledModules: protections.map(p => p.key), // Default all bypassed
              notes
            };
            bots.push(botRecord);
            context.updateModuleConfig('bot_whitelist', { bots });
            context.logSyncEvent(`[Bot Whitelist] Added bot ${targetBot.tag} via command.`, 'success');
          }

          // Build configuration embed and select menu
          const embed = new EmbedBuilder()
            .setTitle(`Whitelist Configuration for ${interaction.guild.name} Server`)
            .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
            .setColor('#7C5CFC')
            .setTimestamp();

          const buildDescription = (enabledModules: string[]) => {
            return protections.map(p => {
              const emoji = enabledModules.includes(p.key) ? '✅' : '❌';
              return `${emoji} : **${p.label}**`;
            }).join('\n');
          };

          embed.setDescription(buildDescription(botRecord.enabledModules || []))
            .addFields(
              { name: 'Target Bot', value: `<@${targetBot.id}> (\`${targetBot.tag}\`)`, inline: true },
              { name: 'Managed Role', value: `<@&${role.id}>`, inline: true }
            );

          const buildSelectMenu = (enabledModules: string[]) => {
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`wl_select_bot_${targetBot.id}`)
              .setPlaceholder('Configure whitelisted bypass protections')
              .setMinValues(0)
              .setMaxValues(protections.length)
              .addOptions(
                protections.map(p => {
                  const option = new StringSelectMenuOptionBuilder()
                    .setLabel(p.label)
                    .setValue(p.key)
                    .setDescription(`Toggle bypass for ${p.label}`);
                  if (enabledModules.includes(p.key)) {
                    option.setDefault(true);
                  }
                  return option;
                })
              );
            return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
          };

          const reply = await interaction.reply({
            embeds: [embed],
            components: [buildSelectMenu(botRecord.enabledModules || [])],
            flags: 64,
            fetchReply: true
          });

          const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 600000 // 10 minutes
          });

          collector.on('collect', async (i: any) => {
            const hasPerm = await checkWhitelistPermission(i.user.id, i.guild, context);
            if (!hasPerm) {
              return i.reply({ content: '🔒 **Access Denied** — Only the Server Owner and whitelisted users can modify the whitelist.', flags: 64 });
            }

            const newBypasses = i.values || [];

            const freshModules = context.getModulesState ? context.getModulesState() : [];
            const freshBw = freshModules.find((m: any) => m.id === 'bot_whitelist');
            let freshBots = freshBw?.config?.bots || [];

            freshBots = freshBots.map((b: any) => {
              if (b.userId === targetBot.id) {
                return { ...b, enabledModules: newBypasses };
              }
              return b;
            });

            context.updateModuleConfig('bot_whitelist', { bots: freshBots });

            embed.setDescription(buildDescription(newBypasses));
            await i.update({
              embeds: [embed],
              components: [buildSelectMenu(newBypasses)]
            });
          });

          return;
        }
        
        if (group === 'whitelist' && subcommand === 'remove') {
          const targetBot = interaction.options.getUser('bot_user', true);
          if (!bots.find((b: BotWhitelistRecord) => b.userId === targetBot.id)) {
            return interaction.reply({ content: '❌ This bot is not whitelisted.', flags: 64 });
          }
          
          bots = bots.filter((b: BotWhitelistRecord) => b.userId !== targetBot.id);
          context.updateModuleConfig('bot_whitelist', { bots });
          context.logSyncEvent(`[Bot Whitelist] Removed bot ${targetBot.tag} via command.`, 'info');
          return interaction.reply({ content: `🗑️ Removed bot **${targetBot.tag}** from the whitelist.`, flags: 64 });
        }

        if (group === 'whitelist' && subcommand === 'list') {
          if (bots.length === 0) return interaction.reply({ content: 'The bot whitelist is currently empty.', flags: 64 });
          const list = bots.map((b: BotWhitelistRecord) => `- **${b.tag}** (Role: <@&${b.managedRoleId}>) [${b.status.toUpperCase()}]`).join('\n');
          return interaction.reply({ content: `**Whitelisted Bots:**\n${list}`, flags: 64 });
        }

        if (group === 'whitelist' && subcommand === 'info') {
          const targetBot = interaction.options.getUser('bot_user', true);
          const b = bots.find((x: BotWhitelistRecord) => x.userId === targetBot.id);
          if (!b) return interaction.reply({ content: '❌ This bot is not whitelisted.', flags: 64 });
          
          const embed = new EmbedBuilder()
            .setTitle(`Bot Info: ${b.tag}`)
            .setColor('#7C5CFC')
            .addFields(
              { name: 'Bot ID', value: b.userId, inline: true },
              { name: 'Status', value: b.status.toUpperCase(), inline: true },
              { name: 'Managed Role', value: `<@&${b.managedRoleId}>`, inline: true },
              { name: 'Auto-Configure', value: b.autoConfigure ? 'Enabled' : 'Disabled', inline: true },
              { name: 'Auto-Restore', value: b.autoRestore ? 'Enabled' : 'Disabled', inline: true },
              { name: 'Notes', value: b.notes || 'None', inline: false }
            );
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (group === 'whitelist' && subcommand === 'sync') {
          const targetBot = interaction.options.getUser('bot_user', true);
          const b = bots.find((x: BotWhitelistRecord) => x.userId === targetBot.id);
          if (!b) return interaction.reply({ content: '❌ This bot is not whitelisted.', flags: 64 });

          const member = await interaction.guild.members.fetch(targetBot.id).catch(() => null);
          if (!member) return interaction.reply({ content: '❌ Bot is not in the server.', flags: 64 });

          try {
            const rolesToRemove = member.roles.cache.filter((r: any) => r.name !== '@everyone' && !r.managed && r.id !== b.managedRoleId);
            for (const [id, role] of rolesToRemove) {
              await member.roles.remove(id).catch(() => {});
            }
            await member.roles.add(b.managedRoleId).catch(() => {});
            return interaction.reply({ content: `✅ Roles synced for **${targetBot.tag}**. Managed role applied, others stripped.`, flags: 64 });
          } catch (e) {
            return interaction.reply({ content: `❌ Failed to sync roles: ${e}`, flags: 64 });
          }
        }

        if (group === 'role' && subcommand === 'change') {
          const targetBot = interaction.options.getUser('bot_user', true);
          const role = interaction.options.getRole('new_role', true);
          const botRecord = bots.find((b: BotWhitelistRecord) => b.userId === targetBot.id);
          
          if (!botRecord) return interaction.reply({ content: '❌ This bot is not whitelisted.', flags: 64 });
          
          botRecord.managedRoleId = role.id;
          context.updateModuleConfig('bot_whitelist', { bots });
          context.logSyncEvent(`[Bot Whitelist] Updated managed role for ${targetBot.tag} to ${role.name}.`, 'info');
          return interaction.reply({ content: `✅ Updated managed role for **${targetBot.tag}** to **${role.name}**.`, flags: 64 });
        }

        await interaction.reply({ content: '❌ Subcommand not recognized or fully implemented yet.', flags: 64 });
      }
    }
  ],
  routes: [
    {
      path: '/state',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'bot_whitelist');
        res.json({ bots: mod?.config?.bots || [] });
      }
    },
    {
      path: '/action',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can manage the whitelist.' });
        }

        const { action, payload } = req.body;
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'bot_whitelist');
        let bots = mod?.config?.bots || [];

        const actor = req.user?.username || 'admin';
        const actorId = req.user?.id || '111';
        const logId = Math.random().toString(36).substring(2, 11);

        if (action === 'add') {
          // If no enabledModules provided (e.g. from web UI), default to all
          if (!payload.enabledModules || payload.enabledModules.length === 0) {
            payload.enabledModules = protections.map(p => p.key);
          }
          bots.push(payload);
          context.logSyncEvent(`[Bot Whitelist] Added bot ${payload.tag}.`, 'success');
          
          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Added bot ${payload.tag} to whitelist`,
            category: 'bot',
            targetBefore: null,
            targetAfter: payload,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'bot',
            action: 'added',
            target: payload.tag,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'remove') {
          const targetBot = bots.find((b: BotWhitelistRecord) => b.userId === payload.userId);
          bots = bots.filter((b: BotWhitelistRecord) => b.userId !== payload.userId);
          context.logSyncEvent(`[Bot Whitelist] Removed bot ${payload.userId}.`, 'info');
          
          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Removed bot ${targetBot?.tag || payload.userId} from whitelist`,
            category: 'bot',
            targetBefore: targetBot || null,
            targetAfter: null,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'bot',
            action: 'removed',
            target: targetBot?.tag || payload.userId,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'edit') {
          const oldBot = bots.find((b: BotWhitelistRecord) => b.userId === payload.userId);
          bots = bots.map((b: BotWhitelistRecord) => b.userId === payload.userId ? { ...b, ...payload } : b);
          context.logSyncEvent(`[Bot Whitelist] Updated configuration for bot ${payload.userId}.`, 'info');
          
          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Modified whitelisted bot ${payload.tag || oldBot?.tag || payload.userId}`,
            category: 'bot',
            targetBefore: oldBot || null,
            targetAfter: { ...oldBot, ...payload },
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'bot',
            action: 'modified',
            target: payload.tag || oldBot?.tag || payload.userId,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        }

        context.updateModuleConfig('bot_whitelist', { bots });
        res.json({ success: true, bots });
      }
    }
  ]
};
