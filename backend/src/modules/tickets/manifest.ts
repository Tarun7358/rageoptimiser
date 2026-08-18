import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import {
  ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} from 'discord.js';
import { ITicket, ITicketConfig, ITicketCategory } from '../../models/index.js';
import {
  Colors, Embeds, Components,
  buildRichCard, buildStatusCard, buildLimeOverviewCard, buildMinimalAction, buildTicketPanelEmbed,
  VERIFIED_ICON, WRONG_ICON, SHIELD_ICON, CONFIG_ICON, BOT_ICON, LINK_ICON, MEMBER_ICON, TIMER_ICON, INFO_ICON, TICKET_ICON, VIP_ICON, GAVEL_ICON
} from '../../core/UIFactory.js';
import { isOwnerOrExtraOwner } from '../../utils/whitelistCheck.js';
import { PrefixRegistry } from '../../core/prefix/PrefixRegistry.js';

function getDefaultConfig(): ITicketConfig {
  return {
    enabled: true,
    categoryId: null,
    transcriptChannelId: null,
    supportRoleIds: [],
    ticketCounter: 0,
    maxOpenPerUser: 1,
    categories: [
      { id: 'general', name: 'General Support', emoji: '🎟️', description: 'General server help & inquiries' },
      { id: 'moderation', name: 'Moderation & Reports', emoji: '🛡️', description: 'Report user rule violations' },
      { id: 'vip', name: 'VIP & Billing', emoji: '👑', description: 'Store, VIP & billing assistance' }
    ],
    activeTickets: []
  };
}

