import { Client } from 'discord.js';
import { QueueManager } from '../../modules/music/QueueManager.js';
import { Database } from '../../core/Database.js';
import { DiscordStats } from '../types/index.js';

export class DiscordCollector {
  private client: Client;
  private gateway: any;

  // Event telemetry counters updated by the agent
  public commandsCount = 0;
  public messagesCount = 0;
  public interactionsCount = 0;
  public eventsCount = 0;

  private lastEventsCheckTime = Date.now();
  private lastEventsCount = 0;
  private currentEps = 0;

  constructor(gateway: any) {
    this.gateway = gateway;
    this.client = gateway.client;
  }

  public async collect(): Promise<DiscordStats> {
    const guilds = Array.from(this.client.guilds.cache.values());
    const guildCount = guilds.length;

    let memberCount = 0;
    let onlineMembers = 0;
    let cachedRoles = 0;

    for (const guild of guilds) {
      memberCount += guild.memberCount || 0;
      cachedRoles += guild.roles.cache.size || 0;
      
      // Online count approximation from presences cache
      const online = guild.members.cache.filter(
        m => m.presence && m.presence.status !== 'offline'
      ).size;
      onlineMembers += online;
    }

    const cachedChannels = this.client.channels.cache.size;
    const cachedEmojis = this.client.emojis.cache.size;
    const cachedThreads = this.client.channels.cache.filter(c => c.isThread()).size;

    // Active music sessions and voice connections
    let activeMusicSessions = 0;
    let activeVoiceConnections = 0;

    try {
      const queues = (QueueManager as any).queues;
      if (queues instanceof Map) {
        for (const queue of queues.values()) {
          if (queue.currentTrack) {
            activeMusicSessions++;
          }
          if (queue.connection && queue.connection.state?.status === 'connected') {
            activeVoiceConnections++;
          }
        }
      }
    } catch (err) {
      // Ignore failures
    }

    // Include 24/7 voice presence connections
    try {
      const guildVoiceState = (this.gateway as any).guildVoiceState;
      if (guildVoiceState instanceof Map) {
        for (const state of guildVoiceState.values()) {
          if (state.connection && state.connection.state?.status === 'connected') {
            activeVoiceConnections++;
          }
        }
      }
    } catch (err) {
      // Ignore
    }

    // Open tickets count from Database
    let openTickets = 0;
    try {
      const openTicketsResult = await Database.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM tickets WHERE status = 'open' OR status = 'Open'"
      ).catch(() => null);
      if (openTicketsResult) {
        openTickets = openTicketsResult.count;
      }
    } catch (err) {
      // Ignore
    }

    // Calculate Events Per Second (EPS)
    const now = Date.now();
    const elapsedSeconds = (now - this.lastEventsCheckTime) / 1000;
    if (elapsedSeconds >= 1.0) {
      const diffEvents = this.eventsCount - this.lastEventsCount;
      this.currentEps = Math.round((diffEvents / elapsedSeconds) * 10) / 10;
      this.lastEventsCheckTime = now;
      this.lastEventsCount = this.eventsCount;
    }

    return {
      guildCount,
      memberCount,
      onlineMembers,
      cachedChannels,
      cachedRoles,
      cachedEmojis,
      cachedThreads,
      commandsExecuted: this.commandsCount,
      messagesProcessed: this.messagesCount,
      interactions: this.interactionsCount,
      eventsPerSecond: this.currentEps,
      activeVoiceConnections,
      openTickets,
      activeMusicSessions,
    };
  }
}
