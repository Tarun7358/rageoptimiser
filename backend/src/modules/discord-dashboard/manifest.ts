import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
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
function generateDashboardEmbed(guild: any, page: string, client: any, context: any) {
  const stats = getServerStats(guild);
  
  const embed = new EmbedBuilder()
    .setColor('#4f8cff')
    .setAuthor({ name: `${guild.name} | Server Dashboard`, iconURL: guild.iconURL() || undefined })
    .setFooter({ text: `Last Updated • ${new Date().toLocaleTimeString()} | Bot Latency: ${client.ws.ping}ms` })
    .setTimestamp();

  switch (page) {
    case 'home':
      embed.setTitle('🏠 **System Overview**')
        .setDescription('> Welcome to the **Rage Optimiser Control Panel**. Use the interactive console below to navigate through live server telemetry and configurations.')
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
      const voiceCount = guild.members.cache.filter((m: any) => m.voice?.channelId).size;
      embed.setTitle('🎙️ **Voice Comms**')
        .setDescription('> Live monitoring of audio channels and active speakers.')
        .addFields(
          { name: '🔊 Current Connections', value: `\`\`\`yaml\nStatus: ${voiceCount} active users\n\`\`\`` }
        );
      break;
    case 'tickets':
      const modules = context?.getModulesState ? context.getModulesState() : [];
      const ticketsModule = modules.find((m: any) => m.id === 'tickets');
      const catId = ticketsModule?.config?.categoryId;
      const activeTickets = catId ? guild.channels.cache.filter((c: any) => c.parentId === catId && c.name.startsWith('ticket-')).size : 0;
      
      embed.setTitle('🎫 **Support Desk**')
        .setDescription('> Overview of active inquiries and staff response metrics.')
        .addFields(
          { name: '📬 Open Tickets', value: `**${activeTickets}** Active`, inline: true },
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

function generateDashboardComponents(config: any = {}, activePage: string = 'home') {
  const enabledPages = config.enabledPages || {
    home: true,
    members: true,
    messages: true,
    voice: true,
    tickets: true,
    events: true,
    stats: true,
    more: true
  };

  const allButtons = [
    { id: 'dbn_home', label: 'Home', emoji: '🏠', page: 'home' },
    { id: 'dbn_members', label: 'Members', emoji: '👥', page: 'members' },
    { id: 'dbn_messages', label: 'Messages', emoji: '💬', page: 'messages' },
    { id: 'dbn_voice', label: 'Voice', emoji: '🎙️', page: 'voice' },
    { id: 'dbn_tickets', label: 'Tickets', emoji: '🎫', page: 'tickets' },
    { id: 'dbn_events', label: 'Events', emoji: '🎉', page: 'events' },
    { id: 'dbn_stats', label: 'Statistics', emoji: '📊', page: 'stats' },
    { id: 'dbn_more', label: 'More', emoji: '⚙️', page: 'more' }
  ];

  // Filter only enabled pages
  const enabledButtons = allButtons.filter(b => enabledPages[b.page] !== false);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const b of enabledButtons) {
    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    const style = b.page === activePage ? ButtonStyle.Primary : ButtonStyle.Secondary;
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(b.id)
        .setLabel(b.label)
        .setEmoji(b.emoji)
        .setStyle(style)
    );
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  // Utility row (always enabled)
  const utilityRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dbn_refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dbn_config').setLabel('Configure').setEmoji('🛠️').setStyle(ButtonStyle.Secondary)
  );
  rows.push(utilityRow);

  return rows;
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
          const guildId = context.guildId || process.env.GUILD_ID;
          if (!guildId) return;
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return;

          const channel = guild.channels.cache.get(config.channelId) as TextChannel;
          if (!channel) return;

          const message = await channel.messages.fetch(config.messageId).catch(() => null);
          if (!message) return;

          const embed = generateDashboardEmbed(guild, 'home', client, context);
          const components = generateDashboardComponents(config, 'home');
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
          return interaction.reply({ content: '❌ Discord Dashboard module is not enabled.', flags: 64 });
        }

        try {
          const embed = generateDashboardEmbed(interaction.guild, 'home', client, context);
          const components = generateDashboardComponents(dashModule.config || {}, 'home');

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
          await interaction.reply({ content: '❌ Failed to setup dashboard.', flags: 64 });
        }
      }
    },
    ...['home', 'members', 'messages', 'voice', 'tickets', 'events', 'stats', 'more'].map(page => ({
      name: `button_dbn_${page}`,
      handler: async (client: any, interaction: any, context: any) => {
        try {
          const modules = context.getModulesState ? context.getModulesState() : [];
          const dashModule = modules.find((m: any) => m.id === 'discord-dashboard');
          const config = dashModule?.config || {};

          const embed = generateDashboardEmbed(interaction.guild, page, client, context);
          const components = generateDashboardComponents(config, page);
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
          const modules = context.getModulesState ? context.getModulesState() : [];
          const dashModule = modules.find((m: any) => m.id === 'discord-dashboard');
          const config = dashModule?.config || {};

          const embed = generateDashboardEmbed(interaction.guild, 'home', client, context);
          const components = generateDashboardComponents(config, 'home');
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
          return interaction.reply({ content: '❌ Only Administrators can access this config.', flags: 64 });
        }
        const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:4680';
        await interaction.reply({ 
          content: `🛠️ **Dashboard Configuration**\nManage appearance, intervals, and pages directly from the Web Dashboard at: \`${dashboardUrl}/dashboard\``, 
          flags: 64 
        });
      }
    }
  ]
};