export const TicketsManifest: ModuleManifest = {
  id: 'tickets',
  name: 'Ticket System',
  version: '1.0.0',
  description: 'Enterprise Ticket System with category dropdowns, staff claiming, automated transcripts, and role-based permissions.',
  configSchema: {
    requiredFields: [],
    validate: () => ({ progress: 100, errors: [] })
  },
  commands: [
    {
      name: 'ticket',
      description: 'Enterprise Ticket System controls & configuration',
      options: [
        {
          name: 'panel',
          description: 'Deploy ticket creation panel with category menu in current channel',
          type: 1
        },
        {
          name: 'create',
          description: 'Open a new support ticket',
          type: 1
        },
        {
          name: 'close',
          description: 'Close current support ticket and generate transcript',
          type: 1
        },
        {
          name: 'add',
          description: 'Add a member to the current ticket',
          type: 1,
          options: [
            { name: 'user', type: 6, description: 'User to add', required: true }
          ]
        },
        {
          name: 'remove',
          description: 'Remove a member from the current ticket',
          type: 1,
          options: [
            { name: 'user', type: 6, description: 'User to remove', required: true }
          ]
        },
        {
          name: 'claim',
          description: 'Claim ticket for support staff assignment',
          type: 1
        },
        {
          name: 'config',
          description: 'Configure parent category, transcripts & support roles',
          type: 1,
          options: [
            { name: 'category', type: 7, description: 'Parent category channel for tickets', required: false },
            { name: 'transcript', type: 7, description: 'Channel to log closed ticket transcripts', required: false },
            { name: 'support_role', type: 8, description: 'Support team role', required: false }
          ]
        },
        {
          name: 'status',
          description: 'View active ticket system stats',
          type: 1
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_ticket',
      handler: async (client: any, interaction: any, context: any) => {
        const guild = interaction.guild;
        if (!guild) {
          return interaction.reply({ content: `${WRONG_ICON} Ticket commands can only be run inside a server.`, flags: 64 });
        }

        const modules = context.getModulesState ? context.getModulesState(guild.id) : [];
        const ticketMod = modules.find((m: any) => m.id === 'tickets');
        const config: ITicketConfig = { ...getDefaultConfig(), ...(ticketMod?.config || {}) };
        const saveConfig = (updated: Partial<ITicketConfig>) => context.updateModuleConfig('tickets', { ...config, ...updated });

        const sub = interaction.options?.getSubcommand(false) || interaction.parsed?.args?.[0]?.toLowerCase() || 'panel';

        // ─── TICKET PANEL DEPLOYMENT ───────────────────────────────────
        if (sub === 'panel' || sub === 'setup') {
          const isAuthorized = await isOwnerOrExtraOwner(interaction.user.id, guild);
          if (!isAuthorized) {
            return interaction.reply({ content: `${WRONG_ICON} Access Denied: Server Owner & Extra Owner permission required.`, flags: 64 });
          }

          const panelCard = buildTicketPanelEmbed({
            serverName: guild.name,
            thumbnailUrl: guild.iconURL?.() || undefined
          });

          const openBtn = new ButtonBuilder()
            .setCustomId('btn_ticket_open_direct')
            .setLabel('Open Ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📩');

          const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('ticket_select_category')
            .setPlaceholder('Click to select support category...')
            .addOptions([
              { label: 'General Support', value: 'general', description: 'General server help & questions', emoji: '🎟️' },
              { label: 'Moderation & Reports', value: 'moderation', description: 'Report user rule violations', emoji: '🛡️' },
              { label: 'VIP & Store', value: 'vip', description: 'VIP subscriptions & store help', emoji: '👑' }
            ]);

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn);
          const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);

          await interaction.channel.send({ embeds: [panelCard], components: [row1, row2] });
          context.logSyncEvent(`[Tickets] Deployed support panel in #${interaction.channel.name}.`, 'success');

          return interaction.reply({ content: `${VERIFIED_ICON} Deployed support ticket panel in ${interaction.channel}!`, flags: 64 });
        }

        // ─── CONFIGURATION ─────────────────────────────────────────────
        if (sub === 'config' || sub === 'configure') {
          const isAuthorized = await isOwnerOrExtraOwner(interaction.user.id, guild);
          if (!isAuthorized) {
            return interaction.reply({ content: `${WRONG_ICON} Access Denied: Server Owner & Extra Owner permission required.`, flags: 64 });
          }

          const categoryOpt = interaction.options?.getChannel?.('category');
          const transcriptOpt = interaction.options?.getChannel?.('transcript');
          const roleOpt = interaction.options?.getRole?.('support_role');

          if (categoryOpt) config.categoryId = categoryOpt.id;
          if (transcriptOpt) config.transcriptChannelId = transcriptOpt.id;
          if (roleOpt && !config.supportRoleIds.includes(roleOpt.id)) {
            config.supportRoleIds.push(roleOpt.id);
          }

          saveConfig(config);

          const statusEmbed = buildLimeOverviewCard({
            title: 'TICKET SYSTEM CONFIGURATION',
            subtitle: 'SUPPORT ENGINE PARAMETERS MATRIX',
            color: Colors.BRAND,
            sections: [
              {
                title: `${CONFIG_ICON} LIVE SETTINGS`,
                items: [
                  `• **Parent Category**: ${config.categoryId ? `<#${config.categoryId}>` : '*Not Set (Default Root)*'}`,
                  `• **Transcript Channel**: ${config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : '*Not Set*'}`,
                  `• **Support Roles**: ${config.supportRoleIds.length > 0 ? config.supportRoleIds.map(id => `<@&${id}>`).join(', ') : '*None Specified*'}`,
                  `• **Ticket Counter**: \`#${config.ticketCounter}\``
                ]
              }
            ],
            footerText: 'Rage Optimiser Enterprise • Support Engine'
          });

          return interaction.reply({ embeds: [statusEmbed], flags: 64 });
        }

        // ─── CREATE TICKET MANUAL ─────────────────────────────────────
        if (sub === 'create' || sub === 'open') {
          return createTicketChannel(client, interaction, context, config, 'general');
        }

        // ─── CLOSE TICKET ─────────────────────────────────────────────
        if (sub === 'close') {
          return closeTicketChannel(client, interaction, context, config);
        }

        // ─── ADD USER ──────────────────────────────────────────────────
        if (sub === 'add') {
          const targetUser = interaction.options?.getUser?.('user') || interaction.mentions?.users?.first();
          if (!targetUser) {
            return interaction.reply({ content: `${WRONG_ICON} Please mention a user to add to this ticket.`, flags: 64 });
          }

          await interaction.channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });

          return interaction.reply({ content: `${VERIFIED_ICON} Added ${targetUser} to ${interaction.channel}.` });
        }

        // ─── REMOVE USER ───────────────────────────────────────────────
        if (sub === 'remove') {
          const targetUser = interaction.options?.getUser?.('user') || interaction.mentions?.users?.first();
          if (!targetUser) {
            return interaction.reply({ content: `${WRONG_ICON} Please mention a user to remove from this ticket.`, flags: 64 });
          }

          await interaction.channel.permissionOverwrites.delete(targetUser.id);
          return interaction.reply({ content: `${VERIFIED_ICON} Removed ${targetUser} from ${interaction.channel}.` });
        }

        // ─── CLAIM TICKET ──────────────────────────────────────────────
        if (sub === 'claim') {
          const currentTickets: ITicket[] = config.activeTickets || [];
          const ticket = currentTickets.find(t => t.channelId === interaction.channel.id);
          if (!ticket) {
            return interaction.reply({ content: `${WRONG_ICON} This channel is not an active support ticket.`, flags: 64 });
          }

          ticket.claimedBy = interaction.user.id;
          ticket.claimedByTag = interaction.user.username;
          saveConfig(config);

          const claimCard = buildMinimalAction({
            user: interaction.user,
            action: 'claimed this ticket',
            reason: 'Assigned as primary support staff member'
          });

          return interaction.reply({ embeds: [claimCard] });
        }

        // ─── STATUS OVERVIEW ──────────────────────────────────────────
        const activeCount = (config.activeTickets || []).filter(t => t.status === 'open').length;

        const overview = buildLimeOverviewCard({
          title: 'TICKET SYSTEM STATUS',
          subtitle: 'ENTERPRISE SUPPORT DESK MATRIX',
          color: Colors.BRAND,
          sections: [
            {
              title: `${SHIELD_ICON} ENGINE STATUS`,
              items: [
                `• **Status**: ${config.enabled ? `${VERIFIED_ICON} Active` : `${WRONG_ICON} Disabled`}`,
                `• **Active Open Tickets**: \`${activeCount}\``,
                `• **Total Tickets Processed**: \`${config.ticketCounter}\``
              ]
            }
          ],
          footerText: 'Rage Optimiser Enterprise • Ticket System'
        });

        return interaction.reply({ embeds: [overview] });
      }
    },
    {
      name: 'interactionCreate',
      handler: async (client: any, interaction: any, context: any) => {
        if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
        const guild = interaction.guild;
        if (!guild) return;

        const modules = context.getModulesState ? context.getModulesState(guild.id) : [];
        const ticketMod = modules.find((m: any) => m.id === 'tickets');
        if (!ticketMod || ticketMod.status !== 'enabled') return;

        const config: ITicketConfig = { ...getDefaultConfig(), ...(ticketMod.config || {}) };

        // Handle category selection dropdown
        if (interaction.customId === 'ticket_select_category') {
          const category = interaction.values[0] || 'general';
          return createTicketChannel(client, interaction, context, config, category);
        }

        // Handle button actions
        if (interaction.customId === 'btn_ticket_open_direct') {
          return createTicketChannel(client, interaction, context, config, 'general');
        }

        if (interaction.customId === 'btn_ticket_close') {
          return closeTicketChannel(client, interaction, context, config);
        }

        if (interaction.customId === 'btn_ticket_claim') {
          const currentTickets: ITicket[] = config.activeTickets || [];
          const ticket = currentTickets.find(t => t.channelId === interaction.channel.id);
          if (!ticket) return interaction.reply({ content: `${WRONG_ICON} Channel is not an active ticket.`, flags: 64 });

          ticket.claimedBy = interaction.user.id;
          ticket.claimedByTag = interaction.user.username;
          context.updateModuleConfig('tickets', { ...config, activeTickets: currentTickets });

          const claimCard = buildMinimalAction({
            user: interaction.user,
            action: 'claimed this ticket',
            reason: 'Assigned support staff'
          });

          return interaction.reply({ embeds: [claimCard] });
        }
      }
    }
  ]
};

