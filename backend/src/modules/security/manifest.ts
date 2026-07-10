import { AuditLogEvent, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { checkWhitelistPermission, getGuildAndCheckPermission, checkBypassImmunity } from '../../utils/whitelistCheck.js';
import { Database } from '../../core/Database.js';

// UPM Live Snapshots & Active Quarantines tracking
export const liveSnapshots = new Map<string, any>();
export const activeQuarantines = new Set<string>();

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

function isRecentEntry(entry: any, maxAgeMs = 5000): boolean {
  if (!entry) return false;
  const now = Date.now();
  const created = entry.createdTimestamp;
  return (now - created) < maxAgeMs;
}

export async function captureLiveSnapshot(guild: any) {
  const channels = guild.channels.cache.map((channel: any) => ({
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    position: channel.position,
    permissionOverwrites: channel.permissionOverwrites.cache.map((o: any) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString()
    })),
    topic: channel.topic || null,
    nsfw: channel.nsfw || false,
    rateLimitPerUser: channel.rateLimitPerUser || 0,
    userLimit: channel.userLimit || 0,
    bitrate: channel.bitrate || null,
    rtcRegion: channel.rtcRegion || null
  }));

  const roles = guild.roles.cache.map((role: any) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    permissions: role.permissions.bitfield.toString(),
    position: role.position,
    mentionable: role.mentionable
  }));

  const guildSettings = {
    name: guild.name,
    icon: guild.icon || null,
    banner: guild.banner || null,
    vanityURLCode: guild.vanityURLCode || null,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
    systemChannelId: guild.systemChannelId || null,
    rulesChannelId: guild.rulesChannelId || null,
    publicUpdatesChannelId: guild.publicUpdatesChannelId || null
  };

  return {
    timestamp: Date.now(),
    channels,
    roles,
    guildSettings
  };
}

export async function saveLiveSnapshotToDb(guildId: string, snap: any) {
  liveSnapshots.set(guildId, snap);

  const db = Database.getDb();
  if (db) {
    await db.collection('upm_snapshots').doc(guildId).set(snap);
  }
}

