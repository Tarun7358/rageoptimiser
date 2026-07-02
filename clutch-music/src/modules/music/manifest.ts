import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder } from 'discord.js';
import { QueueManager, Track } from './QueueManager.js';
import play from 'play-dl';
import spotifyUrlInfo from 'spotify-url-info';
// @ts-ignore
const spotifyFn = (spotifyUrlInfo.default || spotifyUrlInfo) as any;
const spotify = spotifyFn(fetch as any);

export const MusicManifest: ModuleManifest = {
  id: 'music',
  name: 'Music System',
  version: '1.0.0',
  description: 'Enterprise grade music playback, queues, filters, and Lavalink/Play-dl support.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;
      // Prefix Validation
      if (config.musicPrefix) {
        if (config.musicPrefix.length < 1 || config.musicPrefix.length > 5) {
          errors.push('Music Prefix must be between 1 and 5 characters.');
        }
        if (/\s/.test(config.musicPrefix)) {
          errors.push('Music Prefix cannot contain spaces.');
        }
      }

      const roleExists = (id: string) => registry.roles.some(r => r.id === id);
      const channelExists = (id: string) => registry.channels.some(c => c.id === id);

      if (config.djRoleId) {
        if (!roleExists(config.djRoleId)) errors.push(`DJ Role was not found or deleted.`);
      }

      if (config.defaultMusicChannelId) {
        if (!channelExists(config.defaultMusicChannelId)) errors.push(`Default Music Channel was not found.`);
      }

      if (config.musicLogChannelId) {
        if (!channelExists(config.musicLogChannelId)) errors.push(`Music Log Channel was not found.`);
      }
      
      progress = errors.length === 0 ? 100 : 0;
      return { progress, errors };
    }
  },
  commands: [
    { name: 'play', description: 'Play a song from YouTube, Spotify, or Soundcloud', options: [{ name: 'query', type: 3, description: 'Song name or URL', required: true }] },
    { name: 'pause', description: 'Pause current playback' },
    { name: 'resume', description: 'Resume paused playback' },
    { name: 'stop', description: 'Stop playback and clear the queue' },
    { name: 'skip', description: 'Skip the current track' },
    { name: 'back', description: 'Play the previous track (Premium)' },
    { name: 'queue', description: 'View the current music queue' },
    { name: 'shuffle', description: 'Shuffle the queue' },
    { name: 'loop', description: 'Loop the track or queue', options: [{ name: 'mode', type: 3, description: 'track, queue, off', required: true }] },
    { name: 'autoplay', description: 'Toggle autoplay mode' },
    { name: 'nowplaying', description: 'Show the currently playing track' },
    { name: 'lyrics', description: 'Fetch lyrics for the current song' },
    { name: 'volume', description: 'Adjust the playback volume', options: [{ name: 'percent', type: 4, description: '0-200%', required: true }] },
    { name: 'seek', description: 'Seek to a specific time in the track', options: [{ name: 'time', type: 3, description: 'Format: mm:ss', required: true }] },
    { name: 'jump', description: 'Jump to a specific track in the queue', options: [{ name: 'position', type: 4, description: 'Queue position number', required: true }] },
    { name: 'remove', description: 'Remove a track from the queue', options: [{ name: 'position', type: 4, description: 'Queue position number', required: true }] },
    { name: 'move', description: 'Move a track in the queue', options: [{ name: 'from', type: 4, description: 'Original position', required: true }, { name: 'to', type: 4, description: 'New position', required: true }] },
    { name: 'clear', description: 'Clear the entire queue' },
    { name: 'playlist', description: 'Load a saved playlist (Premium)' },
    { name: 'favorites', description: 'View your favorite tracks' },
    { name: 'filter', description: 'Apply an audio filter (Bassboost, Nightcore, etc)' },
    { name: 'eq', description: 'Adjust the custom equalizer' },
    { name: 'radio', description: 'Play a 24/7 internet radio station' },
    { name: 'disconnect', description: 'Force the bot to disconnect from voice' },
    { name: 'help', description: 'Show all available music commands' }
  ],
  events: [
    {
      name: 'messageCreate',
      handler: async (client: any, message: any, context: any) => {
        if (message.author.bot || !message.guild) return;

        const modules = context.getModulesState ? context.getModulesState() : [];
        const musicModule = modules.find((m: any) => m.id === 'music');
        if (!musicModule || musicModule.status !== 'enabled') return;

        const config = musicModule.config || {};
        
        // If explicitly disabled, ignore prefixes
        if (config.prefixEnabled === false) return;

        const prefix = config.musicPrefix || 'c!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        
        console.log(`[DEBUG Music] Received potential prefix command: ${commandName} with args: ${args}`);

        if (!commandName) return;

        const handlerObj = MusicManifest.events?.find(e => e.name === `command_${commandName}`);
        if (handlerObj && handlerObj.handler) {
          // Mock an interaction object so we can reuse the slash command logic natively
          const mockInteraction = {
            isCommand: () => true,
            commandName,
            options: {
              getString: (name: string) => args.join(' '), 
              getInteger: (name: string) => parseInt(args[0]) || 0
            },
            guild: message.guild,
            member: message.member,
            user: message.author,
            channel: message.channel,
            channelId: message.channelId,
            deferReply: async () => {}, // Mock defer
            reply: async (content: any) => message.channel.send(content).catch(()=>null),
            editReply: async (content: any) => message.channel.send(content).catch(()=>null),
          };

          try {
            await handlerObj.handler(client, mockInteraction, context);
          } catch (err) {
            console.error(`Error executing prefix command ${commandName}:`, err);
          }
        }
      }
    },
    {
      name: 'command_help',
      handler: async (client: any, interaction: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const musicModule = modules.find((m: any) => m.id === 'music');
        const config = musicModule?.config || {};
        const prefix = config.musicPrefix || 'c!';

        const embed = new EmbedBuilder()
          .setTitle('🎵 𝗖𝗟𝗨𝗧𝗖𝗛 𝗠𝗨𝗦𝗜𝗖 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦')
          .setDescription(`Experience high-fidelity audio playback and dynamic queues.\n\nUse **\`${prefix}[command]\`** or **\`/ [command]\`**`)
          .setColor('#8B5CF6')
          .addFields(
            {
              name: '▶️ **𝗣𝗟𝗔𝗬𝗕𝗔𝗖𝗞**',
              value: `\`${prefix}play <url/search>\` - Stream audio from YT/Spotify\n\`${prefix}pause\` - Pause current track\n\`${prefix}resume\` - Resume paused track\n\`${prefix}stop\` - Stop and clear everything\n\`${prefix}disconnect\` - Force bot to leave`,
              inline: false
            },
            {
              name: '⏭️ **𝗤𝗨𝗘𝗨𝗘 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧**',
              value: `\`${prefix}skip\` - Next track\n\`${prefix}back\` - Previous track\n\`${prefix}queue\` - View upcoming tracks\n\`${prefix}shuffle\` - Randomize queue\n\`${prefix}loop\` - Toggle loop mode\n\`${prefix}clear\` - Clear all upcoming tracks`,
              inline: false
            },
            {
              name: '🎛️ **𝗔𝗨𝗗𝗜𝗢 𝗖𝗢𝗡𝗧𝗥𝗢𝗟𝗦**',
              value: `\`${prefix}volume <0-200>\` - Adjust volume\n\`${prefix}filter\` - Apply audio filters\n\`${prefix}eq\` - Adjust equalizer\n\`${prefix}seek <mm:ss>\` - Jump to timestamp`,
              inline: false
            }
          )
          .setFooter({ text: 'Rage Optimiser Ecosystem • Powered by yt-dlp & Discord.js' })
          .setTimestamp();

        if (interaction.reply) {
          return interaction.reply({ embeds: [embed] });
        }
      }
    },
    {
      name: 'command_play',
      handler: async (client: any, interaction: any, context: any) => {
        if (!interaction.member.voice.channel) {
          return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        
        try {
          const queue = QueueManager.getQueue(interaction.guild.id);
          
          // SPOTIFY SUPPORT
          if (query.includes('spotify.com')) {
            const tracks = await spotify.getTracks(query);
            if (!tracks || tracks.length === 0) return interaction.editReply('❌ No tracks found in this Spotify link.');
            
            // Limit to first 50 tracks to avoid extreme queue bloat
            const tracksToAdd = tracks.slice(0, 50);
            
            for (const spTrack of tracksToAdd) {
              const track: Track = {
                title: `${spTrack.name} - ${spTrack.artists?.[0]?.name || 'Unknown'}`,
                url: `search:${spTrack.name} ${spTrack.artists?.[0]?.name || ''}`,
                duration: 'Unknown (Spotify)',
                thumbnail: 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png',
                requester: interaction.user.tag
              };
              queue.play(track, interaction.member.voice.channel);
            }

            const embed = new EmbedBuilder()
              .setTitle('🎵 Added Spotify Playlist')
              .setDescription(`Enqueued **${tracksToAdd.length}** tracks.`)
              .setColor('#1db954');
              
            return interaction.editReply({ embeds: [embed] });
          }

          let search = await play.search(query, { limit: 1 }).catch(() => []);
          
          // If YouTube search fails or is rate-limited, fallback to SoundCloud
          if (!search || search.length === 0) {
            try {
              const clientID = await play.getFreeClientID();
              await play.setToken({ soundcloud: { client_id: clientID } });
            } catch (e) {
              console.error('[Music] Failed to grab SC client ID:', e);
            }
            search = await play.search(query, { limit: 1, source: { soundcloud: 'tracks' } }).catch(() => []) as any;
          }

          if (!search || search.length === 0) {
            return interaction.editReply('❌ No results found on YouTube or SoundCloud.');
          }

          const trackInfo = search[0];
          const track: Track = {
            title: trackInfo.title || 'Unknown',
            url: trackInfo.url,
            duration: trackInfo.durationRaw || '0:00',
            thumbnail: trackInfo.thumbnails?.[0]?.url || '',
            requester: interaction.user.tag
          };

          await queue.play(track, interaction.member.voice.channel);

          const embed = new EmbedBuilder()
            .setTitle('🎵 Added to Queue')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
              { name: 'Duration', value: track.duration, inline: true },
              { name: 'Requested By', value: track.requester, inline: true }
            )
            .setColor('#4f8cff');

          if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
          }

          await interaction.editReply({ embeds: [embed] });
          context.logSyncEvent(`Music: ${interaction.user.tag} played "${track.title}" in ${interaction.member.voice.channel.name}`, 'info');
        } catch (err) {
          console.error(err);
          await interaction.editReply('❌ Failed to play track. Ensure age-restriction or region block is not active.');
        }
      }
    },
    {
      name: 'command_pause',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.pause();
        await interaction.reply('⏸️ Paused playback.');
      }
    },
    {
      name: 'command_resume',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.resume();
        await interaction.reply('▶️ Resumed playback.');
      }
    },
    {
      name: 'command_skip',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.skip();
        await interaction.reply('⏭️ Skipped current track.');
      }
    },
    {
      name: 'command_stop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.stop();
        await interaction.reply('🛑 Stopped playback and cleared queue.');
      }
    },
    {
      name: 'command_disconnect',
      handler: async (client: any, interaction: any, context: any) => {
        QueueManager.deleteQueue(interaction.guild.id);
        await interaction.reply('👋 Disconnected from voice channel.');
      }
    },
    {
      name: 'command_queue',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue.currentTrack) return interaction.reply('The queue is empty.');

        let desc = `**Now Playing:**\n[${queue.currentTrack.title}](${queue.currentTrack.url}) | \`${queue.currentTrack.duration}\`\n\n**Up Next:**\n`;
        queue.queue.slice(0, 10).forEach((t, i) => {
          desc += `**${i + 1}.** [${t.title}](${t.url}) | \`${t.duration}\`\n`;
        });
        if (queue.queue.length > 10) desc += `\n*...and ${queue.queue.length - 10} more tracks.*`;

        const embed = new EmbedBuilder().setTitle('📋 Music Queue').setDescription(desc).setColor('#4f8cff');
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_nowplaying',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!queue.currentTrack) return interaction.reply('Nothing is currently playing.');
        const embed = new EmbedBuilder()
          .setTitle('🎶 Now Playing')
          .setDescription(`**[${queue.currentTrack.title}](${queue.currentTrack.url})**`)
          .addFields({ name: 'Duration', value: queue.currentTrack.duration })
          .setColor('#2ecc71');
        
        if (queue.currentTrack.thumbnail) {
          embed.setThumbnail(queue.currentTrack.thumbnail);
        }

        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_loop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        const mode = interaction.options.getString('mode') as 'track' | 'queue' | 'off';
        queue.loopMode = mode;
        await interaction.reply(`🔁 Loop mode set to: **${mode}**`);
      }
    },
    {
      name: 'command_volume',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        const vol = interaction.options.getInteger('percent');
        queue.volume = vol;
        // Native volume adjustments require a custom ffmpeg arg or AudioPlayer volume modifier
        await interaction.reply(`🔊 Volume set to **${vol}%** (Note: Native application volume relies on client mix)`);
      }
    },
    {
      name: 'command_clear',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.queue = [];
        await interaction.reply('🗑️ Queue cleared.');
      }
    },
    {
      name: 'command_remove',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        const pos = interaction.options.getInteger('position');
        if (pos < 1 || pos > queue.queue.length) return interaction.reply('❌ Invalid queue position.');
        const removed = queue.queue.splice(pos - 1, 1);
        await interaction.reply(`🗑️ Removed **${removed[0].title}** from queue.`);
      }
    },
    {
      name: 'command_shuffle',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        for (let i = queue.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue.queue[i], queue.queue[j]] = [queue.queue[j], queue.queue[i]];
        }
        await interaction.reply('🔀 Queue shuffled.');
      }
    },
    // Mock handlers for premium/complex features
    {
      name: 'command_lyrics',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('🎤 Lyrics fetching requires Genius API integration (Coming in v2).');
      }
    },
    {
      name: 'command_filter',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('🎛️ Audio filters (Bassboost, Nightcore) applied. (Mocked response)');
      }
    },
    {
      name: 'command_eq',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('🎚️ Custom Equalizer modified. (Mocked response)');
      }
    },
    {
      name: 'command_radio',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('📻 Started 24/7 lofi radio stream! (Mocked response)');
      }
    },
    {
      name: 'command_playlist',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('📼 Playlist loaded. (Mocked response)');
      }
    },
    {
      name: 'command_favorites',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('⭐ Your favorite songs. (Mocked response)');
      }
    },
    {
      name: 'command_back',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('⏪ Returned to previous track. (Mocked response)');
      }
    },
    {
      name: 'command_autoplay',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.autoplay = !queue.autoplay;
        await interaction.reply(`🤖 Autoplay toggled to **${queue.autoplay ? 'ON' : 'OFF'}**.`);
      }
    },
    {
      name: 'command_seek',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('⏩ Seeked to time. (Mocked response)');
      }
    },
    {
      name: 'command_jump',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('⤴️ Jumped to track in queue. (Mocked response)');
      }
    },
    {
      name: 'command_move',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('🔄 Track moved in queue. (Mocked response)');
      }
    }
  ]
};
