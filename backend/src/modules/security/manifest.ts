import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

// Simple in-memory tracker for rate limits
interface ActionTracker {
  count: number;
  timestamps: number[];
}

const userActions = new Map<string, Map<string, ActionTracker>>();

function checkRateLimit(guildId: string, userId: string, ruleId: string, limit: number, windowSeconds: number): boolean {
  const key = `${userId}_${ruleId}`;
  if (!userActions.has(guildId)) {
    userActions.set(guildId, new Map());
  }
  const guildTracker = userActions.get(guildId)!;
  if (!guildTracker.has(key)) {
    guildTracker.set(key, { count: 0, timestamps: [] });
  }
  const tracker = guildTracker.get(key)!;
  const now = Date.now();
  tracker.timestamps = tracker.timestamps.filter(ts => now - ts < windowSeconds * 1000);
  tracker.timestamps.push(now);
  tracker.count = tracker.timestamps.length;
  return tracker.count >= limit;
}

async function isExecutorBypassed(guild: any, executorId: string, config: any): Promise<boolean> {
  // 1. Guild owner always bypasses
  if (executorId === guild.ownerId) return true;

  // 2. Check whitelist by targetId
  const whitelist = config.whitelist || [];
  if (whitelist.some((w: any) => w.targetId === executorId)) return true;

  // 3. Check exception roles
  const exceptionRoleIds: string[] = config.exceptionRoleIds || [];
  if (exceptionRoleIds.length > 0) {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (member) {
      const hasException = member.roles.cache.some((r: any) => exceptionRoleIds.includes(r.id));
      if (hasException) return true;
    }
  }

  return false;
}

