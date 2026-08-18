import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import {
  Colors, buildLimeOverviewCard, DEFAULT_BRAND_IMAGE_URL,
  VERIFIED_ICON, WRONG_ICON, MEMBER_ICON, CONFIG_ICON, SHIELD_ICON
} from '../../core/UIFactory.js';
import { isOwnerOrExtraOwner } from '../../utils/whitelistCheck.js';
import { PrefixRegistry } from '../../core/prefix/PrefixRegistry.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

function parseReactionEmoji(emojiStr: string): string {
  if (!emojiStr) return '1532390590707142956';
  const match = emojiStr.match(/<a?:?([a-zA-Z0-9_]+):(\d+)>/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  const idMatch = emojiStr.match(/\d{17,20}/);
  if (idMatch) return idMatch[0];
  return emojiStr;
}

export const ReactionRolesManifest: ModuleManifest = {
  id: 'reaction_roles',
  name: 'Reaction Roles Engine',
  version: '1.0.0',
  description: 'Enterprise self-assignable role panels linked to emoji reactions and numbered buttons.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 100;
      
      const roleMap = config.roleMap || {};
      for (const [emoji, roleId] of Object.entries(roleMap)) {
        if (!registry.roles.some(r => r.id === roleId)) {
          errors.push(`Mapped role for emoji ${emoji} (${roleId}) no longer exists.`);
          progress = 50;
        }
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'reactionrole',
      description: 'Enterprise Reaction Role Management Engine',
      options: [
        {
          name: 'spawn',
          description: 'Spawn an enterprise reaction role panel in a channel',
          type: 1,
          options: [
            { name: 'channel', type: 7, description: 'Channel to spawn panel in', required: false, channel_types: [0, 5] }
          ]
        },
        {
          name: 'add',
          description: 'Add an emoji to role mapping for reaction roles',
          type: 1,
          options: [
            { name: 'emoji', type: 3, description: 'Emoji symbol, name, or custom emoji ID', required: true },
            { name: 'role', type: 8, description: 'Role to assign when reacted', required: true }
          ]
        },
        {
          name: 'remove',
          description: 'Remove an emoji mapping',
          type: 1,
          options: [
            { name: 'emoji', type: 3, description: 'Emoji symbol or name to remove', required: true }
          ]
        },
        {
          name: 'list',
          description: 'List all configured reaction role mappings',
          type: 1
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_reactionrole',
      handler: async (client: any, interaction: any, context: any) => {
        const guild = interaction.guild;
        if (!guild) {
          return interaction.reply({ content: `${WRONG_ICON} Reaction Role commands can only be run inside a server.`, flags: 64 });
        }

        const isAuthorized = await isOwnerOrExtraOwner(interaction.user.id, guild);
        if (!isAuthorized) {
          return interaction.reply({ content: `${WRONG_ICON} Access Denied: Server Owner & Extra Owner permission required.`, flags: 64 });
        }
        
        const sub = interaction.options?.getSubcommand(false) || interaction.parsed?.args?.[0]?.toLowerCase() || 'list';
        const modules = context.getModulesState ? context.getModulesState(guild.id) : [];
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');

        // ─── ADD MAPPING ───────────────────────────────────────────────
        if (sub === 'add') {
          const emoji = interaction.options?.getString?.('emoji') || interaction.parsed?.args?.[1];
          const role = interaction.options?.getRole?.('role') || interaction.parsed?.args?.[2];

          if (!emoji || !role) {
            return interaction.reply({ content: `${WRONG_ICON} Usage: \`r!rr add <emoji> <@role>\``, flags: 64 });
          }

          const roleMap = { ...(rrMod?.config?.roleMap || {}) };
          const roleId = typeof role === 'string' ? role.replace(/[<@&>]/g, '') : role.id;
          roleMap[emoji] = roleId;
          context.updateModuleConfig('reaction_roles', { roleMap });
          context.logSyncEvent(`[ReactionRoles] Mapped emoji ${emoji} to role ${typeof role === 'string' ? roleId : role.name}.`, 'success');
          
          return interaction.reply({ content: `${VERIFIED_ICON} Successfully mapped emoji ${emoji} to role <@&${roleId}>.`, flags: 64 });
        }
        
        // ─── REMOVE MAPPING ────────────────────────────────────────────
        if (sub === 'remove' || sub === 'delete') {
          const emoji = interaction.options?.getString?.('emoji') || interaction.parsed?.args?.[1];
          if (!emoji) {
            return interaction.reply({ content: `${WRONG_ICON} Usage: \`r!rr remove <emoji>\``, flags: 64 });
          }

          const roleMap = { ...(rrMod?.config?.roleMap || {}) };
          delete roleMap[emoji];
          context.updateModuleConfig('reaction_roles', { roleMap });
          context.logSyncEvent(`[ReactionRoles] Removed emoji ${emoji} mapping.`, 'info');
          
          return interaction.reply({ content: `${VERIFIED_ICON} Removed reaction role mapping for ${emoji}.`, flags: 64 });
        }
        
        // ─── LIST MAPPINGS ─────────────────────────────────────────────
        if (sub === 'list' || sub === 'show') {
          const roleMap = rrMod?.config?.roleMap || {};
          if (Object.keys(roleMap).length === 0) {
            return interaction.reply({ content: `${WRONG_ICON} No reaction roles currently configured. Use \`r!rr add <emoji> <@role>\` first.`, flags: 64 });
          }
          
          const listCard = buildLimeOverviewCard({
            title: `${MEMBER_ICON} REACTION ROLE MAPPINGS`,
            subtitle: `LIVE ROLE DISTRIBUTION CONFIGURATION`,
            color: Colors.BRAND,
            sections: [
              {
                title: `${CONFIG_ICON} ACTIVE MAPPINGS`,
                items: Object.entries(roleMap).map(([e, rId], idx) => `• **${idx + 1}.** ${e} ➔ <@&${rId}>`)
              }
            ],
            footerText: 'Rage Optimiser Enterprise • Reaction Roles'
          });

          return interaction.reply({ embeds: [listCard], flags: 64 });
        }

        // ─── SPAWN PANEL (NEW REFERENCE DESIGN) ────────────────────────
        if (sub === 'spawn' || sub === 'panel' || sub === 'setup') {
          const channel = interaction.options?.getChannel?.('channel') || interaction.channel;
          const roleMap = rrMod?.config?.roleMap || {};
          const entries = Object.entries(roleMap);
          
          if (entries.length === 0) {
            return interaction.reply({ content: `${WRONG_ICON} No reaction roles mapped yet. Add mappings first using \`r!rr add <emoji> <@role>\`.`, flags: 64 });
          }

          // Build grid layout inside code block (2 columns)
          const formattedGrid: string[] = [];
          for (let i = 0; i < entries.length; i += 2) {
            const num1 = i + 1;
            const [e1, r1Id] = entries[i];
            const role1 = guild.roles.cache.get(r1Id as string);
            const name1 = role1 ? role1.name : r1Id;

            if (i + 1 < entries.length) {
              const num2 = i + 2;
              const [e2, r2Id] = entries[i + 1];
              const role2 = guild.roles.cache.get(r2Id as string);
              const name2 = role2 ? role2.name : r2Id;

              const col1 = `${num1.toString().padStart(2, ' ')}. . ${name1} .`.padEnd(20, ' ');
              const col2 = `${num2.toString().padStart(2, ' ')}. . ${name2} .`;
              formattedGrid.push(`${col1}   ${col2}`);
            } else {
              const col1 = `${num1.toString().padStart(2, ' ')}. . ${name1} .`;
              formattedGrid.push(col1);
            }
          }

          const descContent = [
            `### Select Your Role Below With Your Excellence\n`,
            `\`\`\`text`,
            formattedGrid.join('\n'),
            `\`\`\``
          ].join('\n');

          const panelEmbed = new EmbedBuilder()
            .setColor(Colors.BRAND)
            .setAuthor({ name: 'Rage Optimiser • Reaction Roles Engine' })
            .setTitle('# Reaction Roles !')
            .setDescription(descContent)
            .setImage(DEFAULT_BRAND_IMAGE_URL)
            .setFooter({ text: 'Rage Optimiser Enterprise • Reaction Roles' })
            .setTimestamp();

          // Create Numbered ActionRow Buttons (up to 5 per row)
          const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
          let currentRow = new ActionRowBuilder<ButtonBuilder>();

          entries.forEach(([emoji, roleId], idx) => {
            const btnNumber = (idx + 1).toString();
            const btn = new ButtonBuilder()
              .setCustomId(`rr_btn_${roleId}`)
              .setLabel(btnNumber)
              .setStyle(ButtonStyle.Secondary);

            if (emoji && (emoji.includes(':') || emoji.length <= 4)) {
              const parsed = parseReactionEmoji(emoji as string);
              if (parsed) {
                btn.setEmoji(parsed);
              }
            }

            currentRow.addComponents(btn);

            if (currentRow.components.length === 5 || idx === entries.length - 1) {
              actionRows.push(currentRow);
              currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
          });

          try {
            const msg = await channel.send({ embeds: [panelEmbed], components: actionRows });
            
            // Also react to message with custom emojis if configured
            for (const [emoji] of entries) {
              const reactionKey = parseReactionEmoji(emoji as string);
              await msg.react(reactionKey).catch(() => msg.react(emoji as string).catch(() => null));
            }

            context.logSyncEvent(`[ReactionRoles] Spawned reference reaction role panel in #${channel.name}.`, 'success');
            return interaction.reply({ content: `${VERIFIED_ICON} Reaction role panel successfully spawned in ${channel}.`, flags: 64 });
          } catch (e: any) {
            console.error('[ReactionRoles] Failed to spawn panel:', e);
            return interaction.reply({ content: `${WRONG_ICON} Failed to send reaction role panel: ${e.message}`, flags: 64 });
          }
        }
      }
    },
    // ─── BUTTON INTERACTION LISTENER FOR REACTION ROLES ───────────────
    {
      name: 'interactionCreate',
      handler: async (client: any, interaction: any, context: any) => {
        if (!interaction.isButton?.()) return;
        if (!interaction.customId.startsWith('rr_btn_')) return;

        const roleId = interaction.customId.replace('rr_btn_', '');
        const guild = interaction.guild;
        if (!guild) return;

        try {
          const member = await guild.members.fetch(interaction.user.id);
          const role = await guild.roles.fetch(roleId).catch(() => null);

          if (!role) {
            return interaction.reply({ content: `${WRONG_ICON} The selected role no longer exists on this server.`, flags: 64 });
          }

          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            context.logSyncEvent(`[ReactionRoles] ${member.user.username} removed role @${role.name} via panel button.`, 'info');
            return interaction.reply({ content: `${VERIFIED_ICON} Removed role **${role.name}** from your profile.`, flags: 64 });
          } else {
            await member.roles.add(roleId);
            context.logSyncEvent(`[ReactionRoles] ${member.user.username} claimed role @${role.name} via panel button.`, 'info');
            return interaction.reply({ content: `${VERIFIED_ICON} Successfully assigned role **${role.name}** to your profile!`, flags: 64 });
          }
        } catch (e: any) {
          console.error('[ReactionRoles] Button click error:', e);
          return interaction.reply({ content: `${WRONG_ICON} Unable to modify role: ${e.message}`, flags: 64 });
        }
      }
    },
    // ─── EMOJI REACTION ADD LISTENER ──────────────────────────────────
    {
      name: 'messageReactionAdd',
      handler: async (client: any, reaction: any, user: any, context: any) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const modules = context.getModulesState ? context.getModulesState(reaction.message?.guild?.id) : [];
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');
        if (!rrMod) return;

        const roleMap = rrMod.config?.roleMap || {};
        const emojiKey = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
        
        let roleId = roleMap[emojiKey] || roleMap[reaction.emoji.name] || roleMap[reaction.emoji.id];
        
        if (!roleId) {
          for (const [key, rId] of Object.entries(roleMap)) {
            if (key.includes(reaction.emoji.name) || (reaction.emoji.id && key.includes(reaction.emoji.id))) {
              roleId = rId as string;
              break;
            }
          }
        }

        if (roleId) {
          try {
            const member = await reaction.message.guild.members.fetch(user.id);
            if (member && !member.roles.cache.has(roleId)) {
              await member.roles.add(roleId);
              context.logSyncEvent(`[ReactionRoles] ${user.username} assigned themselves role <@&${roleId}> via reaction.`, 'info');
            }
          } catch (e) {
            console.error('[ReactionRoles] Error assigning role:', e);
          }
        }
      }
    },
    // ─── EMOJI REACTION REMOVE LISTENER ───────────────────────────────
    {
      name: 'messageReactionRemove',
      handler: async (client: any, reaction: any, user: any, context: any) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const modules = context.getModulesState ? context.getModulesState(reaction.message?.guild?.id) : [];
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');
        if (!rrMod) return;

        const roleMap = rrMod.config?.roleMap || {};
        const emojiKey = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
        
        let roleId = roleMap[emojiKey] || roleMap[reaction.emoji.name] || roleMap[reaction.emoji.id];
        
        if (!roleId) {
          for (const [key, rId] of Object.entries(roleMap)) {
            if (key.includes(reaction.emoji.name) || (reaction.emoji.id && key.includes(reaction.emoji.id))) {
              roleId = rId as string;
              break;
            }
          }
        }

        if (roleId) {
          try {
            const member = await reaction.message.guild.members.fetch(user.id);
            if (member && member.roles.cache.has(roleId)) {
              await member.roles.remove(roleId);
              context.logSyncEvent(`[ReactionRoles] ${user.username} removed role <@&${roleId}> via reaction.`, 'info');
            }
          } catch (e) {
            console.error('[ReactionRoles] Error removing role:', e);
          }
        }
      }
    }
  ],
  routes: [
    {
      path: '/state',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'reaction_roles');
        res.json({ roleMap: mod?.config?.roleMap || {} });
      }
    },
    {
      path: '/update',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { roleMap } = req.body;
        context.updateModuleConfig('reaction_roles', { roleMap });
        context.logSyncEvent(`Reaction Roles: Mappings updated from dashboard.`, 'success');
        res.json({ success: true, roleMap });
      }
    }
  ]
};

export function registerReactionRolesCommands() {
  PrefixRegistry.register({
    name: 'reactionrole',
    description: 'Enterprise Reaction Role management engine & numbered button panels',
    category: 'Management',
    usage: 'r!reactionrole [add <emoji> <@role> | remove <emoji> | list | spawn #channel]',
    aliases: ['rr', 'reactionroles', 'rolepanel'],
    userPermissions: [],
    cooldownSeconds: 3,
    examples: ['r!rr add ⭐ @VIP', 'r!rr list', 'r!rr spawn #roles'],
    moduleOwnerId: 'reaction_roles',
    subcommands: [
      { name: 'add <emoji> <@role>', description: 'Add an emoji/role mapping for reaction role panels', examples: ['r!rr add ⭐ @VIP'] },
      { name: 'remove <emoji>', description: 'Remove an existing emoji role mapping', examples: ['r!rr remove ⭐'] },
      { name: 'list', description: 'List all currently configured reaction role mappings', examples: ['r!rr list'] },
      { name: 'spawn [#channel]', description: 'Spawn an enterprise numbered button reaction role panel', examples: ['r!rr spawn', 'r!rr spawn #roles'] }
    ]
  });
}
