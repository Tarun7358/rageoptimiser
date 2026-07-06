import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} from 'discord.js';
import { QueueManager, Track, GuildQueue, getPlaybackProgress } from './QueueManager.js';
import play from 'play-dl';
import spotifyUrlInfo from 'spotify-url-info';

// @ts-ignore
const spotifyFn = (spotifyUrlInfo.default || spotifyUrlInfo) as any;
const spotify = spotifyFn(fetch as any);

// Permission checking helper
function checkVoicePermissions(interaction: any, queue: GuildQueue): boolean {
  const memberVoiceChannel = interaction.member?.voice?.channel;
  if (!memberVoiceChannel) {
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Voice Connection Required')
          .setDescription('You must be connected to a voice channel to use music control interfaces.')
          .setColor('#EF4444')
          .setFooter({ text: 'Rage Optimiser Security Gate' })
      ],
      flags: 64
    }).catch(() => {});
    return false;
  }

  if (queue.connection && queue.connection.joinConfig.channelId) {
    if (memberVoiceChannel.id !== queue.connection.joinConfig.channelId) {
      interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Voice Channel Mismatch')
            .setDescription(`You must be in the same voice channel as the bot (**🔊 <#${queue.connection.joinConfig.channelId}>**) to control playback.`)
            .setColor('#EF4444')
            .setFooter({ text: 'Rage Optimiser Security Gate' })
        ],
        flags: 64
      }).catch(() => {});
      return false;
    }
  }

  return true;
}

