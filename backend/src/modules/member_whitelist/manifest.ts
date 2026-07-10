import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { checkWhitelistPermission, getGuildAndCheckPermission, protections, migrateToUnifiedWhitelist } from '../../utils/whitelistCheck.js';

const PUNISHMENTS = [
  { value: 'quarantine',  label: 'Quarantine',  emoji: '🔒', desc: 'Strip all roles & isolate in quarantine channel' },
  { value: 'ban',         label: 'Ban',          emoji: '🔨', desc: 'Permanently ban the violator from the server' },
  { value: 'kick',        label: 'Kick',         emoji: '👟', desc: 'Remove the violator from the server' },
  { value: 'strip_roles', label: 'Strip Roles',  emoji: '🪄', desc: 'Strip admin roles only, no further action' },
];
const P_EMOJI: Record<string, string> = { quarantine: '🔒', ban: '🔨', kick: '👟', strip_roles: '🪄' };

function buildPunishEmbed(guild: any, rules: Record<string, any>) {
  const lines = protections.map(p => {
    const action = rules[p.key]?.action || 'quarantine';
    const on = rules[p.key]?.enabled !== false ? '🟢' : '🔴';
    return `${on} **${p.label}** — ${P_EMOJI[action] || '🔒'} \`${action.toUpperCase()}\``;
  }).join('\n');
  return new EmbedBuilder()
    .setTitle('⚔️  Whitelist Violation Punishments')
    .setColor(0x7C5CFC)
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription('> Configure the punishment applied to **non-whitelisted** members who trigger Anti-Nuke rules.\n> Use the menu to change a rule\'s punishment type.\n\u200b')
    .addFields({ name: '🛡️ Protection Rules & Active Punishments', value: lines || 'No rules configured.', inline: false })
    .setFooter({ text: `${guild.name} • Rage Optimiser Security` })
    .setTimestamp();
}

export interface MemberWhitelistRecord {
  id: string; // userId
  userId: string;
  tag: string;
  status: 'active' | 'disabled';
  enabledModules: string[];
  addedBy: string;
  createdDate: string;
  notes?: string;
}

