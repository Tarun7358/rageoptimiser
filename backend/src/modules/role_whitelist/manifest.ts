import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { checkWhitelistPermission, protections } from '../../utils/whitelistCheck.js';

export interface RoleWhitelistRecord {
  id: string; // roleId
  roleId: string;
  name: string;
  status: 'active' | 'disabled';
  enabledModules: string[];
  createdDate: string;
}

export const RoleWhitelistManifest: ModuleManifest = {
  id: 'role_whitelist',
  name: 'Role Whitelist',
  version: '1.0.0',
  description: 'Manage trusted roles whose members automatically inherit bypass permissions.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      let progress = 100;
      return { progress, errors: [] };
    }
  },
  commands: [
    {
      name: 'role',
      description: 'Role Whitelist Management',
      options: [
        {
          name: 'whitelist',
          description: 'Manage whitelisted roles',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            {
              name: 'add',
              description: 'Add a role to the whitelist',
              type: 1, // SUB_COMMAND
              options: [
                { name: 'role', type: 8, description: 'The role to whitelist', required: true }
              ]
            },
            {
              name: 'remove',
              description: 'Remove a role from the whitelist',
              type: 1,
              options: [
                { name: 'role', type: 8, description: 'The role to remove', required: true }
              ]
            }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_role',
      handler: async (client: any, interaction: any, context: any) => {
        const hasPermission = await checkWhitelistPermission(interaction.user.id, interaction.guild, context);
        if (!hasPermission) {
          return interaction.reply({ content: '🔒 **Access Denied** — Only the Server Owner and whitelisted users can manage the whitelist.', flags: 64 });
        }
        
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const modules = context.getModulesState ? context.getModulesState() : [];
        const rwModule = modules.find((m: any) => m.id === 'role_whitelist');
        
        if (!rwModule || rwModule.status !== 'enabled') {
          return interaction.reply({ content: '❌ Role Whitelist module is not enabled in the dashboard.', flags: 64 });
        }
        
        let roles = rwModule.config.roles || [];

        if (group === 'whitelist' && subcommand === 'add') {
          const targetRole = interaction.options.getRole('role', true);
          
          let roleRecord = roles.find((r: RoleWhitelistRecord) => r.roleId === targetRole.id);
          
          if (!roleRecord) {
            roleRecord = {
              id: targetRole.id,
              roleId: targetRole.id,
              name: targetRole.name,
              status: 'active',
              enabledModules: protections.map(p => p.key), // Default all bypassed
              createdDate: new Date().toISOString()
            };
            roles.push(roleRecord);
            context.updateModuleConfig('role_whitelist', { roles });
            context.logSyncEvent(`[Role Whitelist] Added role ${targetRole.name} via command.`, 'success');
          }

          // Build configuration embed and select menu
          const embed = new EmbedBuilder()
            .setTitle(`Role Whitelist Configuration for ${interaction.guild.name} Server`)
            .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
            .setColor('#7C5CFC')
            .setTimestamp();

          const buildDescription = (enabledModules: string[]) => {
            return protections.map(p => {
              const emoji = enabledModules.includes(p.key) ? '✅' : '❌';
              return `${emoji} : **${p.label}**`;
            }).join('\n');
          };

          embed.setDescription(buildDescription(roleRecord.enabledModules))
            .addFields({ name: 'Target Role', value: `<@&${targetRole.id}> (\`${targetRole.name}\`)`, inline: false });

          const buildSelectMenu = (enabledModules: string[]) => {
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`wl_select_role_${targetRole.id}`)
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
            components: [buildSelectMenu(roleRecord.enabledModules)],
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
            const freshRw = freshModules.find((m: any) => m.id === 'role_whitelist');
            let freshRoles = freshRw?.config?.roles || [];

            freshRoles = freshRoles.map((r: any) => {
              if (r.roleId === targetRole.id) {
                return { ...r, enabledModules: newBypasses };
              }
              return r;
            });

            context.updateModuleConfig('role_whitelist', { roles: freshRoles });

            embed.setDescription(buildDescription(newBypasses));
            await i.update({
              embeds: [embed],
              components: [buildSelectMenu(newBypasses)]
            });
          });

          return;
        }

        if (group === 'whitelist' && subcommand === 'remove') {
          const targetRole = interaction.options.getRole('role', true);
          if (!roles.find((r: RoleWhitelistRecord) => r.roleId === targetRole.id)) {
            return interaction.reply({ content: '❌ This role is not whitelisted.', flags: 64 });
          }
          
          roles = roles.filter((r: RoleWhitelistRecord) => r.roleId !== targetRole.id);
          context.updateModuleConfig('role_whitelist', { roles });
          context.logSyncEvent(`[Role Whitelist] Removed role ${targetRole.name} via command.`, 'info');
          return interaction.reply({ content: `🗑️ Removed role **${targetRole.name}** from the whitelist.`, flags: 64 });
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
        const mod = modules.find((m: any) => m.id === 'role_whitelist');
        res.json({ roles: mod?.config?.roles || [] });
      }
    },
    {
      path: '/action',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { action, payload } = req.body;
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'role_whitelist');
        let roles = mod?.config?.roles || [];

        const actor = req.user?.username || 'admin';
        const actorId = req.user?.id || '111';
        const logId = Math.random().toString(36).substring(2, 11);

        if (action === 'add') {
          roles.push(payload);
          context.logSyncEvent(`[Role Whitelist] Added role ${payload.name}.`, 'success');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Added role ${payload.name} to whitelist`,
            category: 'role',
            targetBefore: null,
            targetAfter: payload,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'role',
            action: 'added',
            target: payload.name,
            targetId: payload.roleId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'remove') {
          const targetRole = roles.find((r: RoleWhitelistRecord) => r.roleId === payload.roleId);
          roles = roles.filter((r: RoleWhitelistRecord) => r.roleId !== payload.roleId);
          context.logSyncEvent(`[Role Whitelist] Removed role ${payload.roleId}.`, 'info');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Removed role ${targetRole?.name || payload.roleId} from whitelist`,
            category: 'role',
            targetBefore: targetRole || null,
            targetAfter: null,
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'role',
            action: 'removed',
            target: targetRole?.name || payload.roleId,
            targetId: payload.roleId,
            actor,
            timestamp: Date.now()
          });
        } else if (action === 'edit') {
          const oldRole = roles.find((r: RoleWhitelistRecord) => r.roleId === payload.roleId);
          roles = roles.map((r: RoleWhitelistRecord) => r.roleId === payload.roleId ? { ...r, ...payload } : r);
          context.logSyncEvent(`[Role Whitelist] Updated configuration for role ${payload.roleId}.`, 'info');

          context.registry.logWhitelistAudit(context.guildId, {
            id: logId,
            actor,
            actorId,
            action: `Modified whitelisted role ${payload.name || oldRole?.name || payload.roleId}`,
            category: 'role',
            targetBefore: oldRole || null,
            targetAfter: { ...oldRole, ...payload },
            timestamp: Date.now()
          });
          context.registry.logWhitelistActivity(context.guildId, {
            id: logId,
            type: 'role',
            action: 'modified',
            target: payload.name || oldRole?.name || payload.roleId,
            targetId: payload.roleId,
            actor,
            timestamp: Date.now()
          });
        }

        context.updateModuleConfig('role_whitelist', { roles });
        res.json({ success: true, roles });
      }
    }
  ]
};