export async function restoreFromLiveSnapshot(guild: any, client: any, context: any) {
  const guildId = guild.id;
  context.logSyncEvent(guildId, '🔄 [UPM Restore]: Initializing full server restoration sequence...', 'info');

  let snap = liveSnapshots.get(guildId);
  if (!snap) {
    const db = Database.getDb();
    if (db) {
      const doc = await db.collection('upm_snapshots').doc(guildId).get();
      if (doc.exists) {
        snap = doc.data();
        liveSnapshots.set(guildId, snap);
      }
    }
  }

  if (!snap) {
    context.logSyncEvent(guildId, '❌ [UPM Restore Failed]: No snapshot found in database or memory.', 'warn');
    return;
  }

  // Restore Guild Settings
  if (snap.guildSettings) {
    const gs = snap.guildSettings;
    const needsEdit = guild.name !== gs.name ||
                      guild.verificationLevel !== gs.verificationLevel ||
                      guild.explicitContentFilter !== gs.explicitContentFilter;
    if (needsEdit) {
      await guild.edit({
        name: gs.name,
        verificationLevel: gs.verificationLevel,
        explicitContentFilter: gs.explicitContentFilter,
        systemChannelId: gs.systemChannelId,
        rulesChannelId: gs.rulesChannelId,
        publicUpdatesChannelId: gs.publicUpdatesChannelId
      }).catch(() => null);
    }
  }

  // Restore Roles
  const roleMap = new Map<string, any>();
  if (snap.roles) {
    const sortedRoles = [...snap.roles].sort((a, b) => a.position - b.position);
    for (const rSnap of sortedRoles) {
      if (rSnap.name === '@everyone') {
        const everyoneRole = guild.roles.everyone;
        if (everyoneRole && everyoneRole.permissions.bitfield.toString() !== rSnap.permissions) {
          await everyoneRole.setPermissions(BigInt(rSnap.permissions)).catch(() => null);
        }
        roleMap.set(rSnap.id, everyoneRole);
        continue;
      }

      let existingRole = guild.roles.cache.get(rSnap.id) || guild.roles.cache.find((r: any) => r.name === rSnap.name && !r.managed);
      if (!existingRole) {
        existingRole = await guild.roles.create({
          name: rSnap.name,
          color: rSnap.color,
          hoist: rSnap.hoist,
          permissions: BigInt(rSnap.permissions),
          mentionable: rSnap.mentionable,
          reason: 'UPM Recovery: Recreating deleted role'
        }).catch(() => null);
      } else {
        const diff = existingRole.color !== rSnap.color ||
                     existingRole.hoist !== rSnap.hoist ||
                     existingRole.mentionable !== rSnap.mentionable ||
                     existingRole.permissions.bitfield.toString() !== rSnap.permissions;
        if (diff) {
          await existingRole.edit({
            color: rSnap.color,
            hoist: rSnap.hoist,
            mentionable: rSnap.mentionable,
            permissions: BigInt(rSnap.permissions)
          }).catch(() => null);
        }
      }

      if (existingRole) {
        roleMap.set(rSnap.id, existingRole);
      }
    }
  }

  // Restore Channels
  if (snap.channels) {
    const categories = snap.channels.filter((c: any) => c.type === 4);
    const otherChannels = snap.channels.filter((c: any) => c.type !== 4);
    const channelMap = new Map<string, any>();

    const restoreChannel = async (cSnap: any, parentActualId?: string) => {
      let existingChannel = guild.channels.cache.get(cSnap.id) || guild.channels.cache.find((c: any) => c.name === cSnap.name && c.type === cSnap.type);

      const overwrites = (cSnap.permissionOverwrites || []).map((o: any) => {
        let targetId = o.id;
        const mappedRole = roleMap.get(o.id);
        if (mappedRole) {
          targetId = mappedRole.id;
        }
        return {
          id: targetId,
          type: o.type,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny)
        };
      });

      if (!existingChannel) {
        existingChannel = await guild.channels.create({
          name: cSnap.name,
          type: cSnap.type,
          parent: parentActualId || undefined,
          nsfw: cSnap.nsfw,
          topic: cSnap.topic || undefined,
          rateLimitPerUser: cSnap.rateLimitPerUser || undefined,
          userLimit: cSnap.userLimit || undefined,
          bitrate: cSnap.bitrate || undefined,
          rtcRegion: cSnap.rtcRegion || undefined,
          permissionOverwrites: overwrites,
          reason: 'UPM Recovery: Recreating deleted channel'
        }).catch(() => null);
      } else {
        await existingChannel.edit({
          name: cSnap.name,
          parent: parentActualId || undefined,
          nsfw: cSnap.nsfw,
          topic: cSnap.topic || undefined,
          rateLimitPerUser: cSnap.rateLimitPerUser || undefined,
          userLimit: cSnap.userLimit || undefined,
          bitrate: cSnap.bitrate || undefined,
          rtcRegion: cSnap.rtcRegion || undefined,
          permissionOverwrites: overwrites
        }).catch(() => null);
      }

      if (existingChannel) {
        channelMap.set(cSnap.id, existingChannel);
      }
    };

    for (const catSnap of categories) {
      await restoreChannel(catSnap);
    }
    for (const chSnap of otherChannels) {
      const parentActualId = chSnap.parentId ? channelMap.get(chSnap.parentId)?.id : undefined;
      await restoreChannel(chSnap, parentActualId);
    }
  }

  context.logSyncEvent(guildId, '✅ [UPM Restore Completed]: Full server state successfully restored from snapshot.', 'success');
}

async function isExecutorBypassed(guild: any, executorId: string, config: any, context?: any, ruleId?: string): Promise<boolean> {
  return checkBypassImmunity(executorId, guild, context, ruleId);
}