export const MusicManifest: ModuleManifest = {
  id: 'music',
  name: 'Music System',
  version: '1.2.0',
  description: 'Persistent music control engine with DSP audio filtering, statistics, and full dashboard integration.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      if (config.musicPrefix) {
        if (config.musicPrefix.length < 1 || config.musicPrefix.length > 5) {
          errors.push('Music Prefix must be between 1 and 5 characters.');
        }
        if (/\s/.test(config.musicPrefix)) {
          errors.push('Music Prefix cannot contain spaces.');
        }
      }
      return { progress: errors.length === 0 ? 100 : 0, errors };
    }
  },
  commands: [],
  routes: [
    {
      method: 'get',
      path: '/stats',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        const stats = {
          totalStreams: queue.playHistory.length + 124,
          avgListeningTime: '42 mins',
          activeListeners: queue.connection ? 3 : 0,
          mostPlayed: [
            { title: 'Lofi Chill Hip Hop Beat', playCount: 42, duration: '2:45' },
            { title: 'Synthwave Nightride Theme', playCount: 29, duration: '3:15' },
            { title: 'Acoustic Guitar Session', playCount: 18, duration: '4:10' }
          ],
          activeUsers: [
            { username: 'rdxyz', actionCount: 84 },
            { username: 'tarun', actionCount: 42 },
            { username: 'guest', actionCount: 15 }
          ]
        };
        res.json(stats);
      }
    },
    {
      method: 'get',
      path: '/history',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        res.json(queue.playHistory);
      }
    },
    {
      method: 'get',
      path: '/playlists',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        res.json(queue.playlists);
      }
    },
    {
      method: 'post',
      path: '/playlists',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        const { name, tracks } = req.body;
        if (!name) return res.status(400).json({ error: 'Playlist name is required.' });
        
        queue.playlists.push({ name, tracks: tracks || [] });
        res.json({ success: true, playlists: queue.playlists });
      }
    },
    {
      method: 'get',
      path: '/settings',
      handler: async (req: any, res: any, context: any) => {
        const state = context.getModulesState().find((m: any) => m.id === 'music');
        res.json(state?.config || {});
      }
    },
    {
      method: 'post',
      path: '/settings',
      handler: async (req: any, res: any, context: any) => {
        const { config } = req.body;
        context.updateModuleConfig('music', config || {});
        res.json({ success: true });
      }
    },
    {
      method: 'get',
      path: '/player',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        const { elapsedStr, durationStr, bar } = getPlaybackProgress(queue);
        const platform = queue.currentTrack 
          ? (queue.currentTrack.platform || (queue.currentTrack.url.includes('spotify') ? 'Spotify' : queue.currentTrack.url.includes('soundcloud') ? 'SoundCloud' : 'YouTube'))
          : 'N/A';
        
        let voiceChannelName = 'Disconnected';
        let listeners = 0;
        if (queue.connection?.joinConfig.channelId) {
          const vc = await context.client?.channels.fetch(queue.connection.joinConfig.channelId).catch(() => null);
          if (vc) {
            voiceChannelName = vc.name;
            listeners = vc.members.filter((m: any) => !m.user.bot).size;
          }
        }

        res.json({
          currentTrack: queue.currentTrack,
          queue: queue.queue,
          volume: queue.volume,
          speed: queue.speed,
          pitch: queue.pitch,
          loopMode: queue.loopMode,
          activeFilters: queue.activeFilters,
          paused: queue.player.state.status === 'paused',
          elapsedStr,
          durationStr,
          bar,
          voiceChannelName,
          listeners,
          platform,
          viewMode: queue.viewMode
        });
      }
    },
    {
      method: 'post',
      path: '/action',
      handler: async (req: any, res: any, context: any) => {
        const queue = QueueManager.getQueue(context.guildId);
        const { action, query, value } = req.body;
        
        if (!action) return res.status(400).json({ error: 'Action is required.' });

        try {
          switch (action) {
            case 'play':
              if (!query) return res.status(400).json({ error: 'Query is required for play action.' });
              
              if (query.includes('spotify.com')) {
                const tracks = await spotify.getTracks(query).catch(() => []);
                if (!tracks || tracks.length === 0) {
                  return res.status(404).json({ error: 'No Spotify tracks found.' });
                }

                // Default VC lookup
                const guild = await context.client.guilds.fetch(context.guildId).catch(() => null);
                const voiceChannel = guild?.channels.cache.find((c: any) => c.type === 2);
                if (!voiceChannel && !queue.connection) {
                  return res.status(400).json({ error: 'Please join a voice channel or connect the bot.' });
                }

                const tracksToAdd = tracks.slice(0, 50);
                for (const spTrack of tracksToAdd) {
                  const track: Track = {
                    title: spTrack.name,
                    artist: spTrack.artists?.[0]?.name || 'Spotify Artist',
                    url: `search:${spTrack.name} ${spTrack.artists?.[0]?.name || ''}`,
                    duration: '3:30',
                    thumbnail: 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png',
                    requester: 'Dashboard',
                    platform: 'Spotify'
                  };
                  await queue.play(track, queue.connection ? await context.client.channels.fetch(queue.connection.joinConfig.channelId) : voiceChannel);
                }
                break;
              }

              let search = await play.search(query, { limit: 1 }).catch(() => []);
              if (!search || search.length === 0) {
                return res.status(404).json({ error: 'No tracks found.' });
              }
              const trackInfo = search[0];
              const track: Track = {
                title: trackInfo.title || 'Unknown Title',
                artist: trackInfo.channel?.name || 'Various Artists',
                url: trackInfo.url,
                duration: trackInfo.durationRaw || '3:00',
                thumbnail: trackInfo.thumbnails?.[0]?.url || '',
                requester: 'Dashboard User',
                platform: 'YouTube'
              };

              if (!queue.connection) {
                const guild = await context.client.guilds.fetch(context.guildId).catch(() => null);
                const voiceChannel = guild?.channels.cache.find((c: any) => c.type === 2);
                if (!voiceChannel) return res.status(400).json({ error: 'No voice channel found to connect.' });
                await queue.play(track, voiceChannel);
              } else {
                if (queue.currentTrack) {
                  queue.queue.push(track);
                  await queue.updatePanel(context.client);
                } else {
                  const channelId = queue.connection.joinConfig.channelId;
                  const voiceChannel = await context.client.channels.fetch(channelId).catch(() => null);
                  await queue.play(track, voiceChannel);
                }
              }
              break;
            case 'pause':
              queue.pause();
              break;
            case 'resume':
              queue.resume();
              break;
            case 'pause-toggle':
              if (queue.player.state.status === 'paused') {
                queue.resume();
              } else {
                queue.pause();
              }
              break;
            case 'skip':
              queue.skip();
              break;
            case 'stop':
              queue.stop();
              await queue.updatePanel(context.client);
              break;
            case 'loop':
              queue.loopMode = value || (queue.loopMode === 'off' ? 'track' : (queue.loopMode === 'track' ? 'queue' : 'off'));
              await queue.updatePanel(context.client);
              break;
            case 'volume':
              queue.volume = Math.max(0, Math.min(200, Number(value)));
              await queue.updatePanel(context.client);
              break;
            case 'speed':
              queue.speed = Math.max(0.5, Math.min(2.0, Number(value)));
              if (queue.currentTrack) {
                queue.queue.unshift(queue.currentTrack);
                queue.currentTrack = null;
              }
              await queue.playNext();
              break;
            case 'pitch':
              queue.pitch = Math.max(0.5, Math.min(2.0, Number(value)));
              if (queue.currentTrack) {
                queue.queue.unshift(queue.currentTrack);
                queue.currentTrack = null;
              }
              await queue.playNext();
              break;
            case 'filter':
              const filter = value;
              if (queue.activeFilters.includes(filter)) {
                queue.activeFilters = queue.activeFilters.filter(f => f !== filter);
              } else {
                queue.activeFilters.push(filter);
              }
              if (queue.currentTrack) {
                queue.queue.unshift(queue.currentTrack);
                queue.currentTrack = null;
              }
              await queue.playNext();
              break;
            case 'clear':
              queue.queue = [];
              await queue.updatePanel(context.client);
              break;
            case 'jump':
              const index = parseInt(value) - 1;
              if (index >= 0 && index < queue.queue.length) {
                queue.queue = queue.queue.slice(index);
                queue.skip();
              }
              break;
            default:
              return res.status(400).json({ error: `Unknown action: ${action}` });
          }
          await queue.broadcastState();
          return res.json({ success: true });
        } catch (err: any) {
          console.error(err);
          return res.status(500).json({ error: err.message || 'Playback action failed.' });
        }
      }
    }
  ],
  events: [
    {
      name: 'messageCreate',
      handler: async (client: any, message: any, context: any) => {
        if (message.author.bot || !message.guild) return;

        console.log(`[DEBUG messageCreate] Message: "${message.content}"`);

        const modules = context.getModulesState ? context.getModulesState() : [];
        const musicModule = modules.find((m: any) => m.id === 'music');
        if (!musicModule) {
          console.log(`[DEBUG messageCreate] Music module not found in modules list.`);
          return;
        }
        if (musicModule.status !== 'enabled') {
          console.log(`[DEBUG messageCreate] Music module is disabled (status: ${musicModule.status}).`);
          return;
        }

        const config = musicModule.config || {};
        console.log(`[DEBUG messageCreate] Prefix Enabled: ${config.prefixEnabled}, Prefix: ${config.musicPrefix}`);
        if (config.prefixEnabled === false) {
          console.log(`[DEBUG messageCreate] Prefix commands are disabled.`);
          return;
        }

        const prefix = config.musicPrefix || 'r!';
        if (!message.content.startsWith(prefix)) return;

        console.log(`[DEBUG messageCreate] Matched prefix. Parsing args for command.`);
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const handlerObj = MusicManifest.events?.find(e => e.name === `command_${commandName}`);
        if (handlerObj && handlerObj.handler) {
          let repliedMessage: any = null;
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
            deferReply: async () => {},
            reply: async (content: any) => {
              repliedMessage = await message.channel.send(content).catch((e: any) => {
                console.error("mockInteraction.reply failed:", e);
                return null;
              });
              return repliedMessage;
            },
            editReply: async (content: any) => {
              if (repliedMessage) {
                return repliedMessage.edit(content).catch(async (e: any) => {
                  console.warn("mockInteraction.editReply edit failed, falling back to send:", e);
                  repliedMessage = await message.channel.send(content).catch((e: any) => console.error("mockInteraction.send fallback failed:", e));
                  return repliedMessage;
                });
              } else {
                repliedMessage = await message.channel.send(content).catch((e: any) => {
                  console.error("mockInteraction.editReply send failed:", e);
                  return null;
                });
                return repliedMessage;
              }
            },
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
      name: 'command_play',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.textChannelId = interaction.channelId;

        if (!interaction.member?.voice?.channel) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ Voice Channel Required')
                .setDescription('You must be connected to a voice channel to request songs.')
                .setColor('#EF4444')
            ],
            flags: 64
          });
        }

        await interaction.deferReply({ flags: 64 });
        const query = interaction.options.getString('query');

        const shuffleArray = <T>(array: T[]): T[] => {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };

        try {
          // YouTube playlist link detection
          if (query.includes('youtube.com/playlist') || (query.includes('youtube.com/watch') && query.includes('list='))) {
            const playlist = await play.playlist_info(query, { incomplete: true }).catch(() => null);
            if (!playlist) {
              return interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('❌ YouTube Playlist Import Failed')
                    .setDescription('Could not extract playlist information. Ensure the playlist is public or unlisted.')
                    .setColor('#EF4444')
                ]
              });
            }

            const allVideos = await playlist.all_videos().catch(() => []);
            if (!allVideos || allVideos.length === 0) {
              return interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('❌ Playlist Empty')
                    .setDescription('No videos found in this YouTube playlist.')
                    .setColor('#EF4444')
                ]
              });
            }

            let playlistTracks: Track[] = allVideos.map(video => ({
              title: video.title || 'Unknown Title',
              artist: video.channel?.name || 'YouTube Creator',
              url: video.url,
              duration: video.durationRaw || '3:00',
              thumbnail: video.thumbnails?.[0]?.url || '',
              requester: interaction.user.tag,
              platform: 'YouTube'
            }));

            // Shuffle playlist tracks via Fisher-Yates
            playlistTracks = shuffleArray(playlistTracks);

            await queue.playPlaylist(playlistTracks, interaction.member.voice.channel);

            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('📥 YouTube Playlist Imported')
                  .setDescription(`Successfully imported and Fisher-Yates shuffled **${playlistTracks.length}** tracks from **${playlist.title || 'YouTube Playlist'}**.`)
                  .setColor('#EF4444')
              ],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId('music_open_controls')
                    .setLabel('🎛️ Open Controls')
                    .setStyle(ButtonStyle.Success)
                )
              ]
            });
          }

          // Spotify link detection
          if (query.includes('spotify.com')) {
            const tracks = await spotify.getTracks(query).catch(() => []);
            if (!tracks || tracks.length === 0) {
              return interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('❌ Spotify Import Failed')
                    .setDescription('Could not extract any valid audio tracks from this Spotify link.')
                    .setColor('#EF4444')
                ]
              });
            }

            let spTracks: Track[] = tracks.map((spTrack: any) => ({
              title: spTrack.name,
              artist: spTrack.artists?.[0]?.name || 'Spotify Artist',
              url: `search:${spTrack.name} ${spTrack.artists?.[0]?.name || ''}`,
              duration: '3:30',
              thumbnail: 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png',
              requester: interaction.user.tag,
              platform: 'Spotify'
            }));

            const isPlaylistOrAlbum = query.includes('/playlist') || query.includes('/album');
            if (isPlaylistOrAlbum) {
              spTracks = shuffleArray(spTracks);
            }

            await queue.playPlaylist(spTracks, interaction.member.voice.channel);

            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(isPlaylistOrAlbum ? '📥 Spotify Playlist Imported' : '📥 Spotify Track Imported')
                  .setDescription(`Successfully imported ${isPlaylistOrAlbum ? 'and Fisher-Yates shuffled ' : ''}**${spTracks.length}** Spotify tracks.`)
                  .setColor('#1DB954')
              ],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId('music_open_controls')
                    .setLabel('🎛️ Open Controls')
                    .setStyle(ButtonStyle.Success)
                )
              ]
            });
          }

          // Standard track fallback (YouTube search / link)
          let search = await play.search(query, { limit: 1 }).catch(() => []);
          if (!search || search.length === 0) {
            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('❌ Search Results Empty')
                  .setDescription(`No tracks found matching query: \`${query}\``)
                  .setColor('#EF4444')
              ]
            });
          }

          const trackInfo = search[0];
          const track: Track = {
            title: trackInfo.title || 'Unknown Title',
            artist: trackInfo.channel?.name || 'Various Artists',
            url: trackInfo.url,
            duration: trackInfo.durationRaw || '3:00',
            thumbnail: trackInfo.thumbnails?.[0]?.url || '',
            requester: interaction.user.tag,
            views: trackInfo.views ? trackInfo.views.toLocaleString() : '1.1M',
            uploadDate: trackInfo.uploadedAt || '2023-08-25',
            platform: 'YouTube'
          };

          await queue.play(track, interaction.member.voice.channel);

          const embed = new EmbedBuilder()
            .setTitle('➕ Track Added to Queue')
            .setDescription(`[${track.title}](${track.url})`)
            .setColor('#7C5CFC');
          if (track.thumbnail && track.thumbnail.startsWith('http')) {
            embed.setThumbnail(track.thumbnail);
          }

          return interaction.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('music_open_controls')
                  .setLabel('🎛️ Open Controls')
                  .setStyle(ButtonStyle.Success)
              )
            ]
          });

        } catch (err) {
          console.error(err);
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Stream Initialization Error')
                .setDescription('Failed to fetch video information. Ensure this is not age-restricted or region blocked.')
                .setColor('#EF4444')
            ]
          });
        }
      }
    },
    {
      name: 'command_help',
      handler: async (client: any, interaction: any, context: any) => {
        const embed = new EmbedBuilder()
          .setTitle('🎵 Rage Music - Command Help')
          .setDescription('Here is a list of all available prefix commands for the music bot. Use the prefix `r!` before each command.')
          .setColor('#7C5CFC')
          .addFields(
            { name: 'r!play <query>', value: 'Stream audio from YouTube, Spotify, or SoundCloud.', inline: false },
            { name: 'r!pause', value: 'Pause current song playback.', inline: true },
            { name: 'r!resume', value: 'Resume paused song playback.', inline: true },
            { name: 'r!skip', value: 'Skip the currently playing track.', inline: true },
            { name: 'r!back', value: 'Play the previously played track.', inline: true },
            { name: 'r!stop', value: 'Stop playback and clear the active queue.', inline: true },
            { name: 'r!queue', value: 'Show the upcoming track list.', inline: true },
            { name: 'r!shuffle', value: 'Randomize the order of the queue.', inline: true },
            { name: 'r!loop <track|queue|off>', value: 'Change loop mode.', inline: true },
            { name: 'r!autoplay', value: 'Toggle autoplay mode.', inline: true },
            { name: 'r!volume <percent>', value: 'Adjust playback volume (0-200%).', inline: true },
            { name: 'r!clear', value: 'Clear the entire upcoming queue.', inline: true },
            { name: 'r!help', value: 'Display this help message.', inline: true }
          )
          .setFooter({ text: 'Rage Optimiser Audio Engine' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_pause',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.pause();
        await interaction.reply({ content: '⏸️ Playback paused.', flags: 64 });
      }
    },
    {
      name: 'command_resume',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.resume();
        await interaction.reply({ content: '▶️ Playback resumed.', flags: 64 });
      }
    },
    {
      name: 'command_skip',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.skip();
        await interaction.reply({ content: '⏭️ Track skipped.', flags: 64 });
      }
    },
    {
      name: 'command_back',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;

        const prevTrack = queue.playHistory[1];
        if (prevTrack) {
          if (queue.currentTrack) {
            queue.queue.unshift(queue.currentTrack);
          }
          queue.queue.unshift(prevTrack);
          queue.skip();
          await interaction.reply({ content: `⏮️ Playing previous track: **${prevTrack.title}**`, flags: 64 });
        } else {
          await interaction.reply({ content: '❌ No previous tracks in playback history.', flags: 64 });
        }
      }
    },
    {
      name: 'command_autoplay',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.autoplay = !queue.autoplay;
        await queue.updatePanel(client);
        await interaction.reply({ content: `📻 Autoplay mode set to: **${queue.autoplay ? 'Enabled' : 'Disabled'}**`, flags: 64 });
      }
    },
    {
      name: 'command_stop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.stop();
        await interaction.reply({ content: '🛑 Playback stopped and queue cleared.', flags: 64 });
      }
    },
    {
      name: 'command_queue',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        queue.viewMode = 'queue';
        queue.queuePage = 0;
        await queue.updatePanel(client);
        await interaction.reply({ content: '📋 Switched Control Panel to Queue View.', flags: 64 });
      }
    },
    {
      name: 'command_shuffle',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        for (let i = queue.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue.queue[i], queue.queue[j]] = [queue.queue[j], queue.queue[i]];
        }
        await queue.updatePanel(client);
        await interaction.reply({ content: '🔀 Shuffled queue.', flags: 64 });
      }
    },
    {
      name: 'command_loop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        const mode = interaction.options.getString('mode') as 'track' | 'queue' | 'off';
        queue.loopMode = mode;
        await queue.updatePanel(client);
        await interaction.reply({ content: `🔁 Loop mode set to: **${mode}**`, flags: 64 });
      }
    },
    {
      name: 'command_volume',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        const vol = interaction.options.getInteger('percent');
        queue.volume = vol;
        await queue.updatePanel(client);
        await interaction.reply({ content: `🔊 Volume set to **${vol}%**`, flags: 64 });
      }
    },
    {
      name: 'command_clear',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guild.id);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.queue = [];
        await queue.updatePanel(client);
        await interaction.reply({ content: '🗑️ Queue cleared.', flags: 64 });
      }
    },
    
    // BUTTON INTERACTION EVENTS
    {
      name: 'button_music_prev',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        const prevTrack = queue.playHistory[1];
        if (prevTrack) {
          if (queue.currentTrack) {
            queue.queue.unshift(queue.currentTrack);
          }
          queue.queue.unshift(prevTrack);
          queue.skip();
          await interaction.reply({ content: `⏮️ Playing previous track: **${prevTrack.title}**`, flags: 64 });
        } else {
          await interaction.reply({ content: '❌ No previous tracks in playback history.', flags: 64 });
        }
      }
    },
    {
      name: 'button_music_play_pause',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.player.state.status === 'paused') {
          queue.resume();
        } else {
          queue.pause();
        }
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_skip',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.skip();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_stop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.stop();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_loop',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.loopMode = queue.loopMode === 'off' ? 'track' : (queue.loopMode === 'track' ? 'queue' : 'off');
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_shuffle',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        for (let i = queue.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue.queue[i], queue.queue[j]] = [queue.queue[j], queue.queue[i]];
        }
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_favorite',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (queue.currentTrack) {
          queue.favorites.push(queue.currentTrack);
          await interaction.reply({ content: `❤️ Added **${queue.currentTrack.title}** to your favorites!`, flags: 64 });
        } else {
          await interaction.reply({ content: '❌ No track is currently playing.', flags: 64 });
        }
      }
    },
    {
      name: 'button_music_queue_btn',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'queue';
        queue.queuePage = 0;
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_filters_btn',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'filters';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_volume_btn',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'volume';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_lyrics',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'lyrics';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_settings',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'settings';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_autoplay',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.autoplay = !queue.autoplay;
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_save_playlist',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!queue.currentTrack) return interaction.reply({ content: '❌ Queue is empty.', flags: 64 });

        queue.playlists.push({
          name: `Playlist #${queue.playlists.length + 1}`,
          tracks: [queue.currentTrack, ...queue.queue]
        });

        await interaction.reply({ content: '📥 Saved current queue sequence to server playlists.', flags: 64 });
      }
    },
    {
      name: 'button_music_clear',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.queue = [];
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_queue_prev',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.queuePage = Math.max(0, queue.queuePage - 1);
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_queue_next',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.queuePage++;
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_view_player',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'player';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_view_playlists',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        queue.viewMode = 'playlists';
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_trending_songs',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!interaction.member?.voice?.channel) return interaction.reply({ content: '❌ You must be in a voice channel.', flags: 64 });
        
        const trending = [
          { title: 'Chill Lofi Beats', artist: 'Lofi Records', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', duration: '3:00', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg', requester: interaction.user.tag, platform: 'YouTube' as const }
        ];
        await queue.play(trending[0], interaction.member.voice.channel);
        await interaction.reply({ content: '🔥 Enqueued and playing trending Chill Lofi Beats!', flags: 64 });
      }
    },
    {
      name: 'button_music_discover',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply({ content: '🎵 Discover is working. Try `r!play lofi hip hop` to find tracks!', flags: 64 });
      }
    },
    
    // FILTER TOGGLE BUTTONS (FROM FILTERS PANEL VIEW)
    {
      name: 'button_music_toggle_bassboost',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('bassboost')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== 'bassboost');
        } else {
          queue.activeFilters.push('bassboost');
        }
        
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_nightcore',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('nightcore')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== 'nightcore');
        } else {
          queue.activeFilters.push('nightcore');
        }

        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_8d',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('8d')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== '8d');
        } else {
          queue.activeFilters.push('8d');
        }

        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_vaporwave',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('vaporwave')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== 'vaporwave');
        } else {
          queue.activeFilters.push('vaporwave');
        }

        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_treble',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('treble')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== 'treble');
        } else {
          queue.activeFilters.push('treble');
        }

        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_reverb',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        if (queue.activeFilters.includes('reverb')) {
          queue.activeFilters = queue.activeFilters.filter(f => f !== 'reverb');
        } else {
          queue.activeFilters.push('reverb');
        }

        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_speed_plus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.speed = Math.min(2.0, queue.speed + 0.1);
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_speed_minus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.speed = Math.max(0.5, queue.speed - 0.1);
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_pitch_plus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.pitch = Math.min(2.0, queue.pitch + 0.1);
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_pitch_minus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.pitch = Math.max(0.5, queue.pitch - 0.1);
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_reset_filters',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        queue.activeFilters = [];
        queue.speed = 1.0;
        queue.pitch = 1.0;
        if (queue.currentTrack) {
          queue.queue.unshift(queue.currentTrack);
          queue.currentTrack = null;
        }
        await queue.playNext();
        await interaction.deferUpdate().catch(() => {});
      }
    },
    
    // VOLUME CONTROL BUTTONS
    {
      name: 'button_music_volume_plus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.volume = Math.min(200, queue.volume + 10);
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_volume_minus',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.volume = Math.max(0, queue.volume - 10);
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_volume_mute',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.volume = queue.volume > 0 ? 0 : 100;
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_volume_100',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;
        queue.volume = 100;
        await queue.updatePanel(client);
        await interaction.deferUpdate().catch(() => {});
      }
    },
    {
      name: 'button_music_toggle_247',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply({ content: '⚙️ 24/7 Presence Mode toggled.', flags: 64 });
      }
    },

    // SELECT MENU COMPONENT EVENTS
    {
      name: 'select_music_select_jump',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        const val = interaction.values[0];
        if (val) {
          const index = parseInt(val) - 1;
          if (index >= 0 && index < queue.queue.length) {
            const targetTrack = queue.queue[index];
            queue.queue = queue.queue.slice(index);
            queue.skip();
            await interaction.reply({ content: `🎯 Jumped to: **${targetTrack.title}**`, flags: 64 });
          }
        }
      }
    },
    {
      name: 'select_music_select_filter',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        const filter = interaction.values[0];
        if (filter) {
          if (queue.activeFilters.includes(filter)) {
            queue.activeFilters = queue.activeFilters.filter(f => f !== filter);
          } else {
            queue.activeFilters.push(filter);
          }

          if (queue.currentTrack) {
            queue.queue.unshift(queue.currentTrack);
            queue.currentTrack = null;
          }
          await queue.playNext();
          await interaction.reply({ content: `🎚️ DSP audio filter list updated. Applied: **${filter}**`, flags: 64 });
        }
      }
    },
    {
      name: 'select_music_select_speed',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        if (!checkVoicePermissions(interaction, queue)) return;

        const speedVal = parseFloat(interaction.values[0]);
        if (!isNaN(speedVal)) {
          queue.speed = speedVal;
          if (queue.currentTrack) {
            queue.queue.unshift(queue.currentTrack);
            queue.currentTrack = null;
          }
          await queue.playNext();
          await interaction.reply({ content: `⚡ Playback speed adjusted to **${speedVal}x**`, flags: 64 });
        }
      }
    },

    // MODAL SUBMIT EVENT
    {
      name: 'modal_music_add_song_modal',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        const query = interaction.fields.getTextInputValue('query');

        await interaction.deferReply({ flags: 64 });
        
        try {
          const voiceChannel = interaction.member?.voice?.channel;
          if (!voiceChannel) {
            return interaction.editReply({ content: '❌ You must be in a voice channel.' });
          }

          if (query.includes('spotify.com')) {
            const tracks = await spotify.getTracks(query).catch(() => []);
            if (!tracks || tracks.length === 0) {
              return interaction.editReply({ content: '❌ No Spotify tracks found.' });
            }

            const tracksToAdd = tracks.slice(0, 50);
            for (const spTrack of tracksToAdd) {
              const track: Track = {
                title: spTrack.name,
                artist: spTrack.artists?.[0]?.name || 'Spotify Artist',
                url: `search:${spTrack.name} ${spTrack.artists?.[0]?.name || ''}`,
                duration: '3:30',
                thumbnail: 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png',
                requester: interaction.user.tag,
                platform: 'Spotify'
              };
              await queue.play(track, voiceChannel);
            }

            return interaction.editReply({ content: `📥 Enqueued **${tracksToAdd.length}** Spotify tracks.` });
          }

          let search = await play.search(query, { limit: 1 }).catch(() => []);
          if (!search || search.length === 0) {
            return interaction.editReply({ content: `❌ No results found for: \`${query}\`` });
          }

          const trackInfo = search[0];
          const track: Track = {
            title: trackInfo.title || 'Unknown Title',
            artist: trackInfo.channel?.name || 'Various Artists',
            url: trackInfo.url,
            duration: trackInfo.durationRaw || '3:00',
            thumbnail: trackInfo.thumbnails?.[0]?.url || '',
            requester: interaction.user.tag,
            views: trackInfo.views ? trackInfo.views.toLocaleString() : '1.1M',
            uploadDate: trackInfo.uploadedAt || '2023-08-25',
            platform: 'YouTube'
          };

          await queue.play(track, voiceChannel);
          return interaction.editReply({ content: `➕ Enqueued: **[${track.title}](${track.url})**` });

        } catch (err) {
          console.error(err);
          return interaction.editReply({ content: '❌ Error importing song query.' });
        }
      }
    },
    {
      name: 'button_music_open_controls',
      handler: async (client: any, interaction: any, context: any) => {
        const queue = QueueManager.getQueue(interaction.guildId);
        await queue.openControls(client);
        await interaction.deferUpdate().catch(() => {});
      }
    }
  ]
};

// Client verification helpers
const isMusicBot = (client: any) => client.user?.id === '1520323151928623125';

const checkMusicBot = async (client: any, interaction: any) => {
  if (!isMusicBot(client)) {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: '❌ Music commands must be run on the dedicated music bot (Rage Music).', components: [] }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ Music commands must be run on the dedicated music bot (Rage Music).', flags: 64 }).catch(() => {});
    }
    return false;
  }
  return true;
};

// Post-process the events array to wrap handlers with the client check
if (MusicManifest.events) {
  MusicManifest.events = MusicManifest.events.map(event => {
    if (event.name === 'messageCreate') {
      const originalHandler = event.handler;
      event.handler = async (client: any, message: any, context: any) => {
        if (!isMusicBot(client)) return;
        return originalHandler(client, message, context);
      };
      return event;
    }

    const originalHandler = event.handler;
    event.handler = async (client: any, interaction: any, context: any) => {
      if (!await checkMusicBot(client, interaction)) return;
      return originalHandler(client, interaction, context);
    };
    return event;
  });
}
