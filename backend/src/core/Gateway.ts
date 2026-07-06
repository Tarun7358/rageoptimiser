import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits, ChannelType, Events } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { DiscordResourceRegistry, ModuleManifest, ModuleState } from './types.js';
import { IGuildApproval } from '../models/index.js';
import { Database } from './Database.js';
import { calculateRiskScore } from '../utils/riskScoring.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { PublicFeedManager } from './PublicFeedManager.js';
import { AnalyticsService } from './AnalyticsService.js';

export class Gateway {
  public client: Client;
  private manifests: ModuleManifest[] = [];
  private voiceConnection: any = null;
  private isConnectingVoice: boolean = false;
  private voiceRetryCount: number = 0;
  private lastVoiceChannelId: string | null = null;
  private voiceConnectTime: number | null = null;
  private voiceSessions = new Map<string, number>();

  private logSyncEvent(msgOrGuildId: string | undefined, msgOrType?: string, type?: 'info' | 'warn' | 'success') {
    let finalGuildId: string | undefined = undefined;
    let finalMsg = '';
    let finalType: 'info' | 'warn' | 'success' = 'info';

    if (type !== undefined) {
      finalGuildId = msgOrGuildId;
      finalMsg = msgOrType || '';
      finalType = type;
    } else {
      finalMsg = msgOrGuildId || '';
      finalType = (msgOrType as any) || 'info';
    }

    this.logSyncEventCallback(finalGuildId, finalMsg, finalType);
  }