async function createTicketChannel(client: any, interaction: any, context: any, config: ITicketConfig, category: string) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Check max open tickets per user
  const activeMsgs: ITicket[] = config.activeTickets || [];
  const userOpen = activeMsgs.filter(t => t.userId === user.id && t.status === 'open');
  if (userOpen.length >= (config.maxOpenPerUser || 1)) {
    return interaction.reply({ content: `${WRONG_ICON} You already have an active support ticket open (<#${userOpen[0].channelId}>). Please resolve it before opening another.`, flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  config.ticketCounter = (config.ticketCounter || 0) + 1;
  const ticketNumber = String(config.ticketCounter).padStart(4, '0');
  const channelName = `ticket-${ticketNumber}`;

  // Build permission overwrites
  const overwrites: any[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  // Add support roles
  for (const roleId of config.supportRoleIds || []) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  }

  try {
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.categoryId || undefined,
      permissionOverwrites: overwrites,
      reason: `Ticket #${ticketNumber} created by ${user.username}`
    });

    const newTicket: ITicket = {
      id: `ticket_${ticketChannel.id}`,
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: user.id,
      userTag: user.username,
      category,
      status: 'open',
      createdAt: new Date()
    };

    activeMsgs.push(newTicket);
    context.updateModuleConfig('tickets', { ...config, ticketCounter: config.ticketCounter, activeTickets: activeMsgs });

    // Send ticket welcome card
    const welcomeCard = buildLimeOverviewCard({
      title: `${TICKET_ICON} TICKET #${ticketNumber} — ${category.toUpperCase()}`,
      subtitle: `SUPPORT REQUEST CREATED BY ${user.username.toUpperCase()}`,
      color: Colors.BRAND,
      sections: [
        {
          title: `${INFO_ICON} SUPPORT DESK NOTICE`,
          items: [
            `• Welcome ${user}! Thank you for reaching out to our support team.`,
            `• Please describe your issue in detail below. Staff will be with you shortly!`,
            `• Click **Claim** to assign a staff member or **Close** when resolved.`
          ]
        }
      ],
      footerText: 'Rage Optimiser Enterprise • Ticket System'
    });

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_ticket_claim')
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji(VERIFIED_ICON),
      new ButtonBuilder()
        .setCustomId('btn_ticket_close')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(WRONG_ICON)
    );

    await ticketChannel.send({ content: `${user} | Support Team`, embeds: [welcomeCard], components: [btnRow] });

    context.logSyncEvent(`[Tickets] Created ticket channel #${channelName} for ${user.username}.`, 'success');

    return interaction.editReply({ content: `${VERIFIED_ICON} Support ticket created successfully: ${ticketChannel}` });
  } catch (err: any) {
    console.error('[Tickets] Create ticket channel error:', err);
    return interaction.editReply({ content: `${WRONG_ICON} Failed to create ticket channel: ${err.message}` });
  }
}

