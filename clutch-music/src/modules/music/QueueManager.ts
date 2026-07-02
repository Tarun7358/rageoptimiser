import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState
} from '@discordjs/voice';
import play from 'play-dl';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { registry } from '../../index.js';

export interface Track {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requester: string;
}

export class GuildQueue {
  public guildId: string;
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer;
  public queue: Track[] = [];
  public currentTrack: Track | null = null;
  public loopMode: 'off' | 'track' | 'queue' = 'off';
  public volume: number = 100;
  public autoplay: boolean = false;
  public idleSince: number | null = null;
  
  private disconnectTimeout: NodeJS.Timeout | null = null;
  private currentProcess: ChildProcess | null = null;

  constructor(guildId: string) {
    this.guildId = guildId;
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });

    this.player.on('error', (error) => {
      console.error(`Error playing audio in ${this.guildId}:`, error);
      this.playNext();
    });
  }

  public async play(track: Track, channel: any) {
    if (!this.connection || this.connection.joinConfig.channelId !== channel.id) {
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      this.connection.on(VoiceConnectionStatus.Disconnected, () => {
        this.destroy();
      });

      this.connection.subscribe(this.player);
      
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
      } catch (error) {
        console.error('Failed to connect to voice channel within 20s', error);
        this.destroy();
        return;
      }
    }

    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
    
    this.idleSince = null;

    this.queue.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.loopMode === 'track' && this.currentTrack) {
      this.queue.unshift(this.currentTrack); // replay current
    } else if (this.loopMode === 'queue' && this.currentTrack) {
      this.queue.push(this.currentTrack); // add current to end
    }

    const nextTrack = this.queue.shift();
    if (!nextTrack) {
      this.currentTrack = null;
      this.idleSince = Date.now();
      
      const modules = registry.getModulesState ? registry.getModulesState() : [];
      const musicModule = modules.find(m => m.id === 'music');
      const config = musicModule?.config || {};
      
      if (!config.twentyFourSevenMode) {
        const timerMins = config.autoDisconnectTimer || 5;
        this.disconnectTimeout = setTimeout(() => {
          this.destroy();
        }, timerMins * 60000);
      }
      return;
    }

    this.currentTrack = nextTrack;
    try {
      console.log(`[Music] Attempting to stream with yt-dlp: ${nextTrack.url}`);
      
      let query = nextTrack.url;
      
      // If it's a Spotify search deferred track, tell yt-dlp to search youtube natively!
      if (query.startsWith('search:')) {
        query = `ytsearch1:${query.replace('search:', '')}`;
      }

      if (this.currentProcess) {
        try { this.currentProcess.kill(); } catch (e) {}
      }

      const ytdlpPath = path.join(process.cwd(), 'yt-dlp.exe');
      
      this.currentProcess = spawn(ytdlpPath, [
        query,
        '-o', '-',             // Output directly to stdout
        '-q',                  // Quiet mode
        '-f', 'bestaudio',     // Grab the best audio format available
        '--no-playlist'        // Ensure it doesn't try to download a full playlist
      ]);

      this.currentProcess.on('error', (err) => {
        console.error('[Music] yt-dlp spawn error:', err);
      });

      if (!this.currentProcess.stdout) throw new Error('Failed to create yt-dlp stdout');

      const resource = createAudioResource(this.currentProcess.stdout);

      this.player.play(resource);
      console.log(`[Music] Player started playing resource via yt-dlp.`);
    } catch (err) {
      console.error('[Music] Play stream error:', err);
      this.playNext();
    }
  }

  public skip() {
    this.player.stop(); // triggers Idle which calls playNext
  }

  public stop() {
    this.queue = [];
    this.loopMode = 'off';
    this.player.stop();
    if (this.currentProcess) {
      try { this.currentProcess.kill(); } catch (e) {}
      this.currentProcess = null;
    }
  }

  public pause() {
    this.player.pause();
  }

  public resume() {
    this.player.unpause();
  }

  public destroy() {
    this.stop();
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (e) {}
    }
    this.connection = null;
    if (this.currentProcess) {
      try { this.currentProcess.kill(); } catch (e) {}
      this.currentProcess = null;
    }
  }
}

export class QueueManager {
  private static queues: Map<string, GuildQueue> = new Map();

  public static getQueue(guildId: string): GuildQueue {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new GuildQueue(guildId);
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  public static deleteQueue(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.destroy();
      this.queues.delete(guildId);
    }
  }
}
