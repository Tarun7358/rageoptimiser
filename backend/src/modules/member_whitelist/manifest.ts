import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

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
      name: 'member',
      description: 'Member Whitelist Management',
      options: [
        {
          name: 'whitelist',
          description: 'Manage whitelisted members',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            {
              name: 'add',
              description: 'Add a member to the whitelist',
              type: 1, // SUB_COMMAND
              options: [
                { name: 'member_user', type: 6, description: 'The member to whitelist', required: true }
              ]
            },
            {
              name: 'remove',
              description: 'Remove a member from the whitelist',
              type: 1,
              options: [
                { name: 'member_user', type: 6, description: 'The member to remove', required: true }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'whitelist',
      description: 'Global Whitelist Management Overview',
      options: [
        { name: 'overview', description: 'Show whitelist overview', type: 1 },
        { name: 'activity', description: 'Show whitelist activity', type: 1 }
      ]
    }
  ],
  events: [
    {
      name: 'command_member',
      handler: async (client: any, interaction: any, context: any) => {
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.reply({ content: '🔒 **Access Denied** — Administrator permissions required.', ephemeral: true });
        }
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const modules = context.getModulesState ? context.getModulesState() : [];
        const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
        
        if (!mwModule || mwModule.status !== 'enabled') {
          return interaction.reply({ content: '❌ Member Whitelist module is not enabled in the dashboard.', ephemeral: true });
        }
        
        let members = mwModule.config.members || [];

        if (group === 'whitelist' && subcommand === 'add') {
          const targetMember = interaction.options.getUser('member_user', true);
          if (targetMember.bot) return interaction.reply({ content: '❌ Target user is a bot. Use the `/bot whitelist` command instead.', ephemeral: true });
          
          if (members.find((m: MemberWhitelistRecord) => m.userId === targetMember.id)) {
            return interaction.reply({ content: '❌ This member is already whitelisted.', ephemeral: true });
          }
          
          members.push({
            id: targetMember.id,
            userId: targetMember.id,
            tag: targetMember.tag,
            status: 'active',
            enabledModules: [],
            addedBy: interaction.user.id,
            createdDate: new Date().toISOString()
          });
          
          context.updateModuleConfig('member_whitelist', { members });
          context.logSyncEvent(`[Member Whitelist] Added member ${targetMember.tag} via command.`, 'success');
          return interaction.reply({ content: `✅ Successfully whitelisted member **${targetMember.tag}**.`, ephemeral: true });
        }
        
        if (group === 'whitelist' && subcommand === 'remove') {
          const targetMember = interaction.options.getUser('member_user', true);
          if (!members.find((m: MemberWhitelistRecord) => m.userId === targetMember.id)) {
            return interaction.reply({ content: '❌ This member is not whitelisted.', ephemeral: true });
          }
          
          members = members.filter((m: MemberWhitelistRecord) => m.userId !== targetMember.id);
          context.updateModuleConfig('member_whitelist', { members });
          context.logSyncEvent(`[Member Whitelist] Removed member ${targetMember.tag} via command.`, 'info');
          return interaction.reply({ content: `🗑️ Removed member **${targetMember.tag}** from the whitelist.`, ephemeral: true });
        }

        await interaction.reply({ content: '❌ Subcommand not recognized or fully implemented yet.', ephemeral: true });
      }
    },
    {
      name: 'command_whitelist',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply({ content: 'Global Whitelist command received', ephemeral: true });
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
        const { action, payload } = req.body;
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'member_whitelist');
        let members = mod?.config?.members || [];

        const actor = req.user?.username || 'admin';
        const actorId = req.user?.id || '111';
        const logId = Math.random().toString(36).substring(2, 11);

        if (action === 'add') {
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
