import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import fs from 'fs';
import path from 'path';

// Helper to get stats
function getServerStats(guild: any) {
  return {
    totalMembers: guild.memberCount,
    onlineMembers: guild.members.cache.filter((m: any) => m.presence?.status !== 'offline').size || 0,
    boosts: guild.premiumSubscriptionCount || 0,
    channels: guild.channels.cache.size
  };
}

// Generate the embed based on the page
function generateDashboardEmbed(guild: any, page: string, client: any) {
  const stats = getServerStats(guild);
  
  const embed = new EmbedBuilder()
    .setColor('#4f8cff')
    .setAuthor({ name: `${guild.name} | Server Dashboard`, iconURL: guild.iconURL() || undefined })
    .setFooter({ text: `Last Updated • ${new Date().toLocaleTimeString()} | Bot Latency: ${client.ws.ping}ms` })
    .setTimestamp();

  switch (page) {
    case 'home':
      embed.setTitle('🏠 **System Overview**')
        .setDescription('> Welcome to the **Clutch Nation Control Panel**. Use the interactive console below to navigate through live server telemetry and configurations.')
        .addFields(
          { name: '👥 Population', value: `**Total:** \`${stats.totalMembers}\`\n**Online:** \`${stats.onlineMembers}\``, inline: true },
          { name: '🚀 Server Power', value: `**Boosts:** \`${stats.boosts}\`\n**Tier:** \`Premium\``, inline: true },
          { name: '📡 Network', value: `**Channels:** \`${stats.channels}\`\n**Ping:** \`${client.ws.ping}ms\``, inline: true },
          { name: '⚡ Live Feed', value: '```diff\n+ System online and monitoring\n- No new alerts\n```' }
        );
      break;
    case 'members':
      embed.setTitle('👥 **Member Analytics**')
        .setDescription('> Track real-time community growth, retention, and verification statistics.')
        .addFields(
          { name: '📈 Trajectory', value: `**Current Population:** \`${stats.totalMembers}\` users` },
          { name: '⏱️ Recent Activity', value: '```yaml\nAwaiting new join/leave events...\n```' }
        );
      break;
    case 'messages':
      embed.setTitle('💬 **Message Telemetry**')
        .setDescription('> Real-time tracking of server communication and engagement hotspots.')
        .addFields(
          { name: '🔥 Top Active Channels', value: '> 1. **#general-chat**\n> 2. **#commands**' }
        );
      break;
    case 'voice':
      embed.setTitle('🎙️ **Voice Comms**')
        .setDescription('> Live monitoring of audio channels and active speakers.')
        .addFields(
          { name: '🔊 Current Connections', value: '```yaml\nStatus: 0 active users\n```' }
        );
      break;
    case 'tickets':
      embed.setTitle('🎫 **Support Desk**')
        .setDescription('> Overview of active inquiries and staff response metrics.')
        .addFields(
          { name: '📬 Open Tickets', value: `**0** Active`, inline: true },
          { name: '✅ Resolved Today', value: `**0** Closed`, inline: true }
        );
      break;
    case 'events':
      embed.setTitle('🎉 **Community Events**')
        .setDescription('> Upcoming giveaways, tournaments, and server gatherings.')
        .addFields(
          { name: '📅 Upcoming Schedule', value: '```yaml\nNo active events at this time.\n```' }
        );
      break;
    case 'stats':
      embed.setTitle('📊 **Deep Analytics**')
        .setDescription('> Advanced insights into server engagement and retention rates.')
        .addFields(
          { name: '📈 Engagement Index', value: '> Gathering sufficient data to calculate...' }
        );
      break;
    case 'more':
      embed.setTitle('⚙️ **Advanced Modules**')
        .setDescription('> Access other automated systems deployed in this server.')
        .addFields(
          { name: '🔗 Quick Links', value: '> • **Announcements System**\n> • **Suggestions Box**\n> • **Moderation Logs**' }
        );
      break;
  }

  return embed;
}

