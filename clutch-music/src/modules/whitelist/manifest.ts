import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

// ─── WTPS Data Structures ────────────────────────────────────────────────────

export interface WhitelistUser {
  userId: string;
  tag: string;
  reason: string;
  notes?: string;
  addedAt: string;
  expiresAt?: string | null;
  allowedExceptions: string[];
  enforcementPolicy: EnforcementPolicy;
}

export interface WhitelistRole {
  roleId: string;
  name: string;
  color: string;
  protectedOps: string[];
  enforcementPolicy: EnforcementPolicy;
  addedAt: string;
}

export interface WhitelistBot {
  userId: string;
  tag: string;
  status: 'pending' | 'approved' | 'restricted' | 'suspended' | 'removed';
  approvedModules: string[];
  approvedActions: string[];
  monitoringLevel: 'low' | 'medium' | 'high';
  enforcementPolicy: EnforcementPolicy;
  notes?: string;
  securityScore: number;
  addedAt: string;
  activityLog: WTPSAuditEntry[];
  incidentCount: number;
}

export type EnforcementPolicy = 
  | 'log_only'
  | 'notify_owner'
  | 'dashboard_alert'
  | 'quarantine'
  | 'remove_roles'
  | 'kick'
  | 'ban'
  | 'attempt_recovery'
  | 'create_incident'
  | 'escalate';

export interface WTPSIncident {
  id: string;
  time: string;
  type: 'user_protection' | 'role_protection' | 'bot_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actor: string;
  target: string;
  action: string;
  status: 'open' | 'resolved' | 'dismissed';
  policyApplied: EnforcementPolicy;
  recoveryAttempted: boolean;
}

export interface WTPSAuditEntry {
  time: string;
  actor: string;
  target: string;
  action: string;
  previousState?: string;
  newState?: string;
  reason?: string;
}

export interface WTPSConfig {
  enabled: boolean;
  users: WhitelistUser[];
  roles: WhitelistRole[];
  bots: WhitelistBot[];
  defaultUserPolicy: EnforcementPolicy;
  defaultRolePolicy: EnforcementPolicy;
  defaultBotPolicy: EnforcementPolicy;
  notifyChannelId?: string;
  incidents: WTPSIncident[];
  audit: WTPSAuditEntry[];
}

// ─── Internal WTPS state (persisted inside module config) ─────────────────────

function getWTPS(config: Record<string, any>): WTPSConfig {
  return {
    enabled: config.enabled ?? false,
    users: config.users ?? [],
    roles: config.roles ?? [],
    bots: config.bots ?? [],
    defaultUserPolicy: config.defaultUserPolicy ?? 'create_incident',
    defaultRolePolicy: config.defaultRolePolicy ?? 'attempt_recovery',
    defaultBotPolicy: config.defaultBotPolicy ?? 'escalate',
    notifyChannelId: config.notifyChannelId,
    incidents: config.incidents ?? [],
    audit: config.audit ?? []
  };
}