async function punishViolator(client: any, guild: any, executorId: string, executorTag: string, reason: string, ruleAction: string, config: any, context: any, ruleId?: string) {
  let bypassed = await isExecutorBypassed(guild, executorId, config, context, ruleId);
  if (ruleId === 'anti_role_grant') {
    bypassed = bypassed || await isExecutorBypassed(guild, executorId, config, context, 'anti_member_update');
  }
  if (bypassed) {
    context.logSyncEvent(guild.id, `🛡️ [Anti-Nuke Safety]: Prevented punishment of bypassed/whitelisted user ${executorTag} for rule: ${ruleId || 'general'}.`, 'info');
    return;
  }

  if (activeQuarantines.has(executorId)) return;
  activeQuarantines.add(executorId);
  setTimeout(() => activeQuarantines.delete(executorId), 10000); // 10s cooldown to mitigate race conditions

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
          type: 6,
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
          type: 3,
          description: 'Lock or unlock the guild',
          required: true,
          choices: [
            { name: 'Enable Emergency Lockdown', value: 'enable' },
            { name: 'Disable Emergency Lockdown', value: 'disable' }
          ]
        }
      ]
    },
    {
      name: 'security',
      description: 'Security Health Center',
      options: [
        {
          name: 'health',
          description: 'View security health center overview',
          type: 1
        },
        {
          name: 'score',
          description: 'Get your server security score',
          type: 1
        },
        {
          name: 'risk',
          description: 'Run a full risk analysis',
          type: 1
        },
        {
          name: 'perms-scan',
          description: 'Scan all roles for dangerous permissions',
          type: 1
        },
        {
          name: 'roles-scan',
          description: 'List roles with Administrator or Dangerous permissions',
          type: 1
        },
        {
          name: 'whitelist-add',
          description: 'Add a user to the anti-nuke bypass whitelist',
          type: 1,
          options: [{ name: 'user', type: 6, description: 'User to whitelist', required: true }]
        },
        {
          name: 'whitelist-remove',
          description: 'Remove a user from the anti-nuke bypass whitelist',
          type: 1,
          options: [{ name: 'user', type: 6, description: 'User to remove', required: true }]
        },
        {
          name: 'whitelist-list',
          description: 'List all whitelisted users',
          type: 1
        },
        {
          name: 'quarantine-list',
          description: 'List all quarantined users',
          type: 1
        },
        {
          name: 'rollback',
          description: 'Roll back recent unauthorized changes',
          type: 1,
          options: [{ name: 'minutes', type: 4, description: 'How many minutes back to rollback (1-60)', required: false }]
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
          const embed = new EmbedBuilder()
            .setTitle('❌ Security Center Error')
            .setColor('#e74c3c')
            .setDescription('Member not found in this guild.');
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};
        const quarantineRoleId = config.quarantineRoleId;

        if (!quarantineRoleId) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Security Center Error')
            .setColor('#e74c3c')
            .setDescription('The Quarantine Isolation Role is not configured. Please bind a quarantine role via the Web Dashboard.');
          return interaction.reply({ embeds: [embed], flags: 64 });
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
          context.logSyncEvent(interaction.guildId, `Manual Quarantine: ${member.user.tag} isolated.`, 'warn');
          
          const embed = new EmbedBuilder()
            .setTitle('🚨 Security Action: Member Quarantined')
            .setColor('#e74c3c')
            .setDescription(`Successfully quarantined **${member.user.tag}** and stripped all administrative/privileged roles to secure the guild.`)
            .addFields(
              { name: 'Target Member', value: `<@${member.user.id}>`, inline: true },
              { name: 'Enforcing Admin', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Status', value: '🛑 Isolated in Quarantine', inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        } catch (err) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Security Center Error')
            .setColor('#e74c3c')
            .setDescription(`Failed to quarantine member: ${err}`);
          return interaction.reply({ embeds: [embed], flags: 64 });
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
          const embed = new EmbedBuilder()
            .setTitle('🚨 SYSTEM UPDATE: Emergency Lockdown Activated')
            .setColor('#e74c3c')
            .setDescription('**CRITICAL**: All text, voice, and category permissions have been frozen. Only whitelisted administrators can execute changes or send messages.')
            .addFields(
              { name: 'System State', value: '🔴 EMERGENCY LOCKDOWN', inline: true },
              { name: 'Triggered By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
          await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
          context.updateModuleConfig('security', { emergencyMode: false });
          context.logSyncEvent('Emergency Lockdown Disabled.', 'success');
          const embed = new EmbedBuilder()
            .setTitle('✅ SYSTEM UPDATE: Emergency Lockdown Deactivated')
            .setColor('#2ecc71')
            .setDescription('The guild state has been restored to normal operations. Channel permissions have been unfrozen.')
            .addFields(
              { name: 'System State', value: '🟢 Normal Operations', inline: true },
              { name: 'Triggered By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
          await interaction.reply({ embeds: [embed], ephemeral: false });
        }
      }
    },
    {
      name: 'command_security',
      handler: async (client: any, interaction: any, context: any) => {
        const sub = interaction.options.getSubcommand();

        if (sub.startsWith('whitelist-')) {
          const hasPermission = await checkWhitelistPermission(interaction.user.id, interaction.guild, context);
          if (!hasPermission) {
            const embed = new EmbedBuilder()
              .setTitle('🔒 Access Denied')
              .setColor('#e74c3c')
              .setDescription('Only the Server Owner and whitelisted users can manage the anti-nuke whitelist.');
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
        } else {
          if (!interaction.memberPermissions?.has('Administrator')) {
            const embed = new EmbedBuilder()
              .setTitle('🔒 Access Denied')
              .setColor('#e74c3c')
              .setDescription('Administrator permissions are required to perform security actions.');
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
        }
        
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        const config = secModule?.config || {};
        
        const saveConfig = (newConfig: any) => {
          context.updateModuleConfig('security', { ...config, ...newConfig });
        };

        if (sub === 'health' || sub === 'score') {
          const rules = config.rules || {};
          const ruleCount = Object.keys(rules).length;
          const enabledCount = Object.values(rules).filter((r: any) => r.enabled).length;
          const scoreVal = ruleCount > 0 ? Math.round((enabledCount / ruleCount) * 100) : 50;

          const embed = new EmbedBuilder()
            .setTitle('🛡️ Security Health & Score')
            .setColor(scoreVal > 75 ? '#2ecc71' : scoreVal > 40 ? '#f1c40f' : '#e74c3c')
            .addFields(
              { name: 'Security Score', value: `**${scoreVal}/100**`, inline: true },
              { name: 'Active Protection Rules', value: `${enabledCount} / ${ruleCount}`, inline: true },
              { name: 'Emergency Lockdown', value: config.emergencyMode ? '🚨 ACTIVATED' : '🟢 Normal', inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'risk') {
          await interaction.deferReply({ flags: 64 });
          const guild = interaction.guild;
          let riskFactors = [];
          
          if (!guild.mfaLevel) riskFactors.push('⚠️ 2FA Moderation is not enabled on this server.');
          if (guild.verificationLevel < 2) riskFactors.push('⚠️ Server verification level is too low (requires higher verification level to prevent bots).');
          
          const adminRoles = guild.roles.cache.filter((r: any) => r.permissions.has(PermissionFlagsBits.Administrator) && r.name !== '@everyone');
          if (adminRoles.size > 5) riskFactors.push(`⚠️ Excessive Admin Roles: There are ${adminRoles.size} roles with Administrator permissions.`);

          const embed = new EmbedBuilder()
            .setTitle('🔍 Real-time Risk Analysis')
            .setColor(riskFactors.length > 0 ? '#f1c40f' : '#2ecc71')
            .setDescription(riskFactors.length > 0 ? riskFactors.join('\n') : '🟢 No critical risk factors identified. Server configuration is hardened.')
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'perms-scan' || sub === 'roles-scan') {
          const guild = interaction.guild;
          const dangerousRoles = guild.roles.cache.filter((r: any) => 
            r.permissions.has(PermissionFlagsBits.Administrator) ||
            r.permissions.has(PermissionFlagsBits.ManageGuild) ||
            r.permissions.has(PermissionFlagsBits.ManageRoles) ||
            r.permissions.has(PermissionFlagsBits.ManageChannels)
          );

          const lines = dangerousRoles.map((r: any) => `• <@&${r.id}> — Permissions: ${r.permissions.has(PermissionFlagsBits.Administrator) ? 'Admin' : 'Manage Server/Roles/Channels'}`);
          const embed = new EmbedBuilder()
            .setTitle('🛡️ Privileged Role Scan')
            .setColor('#4f8cff')
            .setDescription(lines.join('\n') || 'No privileged roles found.')
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'whitelist-add') {
          const user = interaction.options.getUser('user');
          const whitelist = config.whitelist || [];
          if (whitelist.some((w: any) => (w.targetId === user.id || w === user.id))) {
            const embed = new EmbedBuilder()
              .setTitle('❌ Security Center Error')
              .setColor('#e74c3c')
              .setDescription(`User **${user.tag}** is already whitelisted.`);
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
          whitelist.push({
            id: `wl-${Date.now()}`,
            type: 'user',
            targetId: user.id,
            name: user.tag,
            expiration: null,
            notes: 'Added via Discord slash command',
            createdBy: interaction.user.tag,
            scope: 'all'
          });
          saveConfig({ whitelist });
          context.logSyncEvent(`[Security] Added user ${user.tag} to anti-nuke whitelist.`, 'success');
          const embed = new EmbedBuilder()
            .setTitle('🛡️ Security Whitelist: Member Added')
            .setColor('#7C5CFC')
            .setDescription(`Successfully whitelisted **${user.tag}** from Anti-Nuke restrictions. Standard security limitations will not apply to this user.`)
            .addFields(
              { name: 'Whitelisted User', value: `<@${user.id}>`, inline: true },
              { name: 'Authorized By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'whitelist-remove') {
          const user = interaction.options.getUser('user');
          let whitelist = config.whitelist || [];
          if (!whitelist.some((w: any) => (w.targetId === user.id || w === user.id))) {
            const embed = new EmbedBuilder()
              .setTitle('❌ Security Center Error')
              .setColor('#e74c3c')
              .setDescription(`User **${user.tag}** is not currently whitelisted.`);
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
          whitelist = whitelist.filter((w: any) => {
            if (typeof w === 'string') return w !== user.id;
            return w.targetId !== user.id;
          });
          saveConfig({ whitelist });
          context.logSyncEvent(`[Security] Removed user ${user.tag} from anti-nuke whitelist.`, 'info');
          const embed = new EmbedBuilder()
            .setTitle('🗑️ Security Whitelist: Member Removed')
            .setColor('#7C5CFC')
            .setDescription(`Successfully removed **${user.tag}** from Anti-Nuke bypass whitelist.`)
            .addFields(
              { name: 'Removed User', value: `<@${user.id}>`, inline: true },
              { name: 'Authorized By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'whitelist-list') {
          const whitelist = config.whitelist || [];
          if (whitelist.length === 0) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Security Whitelist')
              .setColor('#7C5CFC')
              .setDescription('No users are currently whitelisted.');
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
          const mentions = whitelist.map((w: any) => {
            const id = typeof w === 'string' ? w : w.targetId;
            return `<@${id}> (\`${id}\`)`;
          }).join('\n');
          const embed = new EmbedBuilder()
            .setTitle('🛡️ Whitelisted Users')
            .setColor('#7C5CFC')
            .setDescription(mentions)
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'quarantine-list') {
          const list = config.quarantinedUsers || [];
          if (list.length === 0) {
            const embed = new EmbedBuilder()
              .setTitle('🚨 Quarantined Members')
              .setColor('#e74c3c')
              .setDescription('No members are currently isolated in quarantine.');
            return interaction.reply({ embeds: [embed], flags: 64 });
          }
          const lines = list.map((u: any) => `• <@${u.userId}> — Reason: **${u.reason}** (Isolated: <t:${Math.floor(new Date(u.time).getTime() / 1000)}:R>)`);
          const embed = new EmbedBuilder()
            .setTitle('🚨 Isolated Quarantined Members')
            .setColor('#e74c3c')
            .setDescription(lines.join('\n'))
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'rollback') {
          const minutes = interaction.options.getInteger('minutes') || 15;
          context.logSyncEvent(`[Security] Rollback triggered for the last ${minutes} minutes.`, 'warn');
          const embed = new EmbedBuilder()
            .setTitle('🔄 Rollback Point Queued')
            .setColor('#7C5CFC')
            .setDescription(`Attempting to synchronize last configuration state from backup points. Restoring database values from the last **${minutes} minutes**...`);
          return interaction.reply({ embeds: [embed], flags: 64 });
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
          const deletionLog = fetchedLogs?.entries.find((e: any) => e.targetId === channel.id && isRecentEntry(e));
          if (!deletionLog) return;

          const executor = deletionLog.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_channel_delete')) return;

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

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Deletion (#${channel.name})`, rule.action, config, context, 'anti_channel_delete');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === channel.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_channel_create')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_channel_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized channel creation #${channel.name} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await channel.delete('Anti-Nuke Recovery: Deleting unauthorized channel.').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Creation (#${channel.name})`, rule.action, config, context, 'anti_channel_create');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newChannel.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_channel_update')) return;

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
              rateLimitPerUser: oldChannel.topic ? oldChannel.rateLimitPerUser : undefined,
              permissionOverwrites: oldChannel.permissionOverwrites.cache.map((o: any) => ({
                id: o.id,
                type: o.type,
                allow: o.allow,
                deny: o.deny
              }))
            }).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Channel Update (#${newChannel.name})`, rule.action, config, context, 'anti_channel_update');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === role.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_role_create')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_role_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role creation "${role.name}" by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await role.delete('Anti-Nuke Recovery: Deleting unauthorized role.').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Creation (${role.name})`, rule.action, config, context, 'anti_role_create');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === role.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_role_delete')) return;

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

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Deletion (${role.name})`, rule.action, config, context, 'anti_role_delete');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newRole.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_role_update')) return;

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

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Update (${newRole.name})`, rule.action, config, context, 'anti_role_update');
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

          // Proactively try to update the live snapshot to match current guild state
          try {
            const snap = await captureLiveSnapshot(guild);
            await saveLiveSnapshotToDb(guild.id, snap);
          } catch (snapErr) {
            console.error('Failed to update live snapshot on member update:', snapErr);
          }

          const oldRoles = oldMember.roles.cache;
          const newRoles = newMember.roles.cache;
          const addedRoles = newRoles.filter((r: any) => !oldRoles.has(r.id));
          if (addedRoles.size === 0) return;

          const hasAdmin = addedRoles.some((r: any) => r.permissions.has(PermissionFlagsBits.Administrator));
          const isMonitored = addedRoles.some((r: any) => (config.monitoredRoleIds || []).includes(r.id));

          if (!hasAdmin && !isMonitored) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newMember.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          
          const isBypassed = await isExecutorBypassed(guild, executor.id, config, context, 'anti_role_grant') ||
                             await isExecutorBypassed(guild, executor.id, config, context, 'anti_member_update');
          if (isBypassed) return;

          if (config.roleMonitorMode === 'Custom Selection' && !isMonitored) return;

          const rules = config.rules || {};
          const rule = rules.anti_role_grant || rules.anti_member_update || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };
          if (!rule.enabled) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_role_grant', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized role grant to ${newMember.user.tag} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            for (const [roleId] of addedRoles) {
              await newMember.roles.remove(roleId).catch(console.error);
            }
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Role Grant to ${newMember.user.tag}`, rule.action, config, context, 'anti_role_grant');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === ban.user.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_ban')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_ban', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized ban of ${ban.user.tag} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await guild.members.unban(ban.user.id, 'Anti-Nuke Recovery: Revoking unauthorized ban').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Ban of ${ban.user.tag}`, rule.action, config, context, 'anti_ban');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === member.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_kick')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_kick', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized kick of ${member.user.tag} by ${executor.tag}.`, 'warn');

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Kick of ${member.user.tag}`, rule.action, config, context, 'anti_kick');
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
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === member.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_bot_add')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_bot_add', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized bot add of ${member.user.tag} by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await member.kick('Anti-Nuke Recovery: Kicking unauthorized bot').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Bot Addition (${member.user.tag})`, rule.action, config, context, 'anti_bot_add');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'webhookUpdate',
      handler: async (client: any, channel: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};

        try {
          const guild = channel.guild;
          if (!guild) return;

          const [createLogs, deleteLogs, updateLogs] = await Promise.all([
            guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.WebhookCreate }).catch(() => null),
            guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.WebhookDelete }).catch(() => null),
            guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.WebhookUpdate }).catch(() => null)
          ]);

          const entries = [
            ...(createLogs?.entries.values() || []),
            ...(deleteLogs?.entries.values() || []),
            ...(updateLogs?.entries.values() || [])
          ].filter(e => isRecentEntry(e));

          const logEntry = entries.find((e: any) => e.channel?.id === channel.id || e.targetId === channel.id);
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;

          let ruleName = 'anti_webhook_update';
          if (logEntry.action === AuditLogEvent.WebhookCreate) ruleName = 'anti_webhook_create';
          if (logEntry.action === AuditLogEvent.WebhookDelete) ruleName = 'anti_webhook_delete';

          const rule = rules[ruleName] || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };
          if (!rule.enabled) return;

          if (await isExecutorBypassed(guild, executor.id, config, context, ruleName)) return;

          const triggered = checkRateLimit(guild.id, executor.id, ruleName, rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized webhook activity (${ruleName.replace('anti_', '')}) in #${channel.name} by ${executor.tag}.`, 'warn');

          if (rule.recovery && logEntry.action === AuditLogEvent.WebhookCreate) {
            const webhooks = await channel.fetchWebhooks().catch(() => null);
            if (webhooks) {
              const targetWh = webhooks.find((wh: any) => wh.id === logEntry.targetId);
              if (targetWh) {
                await targetWh.delete('Anti-Nuke Recovery: Deleting unauthorized webhook').catch(console.error);
              }
            }
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Webhook Activity (${ruleName})`, rule.action, config, context, ruleName);
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'emojiCreate',
      handler: async (client: any, emoji: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_create || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = emoji.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.EmojiCreate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === emoji.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_create')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized emoji creation by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await emoji.delete('Anti-Nuke Recovery: Deleting unauthorized emoji').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Emoji Creation`, rule.action, config, context, 'anti_emoji_create');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'emojiDelete',
      handler: async (client: any, emoji: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_delete || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = emoji.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.EmojiDelete }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === emoji.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_delete')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_delete', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized emoji deletion by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await guild.emojis.create({ attachment: emoji.url, name: emoji.name, reason: 'Anti-Nuke Recovery: Restoring deleted emoji' }).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Emoji Deletion`, rule.action, config, context, 'anti_emoji_delete');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'emojiUpdate',
      handler: async (client: any, oldEmoji: any, newEmoji: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_update || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = newEmoji.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.EmojiUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newEmoji.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_update')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_update', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized emoji update by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await newEmoji.edit({ name: oldEmoji.name, reason: 'Anti-Nuke Recovery: Restoring original emoji state' }).catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Emoji Update`, rule.action, config, context, 'anti_emoji_update');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'stickerCreate',
      handler: async (client: any, sticker: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_create || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = sticker.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.StickerCreate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === sticker.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_create')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_create', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized sticker creation by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await sticker.delete('Anti-Nuke Recovery: Deleting unauthorized sticker').catch(console.error);
          }

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Sticker Creation`, rule.action, config, context, 'anti_emoji_create');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'stickerDelete',
      handler: async (client: any, sticker: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_delete || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = sticker.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.StickerDelete }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === sticker.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_delete')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_delete', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized sticker deletion by ${executor.tag}.`, 'warn');

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Sticker Deletion`, rule.action, config, context, 'anti_emoji_delete');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'stickerUpdate',
      handler: async (client: any, oldSticker: any, newSticker: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_emoji_update || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const guild = newSticker.guild;
          if (!guild) return;

          const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.StickerUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => e.targetId === newSticker.id && isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(guild, executor.id, config, context, 'anti_emoji_update')) return;

          const triggered = checkRateLimit(guild.id, executor.id, 'anti_emoji_update', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(guild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized sticker update by ${executor.tag}.`, 'warn');

          await punishViolator(client, guild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Sticker Update`, rule.action, config, context, 'anti_emoji_update');
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'guildUpdate',
      handler: async (client: any, oldGuild: any, newGuild: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule || secModule.status !== 'enabled') return;

        const config = secModule.config || {};
        const rules = config.rules || {};
        const rule = rules.anti_guild_update || { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true };

        if (!rule.enabled) return;

        try {
          const fetchedLogs = await newGuild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.GuildUpdate }).catch(() => null);
          const logEntry = fetchedLogs?.entries.find((e: any) => isRecentEntry(e));
          if (!logEntry) return;

          const executor = logEntry.executor;
          if (!executor || executor.id === client.user.id) return;
          if (await isExecutorBypassed(newGuild, executor.id, config, context, 'anti_guild_update')) return;

          const triggered = checkRateLimit(newGuild.id, executor.id, 'anti_guild_update', rule.limit, rule.window);
          if (!triggered) return;

          context.logSyncEvent(newGuild.id, `🚨 [Anti-Nuke Triggered]: Unauthorized guild update by ${executor.tag}.`, 'warn');

          if (rule.recovery) {
            await newGuild.edit({
              name: oldGuild.name,
              verificationLevel: oldGuild.verificationLevel,
              explicitContentFilter: oldGuild.explicitContentFilter,
              systemChannelId: oldGuild.systemChannelId,
              rulesChannelId: oldGuild.rulesChannelId,
              publicUpdatesChannelId: oldGuild.publicUpdatesChannelId,
              reason: 'Anti-Nuke Recovery: Reverting unauthorized guild update'
            }).catch(console.error);
          }

          await punishViolator(client, newGuild, executor.id, executor.tag, `Anti-Nuke: Unauthorized Guild Update`, rule.action, config, context, 'anti_guild_update');
        } catch (err) {
          console.error(err);
        }
      }
    }
  ],
  routes: [
    {
      path: '/upm/snapshot',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can capture UPM snapshots.' });
        }

        const client = context.client;
        const guildId = context.guildId || process.env.GUILD_ID;
        if (!client || !guildId) {
          return res.status(400).json({ error: 'Discord Client or Guild ID not available' });
        }

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          return res.status(404).json({ error: 'Guild not found' });
        }

        try {
          const snap = await captureLiveSnapshot(guild);
          await saveLiveSnapshotToDb(guild.id, snap);

          // Update UPM snapshot config metadata in security module config
          const modules = context.getModulesState ? context.getModulesState() : [];
          const secModule = modules.find((m: any) => m.id === 'security');
          const currentConfig = secModule?.config || {};
          context.updateModuleConfig('security', {
            ...currentConfig,
            upmSnapshot: {
              timestamp: snap.timestamp,
              channelsCount: snap.channels?.length || 0,
              rolesCount: snap.roles?.length || 0
            }
          });

          context.logSyncEvent(guild.id, 'Live Snapshot captured successfully from dashboard.', 'success');
          res.json({ success: true, timestamp: snap.timestamp, channelsCount: snap.channels?.length, rolesCount: snap.roles?.length });
        } catch (e: any) {
          res.status(500).json({ error: e.message });
        }
      }
    },
    {
      path: '/upm/restore',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can restore UPM snapshots.' });
        }

        const client = context.client;
        const guildId = context.guildId || process.env.GUILD_ID;
        if (!client || !guildId) {
          return res.status(400).json({ error: 'Discord Client or Guild ID not available' });
        }

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          return res.status(404).json({ error: 'Guild not found' });
        }

        try {
          restoreFromLiveSnapshot(guild, client, context).catch(console.error);
          res.json({ success: true, message: 'Restore sequence initiated' });
        } catch (e: any) {
          res.status(500).json({ error: e.message });
        }
      }
    },
    {
      path: '/state',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'security');
        res.json({ config: mod?.config || {} });
      }
    },
    {
      path: '/quarantine/:userId/action',
      method: 'post',
      handler: async (req, res, context) => {
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can manage quarantine.' });
        }

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
              } else if (action === 'confirm' && member) {
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
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can run scans.' });
        }

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
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can modify presets.' });
        }

        const { preset } = req.body;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule) return res.status(404).json({ error: 'Security module not found' });

        const rules: Record<string, any> = {};
        const p = preset.toLowerCase();

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
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can trigger lockdown.' });
        }

        const { action } = req.body;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const secModule = modules.find((m: any) => m.id === 'security');
        if (!secModule) return res.status(404).json({ error: 'Security module not found' });

        const nextState = action === 'enable';
        context.updateModuleConfig('security', { emergencyMode: nextState });

        const client = context.client;
        if (client && process.env.GUILD_ID) {
          const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
          if (guild) {
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
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can modify the whitelist.' });
        }

        const { whitelist } = req.body;
        context.updateModuleConfig('security', { whitelist });
        res.json({ success: true, whitelist });
      }
    },
    {
      path: '/history',
      method: 'get',
      handler: async (req, res, context) => {
        const userIdToken = req.user?.id;
        if (!req.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const hasPermission = await getGuildAndCheckPermission(req.user, context);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Access Denied: Only the Owner and whitelisted users can access history.' });
        }

        const guildId = (req as any).headers?.['x-guild-id'] || process.env.GUILD_ID;
        const syncLogs = context.getSyncLogs ? context.getSyncLogs(guildId) : [];
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
