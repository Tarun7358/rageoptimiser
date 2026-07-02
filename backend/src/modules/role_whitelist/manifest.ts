import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

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
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.reply({ content: '🔒 **Access Denied** — Administrator permissions required.', ephemeral: true });
        }
        await interaction.reply({ content: 'Role Whitelist command received', ephemeral: true });
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
