import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits, ChannelType, Events } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { DiscordResourceRegistry, ModuleManifest, ModuleState } from './types.js';
import { IGuildApproval } from '../models/index.js';
import { Database } from './Database.js';
import { calculateRiskScore } from '../utils/riskScoring.js';
import { EmbedBuilder } from 'discord.js';
import type { PublicFeedManager } from './PublicFeedManager.js';
import { QueueManager } from '../modules/music/QueueManager.js';

export function wrapInteraction(interaction: any) {
  if (!interaction) return interaction;
  if (interaction._antigravity_wrapped) return interaction;
  interaction._antigravity_wrapped = true;

  const originalReply = interaction.reply ? interaction.reply.bind(interaction) : null;
  const originalDeferReply = interaction.deferReply ? interaction.deferReply.bind(interaction) : null;
  const originalEditReply = interaction.editReply ? interaction.editReply.bind(interaction) : null;
  const originalFollowUp = interaction.followUp ? interaction.followUp.bind(interaction) : null;
  const originalUpdate = interaction.update ? interaction.update.bind(interaction) : null;

  const handlePermError = (err: any) => {
    if (err && (err.code === 50013 || err.message?.includes('Missing Permissions') || err.message?.includes('50013'))) {
      console.warn(`[Music Warning] Cannot send reply in channel ${interaction.channelId || 'unknown'}: Missing Permissions (50013)`);
      return true;
    }
    return false;
  };

  if (originalDeferReply) {
    interaction.deferReply = async function(options?: any) {
      if (interaction.deferred || interaction.replied) return;
      try {
        return await originalDeferReply(options);
      } catch (err: any) {
        if (handlePermError(err)) return;
        console.warn('[wrapInteraction] deferReply failed:', err.message);
      }
    };
  }

  if (originalReply) {
    interaction.reply = async function(options?: any) {
      if (interaction.deferred && originalEditReply) {
        try {
          return await originalEditReply(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          if (originalFollowUp) {
            try {
              return await originalFollowUp(options);
            } catch (e: any) {
              if (handlePermError(e)) return;
              console.warn('[wrapInteraction] reply (as followUp) failed:', e.message);
            }
          }
        }
      } else if (interaction.replied && originalFollowUp) {
        try {
          return await originalFollowUp(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          console.warn('[wrapInteraction] reply (as followUp) failed:', err.message);
        }
      } else {
        try {
          return await originalReply(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          if ((err.code === 40060 || err.message?.includes('already acknowledged')) && originalEditReply) {
            try {
              return await originalEditReply(options);
            } catch (e: any) {
              if (handlePermError(e)) return;
              console.warn('[wrapInteraction] reply fallback to editReply failed:', e.message);
            }
          } else {
            throw err;
          }
        }
      }
    };
  }

  if (originalEditReply) {
    interaction.editReply = async function(options?: any) {
      if (!interaction.deferred && !interaction.replied && originalReply) {
        try {
          return await originalReply(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          if ((err.code === 40060 || err.message?.includes('already acknowledged')) && originalEditReply) {
            try {
              return await originalEditReply(options);
            } catch (e: any) {
              if (handlePermError(e)) return;
              console.warn('[wrapInteraction] editReply fallback to originalEditReply failed:', e.message);
            }
          } else {
            console.warn('[wrapInteraction] editReply (as reply) failed:', err.message);
          }
        }
      } else {
        try {
          return await originalEditReply(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          console.warn('[wrapInteraction] editReply failed:', err.message);
        }
      }
    };
  }

  if (originalFollowUp) {
    interaction.followUp = async function(options?: any) {
      try {
        return await originalFollowUp(options);
      } catch (err: any) {
        if (handlePermError(err)) return;
        console.warn('[wrapInteraction] followUp failed:', err.message);
      }
    };
  }

  if (originalUpdate) {
    interaction.update = async function(options?: any) {
      if (interaction.deferred || interaction.replied) {
        if (originalEditReply) {
          try {
            return await originalEditReply(options);
          } catch (err: any) {
            if (handlePermError(err)) return;
            console.warn('[wrapInteraction] update (as editReply) failed:', err.message);
          }
        }
      } else {
        try {
          return await originalUpdate(options);
        } catch (err: any) {
          if (handlePermError(err)) return;
          if ((err.code === 40060 || err.message?.includes('already acknowledged')) && originalEditReply) {
            try {
              return await originalEditReply(options);
            } catch (e: any) {
              if (handlePermError(e)) return;
              console.warn('[wrapInteraction] update fallback to editReply failed:', e.message);
            }
          } else {
            throw err;
          }
        }
      }
    };
  }

  return interaction;
}

export class Gateway {
  public client: Client;
  private manifests: ModuleManifest[] = [];
  private voiceConnection: any = null;
  private isConnectingVoice: boolean = false;
  private voiceRetryCount: number = 0;
  private lastVoiceChannelId: string | null = null;
  private voiceConnectTime: number | null = null;

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
    private getRegistry: () => DiscordResourceRegistry,
    private setRegistry: (reg: DiscordResourceRegistry) => void,
    private reevaluateModules: () => void,
    private broadcast: (msg: any) => void,
    private getModulesState: () => ModuleState[],
    private getGlobalSettings: () => Record<string, any>,
    private publicFeed: PublicFeedManager,
    private updateModuleConfig: (id: string, config: Record<string, any>) => ModuleState | null
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
    this.client.once(Events.ClientReady, async () => {
      console.log(`Discord client connected as ${this.client.user?.tag}`);
      this.logSyncEvent(`Discord gateway connected as ${this.client.user?.tag}`, 'success');
      await this.client.application?.fetch().catch(() => null);
      
      // Deploy commands to all guilds the bot is currently in on startup
      for (const [guildId] of this.client.guilds.cache) {
        await this.forceDeployCommands(guildId).catch((err) => {
          console.error(`[Gateway] Startup deploy failed for guild ${guildId}:`, err);
        });
      }

      // syncRegistry and syncApprovals are handled by Core bot
      // this.syncRegistry();
      // Voice presence for Music Bot
      setInterval(() => this.checkMusicVoicePresence(), 10000);
      setInterval(() => this.dispatchEvent('tick'), 10000);
      setTimeout(() => this.checkMusicVoicePresence(), 2000);
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
      if (guild.id === process.env.GUILD_ID) {
        await this.forceDeployCommands(guild.id).catch((err) => {
          console.error(`[Gateway] Failed to deploy commands for main guild ${guild.id}:`, err);
        });
        // BUG #2 FIX: Also sync main guild to Firestore as Approved so it's never marked Pending on reboot
        await this.syncApprovals().catch(() => {});
        return;
      }
      this.logSyncEvent(`Discord Event: Bot joined new guild "${guild.name}" (${guild.id}). Entering Pending Mode.`, 'warn');
      
      // Deploy slash commands to the newly joined guild instantly first!
      await this.forceDeployCommands(guild.id).catch((err) => {
        console.error(`[Gateway] Failed to deploy commands for new guild ${guild.id}:`, err);
      });

      try {
        // await guild.members.fetch(); // Ensure we have member counts
        
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
          const existing = await db.get<any>('SELECT status FROM approvals WHERE guildId = ?', [guild.id]);
          if (existing && existing.status === 'Blacklisted') {
            isBlacklisted = true;
          }
        }

        if (isBlacklisted) {
          await guild.leave();
          this.logSyncEvent(`Left blacklisted guild "${guild.name}".`, 'warn');
          return;
        }

        if (db) {
          const existing = await db.get<any>('SELECT status FROM approvals WHERE guildId = ?', [guild.id]);
          const status = existing ? existing.status : 'Pending';
          await db.run(
            `INSERT INTO approvals (
              guildId, guildName, ownerId, ownerUsername, memberCount, botCount, humanCount,
              verificationLevel, premiumTier, premiumSubscriptionCount, riskScore, riskLevel,
              status, joinedAt, lastUpdated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET
              guildName=excluded.guildName,
              ownerId=excluded.ownerId,
              ownerUsername=excluded.ownerUsername,
              memberCount=excluded.memberCount,
              botCount=excluded.botCount,
              humanCount=excluded.humanCount,
              verificationLevel=excluded.verificationLevel,
              premiumTier=excluded.premiumTier,
              premiumSubscriptionCount=excluded.premiumSubscriptionCount,
              riskScore=excluded.riskScore,
              riskLevel=excluded.riskLevel,
              lastUpdated=excluded.lastUpdated`,
            [
              guild.id,
              guild.name,
              owner.id,
              owner.user.username ?? owner.user.tag,
              guild.memberCount,
              botCount,
              humanCount,
              guild.verificationLevel,
              guild.premiumTier,
              guild.premiumSubscriptionCount || 0,
              finalRiskScore,
              finalRiskLevel,
              status,
              Date.now(),
              Date.now()
            ]
          );
        }

        // BUG #3 FIX: Removed duplicate owner DM — the main Core Bot already handles this notification.
        // Sending from both bots causes double-DM spam. Music bot stays silent on guild join.

      } catch (e) {
        console.error('[Gateway] Error handling guildCreate:', e);
      }
    });

    this.client.on('roleDelete', (role) => {
      this.logSyncEvent(role.guild.id, `Discord Event: Role "${role.name}" was deleted from guild.`, 'warn');
      const reg = this.getRegistry();
      reg.roles = reg.roles.filter(r => r.id !== role.id);
      this.setRegistry(reg);
      this.reevaluateModules();
      this.broadcast({ type: 'STATE_UPDATE', registry: reg });

      // Dispatch to modules
      this.dispatchEvent('roleDelete', role);
    });

    this.client.on('roleUpdate', (oldRole, newRole) => {
      if (oldRole.name !== newRole.name || oldRole.color !== newRole.color) {
        this.syncRegistry();
      }
      this.dispatchEvent('roleUpdate', oldRole, newRole);
    });

    this.client.on('channelDelete', (channel) => {
      this.logSyncEvent((channel as any).guild?.id, `Discord Event: Channel "${(channel as any).name || channel.id}" was deleted from guild.`, 'warn');
      const reg = this.getRegistry();
      reg.channels = reg.channels.filter(c => c.id !== channel.id);
      this.setRegistry(reg);
      this.reevaluateModules();
      this.broadcast({ type: 'STATE_UPDATE', registry: reg });

      // Dispatch to modules
      this.dispatchEvent('channelDelete', channel);

      const isPublic = (ch: any) => ch.permissionsFor?.(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      if (isPublic(channel)) {
        this.publicFeed?.addEvent('Server', `Channel **#${(channel as any).name}** was deleted`);
      }
    });

    this.client.on('channelCreate', (channel) => {
      this.syncRegistry();
      this.dispatchEvent('channelCreate', channel);

      const isPublic = (ch: any) => ch.permissionsFor?.(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      if (isPublic(channel)) {
        this.publicFeed?.addEvent('Server', `Channel **#${(channel as any).name}** was created`);
      }
    });

    this.client.on('channelUpdate', (oldChannel, newChannel) => {
      if ((oldChannel as any).name !== (newChannel as any).name) {
        this.logSyncEvent((newChannel as any).guild?.id, `Discord Event: Channel renamed from #${(oldChannel as any).name} to #${(newChannel as any).name}.`, 'info');
        this.syncRegistry();
      }
      this.dispatchEvent('channelUpdate', oldChannel, newChannel);
    });

    this.client.on('guildMemberUpdate', (oldMember, newMember) => {
      this.dispatchEvent('guildMemberUpdate', oldMember, newMember);
    });

    this.client.on('guildMemberAdd', (member) => {
      this.logSyncEvent(member.guild.id, `Discord Event: User "${member.user.username}" joined guild.`, 'info');
      this.syncRegistry();
      this.dispatchEvent('guildMemberAdd', member);
      this.publicFeed?.addEvent('Members', `**${member.user.username}** joined the server`);
    });

    this.client.on('guildMemberRemove', (member) => {
      this.logSyncEvent(member.guild.id, `Discord Event: User "${member.user.username}" left guild.`, 'info');
      this.syncRegistry();
      this.dispatchEvent('guildMemberRemove', member);
      this.publicFeed?.addEvent('Members', `**${member.user.username}** left the server`);
    });

    this.client.on('messageDelete', (message) => {
      this.dispatchEvent('messageDelete', message);
    });

    this.client.on('messageUpdate', (oldMessage, newMessage) => {
      this.dispatchEvent('messageUpdate', { oldMessage, newMessage });
    });

    this.client.on('messageCreate', (message) => {
      this.dispatchEvent('messageCreate', message);
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.dispatchEvent('voiceStateUpdate', { oldState, newState });

      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

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
    this.client.on('interactionCreate', async (rawInteraction) => {
      const interaction = wrapInteraction(rawInteraction);

      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        // SYSTEM MAINTENANCE MODE CHECK
        const settings = this.getGlobalSettings();
        if (settings.maintenanceMode) {
          const isOwner = interaction.user.id === interaction.guild?.ownerId || 
                          interaction.user.id === process.env.OWNER_ID ||
                          interaction.user.id === this.client.application?.owner?.id ||
                          ((this.client.application?.owner as any)?.members && (this.client.application?.owner as any).members.has(interaction.user.id));
          const member = interaction.member;
          // Check if admin
          let isAdmin = isOwner;
          if (!isAdmin && member && typeof member.permissions !== 'string') {
             isAdmin = (member.permissions as any).has(PermissionFlagsBits.Administrator);
          }
          
          if (!isAdmin) {
             this.logSyncEvent(`Blocked command /${commandName} from ${interaction.user.tag} due to active Maintenance Mode.`, 'warn');
             if (interaction.isRepliable()) {
               // BUG #12 FIX: Upgrade to premium embed instead of plain text
               await interaction.reply({
                 embeds: [
                   new EmbedBuilder()
                     .setTitle('🚧 Maintenance Mode Active')
                     .setDescription('The bot is currently in **lockdown mode**. All public commands are temporarily disabled.\n\nPlease check back shortly.')
                     .setColor(0xF59E0B)
                     .setFooter({ text: 'Rage Optimiser System' })
                     .setTimestamp()
                 ],
                 flags: 64
               }).catch(() => {});
             }
             return;
          }
        }

        this.logSyncEvent(`Slash command executed: /${commandName}`, 'info');

        // Dispatch command handler matching the active modules
        for (const manifest of this.manifests) {
          if (manifest.commands) {
            const cmd = manifest.commands.find(c => c.name === commandName);
            if (cmd) {
              const eventObj = manifest.events?.find(e => e.name === `command_${commandName}`);
              if (eventObj) {
                try {
                  await eventObj.handler(this.client, interaction, { 
                    logSyncEvent: (guildId: string | undefined, msg: string, type: 'info' | 'warn' | 'success') => this.logSyncEvent(guildId, msg, type),
                    getModulesState: this.getModulesState,
                    getRegistry: this.getRegistry,
                    updateModuleConfig: this.updateModuleConfig,
                    connect247: (guildId: string, channelId: string) => this.connect247(guildId, channelId),
                    handleApprovalAction: (g: string, a: string, r?: string) => this.handleApprovalAction(g, a, r)
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
      } else if (interaction.isStringSelectMenu()) {
        this.dispatchEvent(`select_${interaction.customId}`, interaction);
      } else if (interaction.isModalSubmit()) {
        this.dispatchEvent(`modal_${interaction.customId}`, interaction);
      }
    });
  }

  public async syncRegistry() {
    try {
      const guildId = process.env.GUILD_ID;
      if (!guildId) return;

      const guild = await this.client.guilds.fetch({ guild: guildId, withCounts: true } as any);
      if (!guild) return;

      const roles = await guild.roles.fetch();
      const channels = await guild.channels.fetch();

      // Fetch all members with presences to get a true 1:1 match with Discord sidebar
      // const members = await guild.members.fetch({ withPresences: true });
      const members = guild.members.cache;
      const exactOnlineCount = members.filter(m => m.presence && m.presence.status !== 'offline').size;

      const reg = this.getRegistry();
      reg.memberCount = guild.approximateMemberCount ?? guild.memberCount;
      reg.onlineCount = exactOnlineCount;

      reg.roles = roles.map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        membersCount: r.members.size,
        permissions: r.permissions.toArray()
      }));

      reg.channels = Array.from(channels.values())
        .filter((c): c is any => c !== null)
        .map(c => ({
          id: c.id,
          name: c.name,
          type: c.type === ChannelType.GuildCategory ? 'category' : (c.type === ChannelType.GuildVoice ? 'voice' : 'text'),
          category: c.parent ? c.parent.name : ''
        }));

      this.setRegistry(reg);
      this.reevaluateModules();
      this.broadcast({ type: 'STATE_UPDATE', registry: reg });
      this.logSyncEvent('Discord resource registry fetched from live Gateway.', 'success');
    } catch (err) {
      console.error('Failed to sync live Discord resources:', err);
    }
  }

  public async syncQuarantineQueue() {
    try {
      const guildId = process.env.GUILD_ID;
      if (!guildId) return;

      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;

      const modules = this.getModulesState();
      const secMod = modules.find(m => m.id === 'security');
      if (!secMod || !secMod.config.quarantineRoleId) return;

      const quarantineRoleId = secMod.config.quarantineRoleId;
      let currentQueue = secMod.config.quarantinedUsers || [];

      // const members = await guild.members.fetch();
      const members = guild.members.cache;
      const membersWithRole = members.filter(m => m.roles.cache.has(quarantineRoleId));

      // 1. Keep users who STILL have the role in Discord (if they are in the server)
      let newQueue = currentQueue.filter((u: any) => members.has(u.userId) ? members.get(u.userId)!.roles.cache.has(quarantineRoleId) : true);

      // 2. Add users who HAVE the role but aren't in the queue
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
        this.updateModuleConfig('security', { quarantinedUsers: newQueue });
        this.logSyncEvent(`Deep Sync: Rebuilt Quarantine Queue. Tracking ${newQueue.length} users.`, 'success');
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
      console.log(`Deploying ${commands.length} application commands to Guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      this.logSyncEvent('Slash commands successfully registered on Discord REST API.', 'success');
    } catch (error: any) {
      if (error.code === 50001 || error.status === 403) {
        console.warn(`[Gateway] Guild command registration failed with Missing Access (50001). Retrying globally...`);
        try {
          await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
          );
          this.logSyncEvent('Slash commands successfully registered globally as fallback.', 'success');
        } catch (globalErr) {
          console.error('[Gateway] Failed to deploy slash commands globally:', globalErr);
        }
      } else {
        console.error('Failed to deploy slash commands:', error);
      }
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
            logSyncEvent: (msg: string, type: 'info' | 'warn' | 'success') => this.logSyncEvent(guildId, msg, type),
            getModulesState: this.getModulesState,
            getRegistry: this.getRegistry,
            updateModuleConfig: this.updateModuleConfig
          });
        } catch (err) {
          console.error(`Error in event listener ${eventName} for module ${m.id}:`, err);
        }
      }
    });
  }

  private async disable247OnFailure(guildId: string, reason: string) {
    const modules = this.getModulesState ? this.getModulesState() : [];
    const musicModule = modules.find((m: any) => m.id === 'music');
    if (musicModule) {
      const config = { ...musicModule.config };
      config.twentyFourSevenMode = false;
      config.defaultMusicChannelId = '';
      this.updateModuleConfig('music', config);

      // Bug 10 Fix: Destroy the active queue/connection so the bot disconnects immediately.
      if (guildId) {
        try {
          QueueManager.deleteQueue(guildId);
        } catch (e) {
          console.error('[24/7] Failed to destroy queue on disable:', e);
        }
      }
      
      try {
        // Bug 4 Fix: Use the actual guildId — never fall back to 'GLOBAL' which breaks state recovery.
        const safeGuildId = guildId || 'UNKNOWN';
        await Database.run(
          `INSERT INTO music_247 (guildId, enabled, disabledBy, disabledAt) 
           VALUES (?, ?, ?, ?)
           ON CONFLICT(guildId) DO UPDATE SET enabled = 0, disabledBy = ?, disabledAt = ?`,
          [safeGuildId, 0, 'SYSTEM_AUTO_DISABLE', Date.now(), 'SYSTEM_AUTO_DISABLE', Date.now()]
        );
      } catch (err) {
        console.error('Error logging system auto disable 24/7 to SQLite:', err);
      }
    }
  }

  /**
   * Immediately join a voice channel for 24/7 mode.
   * Called directly by the /24-7-music command handler after enabling.
   */
  public async connect247(guildId: string, channelId: string, isRetry: boolean = false): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId)
                  ?? await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        this.logSyncEvent(guildId, `[24/7] Guild ${guildId} not found in cache — cannot connect.`, 'warn');
        return;
      }

      const channel = guild.channels.cache.get(channelId)
                    ?? await this.client.channels.fetch(channelId).catch(() => null) as any;
      if (!channel) {
        this.logSyncEvent(guildId, `[24/7] Voice channel ${channelId} not found/deleted.`, 'warn');
        if (!isRetry) {
          this.logSyncEvent(guildId, `[24/7] Retrying channel lookup once...`, 'warn');
          setTimeout(() => this.connect247(guildId, channelId, true), 5000);
        } else {
          this.logSyncEvent(guildId, `[24/7] Voice channel ${channelId} not found (Retry failed). Disabling 24/7.`, 'warn');
          await this.disable247OnFailure(guildId, `Voice channel ${channelId} was deleted.`);
        }
        return;
      }

      const me = guild.members.me || await guild.members.fetch(this.client.user!.id).catch(() => null);
      if (me) {
        const perms = channel.permissionsFor(me);
        if (!perms || !perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.Connect)) {
          if (!isRetry) {
            this.logSyncEvent(guildId, `[24/7] Lacks permissions to connect to #${channel.name}. Retrying once...`, 'warn');
            setTimeout(() => this.connect247(guildId, channelId, true), 5000);
          } else {
            this.logSyncEvent(guildId, `[24/7] Lacks permissions to connect to #${channel.name} (Retry failed). Disabling 24/7.`, 'warn');
            await this.disable247OnFailure(guildId, `Lacks ViewChannel/Connect permission on channel ${channelId}.`);
          }
          return;
        }
      }

      const existing = getVoiceConnection(guildId);
      if (existing && existing.joinConfig.channelId === channelId) {
        // Already in the right channel
        this.logSyncEvent(guildId, `[24/7] Already connected to #${channel.name}. No action needed.`, 'info');
        return;
      }

      this.logSyncEvent(guildId, `[24/7] Connecting to #${channel.name} in guild ${guild.name}...`, 'info');

      const queue = QueueManager.getQueue(guildId);
      // Bug 9 Fix: Always set queue.client so a re-created queue after destroy() has a valid reference.
      queue.client = this.client;

      const newConn = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator as any,
        selfDeaf: true,
        selfMute: false
      });

      queue.connection = newConn;
      queue.bindConnectionEvents(newConn);
      // Bug 8 Fix: Subscribe the audio player to the 24/7 connection so idle music can be heard.
      newConn.subscribe(queue.player);
      this.logSyncEvent(guildId, `[24/7] Successfully connected to #${channel.name} in guild ${guild.name}.`, 'success');
    } catch (err) {
      if (!isRetry) {
        this.logSyncEvent(guildId, `[24/7] Connection error: ${String(err)}. Retrying once...`, 'warn');
        setTimeout(() => this.connect247(guildId, channelId, true), 5000);
      } else {
        this.logSyncEvent(guildId, `[24/7] Connection error: ${String(err)} (Retry failed). Disabling 24/7.`, 'warn');
        await this.disable247OnFailure(guildId, `Connection error: ${String(err)}`);
      }
    }
  }

  private async checkMusicVoicePresence() {
    const modules = this.getModulesState ? this.getModulesState() : [];
    const musicModule = modules.find((m: any) => m.id === 'music');
    if (!musicModule) return;

    const config = musicModule.config || {};
    const channelId = config.defaultMusicChannelId;
    const is247 = config.twentyFourSevenMode;

    if (!is247 || !channelId) return;

    const channel = this.client.channels.cache.get(channelId)
                  ?? await this.client.channels.fetch(channelId).catch(() => null) as any;
    if (!channel) {
      const guild = this.client.guilds.cache.find((g: any) => 
        g.channels.cache.has(channelId)
      );
      const resolvedGuildId = guild?.id || '';
      this.logSyncEvent(resolvedGuildId || undefined, `[24/7] Configured voice channel ${channelId} was deleted or inaccessible. Disabling 24/7.`, 'warn');
      // Bug 4 Fix: Pass a real guildId instead of empty string so SQLite record uses correct key.
      await this.disable247OnFailure(resolvedGuildId, `Voice channel ${channelId} was deleted or inaccessible.`);
      return;
    }

    const guild = channel.guild;
    if (!guild) return;

    const guildId = guild.id;
    const currentConnection = getVoiceConnection(guildId);
    const queue = QueueManager.getQueue(guildId);
    if (!queue) return;

    const isPlaying = queue.currentTrack !== null;

    // Check permissions
    const me = guild.members.me || await guild.members.fetch(this.client.user!.id).catch(() => null);
    if (me) {
      const perms = channel.permissionsFor(me);
      if (!perms || !perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.Connect)) {
        this.logSyncEvent(guildId, `[24/7] Bot lacks permissions (ViewChannel/Connect) for voice channel #${channel.name}. Disabling 24/7.`, 'warn');
        await this.disable247OnFailure(guildId, `Bot lacks ViewChannel/Connect permission for channel #${channel.name}.`);
        return;
      }
    }

    // Connect if not connected anywhere in this guild
    if (!currentConnection) {
      await this.connect247(guildId, channelId);
    } else if (!isPlaying && currentConnection.joinConfig.channelId !== channelId) {
      // Return to default channel if idle past timeout
      const timeoutMins = config.autoDisconnectTimer || 5;
      if (!queue.idleSince) queue.idleSince = Date.now();
      if (Date.now() - queue.idleSince >= timeoutMins * 60 * 1000) {
        await this.connect247(guildId, channelId);
        queue.idleSince = null;
      }
    }
  }

  private async checkVoicePresence() {
    // OLD VOICE MODULE (CORE BOT) - DISABLED IN MUSIC BOT
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
        const docSnap = await db.get<any>('SELECT status FROM approvals WHERE guildId = ?', [guild.id]);
        
        if (!docSnap) {
          // await guild.members.fetch().catch(() => {});
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

          await db.run(
            `INSERT INTO approvals (
              guildId, guildName, ownerId, ownerUsername, memberCount, botCount, humanCount,
              verificationLevel, premiumTier, premiumSubscriptionCount, riskScore, riskLevel,
              status, joinedAt, lastUpdated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
            [
              guild.id,
              guild.name,
              owner?.id || 'Unknown',
              owner?.user?.tag || 'Unknown',
              guild.memberCount,
              botCount,
              humanCount,
              guild.verificationLevel,
              guild.premiumTier,
              guild.premiumSubscriptionCount || 0,
              finalRiskScore,
              finalRiskLevel,
              Date.now(),
              Date.now()
            ]
          );
          this.logSyncEvent(`Synced previously untracked guild "${guild.name}" to Approval System (Pending).`, 'warn');
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