export const MemberWhitelistManifest: ModuleManifest = {
  id: 'member_whitelist',
  name: 'Member Whitelist',
  version: '1.0.0',
  description: 'Manage trusted members who can bypass specific protection modules.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      let progress = 100;
      return { progress, errors: [] };
    }
  },
  commands: [
    {
      name: 'whitelist',
      description: 'Global Whitelist Management & Punishment Config',
      options: [
        { name: 'overview', description: 'Show whitelist overview', type: 1 },
        { name: 'activity', description: 'Show whitelist activity', type: 1 },
        { name: 'list', description: '📋 List all whitelisted members, bots, and roles', type: 1 },
        {
          name: 'add',
          description: '➕ Add a user or role to the global whitelist',
          type: 1,
          options: [
            { name: 'target', type: 9, description: 'The user or role to whitelist', required: true },
            { name: 'notes', type: 3, description: 'Optional purpose note', required: false }
          ]
        },
        {
          name: 'remove',
          description: '➖ Remove a user or role from the global whitelist',
          type: 1,
          options: [
            { name: 'target', type: 9, description: 'The user or role to remove', required: true }
          ]
        },
        {
          name: 'punishment',
          description: 'Configure punishments for non-whitelisted violators',
          type: 2,
          options: [
            { name: 'view', description: 'View all rule punishments (interactive)', type: 1 },
            {
              name: 'set',
              description: 'Set punishment for a specific protection rule',
              type: 1,
              options: [
                {
                  name: 'rule', type: 3, description: 'Protection rule to configure', required: true,
                  choices: protections.map(p => ({ name: p.label, value: p.key }))
                },
                {
                  name: 'action', type: 3, description: 'Punishment to apply for violators', required: true,
                  choices: PUNISHMENTS.map(p => ({ name: `${p.emoji} ${p.label} — ${p.desc}`, value: p.value }))
                }
              ]
            },
            {
              name: 'set-all',
              description: 'Apply one punishment to ALL protection rules',
              type: 1,
              options: [
                {
                  name: 'action', type: 3, description: 'Global punishment action', required: true,
                  choices: PUNISHMENTS.map(p => ({ name: `${p.emoji} ${p.label} — ${p.desc}`, value: p.value }))
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'ready',
      handler: async (client: any, _ignored: any, context: any) => {
        migrateToUnifiedWhitelist(context);
      }
    },
    {
      name: 'command_whitelist',
      handler: async (client: any, interaction: any, context: any) => {
        const hasPermission = await checkWhitelistPermission(interaction.user.id, interaction.guild, context);
        if (!hasPermission) {
          const embed = new EmbedBuilder()
            .setTitle('🔒 Access Denied')
            .setColor(0xEF4444)
            .setDescription('Only the **Server Owner** and whitelisted administrators can manage Whitelist punishment settings.')
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        const sub = interaction.options.getSubcommand(false);
        const group = interaction.options.getSubcommandGroup(false);

        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const secConfig = secModule?.config || {};
        const rules = secConfig.rules || {};

        if (group === 'punishment') {
          if (sub === 'view') {
            const embed = buildPunishEmbed(interaction.guild, rules);
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`wl_punish_select_${interaction.user.id}`)
              .setPlaceholder('⚙️ Select a protection rule to configure…')
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(
                protections.map(p => {
                  const currentAction = rules[p.key]?.action || 'quarantine';
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(p.label)
                    .setValue(p.key)
                    .setDescription(`Current Action: ${currentAction.toUpperCase()}`);
                })
              );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
            const reply = await interaction.reply({
              embeds: [embed],
              components: [row],
              flags: 64,
              fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
              componentType: ComponentType.StringSelect,
              time: 300000 // 5 minutes
            });

            collector.on('collect', async (i: any) => {
              if (i.user.id !== interaction.user.id) {
                const embedErr = new EmbedBuilder()
                  .setTitle('❌ Interactivity Denied')
                  .setColor(0xEF4444)
                  .setDescription('Only the command executor can interact with this menu.')
                  .setTimestamp();
                return i.reply({ embeds: [embedErr], flags: 64 });
              }

              const ruleKey = i.values[0];
              const protection = protections.find(p => p.key === ruleKey)!;
              const currentAction = rules[ruleKey]?.action || 'quarantine';

              const actionMenu = new StringSelectMenuBuilder()
                .setCustomId(`wl_punish_action_${ruleKey}_${interaction.user.id}`)
                .setPlaceholder(`⚡ Select punishment for ${protection.label}…`)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                  PUNISHMENTS.map(p =>
                    new StringSelectMenuOptionBuilder()
                      .setLabel(`${p.emoji} ${p.label}`)
                      .setValue(p.value)
                      .setDescription(p.desc)
                      .setDefault(p.value === currentAction)
                  )
                );

              const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionMenu);
              const detailEmbed = new EmbedBuilder()
                .setTitle(`Configure Action — ${protection.label}`)
                .setColor(0x7C5CFC)
                .setDescription(`**Current Action:** ${P_EMOJI[currentAction]} \`${currentAction.toUpperCase()}\`\n\nChoose the enforcement action that should trigger when a non-whitelisted entity performs this action.`)
                .setFooter({ text: 'Changes take effect immediately' })
                .setTimestamp();

              await i.update({ embeds: [detailEmbed], components: [actionRow] });

              // Collect the final action choice
              const actionCollector = reply.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: (idx: any) => idx.customId.startsWith(`wl_punish_action_${ruleKey}_`),
                time: 120000,
                max: 1
              });

              actionCollector.on('collect', async (iAction: any) => {
                if (iAction.user.id !== interaction.user.id) {
                  const embedErr = new EmbedBuilder()
                    .setTitle('❌ Interactivity Denied')
                    .setColor(0xEF4444)
                    .setDescription('Only the command executor can interact with this menu.')
                    .setTimestamp();
                  return iAction.reply({ embeds: [embedErr], flags: 64 });
                }

                const newAction = iAction.values[0];
                const freshModules = context.getModulesState ? context.getModulesState() : [];
                const freshSec = freshModules.find((m: any) => m.id === 'security');
                const freshConfig = freshSec?.config || {};
                const freshRules = { ...(freshConfig.rules || {}) };

                freshRules[ruleKey] = { ...(freshRules[ruleKey] || {}), action: newAction };
                context.updateModuleConfig('security', { ...freshConfig, rules: freshRules });
                context.logSyncEvent(`[Whitelist Punishment] Updated ${ruleKey} action to ${newAction} via Discord.`, 'info');

                const successEmbed = new EmbedBuilder()
                  .setTitle('✅ Punishment Configured')
                  .setColor(0x10B981)
                  .setDescription(`Successfully updated violation punishment for **${protection.label}**.`)
                  .addFields(
                    { name: '🛡️ Protection Rule', value: `\`${protection.label}\``, inline: true },
                    { name: '⚡ Punishment Action', value: `${P_EMOJI[newAction]} \`${newAction.toUpperCase()}\``, inline: true }
                  )
                  .setTimestamp();

                await iAction.update({ embeds: [successEmbed], components: [] });
              });
            });
            return;
          }

          if (sub === 'set') {
            const ruleKey = interaction.options.getString('rule', true);
            const action = interaction.options.getString('action', true);
            const protection = protections.find(p => p.key === ruleKey);

            if (!protection) {
              const embedErr = new EmbedBuilder()
                .setTitle('❌ Unknown Rule')
                .setColor(0xEF4444)
                .setDescription('Unknown protection rule key.')
                .setTimestamp();
              return interaction.reply({ embeds: [embedErr], flags: 64 });
            }

            const freshRules = { ...rules };
            freshRules[ruleKey] = { ...(freshRules[ruleKey] || {}), action };
            context.updateModuleConfig('security', { ...secConfig, rules: freshRules });
            context.logSyncEvent(`[Whitelist Punishment] Set ${ruleKey} punishment to ${action} via Discord.`, 'info');

            const embed = new EmbedBuilder()
              .setTitle('✅ Punishment Configured')
              .setColor(0x10B981)
              .setDescription(`Violation punishment for **${protection.label}** has been successfully updated.`)
              .addFields(
                { name: '🛡️ Protection Rule', value: `\`${protection.label}\``, inline: true },
                { name: '⚡ New Action', value: `${P_EMOJI[action]} \`${action.toUpperCase()}\``, inline: true }
              )
              .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
          }

          if (sub === 'set-all') {
            const action = interaction.options.getString('action', true);
            const freshRules = { ...rules };

            for (const p of protections) {
              freshRules[p.key] = { ...(freshRules[p.key] || {}), action };
            }

            context.updateModuleConfig('security', { ...secConfig, rules: freshRules });
            context.logSyncEvent(`[Whitelist Punishment] Set ALL rule punishments to ${action} via Discord.`, 'info');

            const embed = new EmbedBuilder()
              .setTitle('✅ Global Punishment Applied')
              .setColor(0x7C5CFC)
              .setDescription(`All protection rules have been updated to trigger ${P_EMOJI[action]} \`${action.toUpperCase()}\` for non-whitelisted violators.`)
              .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
          }
        }

        if (sub === 'list') {
          const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
          const whitelistEntries = mwModule?.config?.members || [];

          const membersList = whitelistEntries.filter((e: any) => e.status === 'active' && (!e.type || e.type === 'member'));
          const botsList = whitelistEntries.filter((e: any) => e.status === 'active' && e.type === 'bot');
          const rolesList = whitelistEntries.filter((e: any) => e.status === 'active' && e.type === 'role');

          const memberLines = membersList.map((e: any) => `<@${e.userId}> (\`${e.tag}\`)`).join('\n') || '*None*';
          const botLines = botsList.map((e: any) => `<@${e.userId}> (\`${e.tag}\`)`).join('\n') || '*None*';
          const roleLines = rolesList.map((e: any) => `<@&${e.roleId}> (\`${e.name}\`)`).join('\n') || '*None*';

          const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Global Whitelist')
            .setDescription('These users, bots, and roles bypass all protection and security modules.')
            .setColor(0x7C5CFC)
            .addFields(
              { name: `👥 Whitelisted Members (${membersList.length})`, value: memberLines, inline: false },
              { name: `🤖 Whitelisted Bots (${botsList.length})`, value: botLines, inline: false },
              { name: `🎖️ Whitelisted Roles (${rolesList.length})`, value: roleLines, inline: false }
            )
            .setFooter({ text: `${interaction.guild.name} • Rage Optimiser` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'add') {
          const target = interaction.options.getMentionable('target', true);
          const notes = interaction.options.getString('notes') || '';

          const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
          let members = [...(mwModule?.config?.members || [])];
          const allBypasses = [...protections.map(p => p.key), 'voice_protection'];

          let tagOrName = '';
          let type: 'member' | 'bot' | 'role' = 'member';
          let isAlready = false;

          const isRole = target.color !== undefined || target.hoist !== undefined || target.permissions !== undefined;

          if (isRole) {
            type = 'role';
            tagOrName = target.name;
            isAlready = members.some((e: any) => e.roleId === target.id);
            if (!isAlready) {
              members.push({
                id: target.id,
                roleId: target.id,
                name: target.name,
                status: 'active',
                type: 'role',
                enabledModules: allBypasses,
                notes,
                createdDate: new Date().toISOString()
              });
            }
          } else {
            const user = target.user || target;
            type = user.bot ? 'bot' : 'member';
            tagOrName = user.tag || user.username;
            isAlready = members.some((e: any) => e.userId === user.id);
            if (!isAlready) {
              members.push({
                id: user.id,
                userId: user.id,
                tag: tagOrName,
                status: 'active',
                type,
                enabledModules: allBypasses,
                notes,
                createdDate: new Date().toISOString()
              });
            }
          }

          if (isAlready) {
            const embedErr = new EmbedBuilder()
              .setTitle('❌ Already Whitelisted')
              .setColor(0xEF4444)
              .setDescription(`**${tagOrName}** is already present in the global whitelist.`)
              .setTimestamp();
            return interaction.reply({ embeds: [embedErr], flags: 64 });
          }

          context.updateModuleConfig('member_whitelist', { members });
          context.logSyncEvent(`[Global Whitelist] Added ${type} ${tagOrName} via unified command.`, 'success');

          const typeLabels = { member: '👤 Member', bot: '🤖 Bot', role: '🎖️ Role' };
          const embedSuccess = new EmbedBuilder()
            .setTitle('✅ Added to Whitelist')
            .setColor(0x10B981)
            .setDescription(`Successfully added **${tagOrName}** to the global whitelist.`)
            .addFields(
              { name: 'Target', value: isRole ? `<@&${target.id}>` : `<@${target.id}>`, inline: true },
              { name: 'Type', value: typeLabels[type], inline: true },
              { name: 'Notes', value: notes || '*None provided*', inline: false }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embedSuccess], flags: 64 });
        }

        if (sub === 'remove') {
          const target = interaction.options.getMentionable('target', true);

          const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
          let members = [...(mwModule?.config?.members || [])];

          const isRole = target.color !== undefined || target.hoist !== undefined || target.permissions !== undefined;
          let found = false;
          let tagOrName = '';

          if (isRole) {
            tagOrName = target.name;
            const roleRecord = members.find((e: any) => e.roleId === target.id);
            if (roleRecord) {
              found = true;
              members = members.filter((e: any) => e.roleId !== target.id);
            }
          } else {
            const user = target.user || target;
            tagOrName = user.tag || user.username;
            const userRecord = members.find((e: any) => e.userId === user.id);
            if (userRecord) {
              found = true;
              members = members.filter((e: any) => e.userId !== user.id);
            }
          }

          if (!found) {
            const embedErr = new EmbedBuilder()
              .setTitle('❌ Not Whitelisted')
              .setColor(0xEF4444)
              .setDescription(`**${tagOrName}** was not found in the global whitelist.`)
              .setTimestamp();
            return interaction.reply({ embeds: [embedErr], flags: 64 });
          }

          context.updateModuleConfig('member_whitelist', { members });
          context.logSyncEvent(`[Global Whitelist] Removed ${tagOrName} via unified command.`, 'info');

          const embedSuccess = new EmbedBuilder()
            .setTitle('🗑️ Removed from Whitelist')
            .setColor(0x7C5CFC)
            .setDescription(`Successfully removed **${tagOrName}** from the global whitelist.`)
            .setTimestamp();
          return interaction.reply({ embeds: [embedSuccess], flags: 64 });
        }


        if (sub === 'activity') {
          const reg = context.getRegistry ? context.getRegistry() : null;
          const activity = reg && reg.whitelistActivity ? reg.whitelistActivity : [];
          const lines = activity.slice(0, 10).map((a: any) => {
            const time = a.timestamp ? `<t:${Math.floor(a.timestamp / 1000)}:R>` : '';
            return `• **${a.actor}** ${a.action} \`${a.target}\` (${a.type}) ${time}`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('📋 Whitelist Audit Timeline')
            .setColor(0x7C5CFC)
            .setDescription(lines || '*No recent whitelist activity logged.*')
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // Default to overview
        const mwMod = modules.find((m: any) => m.id === 'member_whitelist');
        const bwMod = modules.find((m: any) => m.id === 'bot_whitelist');
        const rwMod = modules.find((m: any) => m.id === 'role_whitelist');

        const memberCount = (mwMod?.config?.members || []).length;
        const botCount = (bwMod?.config?.bots || []).length;
        const roleCount = (rwMod?.config?.roles || []).length;

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Whitelist System Hub')
          .setColor(0x7C5CFC)
          .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
          .setDescription('Central control panel for member, bot, and role whitelists.')
          .addFields(
            { name: '👥 Whitelisted Members', value: `\`${memberCount}\` entries`, inline: true },
            { name: '🤖 Whitelisted Bots', value: `\`${botCount}\` entries`, inline: true },
            { name: '🎖️ Whitelisted Roles', value: `\`${roleCount}\` entries`, inline: true }
          )
          .setFooter({ text: 'Use /whitelist punishment view to customize violation punishments' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: 64 });
      }
    }
  ],
  routes: [
    {
      path: '/state',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'member_whitelist');
        res.json({ members: mod?.config?.members || [] });
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
        const mod = modules.find((m: any) => m.id === 'member_whitelist');
        let members = mod?.config?.members || [];

        const actor = req.user?.username || 'admin';
        const actorId = req.user?.id || '111';
        const logId = Math.random().toString(36).substring(2, 11);

        if (action === 'add') {
          // If no enabledModules provided (e.g. from web UI), default to all
          if (!payload.enabledModules || payload.enabledModules.length === 0) {
            payload.enabledModules = protections.map(p => p.key);
          }
          members.push(payload);
          context.logSyncEvent(`[Member Whitelist] Added member ${payload.tag}.`, 'success');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Added member ${payload.tag} to whitelist`,
            category: 'member',
            targetBefore: null,
            targetAfter: payload,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'member',
            action: 'added',
            target: payload.tag,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'remove') {
          const targetMember = members.find((m: MemberWhitelistRecord) => m.userId === payload.userId);
          members = members.filter((m: MemberWhitelistRecord) => m.userId !== payload.userId);
          context.logSyncEvent(`[Member Whitelist] Removed member ${payload.userId}.`, 'info');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Removed member ${targetMember?.tag || payload.userId} from whitelist`,
            category: 'member',
            targetBefore: targetMember || null,
            targetAfter: null,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'member',
            action: 'removed',
            target: targetMember?.tag || payload.userId,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'edit') {
          const oldMember = members.find((m: MemberWhitelistRecord) => m.userId === payload.userId);
          members = members.map((m: MemberWhitelistRecord) => m.userId === payload.userId ? { ...m, ...payload } : m);
          context.logSyncEvent(`[Member Whitelist] Updated configuration for member ${payload.userId}.`, 'info');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Modified whitelisted member ${payload.tag || oldMember?.tag || payload.userId}`,
            category: 'member',
            targetBefore: oldMember || null,
            targetAfter: { ...oldMember, ...payload },
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'member',
            action: 'modified',
            target: payload.tag || oldMember?.tag || payload.userId,
            targetId: payload.userId,
            actor,
            timestamp: Date.now()
          });
        }

        context.updateModuleConfig('member_whitelist', { members });
        res.json({ success: true, members });
      }
    }
  ]
};