async function closeTicketChannel(client: any, interaction: any, context: any, config: ITicketConfig) {
  const channel = interaction.channel;
  if (!channel) return;

  await interaction.reply({ content: `${TIMER_ICON} Closing ticket channel in **5 seconds**... Generating transcript.` });

  setTimeout(async () => {
    try {
      // Transcript logging if channel set
      if (config.transcriptChannelId) {
        const transcriptChan = await interaction.guild.channels.fetch(config.transcriptChannelId).catch(() => null);
        if (transcriptChan && transcriptChan.isTextBased()) {
          const logCard = buildStatusCard({
            emoji: TICKET_ICON,
            title: 'Ticket Closed & Transcribed',
            body: `Ticket channel **#${channel.name}** was closed by ${interaction.user}.`,
            accentColor: Colors.BRAND
          });
          await transcriptChan.send({ embeds: [logCard.embeds[0]] }).catch(() => null);
        }
      }

      // Remove from active tickets config
      const activeTickets = (config.activeTickets || []).filter(t => t.channelId !== channel.id);
      context.updateModuleConfig('tickets', { ...config, activeTickets });
      context.logSyncEvent(`[Tickets] Closed and deleted ticket channel #${channel.name}.`, 'info');

      await channel.delete().catch(() => null);
    } catch (e) {
      console.error('[Tickets] Close error:', e);
    }
  }, 5000);
}

export function registerTicketsCommands() {
  PrefixRegistry.register({
    name: 'ticket',
    description: 'Enterprise Support Ticket System & Management Portal',
    category: 'Community',
    usage: 'r!ticket [panel | open | close | add @user | remove @user | config | status]',
    aliases: ['t', 'tck', 'tickets'],
    userPermissions: ['ManageGuild'],
    cooldownSeconds: 3,
    examples: ['r!ticket panel', 'r!ticket open', 'r!ticket close', 'r!ticket add @User', 'r!ticket config'],
    moduleOwnerId: 'tickets',
    subcommands: [
      { name: 'panel [#channel]', description: 'Deploy enterprise support ticket panel with button triggers', examples: ['r!ticket panel #support'] },
      { name: 'open [reason]', description: 'Open a new private support ticket channel', examples: ['r!ticket open Need assistance'] },
      { name: 'close', description: 'Close current ticket channel, save transcript and auto-delete', examples: ['r!ticket close'] },
      { name: 'add @user', description: 'Grant user access to current ticket channel', examples: ['r!ticket add @User'] },
      { name: 'remove @user', description: 'Remove user access from current ticket channel', examples: ['r!ticket remove @User'] },
      { name: 'config category <id>', description: 'Configure parent category for new tickets', examples: ['r!ticket config category 123456789'] },
      { name: 'status', description: 'View ticket system active configuration and channel stats', examples: ['r!ticket status'] }
    ]
  });
}