  constructor(
    private logSyncEventCallback: (guildId: string | undefined, msg: string, type: 'info' | 'warn' | 'success') => void,
    private getRegistry: (guildId?: string) => DiscordResourceRegistry,
    private setRegistry: (guildId: string | undefined, reg: DiscordResourceRegistry) => void,
    private reevaluateModules: (guildId?: string) => void,
    private broadcast: (msg: any) => void,
    private getModulesState: (guildId?: string) => ModuleState[],
    private getGlobalSettings: (guildId?: string) => Record<string, any>,
    private publicFeed: PublicFeedManager,
    private updateModuleConfig: (guildId: string | undefined, id: string, config: Record<string, any>) => ModuleState | null
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
      ]
    });

    this.setupListeners();
  }

  public registerModuleManifests(manifests: ModuleManifest[]) {
    this.manifests = manifests;
  }

  public async connect() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      console.log('No DISCORD_TOKEN provided. Gateway running in simulation mode.');
      return;
    }

    try {
      await this.client.login(token);
    } catch (err) {
      console.error('Discord gateway connection failed. Fallback simulation mode active.', err);
      this.logSyncEvent('Discord login failed. Offline simulator running.', 'warn');
    }
  }

  public async triggerEmergencyLock() {
    const guildId = process.env.GUILD_ID;
    if (!guildId) return;
    const guild = await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    this.logSyncEvent('CRITICAL: Executing Global Emergency Lock. Locking all text channels.', 'warn');
    const channels = await guild.channels.fetch();
    
    let lockedCount = 0;
    for (const channel of channels.values()) {
      if (channel && channel.isTextBased() && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
        try {
          // Deny SEND_MESSAGES for @everyone
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: false
          });
          lockedCount++;
        } catch (e) {
          // Skip if missing permissions on specific channel
        }
      }
    }
    
    this.logSyncEvent(`Emergency Lock complete. ${lockedCount} channels set to Read-Only.`, 'warn');
  }

  private setupListeners() {
    this.client.once(Events.ClientReady, () => {
      console.log(`Discord client connected as ${this.client.user?.tag}`);
      this.logSyncEvent(`Discord gateway connected as ${this.client.user?.tag}`, 'success');
      this.syncRegistry();
      this.syncApprovals();
      this.forceDeployCommands();
      setInterval(() => this.syncRegistry(), 30000);
      setInterval(() => this.checkVoicePresence(), 10000);
      setInterval(() => this.dispatchEvent('tick'), 10000);
      setTimeout(() => this.checkVoicePresence(), 2000);
      setInterval(() => {
        const metrics = this.getMetrics();
        this.broadcast({
          type: 'METRICS_UPDATE',
          latency: metrics.latency,
          uptime: metrics.uptime
        });
      }, 5000);
    });

    this.client.on('guildCreate', async (guild) => {
      if (guild.id === process.env.GUILD_ID) return; // Skip main server
      this.logSyncEvent(`Discord Event: Bot joined new guild "${guild.name}" (${guild.id}). Entering Pending Mode.`, 'warn');
      
      try {
        await guild.members.fetch(); // Ensure we have member counts
        
        const owner = await guild.fetchOwner();
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = guild.memberCount - botCount;

        const { riskScore, riskLevel } = calculateRiskScore(guild);
        
        // Adjust risk score based on bot ratio
        let finalRiskScore = riskScore;
        if (guild.memberCount > 0) {
          const botRatio = botCount / guild.memberCount;
          if (botRatio > 0.5) finalRiskScore = Math.min(100, finalRiskScore + 30);
          else if (botRatio > 0.3) finalRiskScore = Math.min(100, finalRiskScore + 15);
        }

        let finalRiskLevel = riskLevel;
        if (finalRiskScore >= 75) finalRiskLevel = 'Critical';
        else if (finalRiskScore >= 50) finalRiskLevel = 'High';
        else if (finalRiskScore >= 25) finalRiskLevel = 'Medium';

        const db = Database.getDb();
        let isBlacklisted = false;

        if (db) {
          const docSnap = await db.collection('approvals').doc(guild.id).get();
          if (docSnap.exists) {
            const existing = docSnap.data() as IGuildApproval;
            if (existing.status === 'Blacklisted') {
              isBlacklisted = true;
            }
          }
        }

        if (isBlacklisted) {
          await guild.leave();
          this.logSyncEvent(`Left blacklisted guild "${guild.name}".`, 'warn');
          return;
        }

        const approvalData = {
          guildId: guild.id,
          guildName: guild.name,
          ownerId: owner.id,
          ownerUsername: owner.user.tag,
          ownerAvatar: owner.user.displayAvatarURL(),
          memberCount: guild.memberCount,
          botCount,
          humanCount,
          verificationLevel: guild.verificationLevel,
          premiumTier: guild.premiumTier,
          premiumSubscriptionCount: guild.premiumSubscriptionCount || 0,
          joinedAt: Date.now(),
          riskScore: finalRiskScore,
          riskLevel: finalRiskLevel,
          status: 'Approved',
          lastUpdated: Date.now()
        };

        if (db) {
          await db.collection('approvals').doc(guild.id).set(approvalData, { merge: true });
        }

        // Notify Bot Owner (platform admin)
        const ownerId = process.env.OWNER_ID || '1508399161798819840';
        try {
          const botOwner = await this.client.users.fetch(ownerId);
          if (botOwner) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ New Server Registered')
              .setDescription(`Rage Optimiser joined **${guild.name}**. The server has been auto-approved.`)
              .addFields(
                { name: 'Guild ID', value: guild.id, inline: true },
                { name: 'Owner', value: `${owner.user.tag} (${owner.id})`, inline: true },
                { name: 'Members', value: `${guild.memberCount} (${humanCount} Humans, ${botCount} Bots)`, inline: true },
                { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Risk Level', value: `${finalRiskLevel} (Score: ${finalRiskScore})`, inline: true }
              )
              .setThumbnail(guild.iconURL() || null)
              .setColor('#22C55E')
              .setFooter({ text: 'Auto-Approved' });

            await botOwner.send({ embeds: [embed] }).catch(() => {});
          }
        } catch (e) {
          console.error('[Gateway] Failed to notify bot owner of new guild:', e);
        }

        // Also DM the guild owner about approval + music bot
        try {
          const musicClientId = process.env.MUSIC_CLIENT_ID || '1520323151928623125';
          const musicPerms = process.env.MUSIC_BOT_PERMISSIONS || '36700160';
          const musicInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${musicClientId}&permissions=${musicPerms}&scope=bot%20applications.commands&guild_id=${guild.id}`;

          await owner.user.send({
            embeds: [{
              title: '👋 Thanks for inviting Rage Optimiser!',
              description: `Your server **${guild.name}** has been registered and is now **Approved**.\nYou can configure all features immediately through your real-time dashboard.`,
              fields: [
                {
                  name: '⚙️ Configure the Bot',
                  value: 'Use our real-time dashboard to set up security settings, verification, moderation, logging, levels, backups, and more!',
                  inline: false
                },
                {
                  name: '🎵 Add Rage Music Bot (Optional)',
                  value: `Music features run on a **separate dedicated bot** for best performance.\nYou can invite it to your server using the link below:\n[Invite Rage Music to ${guild.name}](${musicInviteUrl})`,
                  inline: false
                }
              ],
              color: 0x22c55e,
              footer: { text: 'Rage Optimiser Enterprise Platform' },
              timestamp: new Date().toISOString()
            }]
          }).catch(() => {}); // Silently fail if owner has DMs closed
        } catch (e) {
          console.error('[Gateway] Failed to DM guild owner about pending approval:', e);
        }


      } catch (e) {
        console.error('[Gateway] Error handling guildCreate:', e);
      }
    });

    this.client.on('roleDelete', (role) => {
      const guildId = role.guild.id;
      this.logSyncEvent(guildId, `Discord Event: Role "${role.name}" was deleted from guild.`, 'warn');
      const reg = this.getRegistry(guildId);
      reg.roles = reg.roles.filter(r => r.id !== role.id);
      this.setRegistry(guildId, reg);
      this.reevaluateModules(guildId);
      this.broadcast({ type: 'STATE_UPDATE', modules: this.getModulesState(guildId), registry: reg, guildId });

      // Dispatch to modules
      this.dispatchEvent('roleDelete', role);
    });

    this.client.on('roleUpdate', (oldRole, newRole) => {
      const guildId = newRole.guild.id;
      if (oldRole.name !== newRole.name || oldRole.color !== newRole.color) {
        this.syncRegistry(guildId);
      }
      this.dispatchEvent('roleUpdate', oldRole, newRole);
    });

    this.client.on('channelDelete', (channel) => {
      const guildId = (channel as any).guild?.id;
      if (!guildId) return;
      this.logSyncEvent(guildId, `Discord Event: Channel "${(channel as any).name || channel.id}" was deleted from guild.`, 'warn');
      const reg = this.getRegistry(guildId);
      reg.channels = reg.channels.filter(c => c.id !== channel.id);
      this.setRegistry(guildId, reg);
      this.reevaluateModules(guildId);
      this.broadcast({ type: 'STATE_UPDATE', modules: this.getModulesState(guildId), registry: reg, guildId });

      // Dispatch to modules
      this.dispatchEvent('channelDelete', channel);

      const isPublic = (ch: any) => ch.permissionsFor?.(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      if (isPublic(channel)) {
        this.publicFeed?.addEvent('Server', `Channel **#${(channel as any).name}** was deleted`);
      }
    });

    this.client.on('channelCreate', (channel) => {
      const guildId = (channel as any).guild?.id;
      if (!guildId) return;
      this.syncRegistry(guildId);
      this.dispatchEvent('channelCreate', channel);

      const isPublic = (ch: any) => ch.permissionsFor?.(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      if (isPublic(channel)) {
        this.publicFeed?.addEvent('Server', `Channel **#${(channel as any).name}** was created`);
      }
    });

    this.client.on('channelUpdate', (oldChannel, newChannel) => {
      const guildId = (newChannel as any).guild?.id;
      if (!guildId) return;
      if ((oldChannel as any).name !== (newChannel as any).name) {
        this.logSyncEvent(guildId, `Discord Event: Channel renamed from #${(oldChannel as any).name} to #${(newChannel as any).name}.`, 'info');
        this.syncRegistry(guildId);
      }
      this.dispatchEvent('channelUpdate', oldChannel, newChannel);
    });

    this.client.on('guildMemberUpdate', (oldMember, newMember) => {
      this.dispatchEvent('guildMemberUpdate', oldMember, newMember);
    });

    this.client.on('guildMemberAdd', (member) => {
      const guildId = member.guild.id;
      this.logSyncEvent(guildId, `Discord Event: User "${member.user.tag}" joined guild.`, 'info');
      this.syncRegistry(guildId);
      this.dispatchEvent('guildMemberAdd', member);
      this.publicFeed?.addEvent('Members', `**${member.user.username}** joined the server`);
      AnalyticsService.incrementMetric(guildId, 'joins').catch(() => {});
    });

    this.client.on('guildMemberRemove', (member) => {
      const guildId = member.guild.id;
      this.logSyncEvent(guildId, `Discord Event: User "${member.user.tag}" left guild.`, 'info');
      this.syncRegistry(guildId);
      this.dispatchEvent('guildMemberRemove', member);
      this.publicFeed?.addEvent('Members', `**${member.user.username}** left the server`);
      AnalyticsService.incrementMetric(guildId, 'leaves').catch(() => {});
    });

    this.client.on('messageDelete', (message) => {
      this.dispatchEvent('messageDelete', message);
    });

    this.client.on('messageUpdate', (oldMessage, newMessage) => {
      this.dispatchEvent('messageUpdate', { oldMessage, newMessage });
    });

    this.client.on('messageCreate', (message) => {
      this.dispatchEvent('messageCreate', message);
      if (message.guildId && !message.author?.bot) {
        AnalyticsService.incrementMetric(message.guildId, 'messages').catch(() => {});
        
        // DM notify users who were tagged/mentioned directly
        if (message.mentions.users.size > 0 && message.guild) {
          message.mentions.users.forEach(async (user) => {
            // Do not notify self or other bots
            if (user.id === message.author.id || user.bot) return;

            try {
              const guildIcon = message.guild?.iconURL({ size: 256 }) || null;
              
              const dmEmbed = new EmbedBuilder()
                .setTitle('🔔 New Mention Alert')
                .setDescription(`You have been mentioned by **${message.author.tag}** in **${message.guild?.name}**!`)
                .setColor('#7C5CFC')
                .setThumbnail(guildIcon)
                .addFields(
                  { name: '📍 Server', value: `\`${message.guild?.name}\``, inline: true },
                  { name: '💬 Channel', value: `${message.channel.toString()}`, inline: true },
                  { name: '👤 Mentioned By', value: `${message.author.toString()} (\`${message.author.tag}\`)`, inline: false },
                  { name: '📝 Message Context', value: message.content ? (message.content.length > 800 ? message.content.substring(0, 800) + '...' : message.content) : '*(No text content)*', inline: false }
                )
                .setFooter({ text: 'Rage Optimiser Premium • Real-time Alerts', iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();

              const jumpButton = new ButtonBuilder()
                .setLabel('Go to Message')
                .setStyle(ButtonStyle.Link)
                .setURL(message.url);

              const row = new ActionRowBuilder<ButtonBuilder>().addComponents(jumpButton);

              await user.send({ embeds: [dmEmbed], components: [row] });
            } catch (err) {
              // Silently catch errors if user has DMs closed or blocked the bot
            }
          });
        }
      }
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.dispatchEvent('voiceStateUpdate', { oldState, newState });

      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      // Track voice time
      if (!oldState.channelId && newState.channelId) {
        // User joined
        this.voiceSessions.set(member.id, Date.now());
      } else if (oldState.channelId && !newState.channelId) {
        // User left
        const start = this.voiceSessions.get(member.id);
        if (start && newState.guild?.id) {
          const diffMin = Math.max(1, Math.floor((Date.now() - start) / 60000));
          AnalyticsService.incrementMetric(newState.guild.id, 'voiceMinutes', diffMin).catch(() => {});
        }
        this.voiceSessions.delete(member.id);
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // User moved channels - record current and start new
        const start = this.voiceSessions.get(member.id);
        if (start && newState.guild?.id) {
          const diffMin = Math.max(1, Math.floor((Date.now() - start) / 60000));
          AnalyticsService.incrementMetric(newState.guild.id, 'voiceMinutes', diffMin).catch(() => {});
        }
        this.voiceSessions.set(member.id, Date.now());
      }

      const isPublic = (channel: any) => {
        if (!channel) return false;
        return channel.permissionsFor(channel.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      };

      if (!oldState.channelId && newState.channelId) {
        if (isPublic(newState.channel)) {
          this.publicFeed?.addEvent('Voice', `**${member.user.username}** joined ${newState.channel?.name}`);
        }
      } else if (oldState.channelId && !newState.channelId) {
        if (isPublic(oldState.channel)) {
          this.publicFeed?.addEvent('Voice', `**${member.user.username}** left ${oldState.channel?.name}`);
        }
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        if (isPublic(newState.channel)) {
          this.publicFeed?.addEvent('Voice', `**${member.user.username}** moved to ${newState.channel?.name}`);
        }
      }
    });



    this.client.on('guildBanAdd', (ban) => {
      this.dispatchEvent('guildBanAdd', ban);
    });

    this.client.on('guildBanRemove', (ban) => {
      this.dispatchEvent('guildBanRemove', ban);
    });

    this.client.on('roleCreate', (role) => {
      this.syncRegistry();
      this.dispatchEvent('roleCreate', role);
    });

    this.client.on('messageReactionAdd', (reaction, user) => {
      this.dispatchEvent('messageReactionAdd', reaction, user);
    });

    this.client.on('messageReactionRemove', (reaction, user) => {
      this.dispatchEvent('messageReactionRemove', reaction, user);
    });

    // Slash Command & Component Button routing
    this.client.on('interactionCreate', async (interaction) => {

      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        // SYSTEM MAINTENANCE MODE CHECK
        const settings = this.getGlobalSettings();
        if (settings.maintenanceMode) {
          const isOwner = interaction.user.id === interaction.guild?.ownerId || interaction.user.id === process.env.OWNER_ID;
          const member = interaction.member;
          // Check if admin
          let isAdmin = isOwner;
          if (!isAdmin && member && typeof member.permissions !== 'string') {
             isAdmin = (member.permissions as any).has(PermissionFlagsBits.Administrator);
          }
          
          if (!isAdmin) {
             this.logSyncEvent(`Blocked command /${commandName} from ${interaction.user.tag} due to active Maintenance Mode.`, 'warn');
             if (interaction.isRepliable()) {
               await interaction.reply({
                 content: '🚧 **System Maintenance Mode Active**\nThe server is currently in lockdown mode. All public bot commands are temporarily disabled. Please check back later.',
                 flags: 64
               }).catch(() => {});
             }
             return;
          }
        }

        this.logSyncEvent(`Slash command executed: /${commandName}`, 'info');
        if (interaction.guildId) {
          AnalyticsService.trackCommand(interaction.guildId, commandName).catch(() => {});
        }

        // Dispatch command handler matching the active modules
        for (const manifest of this.manifests) {
          if (manifest.commands) {
            const cmd = manifest.commands.find(c => c.name === commandName);
            if (cmd) {
              // Check if the module is enabled (bypass for owner/system modules)
              const isSystemModule = ['owner_commands', 'approval'].includes(manifest.id);
              if (!isSystemModule) {
                const modulesState = this.getModulesState(interaction.guildId || undefined);
                const moduleState = modulesState.find(m => m.id === manifest.id);
                if (!moduleState || moduleState.status !== 'enabled') {
                  if (interaction.isRepliable()) {
                    await interaction.reply({
                      content: `❌ The **${manifest.name}** module is currently disabled.`,
                      flags: 64
                    }).catch(() => {});
                  }
                  return;
                }
              }

              const eventObj = manifest.events?.find(e => e.name === `command_${commandName}`);
              if (eventObj) {
                try {
                  await eventObj.handler(this.client, interaction, { 
                    logSyncEvent: (msgOrGuildId: string | undefined, msgOrType?: string, type?: 'info' | 'warn' | 'success') => {
                      if (type !== undefined) {
                        this.logSyncEvent(msgOrGuildId, msgOrType, type);
                      } else {
                        this.logSyncEvent(interaction.guildId || undefined, msgOrGuildId, msgOrType as any);
                      }
                    },
                    getModulesState: () => this.getModulesState(interaction.guildId || undefined),
                    getRegistry: () => this.getRegistry(interaction.guildId || undefined),
                    handleApprovalAction: (g: string, a: string, r?: string) => this.handleApprovalAction(g, a, r),
                    updateModuleConfig: (id: string, config: Record<string, any>) => this.updateModuleConfig(interaction.guildId || undefined, id, config)
                  });
                  return;
                } catch (err) {
                  console.error(`Error executing command ${commandName} handler:`, err);
                  await interaction.reply({
                    content: '❌ An internal error occurred while executing this command.',
                    flags: 64
                  });
                  return;
                }
              }
            }
          }
        }

        await interaction.reply({
          content: `❌ Command /${commandName} is registered but no module handler is currently active.`,
          flags: 64
        });
      } else if (interaction.isButton()) {
        this.dispatchEvent(`button_${interaction.customId}`, interaction);
      } else if (interaction.isAnySelectMenu()) {
        this.dispatchEvent(`select_${interaction.customId}`, interaction);
      } else if (interaction.isModalSubmit()) {
        this.dispatchEvent(`modal_${interaction.customId}`, interaction);
      }
    });
  }

  public async syncRegistry(guildId?: string) {
    try {
      if (!guildId) {
        const guilds = Array.from(this.client.guilds.cache.values());
        for (const g of guilds) {
          await this.syncSingleGuild(g.id);
        }
      } else {
        await this.syncSingleGuild(guildId);
      }
    } catch (err) {
      console.error('Failed to sync live Discord resources:', err);
    }
  }

  private async syncSingleGuild(guildId: string) {
    try {
      const guild = await this.client.guilds.fetch({ guild: guildId, withCounts: true } as any);
      if (!guild) return;

      const roles = await guild.roles.fetch();
      const channels = await guild.channels.fetch();

      const members = await guild.members.fetch({ withPresences: true }).catch(() => null);
      const exactOnlineCount = members ? members.filter(m => m.presence && m.presence.status !== 'offline').size : 0;

      const reg = this.getRegistry(guildId);
      reg.memberCount = guild.approximateMemberCount ?? guild.memberCount;
      reg.onlineCount = exactOnlineCount;

      reg.roles = roles.map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        membersCount: r.members.size,
        permissions: r.permissions.toArray(),
        position: r.position
      }));

      reg.channels = channels.filter(c => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory || c.type === ChannelType.GuildVoice))
        .map(c => ({
          id: c!.id,
          name: c!.name,
          type: c!.type === ChannelType.GuildText ? 'text' : (c!.type === ChannelType.GuildVoice ? 'voice' : 'category'),
          category: c!.parentId ? channels.get(c!.parentId)?.name || '' : '',
          permissions: []
        }));

      this.setRegistry(guildId, reg);
      this.reevaluateModules(guildId);
      this.broadcast({ type: 'STATE_UPDATE', modules: this.getModulesState(guildId), registry: reg, guildId });
      this.logSyncEvent(guildId, 'Discord resource registry fetched from live Gateway.', 'success');
    } catch (err) {
      console.error(`Failed to sync live Discord resources for guild ${guildId}:`, err);
    }
  }

  public async syncQuarantineQueue(guildId?: string) {
    try {
      const gId = guildId || process.env.GUILD_ID;
      if (!gId) return;

      const guild = await this.client.guilds.fetch(gId).catch(() => null);
      if (!guild) return;

      const modules = this.getModulesState(gId);
      const secMod = modules.find(m => m.id === 'security');
      if (!secMod || !secMod.config.quarantineRoleId) return;

      const quarantineRoleId = secMod.config.quarantineRoleId;
      let currentQueue = secMod.config.quarantinedUsers || [];

      const members = await guild.members.fetch();
      const membersWithRole = members.filter(m => m.roles.cache.has(quarantineRoleId));

      let newQueue = currentQueue.filter((u: any) => members.has(u.userId) ? members.get(u.userId)!.roles.cache.has(quarantineRoleId) : true);

      let changed = false;
      for (const [memberId, member] of membersWithRole) {
        if (!newQueue.find((u: any) => u.userId === memberId)) {
          newQueue.push({
            id: `q-${Date.now()}-${memberId}`,
            tag: member.user.tag,
            userId: memberId,
            reason: 'Auto-Synced from Discord',
            time: new Date().toISOString(),
            status: 'Quarantined',
            risk: 'danger',
            originalRoles: []
          });
          changed = true;
        }
      }

      if (changed || newQueue.length !== currentQueue.length) {
        this.updateModuleConfig(gId, 'security', { quarantinedUsers: newQueue });
        this.logSyncEvent(gId, `Deep Sync: Rebuilt Quarantine Queue. Tracking ${newQueue.length} users.`, 'success');
      }
    } catch (e) {
      console.error('Failed to sync quarantine queue:', e);
    }
  }

  public async forceDeployCommands(targetGuildId?: string) {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = targetGuildId || process.env.GUILD_ID;

    if (!token || !clientId || !guildId) return;

    const commands: any[] = [];
    this.manifests.forEach(m => {
      if (m.commands) {
        m.commands.forEach(c => {
          commands.push({
            name: c.name,
            description: c.description,
            options: c.options || []
          });
        });
      }
    });

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log(`Deploying ${commands.length} application commands to Discord API...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      this.logSyncEvent('Slash commands successfully registered on Discord REST API.', 'success');
      console.log('✅ Slash commands successfully registered on Discord REST API.');
    } catch (error) {
      console.error('Failed to deploy slash commands:', error);
    }
  }

  private dispatchEvent(eventName: string, ...args: any[]) {
    const resolveGuildId = (eventArgs: any[]): string | undefined => {
      if (!eventArgs || eventArgs.length === 0) return undefined;
      const first = eventArgs[0];
      if (!first) return undefined;

      if (first.guildId) return first.guildId;
      if (first.guild && typeof first.guild === 'object') {
        if (first.guild.id) return first.guild.id;
      }

      if (first.newState && first.newState.guild) return first.newState.guild.id;
      if (first.oldState && first.oldState.guild) return first.oldState.guild.id;
      if (first.newMessage && first.newMessage.guildId) return first.newMessage.guildId;
      if (first.oldMessage && first.oldMessage.guildId) return first.oldMessage.guildId;

      if (first.message && first.message.guildId) return first.message.guildId;

      for (const arg of eventArgs) {
        if (arg && typeof arg === 'object') {
          if (arg.guildId) return arg.guildId;
          if (arg.guild && arg.guild.id) return arg.guild.id;
        }
      }
      return undefined;
    };

    const guildId = resolveGuildId(args) || process.env.GUILD_ID || 'default_guild';

    this.manifests.forEach(m => {
      const ev = m.events?.find(e => e.name === eventName);
      if (ev) {
        try {
          ev.handler(this.client, ...args, { 
            guildId,
            logSyncEvent: (msgOrGuildId: string | undefined, msgOrType?: string, type?: 'info' | 'warn' | 'success') => {
              if (type !== undefined) {
                this.logSyncEvent(msgOrGuildId, msgOrType, type);
              } else {
                this.logSyncEvent(guildId, msgOrGuildId, msgOrType as any);
              }
            },
            getModulesState: () => this.getModulesState(guildId),
            getRegistry: () => this.getRegistry(guildId),
            updateModuleConfig: (id: string, config: Record<string, any>) => this.updateModuleConfig(guildId, id, config)
          });
        } catch (err) {
          console.error(`Error in event listener ${eventName} for module ${m.id}:`, err);
        }
      }
    });
  }

  private async checkVoicePresence() {
    const guilds = Array.from(this.client.guilds.cache.values());
    for (const guild of guilds) {
      await this.checkVoicePresenceForGuild(guild);
    }
  }

  private async checkVoicePresenceForGuild(guild: any) {
    const guildId = guild.id;
    const modules = this.getModulesState ? this.getModulesState(guildId) : [];
    const voiceModule = modules.find((m: any) => m.id === 'voice');
    if (!voiceModule) return;

    if (voiceModule.status !== 'enabled') {
      const currentConnection = getVoiceConnection(guildId);
      if (currentConnection) {
        this.logSyncEvent(guildId, 'Voice Presence: Disconnecting from voice channel (Module disabled).', 'info');
        try {
          currentConnection.destroy();
        } catch (e) {}
        if (this.voiceConnection && this.lastVoiceChannelId && this.voiceConnection.joinConfig.guildId === guildId) {
          this.voiceConnection = null;
          this.voiceConnectTime = null;
          this.voiceRetryCount = 0;
        }

        // Reset transient stats
        voiceModule.connectionStatus = 'disconnected';
        voiceModule.connectedChannelId = null;
        voiceModule.connectionDuration = '0s';
        this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      }
      return;
    }

    const config = voiceModule.config || {};
    const channelId = config.channelId;
    if (!channelId) {
      voiceModule.connectionStatus = 'not_configured';
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      if (this.lastVoiceChannelId === channelId) {
        this.logSyncEvent(guildId, `Voice Presence Alert: Configured voice channel (${channelId}) was deleted!`, 'warn');
        this.lastVoiceChannelId = null;
      }
      voiceModule.connectionStatus = 'error';
      voiceModule.errors = [`Configured voice channel (${channelId}) was deleted or does not exist!`];
      this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      return;
    }

    const currentConnection = getVoiceConnection(guildId);

    // If channel changed, destroy old connection and reconnect
    if (currentConnection && this.lastVoiceChannelId !== channelId) {
      this.logSyncEvent(guildId, `Voice Presence: Target channel changed to #${channel.name}. Reconnecting...`, 'info');
      try {
        currentConnection.destroy();
      } catch (e) {}
      if (this.voiceConnection && this.lastVoiceChannelId && this.voiceConnection.joinConfig.guildId === guildId) {
        this.voiceConnection = null;
        this.voiceConnectTime = null;
        this.voiceRetryCount = 0;
      }
    }

    const reconnectDelay = Number(config.reconnectDelay || 5000);
    const maxRetries = Number(config.maxRetries || 5);

    if (!getVoiceConnection(guildId)) {
      this.connectVoiceChannel(guild, channel, reconnectDelay, maxRetries);
    } else {
      if (this.voiceConnectTime) {
        const diffSecs = Math.floor((Date.now() - this.voiceConnectTime) / 1000);
        const hrs = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;
        voiceModule.connectionDuration = `${hrs}h ${mins}m ${secs}s`;
      }
      voiceModule.connectionStatus = 'connected';
      voiceModule.connectedChannelId = channelId;
      voiceModule.reconnectAttempts = this.voiceRetryCount;
      voiceModule.voiceGatewayStatus = 'healthy';
      
      const activityStatus = config.activityStatus;
      if (activityStatus && this.client.user) {
        this.client.user.setActivity(activityStatus);
      }
      
      this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
    }
  }

  private async connectVoiceChannel(guild: any, channel: any, reconnectDelay: number, maxRetries: number) {
    if (this.isConnectingVoice) return;
    this.isConnectingVoice = true;

    const guildId = guild.id;
    const modules = this.getModulesState ? this.getModulesState(guildId) : [];
    const voiceModule = modules.find((m: any) => m.id === 'voice');

    try {
      this.logSyncEvent(guildId, `Voice Presence: Connecting to voice channel #${channel.name}...`, 'info');
      if (voiceModule) {
        voiceModule.connectionStatus = 'connecting';
        this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      }

      // Check bot permissions: ViewChannel, Connect
      const member = guild.members.me;
      const perms = channel.permissionsFor(member);
      if (!perms || !perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.Connect)) {
        throw new Error('Missing ViewChannel or Connect permissions on voice channel');
      }

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });

      this.voiceConnection = connection;
      this.lastVoiceChannelId = channel.id;
      this.voiceConnectTime = Date.now();
      this.voiceRetryCount = 0;
      this.isConnectingVoice = false;

      this.logSyncEvent(guildId, `Voice Presence: Connected to voice channel #${channel.name} (24/7 Presence Active).`, 'success');

      if (voiceModule) {
        voiceModule.connectionStatus = 'connected';
        voiceModule.connectedChannelId = channel.id;
        voiceModule.voiceGatewayStatus = 'healthy';
        this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      }

      if ((connection as any)._presenceListener) {
        try {
          connection.removeListener('stateChange', (connection as any)._presenceListener);
        } catch (e) {}
      }
      const listener = (oldState: any, newState: any) => {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          this.logSyncEvent(guildId, `Voice Presence Alert: Unexpectedly disconnected from #${channel.name}!`, 'warn');
          this.handleVoiceDisconnect(guild, channel, reconnectDelay, maxRetries);
        }
      };
      (connection as any)._presenceListener = listener;
      connection.on('stateChange', listener);

    } catch (err: any) {
      this.isConnectingVoice = false;
      console.error('Voice connect error:', err);
      this.logSyncEvent(guildId, `Voice Connection Error: ${err.message || err}`, 'warn');

      if (voiceModule) {
        voiceModule.connectionStatus = 'error';
        voiceModule.voiceGatewayStatus = 'unreachable';
        this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      }
    }
  }

  private handleVoiceDisconnect(guild: any, channel: any, reconnectDelay: number, maxRetries: number) {
    if (this.isConnectingVoice) return;

    const guildId = guild.id;
    const modules = this.getModulesState ? this.getModulesState(guildId) : [];
    const voiceModule = modules.find((m: any) => m.id === 'voice');

    if (this.voiceConnection) {
      try {
        this.voiceConnection.destroy();
      } catch (e) {}
      if (this.voiceConnection.joinConfig.guildId === guildId) {
        this.voiceConnection = null;
        this.voiceConnectTime = null;
      }
    }

    if (voiceModule && voiceModule.status !== 'enabled') {
      return;
    }

    if (this.voiceRetryCount >= maxRetries) {
      this.logSyncEvent(guildId, `Voice Presence Alert: Maximum reconnect attempts (${maxRetries}) reached. Reconnection aborted.`, 'warn');
      if (voiceModule) {
        voiceModule.connectionStatus = 'error';
        this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
      }
      return;
    }

    this.voiceRetryCount++;
    this.logSyncEvent(guildId, `Voice Presence: Auto-reconnecting in ${reconnectDelay / 1000}s (Attempt ${this.voiceRetryCount}/${maxRetries})...`, 'info');

    if (voiceModule) {
      voiceModule.connectionStatus = 'connecting';
      voiceModule.reconnectAttempts = this.voiceRetryCount;
      this.broadcast({ type: 'STATE_UPDATE', modules, registry: this.getRegistry(guildId), guildId });
    }
    setTimeout(() => {
      this.connectVoiceChannel(guild, channel, reconnectDelay, maxRetries);
    }, reconnectDelay);
  }
  public getMetrics() {
    if (!this.client || !this.client.readyAt) {
      return { latency: 0, uptime: 'Offline' };
    }
    const ping = this.client.ws.ping;
    const upMs = this.client.uptime || 0;
    const hrs = Math.floor(upMs / 3600000);
    const mins = Math.floor((upMs % 3600000) / 60000);
    const secs = Math.floor((upMs % 60000) / 1000);
    
    let uptimeStr = '';
    if (hrs > 0) uptimeStr += `${hrs}h `;
    if (mins > 0 || hrs > 0) uptimeStr += `${mins}m `;
    uptimeStr += `${secs}s`;
    
    return {
      latency: ping >= 0 ? ping : 0,
      uptime: uptimeStr || '0s'
    };
  }

  private async syncApprovals() {
    const db = Database.getDb();
    if (!db) return;

    for (const guild of this.client.guilds.cache.values()) {
      if (guild.id === process.env.GUILD_ID) continue; // Skip main server

      try {
        const docRef = db.collection('approvals').doc(guild.id);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
          await guild.members.fetch().catch(() => {});
          const owner = await guild.fetchOwner().catch(() => null);
          const botCount = guild.members.cache.filter(m => m.user.bot).size;
          const humanCount = guild.memberCount - botCount;
          const { riskScore, riskLevel } = calculateRiskScore(guild);

          let finalRiskScore = riskScore;
          if (guild.memberCount > 0) {
            const botRatio = botCount / guild.memberCount;
            if (botRatio > 0.5) finalRiskScore = Math.min(100, finalRiskScore + 30);
            else if (botRatio > 0.3) finalRiskScore = Math.min(100, finalRiskScore + 15);
          }

          let finalRiskLevel = riskLevel;
          if (finalRiskScore >= 75) finalRiskLevel = 'Critical';
          else if (finalRiskScore >= 50) finalRiskLevel = 'High';
          else if (finalRiskScore >= 25) finalRiskLevel = 'Medium';

          await docRef.set({
            guildId: guild.id,
            guildName: guild.name,
            ownerId: owner?.id || 'Unknown',
            ownerUsername: owner?.user?.tag || 'Unknown',
            ownerAvatar: owner?.user?.displayAvatarURL() || '',
            memberCount: guild.memberCount,
            botCount,
            humanCount,
            verificationLevel: guild.verificationLevel,
            premiumTier: guild.premiumTier,
            premiumSubscriptionCount: guild.premiumSubscriptionCount || 0,
            joinedAt: Date.now(),
            riskScore: finalRiskScore,
            riskLevel: finalRiskLevel,
            status: 'Approved',
            lastUpdated: Date.now()
          });
          this.logSyncEvent(`Synced previously untracked guild "${guild.name}" to Approval System (Approved).`, 'success');
        }
      } catch (e) {
        console.error(`[Gateway] Failed to sync approval for guild ${guild.id}`, e);
      }
    }
  }

  public async handleApprovalAction(guildId: string, action: string, reason?: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    try {
      const owner = await guild.fetchOwner().catch(() => null);

      if (action === 'approve') {
        if (owner) {
          await owner.send(`✅ Your server **${guild.name}** has been approved for Rage Optimiser! Message me for having the dashboard.`).catch(() => {});
        }
        await this.forceDeployCommands(guildId).catch((err) => {
          console.error(`[Gateway] Failed to deploy commands for approved guild ${guildId}:`, err);
        });
      } else if (action === 'reject' || action === 'blacklist') {
        const textChannel = guild.channels.cache.find((c: any) => c.isTextBased() && c.permissionsFor(guild.members.me!)?.has('SendMessages'));
        const rejectMessage = `⚠️ The bot owner has deauthorized access for this server. Reason: ${reason || 'No reason provided'}. Leaving now...`;
        
        if (textChannel) {
          await (textChannel as any).send(rejectMessage).catch(() => {});
        }
        
        if (owner) {
          await owner.send(`❌ Your server **${guild.name}** was rejected from using Rage Optimiser. Reason: ${reason || 'No reason provided'}. The bot has left your server.`).catch(() => {});
        }
        
        await guild.leave();
      }
    } catch (e) {
      console.error(`[Gateway] Error handling approval action for guild ${guildId}`, e);
    }
  }
}
