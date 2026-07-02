import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

const WARNINGS_FILE = path.join(process.cwd(), 'src', 'warnings.json');

function loadWarnings(): Record<string, any[]> {
  try {
    if (fs.existsSync(WARNINGS_FILE)) return JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf-8'));
  } catch {}
  return {};
}

function saveWarnings(data: Record<string, any[]>) {
  try { fs.writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export const ModerationManifest: ModuleManifest = {
  id: 'moderation',
  name: 'Moderation Console',
  version: '1.0.0',
  description: 'Warnings, timeouts, temporary bans, and automated chat offense tracking.',
  configSchema: {
    requiredFields: ['logChannelId', 'modRoleIds', 'warnsToTimeout', 'warnsToBan'],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;

      const roleExists = (id: string) => registry.roles.some(r => r.id === id);
      const channelExists = (id: string) => registry.channels.some(c => c.id === id);

      if (config.logChannelId) {
        progress += 40;
        if (!channelExists(config.logChannelId)) errors.push(`Mod logs channel ID (${config.logChannelId}) was deleted!`);
      }
      if (config.modRoleIds && config.modRoleIds.length > 0) {
        progress += 30;
        config.modRoleIds.forEach((id: string) => {
          if (!roleExists(id)) errors.push(`Moderator role ID (${id}) was deleted!`);
        });
      }
      if (config.warnsToTimeout) progress += 15;
      if (config.warnsToBan) progress += 15;

      return { progress, errors };
    }
  },
  commands: [
    { name: 'status', description: 'Check configuration completeness and module health status.' },
    { name: 'ban', description: 'Ban a user from the server', options: [{ name: 'user', type: 6, description: 'User to ban', required: true }, { name: 'reason', type: 3, description: 'Reason for ban', required: false }] },
    { name: 'kick', description: 'Kick a user from the server', options: [{ name: 'user', type: 6, description: 'User to kick', required: true }, { name: 'reason', type: 3, description: 'Reason for kick', required: false }] },
    { name: 'mute', description: 'Mute a user', options: [{ name: 'user', type: 6, description: 'User to mute', required: true }, { name: 'duration', type: 3, description: 'Duration', required: false }] },
    { name: 'unmute', description: 'Unmute a user', options: [{ name: 'user', type: 6, description: 'User to unmute', required: true }] },
    { name: 'warn', description: 'Warn a user', options: [{ name: 'user', type: 6, description: 'User to warn', required: true }, { name: 'reason', type: 3, description: 'Reason for warning', required: true }] },
    { name: 'warnings', description: 'Check a user\'s warnings', options: [{ name: 'user', type: 6, description: 'User to check', required: true }] },
    { name: 'clearwarnings', description: 'Clear a user\'s warnings', options: [{ name: 'user', type: 6, description: 'User to clear', required: true }] },
    { name: 'purge', description: 'Delete multiple messages', options: [{ name: 'amount', type: 4, description: 'Number of messages to delete', required: true }] },
    { name: 'lock', description: 'Lock the current channel' },
    { name: 'unlock', description: 'Unlock the current channel' },
    { name: 'slowmode', description: 'Set channel slowmode', options: [{ name: 'seconds', type: 4, description: 'Slowmode duration in seconds', required: true }] },
    { name: 'timeout', description: 'Timeout a user', options: [{ name: 'user', type: 6, description: 'User to timeout', required: true }, { name: 'duration', type: 3, description: 'Duration (e.g. 10m, 1h)', required: true }] },
    { name: 'untimeout', description: 'Remove timeout from a user', options: [{ name: 'user', type: 6, description: 'User to remove timeout', required: true }] }
  ],
  events: [
    {
      name: 'command_status',
      handler: async (client: any, interaction: any, context: any) => {
        const db = context.logSyncEvent ? await fetchStatusFromContext(context) : null;
        const lines = db ? db.modules.map((m: any) => {
          const statusIcon = m.status === 'enabled' ? '🟢 Active' : m.status === 'ready' ? '🔵 Ready' : '🔴 Unconfigured';
          return `**${m.name}**: ${statusIcon} (${m.progress}%)`;
        }).join('\n') : 'Status matrix currently unavailable.';

        await interaction.reply({
          content: `### 🛡️ CLUTCH NATION Module Health Matrix\n${lines}`,
          ephemeral: true
        });
      }
    },
    {
      name: 'command_ban',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
          await interaction.guild.members.ban(user, { reason });
          await interaction.reply({ content: `✅ **Banned** ${user.tag} for: ${reason}` });
          logModAction(interaction.guild, user, interaction.user, 'Ban', reason, context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to ban user. Check hierarchy.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_kick',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        try {
          await member.kick(reason);
          await interaction.reply({ content: `✅ **Kicked** ${member.user.tag} for: ${reason}` });
          logModAction(interaction.guild, member.user, interaction.user, 'Kick', reason, context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to kick user. Check hierarchy.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_timeout',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const member = interaction.options.getMember('user');
        const durationStr = interaction.options.getString('duration');
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        
        let ms = 60000;
        if (durationStr.endsWith('m')) ms = parseInt(durationStr) * 60000;
        else if (durationStr.endsWith('h')) ms = parseInt(durationStr) * 3600000;
        else if (durationStr.endsWith('d')) ms = parseInt(durationStr) * 86400000;
        else ms = parseInt(durationStr) * 60000; // default to minutes

        try {
          await member.timeout(ms, 'Moderator Timeout');
          await interaction.reply({ content: `✅ **Timed out** ${member.user.tag} for ${durationStr}.` });
          logModAction(interaction.guild, member.user, interaction.user, 'Timeout', durationStr, context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to timeout user.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_untimeout',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        try {
          await member.timeout(null, 'Timeout removed by Moderator');
          await interaction.reply({ content: `✅ **Removed timeout** for ${member.user.tag}.` });
          logModAction(interaction.guild, member.user, interaction.user, 'Untimeout', 'N/A', context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to remove timeout.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_mute',
      handler: async (client: any, interaction: any, context: any) => {
        // Simple alias for timeout for modern discord servers
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        try {
          await member.timeout(60 * 60 * 1000, 'Moderator Mute'); // 1 hr default
          await interaction.reply({ content: `✅ **Muted** ${member.user.tag} for 1 hour.` });
          logModAction(interaction.guild, member.user, interaction.user, 'Mute', '1h', context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to mute user.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_unmute',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        try {
          await member.timeout(null, 'Unmuted by Moderator');
          await interaction.reply({ content: `✅ **Unmuted** ${member.user.tag}.` });
          logModAction(interaction.guild, member.user, interaction.user, 'Unmute', 'N/A', context);
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to unmute user.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_warn',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        const warnsData = loadWarnings();
        if (!warnsData[user.id]) warnsData[user.id] = [];
        warnsData[user.id].push({ reason, date: new Date().toISOString(), by: interaction.user.id });
        saveWarnings(warnsData);

        await interaction.reply({ content: `⚠️ **Warned** ${user.tag} for: ${reason}` });
        logModAction(interaction.guild, user, interaction.user, 'Warn', reason, context);
      }
    },
    {
      name: 'command_warnings',
      handler: async (client: any, interaction: any, context: any) => {
        const user = interaction.options.getUser('user');
        const warnsData = loadWarnings();
        const userWarns = warnsData[user.id] || [];
        
        if (userWarns.length === 0) {
          return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
        }
        
        const lines = userWarns.map((w, i) => `**${i+1}.** ${w.reason} (by <@${w.by}>) - <t:${Math.floor(new Date(w.date).getTime()/1000)}:d>`);
        await interaction.reply({ content: `⚠️ **Warnings for ${user.tag}**:\n${lines.join('\n')}`, ephemeral: true });
      }
    },
    {
      name: 'command_clearwarnings',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const warnsData = loadWarnings();
        delete warnsData[user.id];
        saveWarnings(warnsData);
        await interaction.reply({ content: `✅ Cleared all warnings for ${user.tag}.` });
        logModAction(interaction.guild, user, interaction.user, 'Clear Warnings', 'N/A', context);
      }
    },
    {
      name: 'command_purge',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ Amount must be between 1 and 100.', ephemeral: true });
        try {
          await interaction.channel.bulkDelete(amount, true);
          await interaction.reply({ content: `🗑️ Deleted ${amount} messages.`, ephemeral: true });
          context.logSyncEvent(`Moderation: ${interaction.user.tag} purged ${amount} messages in #${interaction.channel.name}.`, 'info');
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to delete messages.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_lock',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
          await interaction.reply({ content: '🔒 Channel locked.' });
          context.logSyncEvent(`Moderation: ${interaction.user.tag} locked #${interaction.channel.name}.`, 'warn');
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to lock channel.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_unlock',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
          await interaction.reply({ content: '🔓 Channel unlocked.' });
          context.logSyncEvent(`Moderation: ${interaction.user.tag} unlocked #${interaction.channel.name}.`, 'success');
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to unlock channel.', ephemeral: true });
        }
      }
    },
    {
      name: 'command_slowmode',
      handler: async (client: any, interaction: any, context: any) => {
        if (!hasModAccess(interaction, context)) return interaction.reply({ content: '🔒 Access Denied.', ephemeral: true });
        const seconds = interaction.options.getInteger('seconds');
        try {
          await interaction.channel.setRateLimitPerUser(seconds);
          await interaction.reply({ content: `⏱️ Slowmode set to ${seconds} seconds.` });
        } catch (e) {
          await interaction.reply({ content: '❌ Failed to set slowmode.', ephemeral: true });
        }
      }
    }
  ]
};

async function fetchStatusFromContext(context: any) {
  try {
    const modules = context.registry.getModulesState();
    return { modules };
  } catch {
    return null;
  }
}

function hasModAccess(interaction: any, context: any): boolean {
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  if (interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  
  const modules = context.getModulesState ? context.getModulesState() : [];
  const modModule = modules.find((m: any) => m.id === 'moderation');
  if (modModule && modModule.config && modModule.config.modRoleIds) {
    const roleIds = modModule.config.modRoleIds;
    return interaction.member.roles.cache.some((role: any) => roleIds.includes(role.id));
  }
  return false;
}

function logModAction(guild: any, target: any, moderator: any, action: string, reason: string, context: any) {
  context.logSyncEvent(`Moderation: ${moderator.tag} executed **${action}** on ${target.tag}. Reason: ${reason}`, 'warn');
  
  const modules = context.getModulesState ? context.getModulesState() : [];
  const modModule = modules.find((m: any) => m.id === 'moderation');
  if (modModule && modModule.config && modModule.config.logChannelId) {
    const channelId = modModule.config.logChannelId;
    const channel = guild.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Moderation: ${action}`)
        .setColor('#ff4444')
        .addFields(
          { name: 'Target', value: `${target} (${target.id})`, inline: true },
          { name: 'Moderator', value: `${moderator} (${moderator.id})`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}