function createIncident(
  type: WTPSIncident['type'],
  severity: WTPSIncident['severity'],
  actor: string,
  target: string,
  action: string,
  policy: EnforcementPolicy
): WTPSIncident {
  return {
    id: `wtps-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    time: new Date().toISOString(),
    type,
    severity,
    actor,
    target,
    action,
    status: 'open',
    policyApplied: policy,
    recoveryAttempted: policy === 'attempt_recovery' || policy === 'escalate'
  };
}

// ─── Manifest Definition ──────────────────────────────────────────────────────

export const WhitelistManifest: ModuleManifest = {
  id: 'whitelist',
  name: 'Whitelist & Trust',
  version: '1.0.0',
  description: 'Configurable trust and protection system for users, roles, and third-party bots with enforcement policies and incident management.',
  
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 60; // Base progress — WTPS is opt-in, partial config is valid
      const wtps = getWTPS(config);

      // Validate whitelisted role IDs still exist
      for (const wr of wtps.roles) {
        if (!registry.roles.some(r => r.id === wr.roleId)) {
          errors.push(`Protected role "${wr.name}" (${wr.roleId}) no longer exists in server!`);
        }
      }

      // Validate notification channel
      if (wtps.notifyChannelId && !registry.channels.some(c => c.id === wtps.notifyChannelId)) {
        errors.push(`WTPS notification channel (${wtps.notifyChannelId}) was deleted or not found!`);
      }

      if (wtps.enabled) progress = 100;
      if (errors.length > 0) progress = Math.max(progress - 20, 40);

      return { progress, errors };
    }
  },

  commands: [
    {
      name: 'whitelist',
      description: 'Manage the Whitelist & Trust Protection System',
      options: [
        {
          name: 'user',
          description: 'User Whitelist Management',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'add', type: 1, description: 'Add User', options: [ { name: 'user', type: 6, description: 'User', required: true }, { name: 'level', type: 3, description: 'Protection Level', required: true }, { name: 'expiration', type: 3, description: 'Expiration', required: false }, { name: 'reason', type: 3, description: 'Reason', required: false } ] },
            { name: 'remove', type: 1, description: 'Remove User', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'info', type: 1, description: 'Information', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'list', type: 1, description: 'List Users' },
            { name: 'edit', type: 1, description: 'Edit User', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'protect', type: 1, description: 'Protect', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'exceptions', type: 1, description: 'Exceptions', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'history', type: 1, description: 'History', options: [ { name: 'user', type: 6, description: 'User', required: true } ] },
            { name: 'audit', type: 1, description: 'Audit', options: [ { name: 'user', type: 6, description: 'User', required: true } ] }
          ]
        },
        {
          name: 'role',
          description: 'Role Whitelist Management',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'add', type: 1, description: 'Add Role', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'remove', type: 1, description: 'Remove Role', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'info', type: 1, description: 'Information', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'list', type: 1, description: 'List Roles' },
            { name: 'edit', type: 1, description: 'Edit Role', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'protect', type: 1, description: 'Protection', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'exceptions', type: 1, description: 'Exceptions', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'history', type: 1, description: 'History', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] },
            { name: 'audit', type: 1, description: 'Audit', options: [ { name: 'role', type: 8, description: 'Role', required: true } ] }
          ]
        },
        {
          name: 'bot',
          description: 'Bot Whitelist Management',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'approve', type: 1, description: 'Approve', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'restrict', type: 1, description: 'Restrict', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'suspend', type: 1, description: 'Suspend', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'remove', type: 1, description: 'Remove', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'info', type: 1, description: 'Information', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'list', type: 1, description: 'List Bots' },
            { name: 'pending', type: 1, description: 'Review Pending' },
            { name: 'permissions', type: 1, description: 'Allowed Actions', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'score', type: 1, description: 'Security Score', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'activity', type: 1, description: 'Activity', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'incidents', type: 1, description: 'Incidents', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] },
            { name: 'audit', type: 1, description: 'Audit', options: [ { name: 'bot', type: 6, description: 'Bot User', required: true } ] }
          ]
        },
        {
          name: 'policy',
          description: 'Enforcement Policies',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'configure', type: 1, description: 'Configure Policy' },
            { name: 'view', type: 1, description: 'View Policy' },
            { name: 'test', type: 1, description: 'Test Policy' },
            { name: 'reset', type: 1, description: 'Reset Policy' }
          ]
        },
        {
          name: 'monitoring',
          description: 'Monitoring',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'enable', type: 1, description: 'Enable Monitoring' },
            { name: 'disable', type: 1, description: 'Disable Monitoring' },
            { name: 'status', type: 1, description: 'Check Status' },
            { name: 'configure', type: 1, description: 'Configure Monitoring' }
          ]
        },
        {
          name: 'quarantine',
          description: 'Quarantine Settings',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'release', type: 1, description: 'Release', options: [ { name: 'target', type: 6, description: 'User or Bot', required: true } ] },
            { name: 'extend', type: 1, description: 'Extend', options: [ { name: 'target', type: 6, description: 'User or Bot', required: true } ] },
            { name: 'history', type: 1, description: 'History' },
            { name: 'queue', type: 1, description: 'Active Queue' }
          ]
        },
        {
          name: 'recovery',
          description: 'Recovery Settings',
          type: 2, // SUB_COMMAND_GROUP
          options: [
            { name: 'restore', type: 1, description: 'Restore' },
            { name: 'status', type: 1, description: 'Status' },
            { name: 'history', type: 1, description: 'History' }
          ]
        },
        { name: 'sync', type: 1, description: 'Synchronizes Users, Roles, Bots' },
        { name: 'health', type: 1, description: 'Check WTPS Health and Configurations' },
        { name: 'dashboard', type: 1, description: 'Returns the direct dashboard page link for WTPS' }
      ]
    }
  ],

  events: [
    {
      name: 'command_whitelist',
      handler: async (client: any, interaction: any, context: any) => {
        const action = interaction.options.getString('action');
        const target = interaction.options.getString('target');

        // Owner-only check
        const member = interaction.member;
        const isOwner = member?.permissions?.has?.('Administrator') || 
                        interaction.guild?.ownerId === interaction.user?.id;

        if (!isOwner) {
          await interaction.reply({
            content: '🔒 **Access Denied** — Whitelist commands require Server Owner or Administrator permissions.',
            flags: 64
          });
          return;
        }

        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        switch (action) {
          case 'list':
            const userCount = wtps.users.length;
            const roleCount = wtps.roles.length;
            const botCount = wtps.bots.length;
            const pendingBots = wtps.bots.filter((b: WhitelistBot) => b.status === 'pending').length;
            await interaction.reply({
              content: [
                '## 🛡️ RAGE OPTIMISER — Whitelist & Trust Overview',
                `**Protected Users:** ${userCount}`,
                `**Protected Roles:** ${roleCount}`,
                `**Tracked Bots:** ${botCount} (${pendingBots} pending review)`,
                `**Open Incidents:** ${wtps.incidents.filter((i: WTPSIncident) => i.status === 'open').length}`,
                `\n> Manage full configuration from the Dashboard → Whitelist & Trust`
              ].join('\n'),
              flags: 64
            });
            break;

          case 'info':
            if (!target) {
              await interaction.reply({ content: '❌ Please provide a target ID.', flags: 64 });
              return;
            }
            const protectedUser = wtps.users.find((u: WhitelistUser) => u.userId === target);
            const protectedRole = wtps.roles.find((r: WhitelistRole) => r.roleId === target);
            const trackedBot = wtps.bots.find((b: WhitelistBot) => b.userId === target);

            if (protectedUser) {
              await interaction.reply({ content: `👤 **User:** ${protectedUser.tag}\n📋 **Reason:** ${protectedUser.reason}\n🛡️ **Policy:** \`${protectedUser.enforcementPolicy}\`\n📅 **Added:** ${protectedUser.addedAt}`, flags: 64 });
            } else if (protectedRole) {
              await interaction.reply({ content: `🎭 **Role:** ${protectedRole.name}\n🔐 **Protected ops:** ${protectedRole.protectedOps.join(', ')}\n🛡️ **Policy:** \`${protectedRole.enforcementPolicy}\``, flags: 64 });
            } else if (trackedBot) {
              await interaction.reply({ content: `🤖 **Bot:** ${trackedBot.tag}\n📊 **Status:** ${trackedBot.status}\n🔒 **Security Score:** ${trackedBot.securityScore}/100\n📦 **Approved Modules:** ${trackedBot.approvedModules.join(', ') || 'None'}`, flags: 64 });
            } else {
              await interaction.reply({ content: `❌ No WTPS entry found for ID \`${target}\`.`, flags: 64 });
            }
            break;

          default:
            await interaction.reply({
              content: [
                '📋 **Whitelist Commands:**',
                '`/whitelist list` — Overview of all protected entities',
                '`/whitelist info <id>` — Details for a user, role, or bot',
                '`/whitelist user-add <id>` — Add user to protection list',
                '`/whitelist user-remove <id>` — Remove user protection',
                '`/whitelist role-add <id>` — Protect a server role',
                '`/whitelist role-remove <id>` — Remove role protection',
                '`/whitelist bot-approve <id>` — Approve a bot',
                '`/whitelist bot-restrict <id>` — Restrict a bot',
                '`/whitelist bot-suspend <id>` — Suspend a bot',
                '`/whitelist bot-remove <id>` — Remove bot from tracking'
              ].join('\n'),
              flags: 64
            });
        }
      }
    },

    // ── Gateway event: role modified by non-owner ─────────────────────────────
    {
      name: 'roleUpdate',
      handler: async (client: any, oldRole: any, newRole: any, context: any) => {
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (!wtps.enabled) return;

        const protectedRole = wtps.roles.find((r: WhitelistRole) => r.roleId === oldRole.id);
        if (!protectedRole) return;

        const changes: string[] = [];
        if (oldRole.name !== newRole.name) changes.push(`renamed from "${oldRole.name}" to "${newRole.name}"`);
        if (oldRole.permissions?.bitfield !== newRole.permissions?.bitfield) changes.push('permissions edited');
        if (oldRole.hexColor !== newRole.hexColor) changes.push(`color changed from ${oldRole.hexColor} to ${newRole.hexColor}`);

        if (changes.length === 0) return;

        const incident = createIncident(
          'role_protection',
          'high',
          'Unknown Actor',
          protectedRole.name,
          `Protected role ${changes.join(', ')}`,
          protectedRole.enforcementPolicy
        );

        wtps.incidents.unshift(incident);
        wtps.audit.unshift({
          time: new Date().toISOString(),
          actor: 'Discord Gateway',
          target: protectedRole.name,
          action: `Role ${changes.join(', ')} — WTPS policy applied: ${protectedRole.enforcementPolicy}`,
          previousState: oldRole.name,
          newState: newRole.name
        });

        context.logSyncEvent(
          `WTPS ALERT: Protected role "${protectedRole.name}" was modified (${changes.join(', ')}). Incident created.`,
          'warn'
        );
      }
    },

    // ── Gateway event: role deleted ───────────────────────────────────────────
    {
      name: 'roleDelete',
      handler: async (client: any, role: any, context: any) => {
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (!wtps.enabled) return;

        const protectedRole = wtps.roles.find((r: WhitelistRole) => r.roleId === role.id);
        if (!protectedRole) return;

        const incident = createIncident(
          'role_protection',
          'critical',
          'Unknown Actor',
          protectedRole.name,
          `CRITICAL: Protected role "${protectedRole.name}" was DELETED`,
          protectedRole.enforcementPolicy
        );

        wtps.incidents.unshift(incident);
        context.logSyncEvent(
          `WTPS CRITICAL: Protected role "${protectedRole.name}" was deleted! Immediate owner notification required.`,
          'warn'
        );
      }
    },

    // ── Gateway event: member updated (role changes on protected users) ───────
    {
      name: 'guildMemberUpdate',
      handler: async (client: any, oldMember: any, newMember: any, context: any) => {
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (!wtps.enabled) return;

        const protectedUser = wtps.users.find((u: WhitelistUser) => u.userId === (newMember?.id || newMember?.user?.id));
        if (!protectedUser) return;

        const oldRoles = oldMember?.roles?.cache?.map((r: any) => r.id) || [];
        const newRoles = newMember?.roles?.cache?.map((r: any) => r.id) || [];
        const removedRoles = oldRoles.filter((id: string) => !newRoles.includes(id));

        if (removedRoles.length === 0) return;

        const incident = createIncident(
          'user_protection',
          'high',
          'Unknown Actor',
          protectedUser.tag,
          `Protected user had ${removedRoles.length} role(s) removed`,
          protectedUser.enforcementPolicy
        );

        wtps.incidents.unshift(incident);
        context.logSyncEvent(
          `WTPS ALERT: Protected user "${protectedUser.tag}" had roles removed. Incident created. Recovery may be required.`,
          'warn'
        );
      }
    }
  ],

  routes: [
    // Get full WTPS state
    {
      path: '/state',
      method: 'get',
      handler: async (_req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});
        res.json(wtps);
      }
    },
    // Add/remove user
    {
      path: '/users',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { action, user } = req.body;
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (action === 'add' && user) {
          const entry: WhitelistUser = {
            userId: user.userId,
            tag: user.tag || user.userId,
            reason: user.reason || 'Protected by Owner',
            notes: user.notes || '',
            addedAt: new Date().toISOString(),
            expiresAt: user.expiresAt || null,
            allowedExceptions: user.allowedExceptions || [],
            enforcementPolicy: user.enforcementPolicy || wtps.defaultUserPolicy
          };
          wtps.users = wtps.users.filter((u: WhitelistUser) => u.userId !== user.userId);
          wtps.users.push(entry);
          wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: entry.tag, action: 'Added to User Whitelist', reason: entry.reason });
          context.logSyncEvent(`WTPS: User "${entry.tag}" added to whitelist.`, 'success');
        } else if (action === 'remove' && user?.userId) {
          const found = wtps.users.find((u: WhitelistUser) => u.userId === user.userId);
          if (found) {
            wtps.users = wtps.users.filter((u: WhitelistUser) => u.userId !== user.userId);
            wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: found.tag, action: 'Removed from User Whitelist' });
            context.logSyncEvent(`WTPS: User "${found.tag}" removed from whitelist.`, 'warn');
          }
        }

        context.updateModuleConfig('whitelist', { ...wtpsMod?.config, ...wtps });
        res.json({ success: true, users: wtps.users });
      }
    },
    // Add/remove role
    {
      path: '/roles',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { action, role } = req.body;
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (action === 'add' && role) {
          const entry: WhitelistRole = {
            roleId: role.roleId,
            name: role.name || role.roleId,
            color: role.color || '#ffffff',
            protectedOps: role.protectedOps || ['delete', 'rename', 'permission_edit'],
            enforcementPolicy: role.enforcementPolicy || wtps.defaultRolePolicy,
            addedAt: new Date().toISOString()
          };
          wtps.roles = wtps.roles.filter((r: WhitelistRole) => r.roleId !== role.roleId);
          wtps.roles.push(entry);
          wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: entry.name, action: 'Added to Role Whitelist' });
          context.logSyncEvent(`WTPS: Role "${entry.name}" added to protected roles.`, 'success');
        } else if (action === 'remove' && role?.roleId) {
          const found = wtps.roles.find((r: WhitelistRole) => r.roleId === role.roleId);
          if (found) {
            wtps.roles = wtps.roles.filter((r: WhitelistRole) => r.roleId !== role.roleId);
            wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: found.name, action: 'Removed from Role Whitelist' });
            context.logSyncEvent(`WTPS: Role "${found.name}" removed from protection.`, 'warn');
          }
        }

        context.updateModuleConfig('whitelist', { ...wtpsMod?.config, ...wtps });
        res.json({ success: true, roles: wtps.roles });
      }
    },
    // Update bot status
    {
      path: '/bots',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { action, bot } = req.body;
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (action === 'add' && bot) {
          const entry: WhitelistBot = {
            userId: bot.userId,
            tag: bot.tag || bot.userId,
            status: 'pending',
            approvedModules: bot.approvedModules || [],
            approvedActions: bot.approvedActions || [],
            monitoringLevel: 'high',
            enforcementPolicy: wtps.defaultBotPolicy,
            notes: bot.notes || '',
            securityScore: 50,
            addedAt: new Date().toISOString(),
            activityLog: [],
            incidentCount: 0
          };
          wtps.bots = wtps.bots.filter((b: WhitelistBot) => b.userId !== bot.userId);
          wtps.bots.push(entry);
          context.logSyncEvent(`WTPS: Bot "${entry.tag}" added for review.`, 'info');
        } else if (['approve', 'restrict', 'suspend', 'remove'].includes(action) && bot?.userId) {
          const found = wtps.bots.find((b: WhitelistBot) => b.userId === bot.userId);
          if (found) {
            if (action === 'remove') {
              wtps.bots = wtps.bots.filter((b: WhitelistBot) => b.userId !== bot.userId);
            } else {
              found.status = action === 'approve' ? 'approved' : action === 'restrict' ? 'restricted' : 'suspended';
              if (action === 'approve') found.securityScore = Math.min(100, found.securityScore + 30);
              if (action === 'suspend') found.securityScore = Math.max(0, found.securityScore - 50);
            }
            wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: found.tag, action: `Bot status changed to: ${action}` });
            context.logSyncEvent(`WTPS: Bot "${found.tag}" status updated to "${action}".`, action === 'approve' ? 'success' : 'warn');
          }
        }

        context.updateModuleConfig('whitelist', { ...wtpsMod?.config, ...wtps });
        res.json({ success: true, bots: wtps.bots });
      }
    },
    // Resolve / dismiss incidents
    {
      path: '/incidents',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { incidentId, newStatus } = req.body;
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        const incident = wtps.incidents.find((i: WTPSIncident) => i.id === incidentId);
        if (incident && ['resolved', 'dismissed'].includes(newStatus)) {
          incident.status = newStatus;
          wtps.audit.unshift({ time: new Date().toISOString(), actor: 'Owner', target: incident.target, action: `Incident ${newStatus}: ${incident.action}` });
          context.logSyncEvent(`WTPS: Incident "${incident.id}" marked as ${newStatus}.`, 'info');
          context.updateModuleConfig('whitelist', { ...wtpsMod?.config, ...wtps });
        }

        res.json({ success: true, incident });
      }
    },
    // Update global policies
    {
      path: '/policies',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { defaultUserPolicy, defaultRolePolicy, defaultBotPolicy, notifyChannelId } = req.body;
        const modules = context.getModulesState();
        const wtpsMod = modules.find((m: any) => m.id === 'whitelist');
        const wtps = getWTPS(wtpsMod?.config || {});

        if (defaultUserPolicy) wtps.defaultUserPolicy = defaultUserPolicy;
        if (defaultRolePolicy) wtps.defaultRolePolicy = defaultRolePolicy;
        if (defaultBotPolicy) wtps.defaultBotPolicy = defaultBotPolicy;
        if (notifyChannelId !== undefined) wtps.notifyChannelId = notifyChannelId;

        context.updateModuleConfig('whitelist', { ...wtpsMod?.config, ...wtps });
        context.logSyncEvent('WTPS: Global enforcement policies updated by Owner.', 'success');
        res.json({ success: true });
      }
    }
  ]
};