async function punishViolator(client: any, guild: any, executorId: string, executorTag: string, reason: string, ruleAction: string, config: any, context: any) {
  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    // 1. Identify and strip ALL administrative roles (roles with Administrator permission)
    const adminRoles = member.roles.cache.filter((r: any) => r.permissions.has(PermissionFlagsBits.Administrator) && r.id !== guild.id);
    for (const [roleId] of adminRoles) {
      await member.roles.remove(roleId).catch(() => {});
    }

    // 2. Apply action punishment
    if (ruleAction === 'quarantine' && config.quarantineRoleId) {
      const rolesToRemove = member.roles.cache.filter((r: any) => r.id !== guild.id && !r.managed && r.id !== config.quarantineRoleId);
      const originalRoleIds = Array.from(rolesToRemove.keys());
      
      await member.roles.add(config.quarantineRoleId).catch(console.error);
      for (const roleId of originalRoleIds) {
        await member.roles.remove(roleId).catch(() => {});
      }
      
      const quarantinedUsers = config.quarantinedUsers || [];
      if (!quarantinedUsers.some((u: any) => u.userId === executorId)) {
        quarantinedUsers.push({
          id: `q-${Date.now()}`,
          tag: executorTag,
          userId: executorId,
          reason: reason,
          time: new Date().toISOString(),
          status: 'Quarantined',
          risk: 'danger',
          originalRoles: originalRoleIds
        });
        context.updateModuleConfig('security', { quarantinedUsers });
      }
      context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Action]: Quarantined ${executorTag} and stripped all Administrative roles. Reason: ${reason}`, 'warn');
    } else if (ruleAction === 'ban') {
      await guild.members.ban(executorId, { reason }).catch(console.error);
      context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Action]: Banned ${executorTag}. Reason: ${reason}`, 'warn');
    } else if (ruleAction === 'kick') {
      await member.kick(reason).catch(console.error);
      context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Action]: Kicked ${executorTag}. Reason: ${reason}`, 'warn');
    }
  } catch (err) {
    console.error('Error punishing violator:', err);
  }
}

export const SecurityManifest: ModuleManifest = {
  id: 'security',
  name: 'Security Guard',
  version: '1.5.0',
  description: 'Enterprise Security Center featuring real-time SOC logs, threat detection rules, scan diagnostics, and automatic quarantines.',
  configSchema: {
    requiredFields: ['quarantineRoleId', 'alertChannelId'],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;

      const roleExists = (id: string) => registry.roles.some(r => r.id === id);
      const channelExists = (id: string) => registry.channels.some(c => c.id === id);

      if (config.quarantineRoleId) {
        progress += 50;
        if (!roleExists(config.quarantineRoleId)) {
          errors.push(`Quarantine role ID (${config.quarantineRoleId}) was deleted from the server!`);
        }
      }
      if (config.alertChannelId) {
        progress += 50;
        if (!channelExists(config.alertChannelId)) {
          errors.push(`Alert logging channel ID (${config.alertChannelId}) was deleted from the server!`);
        }
      }

      return { progress: Math.min(progress, 100), errors };
    }
  },
  commands: [
    {
      name: 'quarantine',
      description: 'Forcefully isolate a suspect server member.',
      options: [
        {
          name: 'user',
          type: 6, // USER
          description: 'The member to quarantine',
          required: true
        }
      ]
    },
    {
      name: 'lockdown',
      description: 'Lock or unlock the entire server in case of emergency.',
      options: [
        {
          name: 'status',
          type: 3, // STRING
          description: 'Lock or unlock the guild',
          required: true,
          choices: [
            { name: 'Enable Emergency Lockdown', value: 'enable' },
            { name: 'Disable Emergency Lockdown', value: 'disable' }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_quarantine',
      handler: async (client: any, interaction: any, context: any) => {
        const member = interaction.options.getMember('user');
        if (!member) {
          return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        }

        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};
        const quarantineRoleId = config.quarantineRoleId;

        if (!quarantineRoleId) {
          return interaction.reply({ content: '❌ Quarantine role is not configured.', ephemeral: true });
        }

        try {
          const rolesToRemove = member.roles.cache.filter((r: any) => r.name !== '@everyone' && !r.managed);
          const originalRoleIds = Array.from(rolesToRemove.keys());
          
          await member.roles.add(quarantineRoleId);
          for (const roleId of originalRoleIds) {
            await member.roles.remove(roleId).catch(() => {});
          }
          
          const quarantinedUsers = config.quarantinedUsers || [];
          quarantinedUsers.push({
            id: `q-${Date.now()}`,
            tag: member.user.tag,
            userId: member.user.id,
            reason: 'Manual Quarantine via Slash Command',
            time: new Date().toISOString(),
            status: 'Quarantined',
            risk: 'danger',
            originalRoles: originalRoleIds
          });
          context.updateModuleConfig('security', { quarantinedUsers });
          context.logSyncEvent(`Quarantined user "${member.user.tag}" via Slash Command.`, 'warn');
          
          await interaction.reply({
            content: `🚨 **Member Quarantined**: Successfully isolated ${member.user} and stripped dangerous permissions.`,
            ephemeral: false
          });
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: '❌ Failed to quarantine member. Check bot role hierarchy.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_lockdown',
      handler: async (client: any, interaction: any, context: any) => {
        const status = interaction.options.getString('status');
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};

        if (status === 'enable') {
          context.updateModuleConfig('security', { emergencyMode: true });
          context.logSyncEvent('EMERGENCY LOCKDOWN ENABLED via Slash Command.', 'danger');
          await interaction.reply({ content: '🚨 **Emergency Lockdown Activated**: Channels frozen and non-whitelisted actions blocked.', ephemeral: false });
        } else {
          context.updateModuleConfig('security', { emergencyMode: false });
          context.logSyncEvent('Emergency Lockdown Disabled.', 'success');
          await interaction.reply({ content: '✅ **Emergency Lockdown Deactivated**: Restored regular server permissions.', ephemeral: false });
        }
      }
    },
    {
      name: 'channelDelete',
      handler: async (client: any, channel: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_channel_delete || { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = channel.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelDelete }).catch(() => null);
          const deletionLog = fetchedLogs?.entries.find((e: any) => e.targetId === channel.id);
          if (!deletionLog) return;

          const executor = deletionLog.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_channel_delete', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized channel deletion of #${channel.name} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await guild.channels.create({
              name: channel.name,
              type: channel.type,
              parent: channel.parentId,
              permissionOverwrites: channel.permissionOverwrites.cache.map((o: any) => ({
                id: o.id,
                type: o.type,
                allow: o.allow,
                deny: o.deny
              }))
            }).catch(console.error);
            context.logSyncEvent(guild.id, `Re-created deleted channel #${channel.name}.`, 'success');
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Deletion (#${channel.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'channelCreate',
      handler: async (client: any, channel: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_channel_create || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = channel.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelCreate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === channel.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_channel_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized channel creation #${channel.name} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await channel.delete('Anti-Nuke Recovery: Deleting unauthorized channel.').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Creation (#${channel.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'channelUpdate',
      handler: async (client: any, oldChannel: any, newChannel: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_channel_update || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = newChannel.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newChannel.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_channel_update', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized channel update #${newChannel.name} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await newChannel.edit({
              name: oldChannel.name,
              type: oldChannel.type,
              topic: oldChannel.topic,
              nsfw: oldChannel.nsfw,
              parentId: oldChannel.parentId,
              rateLimitPerUser: oldChannel.rateLimitPerUser,
              permissionOverwrites: oldChannel.permissionOverwrites.cache.map((o: any) => ({
                id: o.id,
                type: o.type,
                allow: o.allow,
                deny: o.deny
              }))
            }).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Update (#${newChannel.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'roleCreate',
      handler: async (client: any, role: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_role_create || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = role.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleCreate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === role.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_role_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role creation "${role.name}" by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await role.delete('Anti-Nuke Recovery: Deleting unauthorized role.').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Creation (${role.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'roleDelete',
      handler: async (client: any, role: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_role_delete || { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = role.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleDelete }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === role.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_role_delete', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role deletion of "${role.name}" by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await guild.roles.create({
              name: role.name,
              color: role.color,
              hoist: role.hoist,
              permissions: role.permissions,
              mentionable: role.mentionable,
              position: role.position,
              reason: 'Anti-Nuke Recovery: Restoring deleted role'
            }).catch(console.error);
            context.logSyncEvent(guild.id, `Re-created deleted role "${role.name}".`, 'success');
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Deletion (${role.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'roleUpdate',
      handler: async (client: any, oldRole: any, newRole: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_role_update || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = newRole.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newRole.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_role_update', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role update for "${newRole.name}" by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await newRole.edit({
              name: oldRole.name,
              color: oldRole.color,
              hoist: oldRole.hoist,
              permissions: oldRole.permissions,
              mentionable: oldRole.mentionable,
              position: oldRole.position
            }).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Update (${newRole.name})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'guildMemberUpdate',
      handler: async (client: any, oldMember: any, newMember: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        
        try {
          const guild = newMember.guild;
          if (!guild) return;

          const oldRoles = oldMember.roles.cache;
          const newRoles = newMember.roles.cache;
          const addedRoles = newRoles.filter((r: any) => !oldRoles.has(r.id));
          if (addedRoles.size === 0) return;

          const hasAdmin = addedRoles.some((r: any) => r.permissions.has(PermissionFlagsBits.Administrator));
          const isMonitored = addedRoles.some((r: any) => (config.monitoredRoleIds || []).includes(r.id));

          if (!hasAdmin && !isMonitored) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newMember.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          if (config.roleMonitorMode === 'Custom Selection' && !isMonitored) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role grant to ${newMember.user.tag} by ${executor.tag}.`, 'warn');

          for (const [roleId] of addedRoles) {
            await newMember.roles.remove(roleId).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Grant to ${newMember.user.tag}`, 'quarantine', config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'guildBanAdd',
      handler: async (client: any, ban: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_ban || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = ban.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === ban.user.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_ban', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized ban of ${ban.user.tag} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await guild.members.unban(ban.user.id, 'Anti-Nuke Recovery: Revoking unauthorized ban').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Ban of ${ban.user.tag}`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'guildMemberRemove',
      handler: async (client: any, member: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_kick || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = member.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberKick }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === member.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_kick', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized kick of ${member.user.tag} by ${executor.tag}.`, 'warn');

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Kick of ${member.user.tag}`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'guildMemberAdd',
      handler: async (client: any, member: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_bot_add || { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true };

        if (!member.user.bot) return;
        if (!rule.enabled) return;

        try {
          const guild = member.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === member.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config)) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_bot_add', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized bot add of ${member.user.tag} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await member.kick('Anti-Nuke Recovery: Kicking unauthorized bot').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Bot Addition (${member.user.tag})`, rule.action, config, context);
        } catch (err) {
          console.error(err);
        }
      }
    }
  ],
  routes: [
    {
      path: '/quarantine/:userId/action',
      method: 'post',
      handler: async (req, res, context) => {
        const { userId } = req.params;
        const { action } = req.body;
        
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};
        const quarantinedUsers = config.quarantinedUsers || [];
        const userEntry = quarantinedUsers.find((u: any) => u.userId === userId);
        
        if (!userEntry) {
          return res.status(404).json({ error: 'User not found in quarantine queue' });
        }
        
        try {
          const client = context.client;
          if (client && process.env.GUILD_ID) {
            const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
            if (guild) {
              const member = await guild.members.fetch(userId).catch(() => null);
              if (action === 'release' && member) {
                if (config.quarantineRoleId) {
                  await member.roles.remove(config.quarantineRoleId).catch(() => null);
                }
                if (userEntry.originalRoles && userEntry.originalRoles.length > 0) {
                  await member.roles.add(userEntry.originalRoles).catch(() => null);
                }
                context.logSyncEvent(guild.id, `Quarantine Release: Restored original roles for "${userEntry.tag}".`, 'success');
              } else if (action === 'confirm') {
                context.logSyncEvent(guild.id, `Quarantine Confirmed: Action finalized for "${userEntry.tag}".`, 'warn');
              }
            }
          }
          
          const updatedUsers = quarantinedUsers.filter((u: any) => u.userId !== userId);
          context.updateModuleConfig('security', { quarantinedUsers: updatedUsers });
          res.json({ success: true, updatedUsers });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      }
    },
    {
      path: '/scan',
      method: 'get',
      handler: async (req, res, context) => {
        // Return dynamic scan diagnostics based on current server state
        const registry = context.getRegistry ? context.getRegistry() : { roles: [], channels: [] };
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};

        const adminRoles = registry.roles.filter((r: any) => r.permissions.includes('Administrator') && r.id !== '1508399252546654370');
        const hasBackup = modules.some((m: any) => m.id === 'backups' && m.status === 'ready');
        
        let score = 95;
        const issues: Array<{ type: string; title: string; desc: string; risk: 'danger' | 'warning' | 'info' }> = [];

        if (adminRoles.length > 3) {
          score -= 15;
          issues.push({
            type: 'role_hierarchy',
            title: 'Excessive Administrator Roles',
            desc: `Found ${adminRoles.length} roles with Administrator privileges. Recommend removing unnecessary administrative roles.`,
            risk: 'danger'
          });
        }
        if (!config.quarantineRoleId) {
          score -= 20;
          issues.push({
            type: 'quarantine',
            title: 'Quarantine Role Missing',
            desc: 'Quarantine role is not bound. Incidents cannot be auto-isolated.',
            risk: 'danger'
          });
        }
        if (!hasBackup) {
          score -= 10;
          issues.push({
            type: 'backup',
            title: 'No Backups Initialized',
            desc: 'Backups module is offline or not configured. Ensure server backups are scheduled.',
            risk: 'warning'
          });
        }
        if (!config.rules || Object.keys(config.rules).length === 0) {
          score -= 15;
          issues.push({
            type: 'rules',
            title: 'Weak Anti-Nuke Rule Profile',
            desc: 'All security rules are currently using basic or default profiles. Tighten parameters for better security coverage.',
            risk: 'warning'
          });
        }

        res.json({
          score: Math.max(score, 10),
          riskRating: score > 80 ? 'Low' : score > 50 ? 'Medium' : 'High',
          issues
        });
      }
    },
    {
      path: '/presets',
      method: 'post',
      handler: async (req, res, context) => {
        const { preset } = req.body; // 'relaxed' | 'balanced' | 'strict' | 'maximum'
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule) return res.status(404).json({ error: 'Security module not found' });

        const rules: Record<string, any> = {};
        const p = preset.toLowerCase();

        // Preset assignments
        const sensitivity = p === 'maximum' ? 1 : p === 'strict' ? 2 : p === 'balanced' ? 3 : 5;
        const action = (p === 'strict' || p === 'maximum') ? 'ban' : 'quarantine';

        const ruleNames = [
          'anti_ban', 'anti_kick', 'anti_timeout', 'anti_prune',
          'anti_channel_create', 'anti_channel_delete', 'anti_channel_update',
          'anti_role_create', 'anti_role_delete', 'anti_role_update',
          'anti_webhook_create', 'anti_webhook_delete', 'anti_guild_update',
          'anti_bot_add'
        ];

        for (const rName of ruleNames) {
          rules[rName] = {
            enabled: true,
            limit: sensitivity,
            window: 10,
            action: rName === 'anti_bot_add' ? 'ban' : action,
            recovery: true
          };
        }

        context.updateModuleConfig('security', { preset: p, rules });
        context.logSyncEvent(undefined, `Security Presets: Applied "${preset.toUpperCase()}" configurations profile globally.`, 'success');
        res.json({ success: true, preset: p, rules });
      }
    },
    {
      path: '/lockdown',
      method: 'post',
      handler: async (req, res, context) => {
        const { action } = req.body; // 'enable' | 'disable'
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule) return res.status(404).json({ error: 'Security module not found' });

        const nextState = action === 'enable';
        context.updateModuleConfig('security', { emergencyMode: nextState });

        const client = context.client;
        if (client && process.env.GUILD_ID) {
          const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
          if (guild) {
            // Log & Alert
            context.logSyncEvent(guild.id, `EMERGENCY CONTROL: Server Lockdown ${nextState ? 'ENABLED' : 'DISABLED'} by Administrator.`, nextState ? 'warn' : 'success');
          }
        }

        res.json({ success: true, emergencyMode: nextState });
      }
    },
    {
      path: '/whitelist',
      method: 'post',
      handler: async (req, res, context) => {
        const { whitelist } = req.body; // Array of whitelist items
        context.updateModuleConfig('security', { whitelist });
        res.json({ success: true, whitelist });
      }
    },
    {
      path: '/history',
      method: 'get',
      handler: async (req, res, context) => {
        // Return real SOC sync logs stored by logSyncEvent
        const guildId = (req as any).headers?.['x-guild-id'] || process.env.GUILD_ID;
        const syncLogs = context.getSyncLogs ? context.getSyncLogs(guildId) : [];
        // Map to the shape the frontend expects: { date, author, changes }
        const logs = syncLogs.map((l: any) => ({
          date: new Date().toISOString().split('T')[0] + 'T' + (l.time || '00:00:00'),
          author: l.type === 'warn' ? 'Anti-Nuke' : l.type === 'success' ? 'Recovery' : 'System',
          changes: l.msg
        }));
        res.json(logs);
      }
    }
  ]
};