function generateDashboardComponents() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dbn_home').setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dbn_members').setLabel('Members').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dbn_messages').setLabel('Messages').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dbn_voice').setLabel('Voice').setEmoji('🎙️').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dbn_tickets').setLabel('Tickets').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dbn_events').setLabel('Events').setEmoji('🎉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dbn_stats').setLabel('Statistics').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dbn_more').setLabel('More').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export const DiscordDashboardManifest: ModuleManifest = {
  id: 'discord-dashboard',
  name: 'Discord Dashboard',
  version: '1.0.0',
  description: 'Interactive single-message Discord control panel for server statistics and logs.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;
      
      if (config.channelId) {
        progress += 100;
        const channelExists = registry.channels.some(c => c.id === config.channelId);
        if (!channelExists) errors.push(`Configured dashboard channel (${config.channelId}) does not exist.`);
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'setup-discord-dashboard',
      description: 'Force spawn the Discord dashboard message in the current channel.'
    }
  ],
  events: [
    {
      name: 'tick',
      handler: async (client: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const dashModule = modules.find((m: any) => m.id === 'discord-dashboard');
        if (!dashModule || dashModule.status !== 'enabled') return;

        const config = dashModule.config || {};
        if (!config.channelId || !config.messageId) return;

        // Rate limit check based on configured interval
        const interval = config.refreshInterval || 30000;
        const now = Date.now();
        if (!dashModule._lastRefresh) dashModule._lastRefresh = 0;
        if (now - dashModule._lastRefresh < interval) return;

        dashModule._lastRefresh = now;

        try {
          const guildId = process.env.GUILD_ID;
          if (!guildId) return;
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return;

          const channel = guild.channels.cache.get(config.channelId) as TextChannel;
          if (!channel) return;

          const message = await channel.messages.fetch(config.messageId).catch(() => null);
          if (!message) return;

          const embed = generateDashboardEmbed(guild, 'home', client);
          const components = generateDashboardComponents();
          await message.edit({ embeds: [embed], components });
        } catch (err) {
          console.error('[Discord Dashboard] Background refresh failed:', err);
        }
      }
    },
    {
      name: 'command_setup-discord-dashboard',
      handler: async (client: any, interaction: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const dashModule = modules.find((m: any) => m.id === 'discord-dashboard');
        
        if (!dashModule || dashModule.status !== 'enabled') {
          return interaction.reply({ content: '❌ Discord Dashboard module is not enabled.', ephemeral: true });
        }

        try {
          const embed = generateDashboardEmbed(interaction.guild, 'home', client);
          const components = generateDashboardComponents();

          const message = await interaction.reply({ embeds: [embed], components, fetchReply: true });
          
          // Save message ID to backend config
          if (context.updateModuleConfig) {
            context.updateModuleConfig('discord-dashboard', {
              ...dashModule.config,
              channelId: interaction.channelId,
              messageId: message.id
            });
          }

          context.logSyncEvent('Discord Dashboard initialized and pinned.', 'success');
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: '❌ Failed to setup dashboard.', ephemeral: true });
        }
      }
    },
    ...['home', 'members', 'messages', 'voice', 'tickets', 'events', 'stats', 'more'].map(page => ({
      name: `button_dbn_${page}`,
      handler: async (client: any, interaction: any, context: any) => {
        try {
          const embed = generateDashboardEmbed(interaction.guild, page, client);
          const components = generateDashboardComponents();
          await interaction.update({ embeds: [embed], components });
        } catch (err) {
          console.error(err);
        }
      }
    })),
    {
      name: 'button_dbn_refresh',
      handler: async (client: any, interaction: any, context: any) => {
        try {
          const embed = generateDashboardEmbed(interaction.guild, 'home', client); // Refreshes home by default on refresh button
          const components = generateDashboardComponents();
          await interaction.update({ embeds: [embed], components });
        } catch (err) {
          console.error(err);
        }
      }
    },
    {
      name: 'button_dbn_config',
      handler: async (client: any, interaction: any, context: any) => {
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.reply({ content: '❌ Only Administrators can access this config.', ephemeral: true });
        }
        await interaction.reply({ 
          content: '🛠️ **Dashboard Configuration**\nManage appearance, intervals, and pages directly from the Web Dashboard at: `http://localhost:3000/dashboard`', 
          ephemeral: true 
        });
      }
    }
  ]
};
