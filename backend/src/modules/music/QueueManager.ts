import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
  StreamType
} from '@discordjs/voice';
import play from 'play-dl';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import ffmpegPath from 'ffmpeg-static';
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} from 'discord.js';

export interface Track {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requester: string;
  artist?: string;
  uploadDate?: string;
  views?: string;
  platform?: 'YouTube' | 'Spotify' | 'SoundCloud';
}

export function getPlaybackProgress(queue: GuildQueue): { elapsedStr: string; durationStr: string; bar: string } {
  if (!queue.currentTrack) return { elapsedStr: '00:00', durationStr: '00:00', bar: '━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━' };
  
  let elapsedMs = 0;
  if (queue.playbackStartTime) {
    if (queue.pausedTime) {
      elapsedMs = queue.pausedTime - queue.playbackStartTime - queue.totalPausedDuration;
    } else {
      elapsedMs = Date.now() - queue.playbackStartTime - queue.totalPausedDuration;
    }
  }

  // Adjust for playback speed
  const elapsedSec = Math.max(0, Math.floor((elapsedMs * queue.speed) / 1000));
  
  // parse duration e.g. "03:45" or "01:23:45"
  const durParts = queue.currentTrack.duration.split(':').map(Number);
  let durSec = 0;
  if (durParts.length === 2) {
    durSec = durParts[0] * 60 + durParts[1];
  } else if (durParts.length === 3) {
    durSec = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];
  }
  
  if (isNaN(durSec) || durSec === 0) {
    durSec = 180; // fallback default
  }

  const progress = Math.min(elapsedSec / durSec, 1.0);
  const totalBarLength = 24;
  const dotPosition = Math.round(progress * totalBarLength);
  
  let bar = '';
  for (let i = 0; i <= totalBarLength; i++) {
    if (i === dotPosition) {
      bar += '●';
    } else {
      bar += '━';
    }
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return {
    elapsedStr: formatTime(elapsedSec),
    durationStr: formatTime(durSec),
    bar
  };
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
  
  // Premium properties
  public textChannelId: string | null = null;
  public panelMessageId: string | null = null;
  public activeFilters: string[] = [];
  public playHistory: Track[] = [];
  public favorites: Track[] = [];
  public playlists: { name: string; tracks: Track[] }[] = [];
  public speed: number = 1.0;
  public pitch: number = 1.0;
  public playbackStartTime: number | null = null;
  public pausedTime: number | null = null;
  public totalPausedDuration: number = 0;
  public progressInterval: NodeJS.Timeout | null = null;
  public viewMode: 'player' | 'queue' | 'filters' | 'volume' | 'lyrics' | 'settings' | 'playlists' = 'player';
  public queuePage: number = 0;
  public client: any = null;

  public voiceChannel: any = null;
  private queueLock = false;
  private retryCount = 0;

  private disconnectTimeout: NodeJS.Timeout | null = null;
  private currentProcess: ChildProcess | null = null;
  private ffmpegProcess: ChildProcess | null = null;

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

    this.player.on(AudioPlayerStatus.Playing, () => {
      this.retryCount = 0;
    });

    this.player.on('error', async (error) => {
      console.error(`Error playing audio in ${this.guildId}:`, error);
      if (this.currentTrack) {
        await this.handleTrackError(this.currentTrack, error);
      } else {
        await this.playNext();
      }
    });
  }

  private async lockQueue() {
    while (this.queueLock) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.queueLock = true;
  }

  private unlockQueue() {
    this.queueLock = false;
  }

  private setupConnection(voiceChannel: any) {
    this.voiceChannel = voiceChannel;
    if (!this.connection) {
      this.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      this.connection.subscribe(this.player);

      this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          console.log(`[Music Debug] Voice disconnected in guild ${this.guildId}. Attempting auto-reconnection...`);
          await Promise.race([
            entersState(this.connection!, VoiceConnectionStatus.Signalling, 5000),
            entersState(this.connection!, VoiceConnectionStatus.Connecting, 5000),
          ]);
          console.log(`[Music Debug] Voice successfully reconnected in guild ${this.guildId}`);
        } catch (error) {
          console.log(`[Music Debug] Auto-reconnect failed. Trying to rejoin voice channel...`);
          if (this.voiceChannel) {
            try {
              this.connection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.voiceChannel.guild.id,
                adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
              });
              this.connection.subscribe(this.player);
              console.log(`[Music Debug] Rejoined voice channel: ${this.voiceChannel.name}`);
              if (this.currentTrack) {
                await this.startStream(this.currentTrack);
              }
            } catch (rejoinErr) {
              console.error(`[Music Debug] Failed to rejoin voice channel:`, rejoinErr);
              this.destroy();
            }
          } else {
            this.destroy();
          }
        }
      });
    }
  }

  public async preloadNextTracks() {
    const maxPreload = 2;
    for (let i = 0; i < Math.min(this.queue.length, maxPreload); i++) {
      const track = this.queue[i];
      if (track.url.startsWith('search:')) {
        try {
          console.log(`[Music Debug] Preloading next track: "${track.title}"`);
          const query = track.url.replace('search:', '');
          const results = await play.search(query, { limit: 1 }).catch(() => []);
          if (results && results.length > 0) {
            track.url = results[0].url;
            if (results[0].title) track.title = results[0].title;
            if (results[0].durationRaw) track.duration = results[0].durationRaw;
            if (results[0].thumbnails?.[0]?.url) track.thumbnail = results[0].thumbnails[0].url;
            if (results[0].channel?.name) track.artist = results[0].channel.name;
            console.log(`[Music Debug] Preloaded track to: ${track.url}`);
          }
        } catch (err) {
          console.error(`[Music Debug] Preload failed for track "${track.title}":`, err);
        }
      }
    }
  }

  public async play(track: Track, voiceChannel: any) {
    await this.lockQueue();
    try {
      this.client = voiceChannel.client;
      this.textChannelId = this.textChannelId || voiceChannel.id;
      this.voiceChannel = voiceChannel;
      
      if (!voiceChannel) {
        throw new Error('You must be in a voice channel to play music.');
      }

      this.setupConnection(voiceChannel);

      if (this.disconnectTimeout) {
        clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = null;
      }
      this.idleSince = null;

      if (!this.currentTrack) {
        this.currentTrack = track;
        await this.startStream(track);
      } else {
        this.queue.push(track);
        await this.updatePanel(this.client);
      }

      this.preloadNextTracks().catch(() => {});
    } finally {
      this.unlockQueue();
    }
  }

  public async playPlaylist(tracks: Track[], voiceChannel: any) {
    await this.lockQueue();
    try {
      this.client = voiceChannel.client;
      this.textChannelId = this.textChannelId || voiceChannel.id;
      this.voiceChannel = voiceChannel;

      if (!voiceChannel) {
        throw new Error('You must be in a voice channel to play music.');
      }

      this.setupConnection(voiceChannel);

      if (this.disconnectTimeout) {
        clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = null;
      }
      this.idleSince = null;

      console.log(`[Music Debug] Queueing playlist of ${tracks.length} tracks.`);
      if (!this.currentTrack) {
        this.currentTrack = tracks[0];
        this.queue.push(...tracks.slice(1));
        await this.startStream(this.currentTrack);
      } else {
        this.queue.push(...tracks);
        await this.updatePanel(this.client);
      }

      this.preloadNextTracks().catch(() => {});
    } finally {
      this.unlockQueue();
    }
  }

  public async playNext() {
    await this.lockQueue();
    try {
      if (this.loopMode === 'track' && this.currentTrack) {
        await this.startStream(this.currentTrack);
        return;
      }

      if (this.loopMode === 'queue' && this.currentTrack) {
        this.queue.push(this.currentTrack);
      }

      const nextTrack = this.queue.shift();
      if (nextTrack) {
        this.currentTrack = nextTrack;
        await this.startStream(nextTrack);
      } else {
        // Queue is empty, start idle timeout
        this.currentTrack = null;
        this.playbackStartTime = null;
        this.totalPausedDuration = 0;
        this.pausedTime = null;
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }
        
        this.idleSince = Date.now();
        await this.updatePanel(this.client);

        // Disconnect after 2 minutes of inactivity
        if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = setTimeout(() => {
          if (!this.currentTrack && this.connection) {
            this.destroy();
          }
        }, 120000);
      }
    } finally {
      this.unlockQueue();
    }
  }

  private async handleTrackError(track: Track, error: any) {
    console.error(`[Music Debug] Error playing track "${track.title}":`, error);
    if (this.retryCount < 1) {
      this.retryCount++;
      console.log(`[Music Debug] Retrying failed track: "${track.title}" (Attempt 1/1)`);
      if (track.url.includes('youtube.com') || track.url.includes('youtu.be')) {
        track.url = `search:${track.title} ${track.artist || ''}`;
      }
      setTimeout(async () => {
        try {
          await this.startStream(track);
        } catch (retryErr) {
          await this.handleTrackError(track, retryErr);
        }
      }, 1500);
    } else {
      this.retryCount = 0;
      console.log(`[Music Debug] Track failed twice, skipping: "${track.title}"`);
      await this.playNext();
    }
  }

  private async startStream(nextTrack: Track) {
    if (this.currentProcess) {
      try {
        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.unpipe();
          this.currentProcess.stdout.destroy();
        }
        this.currentProcess.kill();
      } catch (e) {}
      this.currentProcess = null;
    }
    if (this.ffmpegProcess) {
      try {
        if (this.ffmpegProcess.stdin) {
          this.ffmpegProcess.stdin.end();
          this.ffmpegProcess.stdin.destroy();
        }
        if (this.ffmpegProcess.stdout) {
          this.ffmpegProcess.stdout.destroy();
        }
        this.ffmpegProcess.kill();
      } catch (e) {}
      this.ffmpegProcess = null;
    }

    try {
      let audioUrl = nextTrack.url;
      if (nextTrack.url.startsWith('search:')) {
        const query = nextTrack.url.replace('search:', '');
        const results = await play.search(query, { limit: 1 }).catch(() => []);
        if (results && results.length > 0) {
          audioUrl = results[0].url;
          nextTrack.url = audioUrl;
          if (results[0].title) nextTrack.title = results[0].title;
          if (results[0].durationRaw) nextTrack.duration = results[0].durationRaw;
          if (results[0].thumbnails?.[0]?.url) nextTrack.thumbnail = results[0].thumbnails[0].url;
          if (results[0].channel?.name) nextTrack.artist = results[0].channel.name;
        } else {
          throw new Error('Track not found via search stream import.');
        }
      }

      // Stream via yt-dlp binary
      const ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp.exe');
      const hasLocalYtDlp = fs.existsSync(ytDlpPath);
      const command = hasLocalYtDlp ? ytDlpPath : 'yt-dlp';

      this.currentProcess = spawn(command, [
        '-o', '-',
        '-f', 'bestaudio',
        '--no-playlist',
        audioUrl
      ]);

      this.currentProcess.on('error', (err) => {
        console.error('[Music] yt-dlp process spawn error:', err);
      });

      if (!this.currentProcess.stdout) throw new Error('Failed to create yt-dlp stdout');

      // Prevent EPIPE crash on yt-dlp stdout
      this.currentProcess.stdout.on('error', (err) => {
        console.warn('[Music Debug] yt-dlp stdout stream error (expected during skip):', err.message);
      });

      // Build FFmpeg filters
      const afFilters: string[] = [];
      
      // Volume filter
      afFilters.push(`volume=${this.volume / 100}`);

      // Speed & Pitch filters
      if (this.speed !== 1.0) {
        afFilters.push(`atempo=${this.speed}`);
      }

      if (this.pitch !== 1.0) {
        const rate = Math.round(48000 * this.pitch);
        afFilters.push(`asetrate=${rate}`);
        afFilters.push(`atempo=${(1 / this.pitch).toFixed(4)}`);
      }

      // Other active filters
      this.activeFilters.forEach(f => {
        if (f === 'bassboost') {
          afFilters.push('equalizer=f=60:width_type=o:width=2:g=12');
        } else if (f === 'nightcore') {
          afFilters.push('asetrate=48000*1.25,atempo=1.0');
        } else if (f === '8d') {
          afFilters.push('apulsator=hz=0.125');
        } else if (f === 'vaporwave') {
          afFilters.push('asetrate=48000*0.75,atempo=1.0');
        } else if (f === 'treble') {
          afFilters.push('equalizer=f=3000:width_type=h:width=200:g=10');
        } else if (f === 'karaoke') {
          afFilters.push('pan=stereo|c0=c0-c1|c1=c1-c0');
        } else if (f === 'reverb') {
          afFilters.push('aecho=0.8:0.88:60:0.4');
        } else if (f === 'surround') {
          afFilters.push('apulsator=hz=0.25');
        } else if (f === 'normalize') {
          afFilters.push('loudnorm');
        }
      });

      const ffmpegArgs = [
        '-i', 'pipe:0',
      ];

      if (afFilters.length > 0) {
        ffmpegArgs.push('-af', afFilters.join(','));
      }

      ffmpegArgs.push(
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      );

      const actualFfmpeg = (ffmpegPath as any) || 'ffmpeg';
      this.ffmpegProcess = spawn(actualFfmpeg, ffmpegArgs);

      this.ffmpegProcess.on('error', (err) => {
        console.error('[Music] ffmpeg process spawn error:', err);
      });

      if (this.currentProcess && this.currentProcess.stdout && this.ffmpegProcess && this.ffmpegProcess.stdin) {
        // Prevent EPIPE crash on ffmpeg streams
        this.ffmpegProcess.stdin.on('error', (err) => {
          console.warn('[Music Debug] ffmpeg stdin stream error (expected during skip):', err.message);
        });
        if (this.ffmpegProcess.stdout) {
          this.ffmpegProcess.stdout.on('error', (err) => {
            console.warn('[Music Debug] ffmpeg stdout stream error (expected during skip):', err.message);
          });
        }

        this.currentProcess.stdout.pipe(this.ffmpegProcess.stdin as any);
      } else {
        throw new Error('Failed to pipe stdout of yt-dlp to stdin of ffmpeg');
      }

      if (!this.ffmpegProcess || !this.ffmpegProcess.stdout) throw new Error('Failed to create ffmpeg stdout');

      const resource = createAudioResource(this.ffmpegProcess.stdout as any, {
        inputType: StreamType.Raw
      });

      this.player.play(resource);
      console.log(`[Music] Player started playing resource via yt-dlp & FFmpeg with filters: ${afFilters.join(',') || 'none'}.`);

      // Track playback start times
      this.playbackStartTime = Date.now();
      this.totalPausedDuration = 0;
      this.pausedTime = null;

      // Start progress update interval
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
      }
      this.progressInterval = setInterval(() => {
        if (this.player.state.status === AudioPlayerStatus.Playing) {
          this.updatePanel(this.client);
        }
      }, 5000);

      // Send/edit control panel message
      await this.updatePanel(this.client);
      
      // Add to play history
      if (!this.playHistory.find(t => t.url === nextTrack.url)) {
        this.playHistory.unshift(nextTrack);
        if (this.playHistory.length > 50) this.playHistory.pop();
      }

      this.preloadNextTracks().catch(() => {});

    } catch (err) {
      await this.handleTrackError(nextTrack, err);
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
      try {
        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.unpipe();
          this.currentProcess.stdout.destroy();
        }
        this.currentProcess.kill();
      } catch (e) {}
      this.currentProcess = null;
    }
    if (this.ffmpegProcess) {
      try {
        if (this.ffmpegProcess.stdin) {
          this.ffmpegProcess.stdin.end();
          this.ffmpegProcess.stdin.destroy();
        }
        if (this.ffmpegProcess.stdout) {
          this.ffmpegProcess.stdout.destroy();
        }
        this.ffmpegProcess.kill();
      } catch (e) {}
      this.ffmpegProcess = null;
    }
  }

  public pause() {
    this.player.pause();
    this.pausedTime = Date.now();
    this.updatePanel(this.client).catch(() => {});
  }

  public resume() {
    this.player.unpause();
    if (this.pausedTime) {
      this.totalPausedDuration += Date.now() - this.pausedTime;
      this.pausedTime = null;
    }
    this.updatePanel(this.client).catch(() => {});
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
      try {
        if (this.currentProcess.stdout) {
          this.currentProcess.stdout.unpipe();
          this.currentProcess.stdout.destroy();
        }
        this.currentProcess.kill();
      } catch (e) {}
      this.currentProcess = null;
    }
    if (this.ffmpegProcess) {
      try {
        if (this.ffmpegProcess.stdin) {
          this.ffmpegProcess.stdin.end();
          this.ffmpegProcess.stdin.destroy();
        }
        if (this.ffmpegProcess.stdout) {
          this.ffmpegProcess.stdout.destroy();
        }
        this.ffmpegProcess.kill();
      } catch (e) {}
      this.ffmpegProcess = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  public async openControls(client: any) {
    if (this.panelMessageId && this.textChannelId) {
      try {
        const channel = await client.channels.fetch(this.textChannelId).catch(() => null);
        if (channel) {
          const oldMsg = await channel.messages.fetch(this.panelMessageId).catch(() => null);
          if (oldMsg) {
            await oldMsg.delete().catch(() => {});
          }
        }
      } catch (e) {}
    }
    this.panelMessageId = null;
    await this.updatePanel(client);
  }

  public async broadcastState() {
    if (!this.client) return;
    
    // Calculate progress details
    const { elapsedStr, durationStr, bar } = getPlaybackProgress(this);
    
    let voiceChannelName = 'Disconnected';
    let listeners = 0;
    if (this.connection?.joinConfig.channelId) {
      const vc = await this.client.channels.fetch(this.connection.joinConfig.channelId).catch(() => null);
      if (vc) {
        voiceChannelName = vc.name;
        listeners = vc.members.filter((m: any) => !m.user.bot).size;
      }
    }

    const platform = this.currentTrack 
      ? (this.currentTrack.platform || (this.currentTrack.url.includes('spotify') ? 'Spotify' : this.currentTrack.url.includes('soundcloud') ? 'SoundCloud' : 'YouTube'))
      : 'N/A';

    const statePayload = {
      type: 'MUSIC_STATE_UPDATE',
      guildId: this.guildId,
      state: {
        currentTrack: this.currentTrack,
        queue: this.queue,
        volume: this.volume,
        speed: this.speed,
        pitch: this.pitch,
        loopMode: this.loopMode,
        activeFilters: this.activeFilters,
        paused: this.player.state.status === AudioPlayerStatus.Paused,
        elapsedStr,
        durationStr,
        bar,
        voiceChannelName,
        listeners,
        platform,
        viewMode: this.viewMode
      }
    };

    const CORE_API = `http://localhost:${process.env.PORT || 5000}`;
    fetch(`${CORE_API}/api/internal/music/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statePayload)
    }).catch(() => {});
  }

  public async updatePanel(client: any) {
    if (!this.textChannelId || !client) return;

    try {
      const channel = await client.channels.fetch(this.textChannelId).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder();
      const components: any[] = [];

      if (!this.currentTrack) {
        // No song is currently playing
        embed.setTitle('🎵 Spotify Persistent Engine')
          .setDescription('**No music is currently playing in this guild.**\n\nInvite users to join a voice channel and play a track via `r!play <query>` or add songs from the dashboard.')
          .setColor('#1DB954')
          .setTimestamp()
          .setFooter({ text: 'Rage Optimiser Audio Engine' });

        embed.addFields({
          name: '🎵 Discover Trending',
          value: '🔹 `1.` Chill Lofi Beats to Study/Relax\n🔹 `2.` Synthwave Neon Drive Mix\n🔹 `3.` Cyberpunk Tokyo Drift Theme',
          inline: false
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('music_view_playlists').setLabel('📥 View Playlists').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music_trending_songs').setLabel('🔥 Trending').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music_discover').setLabel('🎵 Discover').setStyle(ButtonStyle.Secondary)
        );
        components.push(row);
      } else {
        if (this.viewMode === 'player') {
          const { elapsedStr, durationStr, bar } = getPlaybackProgress(this);
          
          embed.setTitle('🎵 NOW PLAYING')
            .setColor('#1DB954')
            .setTimestamp()
            .setFooter({ text: 'Rage Optimiser • Audio System' });

          if (this.currentTrack.url && this.currentTrack.url.startsWith('http')) {
            embed.setURL(this.currentTrack.url);
          }

          const hasValidUrl = this.currentTrack.url && this.currentTrack.url.startsWith('http');
          const titleMarkdown = hasValidUrl ? `**[${this.currentTrack.title}](${this.currentTrack.url})**` : `**${this.currentTrack.title}**`;

          embed.setDescription(`${titleMarkdown}\nby **${this.currentTrack.artist || 'Various Artists'}**\n\n${bar}\n\`${elapsedStr} / ${durationStr}\` • Requested by: **${this.currentTrack.requester}**`);

          if (this.currentTrack.thumbnail) {
            embed.setImage(this.currentTrack.thumbnail);
          }

          let voiceChannelName = 'Disconnected';
          let listeners = 0;
          
          if (this.connection?.joinConfig.channelId) {
            const vc = await client.channels.fetch(this.connection.joinConfig.channelId).catch(() => null);
            if (vc) {
              voiceChannelName = vc.name;
              listeners = vc.members.filter((m: any) => !m.user.bot).size;
            }
          }

          const platform = this.currentTrack.platform || (this.currentTrack.url.includes('spotify') ? 'Spotify' : this.currentTrack.url.includes('soundcloud') ? 'SoundCloud' : 'YouTube');

          embed.addFields(
            { name: '🔊 Connection', value: `Voice: **🔊 ${voiceChannelName}**\nListeners: **${listeners}**`, inline: true },
            { name: '⚙️ Control Matrix', value: `Volume: **${this.volume}%**\nSpeed: **${this.speed}x** | Pitch: **${this.pitch}x**\nLoop: **${this.loopMode}**`, inline: true },
            { name: '💿 Platform', value: `Source: **${platform}**\nQueue: **${this.queue.length} tracks**`, inline: true }
          );

          // Row 1: Primary Controls
          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_prev').setLabel('⏮ Previous').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_play_pause').setLabel(this.player.state.status === AudioPlayerStatus.Paused ? '▶️ Resume' : '⏸️ Pause').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_loop').setLabel('🔁 Loop').setStyle(this.loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary)
          );

          // Row 2: Secondary Controls
          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_queue_btn').setLabel('📜 Queue').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_filters_btn').setLabel('🎚 Filters').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_volume_btn').setLabel('🔊 Volume').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_lyrics').setLabel('🎤 Lyrics').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_settings').setLabel('⚙ Settings').setStyle(ButtonStyle.Secondary)
          );

          components.push(row1, row2);

        } else if (this.viewMode === 'queue') {
          const hasValidUrl = this.currentTrack.url && this.currentTrack.url.startsWith('http');
          const titleMarkdown = hasValidUrl ? `[${this.currentTrack.title}](${this.currentTrack.url})` : `**${this.currentTrack.title}**`;
          embed.setTitle('📋 CURRENT PLAYBACK QUEUE')
            .setDescription(`▶️ **Now Playing**: ${titleMarkdown} (Duration: \`${this.currentTrack.duration}\` • Requested by: **${this.currentTrack.requester}**)\n\n**Upcoming Tracks:**`)
            .setColor('#1DB954');

          const itemsPerPage = 6;
          const totalPages = Math.ceil(this.queue.length / itemsPerPage) || 1;
          const page = Math.min(this.queuePage, totalPages - 1);
          
          const startIdx = page * itemsPerPage;
          const endIdx = startIdx + itemsPerPage;
          const pageTracks = this.queue.slice(startIdx, endIdx);

          if (pageTracks.length === 0) {
            embed.addFields({ name: 'Upcoming Queue', value: '*No upcoming songs. Use commands or dashboard to add tracks.*' });
          } else {
            pageTracks.forEach((t, i) => {
              embed.addFields({
                name: `${startIdx + i + 1}. ${t.title.slice(0, 75)}`,
                value: `Duration: \`${t.duration}\` • Requested By: **${t.requester}**`,
                inline: false
              });
            });
          }

          let totalSecs = 0;
          this.queue.forEach(track => {
            const parts = track.duration.split(':').map(Number);
            if (parts.length === 2) totalSecs += parts[0] * 60 + parts[1];
            else if (parts.length === 3) totalSecs += parts[0] * 3600 + parts[1] * 60 + parts[2];
          });
          const estHrs = Math.floor(totalSecs / 3600);
          const estMins = Math.floor((totalSecs % 3600) / 60);

          embed.addFields({
            name: '⏱️ Queue Estimations',
            value: `• **Total Duration**: ${estHrs > 0 ? `${estHrs}h ` : ''}${estMins}m\n• **Est. Finish Time**: <t:${Math.floor((Date.now() + totalSecs * 1000) / 1000)}:t> (<t:${Math.floor((Date.now() + totalSecs * 1000) / 1000)}:R>)`,
            inline: false
          });

          embed.setFooter({ text: `Page ${page + 1} of ${totalPages}` });

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_queue_prev').setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId('music_queue_next').setLabel('➡️ Next').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back to Player').setStyle(ButtonStyle.Primary)
          );
          components.push(row1);

        } else if (this.viewMode === 'filters') {
          embed.setTitle('🎚️ DSP AUDIO EFFECTS BOARD')
            .setDescription(`Configure DSP filters for real-time frequency modification.\n\nActive Filters: ${this.activeFilters.length > 0 ? this.activeFilters.map(f => `\`${f}\``).join(', ') : 'None'}`)
            .setColor('#1DB954');

          const filtersList = [
            { name: 'Bass Boost', key: 'bassboost', desc: 'Amplifies low-end frequencies.' },
            { name: 'Nightcore', key: 'nightcore', desc: 'Increases speed and pitch.' },
            { name: '8D Audio', key: '8d', desc: 'Rotary surround sound pan.' },
            { name: 'Vaporwave', key: 'vaporwave', desc: 'Slows down pitch & tempo.' },
            { name: 'Treble Boost', key: 'treble', desc: 'Enhances high-end clarity.' },
            { name: 'Reverb', key: 'reverb', desc: 'Simulates spatial audio echo.' }
          ];

          filtersList.forEach(f => {
            const isEnabled = this.activeFilters.includes(f.key);
            embed.addFields({
              name: `${isEnabled ? '🟢' : '⚫'} ${f.name}`,
              value: `${f.desc}`,
              inline: true
            });
          });

          // Show speed & pitch status in description/fields
          embed.addFields({
            name: '⚡ Speed & Pitch Tweaks',
            value: `Speed multiplier: **${this.speed}x** • Pitch multiplier: **${this.pitch}x**`,
            inline: false
          });

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_toggle_bassboost').setLabel('Bass Boost').setStyle(this.activeFilters.includes('bassboost') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_nightcore').setLabel('Nightcore').setStyle(this.activeFilters.includes('nightcore') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_8d').setLabel('8D Audio').setStyle(this.activeFilters.includes('8d') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_vaporwave').setLabel('Vaporwave').setStyle(this.activeFilters.includes('vaporwave') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_treble').setLabel('Treble').setStyle(this.activeFilters.includes('treble') ? ButtonStyle.Success : ButtonStyle.Secondary)
          );

          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_toggle_reverb').setLabel('Reverb').setStyle(this.activeFilters.includes('reverb') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_speed_plus').setLabel('Speed +0.1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_speed_minus').setLabel('Speed -0.1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_pitch_plus').setLabel('Pitch +0.1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_toggle_pitch_minus').setLabel('Pitch -0.1').setStyle(ButtonStyle.Secondary)
          );

          const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_reset_filters').setLabel('Reset Filters').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back to Player').setStyle(ButtonStyle.Primary)
          );

          components.push(row1, row2, row3);

        } else if (this.viewMode === 'volume') {
          const barLength = 10;
          const filledLength = Math.round((this.volume / 200) * barLength);
          let volBar = '';
          for (let i = 0; i < barLength; i++) {
            if (i < filledLength) volBar += '█';
            else volBar += '░';
          }
          
          embed.setTitle('🔊 VOLUME MATRIX')
            .setDescription(`Adjust playback volume output levels.\n\nVolume: \`[${volBar}] ${this.volume}%\``)
            .setColor('#1DB954');

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_volume_minus').setLabel('-10%').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_volume_plus').setLabel('+10%').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_volume_mute').setLabel(this.volume === 0 ? '🔊 Unmute' : '🔇 Mute').setStyle(this.volume === 0 ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_volume_100').setLabel('100%').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back').setStyle(ButtonStyle.Primary)
          );
          components.push(row1);

        } else if (this.viewMode === 'lyrics') {
          embed.setTitle('🎤 SYNCED LYRICS')
            .setDescription(`**Now Playing**: [${this.currentTrack.title}](${this.currentTrack.url})\n\n*Instrumental / Lyrics fetching is currently operating in local mode.*\n\n🎵 *La la la...* (Connect your Genius API key in dashboard settings for full real-time lyric scrolling integrations).`)
            .setColor('#1DB954');

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back to Player').setStyle(ButtonStyle.Primary)
          );
          components.push(row1);

        } else if (this.viewMode === 'settings') {
          embed.setTitle('⚙️ PLAYER CONFIGURATION')
            .setDescription(`Configure operational options.\n\n` +
              `• **Autoplay**: ${this.autoplay ? '🟢 Enabled' : '⚫ Disabled'}\n` +
              `• **Loop Mode**: \`${this.loopMode}\``)
            .setColor('#1DB954');

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_settings').setLabel(this.autoplay ? 'Disable Autoplay' : 'Enable Autoplay').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_loop').setLabel('Cycle Loop Mode').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back to Player').setStyle(ButtonStyle.Primary)
          );
          components.push(row1);

        } else if (this.viewMode === 'playlists') {
          embed.setTitle('📥 PLAYLIST ENGINE')
            .setDescription(`Manage server and personal saved music sequences.\n\n` +
              `• **Saved Playlists**: ${this.playlists.length} playlists stored\n` +
              `• **Favorites**: ${this.favorites.length} tracks liked`)
            .setColor('#1DB954');

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('music_save_playlist').setLabel('📥 Save Current Queue').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_favorite').setLabel('❤️ Favorite Current').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_view_player').setLabel('🔙 Back to Player').setStyle(ButtonStyle.Primary)
          );
          components.push(row1);
        }
      }

      // Send or Edit message
      if (this.panelMessageId) {
        const msg = await channel.messages.fetch(this.panelMessageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed], components }).catch(() => {});
          await this.broadcastState();
          return;
        }
      }

      const newMsg = await channel.send({ embeds: [embed], components }).catch(() => null);
      if (newMsg) {
        this.panelMessageId = newMsg.id;
      }
      await this.broadcastState();
    } catch (err) {
      console.error('[Music] Error rendering control panel:', err);
    }
  }
}

export class QueueManager {
  public static registry: any = null;
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
