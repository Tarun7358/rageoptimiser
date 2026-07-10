import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

export const ReactionRolesManifest: ModuleManifest = {
  id: 'reaction_roles',
  name: 'Reaction Roles',
  version: '1.0.0',
  description: 'Self-assignable role panels linked to emoji reactions.',
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
      description: 'Spawn a reaction role panel.',
      options: [
        { name: 'channel', type: 7, description: 'Channel to spawn panel in', required: true, channel_types: [0, 5] }
      ]
    }
  ],
  events: [
    {
      name: 'command_reactionrole',
      handler: async (client: any, interaction: any, context: any) => {
        const isOwner = interaction.guild?.ownerId === interaction.user?.id ||
                        interaction.member?.permissions?.has?.('Administrator');
        if (!isOwner) return interaction.reply({ content: '🔒 Requires Administrator.', flags: 64 });
        
        const channel = interaction.options.getChannel('channel');
        const modules = context.getModulesState();
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');
        const roleMap = rrMod?.config?.roleMap || {};
        
        if (Object.keys(roleMap).length === 0) {
          return interaction.reply({ content: '❌ No reaction roles mapped in dashboard.', flags: 64 });
        }

        const lines = ['**Self-Assign Roles**\nReact below to assign yourself roles:'];
        for (const [emoji, roleId] of Object.entries(roleMap)) {
          lines.push(`${emoji} - <@&${roleId}>`);
        }

        try {
          const msg = await channel.send({ content: lines.join('\n') });
          for (const emoji of Object.keys(roleMap)) {
            await msg.react(emoji).catch(() => {});
          }
          await interaction.reply({ content: `✅ Reaction role panel spawned in ${channel}.`, flags: 64 });
          context.logSyncEvent(`Reaction Roles: Panel spawned in #${channel.name}.`, 'success');
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to send panel. Check bot permissions.', flags: 64 });
        }
      }
    },
    {
      name: 'messageReactionAdd',
      handler: async (client: any, reaction: any, user: any, context: any) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const modules = context.getModulesState();
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');
        if (!rrMod || rrMod.status !== 'enabled') return;

        const roleMap = rrMod.config.roleMap || {};
        const emojiName = reaction.emoji.name;
        const roleId = roleMap[emojiName];

        if (roleId) {
          try {
            const member = await reaction.message.guild.members.fetch(user.id);
            if (member && !member.roles.cache.has(roleId)) {
              await member.roles.add(roleId);
              context.logSyncEvent(`Reaction Roles: ${user.tag} assigned themselves <@&${roleId}> via ${emojiName}.`, 'info');
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    },
    {
      name: 'messageReactionRemove',
      handler: async (client: any, reaction: any, user: any, context: any) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const modules = context.getModulesState();
        const rrMod = modules.find((m: any) => m.id === 'reaction_roles');
        if (!rrMod || rrMod.status !== 'enabled') return;

        const roleMap = rrMod.config.roleMap || {};
        const emojiName = reaction.emoji.name;
        const roleId = roleMap[emojiName];

        if (roleId) {
          try {
            const member = await reaction.message.guild.members.fetch(user.id);
            if (member && member.roles.cache.has(roleId)) {
              await member.roles.remove(roleId);
              context.logSyncEvent(`Reaction Roles: ${user.tag} removed their <@&${roleId}> via ${emojiName}.`, 'info');
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  ]
};
