import { EmbedBuilder } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import fs from 'fs';
import path from 'path';

const AFK_FILE = path.join(process.cwd(), 'src', 'afk.json');

function loadAFK(): Record<string, { reason: string, timestamp: number }> {
  try {
    if (fs.existsSync(AFK_FILE)) return JSON.parse(fs.readFileSync(AFK_FILE, 'utf-8'));
  } catch {}
  return {};
}

function saveAFK(data: Record<string, { reason: string, timestamp: number }>) {
  try { fs.writeFileSync(AFK_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export const CommunityManifest: ModuleManifest = {
  id: 'community',
  name: 'Community Welcomer',
  version: '1.0.0',
  description: 'Greeting cards, auto-moderated welcome logs, and reaction role grids.',
  configSchema: {
    requiredFields: ['welcomeChannelId'],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;

      const channelExists = (id: string) => registry.channels.some(c => c.id === id);

      if (config.welcomeChannelId) {
        progress += 100;
        if (!channelExists(config.welcomeChannelId)) errors.push(`Welcome channel ID (${config.welcomeChannelId}) was deleted!`);
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'welcome',
      description: 'Manage or test the Community Welcomer module.',
      options: [
        { name: 'action', type: 3, description: 'Action: test, leave-test, status', required: true }
      ]
    },
    { name: 'avatar', description: 'Get a user\'s avatar', options: [{ name: 'user', type: 6, description: 'User to check', required: false }] },
    { name: 'userinfo', description: 'Get info about a user', options: [{ name: 'user', type: 6, description: 'User to check', required: false }] },
    { name: 'serverinfo', description: 'Get info about the server' },
    { name: 'ping', description: 'Check bot latency' },
    { name: 'help', description: 'List all bot commands' },
    { name: 'invite', description: 'Get the bot invite link' },
    { name: 'stats', description: 'View bot statistics' },
    { name: 'poll', description: 'Create a poll', options: [{ name: 'question', type: 3, description: 'Poll question', required: true }] },
    { name: 'giveaway', description: 'Start a giveaway', options: [{ name: 'duration', type: 3, description: 'Duration', required: true }, { name: 'prize', type: 3, description: 'Prize', required: true }] },
    { name: 'weather', description: 'Check the weather', options: [{ name: 'location', type: 3, description: 'City name', required: true }] },
    { name: 'afk', description: 'Set your AFK status', options: [{ name: 'reason', type: 3, description: 'Reason for being AFK', required: false }] },
    { name: 'remindme', description: 'Set a reminder', options: [{ name: 'time', type: 3, description: 'Time (e.g. 1h, 1d)', required: true }, { name: 'message', type: 3, description: 'Reminder message', required: true }] },
    { name: '8ball', description: 'Ask the magic 8-ball a question', options: [{ name: 'question', type: 3, description: 'Question to ask', required: true }] },
    { name: 'meme', description: 'Get a random meme' },
    { name: 'joke', description: 'Get a random joke' },
    { name: 'flip', description: 'Flip a coin' },
    { name: 'roll', description: 'Roll a dice' }
  ],
  events: [
    {
      name: 'command_welcome',
      handler: async (client: any, interaction: any, context: any) => {
        const action = interaction.options.getString('action');
        const isOwner = interaction.guild?.ownerId === interaction.user?.id ||
                        interaction.member?.permissions?.has?.('Administrator');
        if (!isOwner) return interaction.reply({ content: '🔒 Requires Administrator.', ephemeral: true });
        const modules = context.getModulesState();
        const commMod = modules.find((m: any) => m.id === 'community');
        if (action === 'status') {
          const ch = commMod?.config?.welcomeChannelId;
          await interaction.reply({ content: `👥 **Community Welcomer**\n- **Status**: \`${commMod?.status || 'unknown'}\`\n- **Welcome Channel**: ${ch ? `<#${ch}>` : 'Not configured'}`, ephemeral: true });
        } else if (action === 'test' || action === 'leave-test') {
          const isWelcome = action === 'test';
          const defaultEmbed = isWelcome 
            ? { title: '👋 Welcome to {server}!', description: 'Welcome {user}!', color: '#4f8cff', showAvatar: true, footer: 'User ID: {userId}' }
            : { title: '😢 Goodbye {user}!', description: '**{userTag}** has left.', color: '#ff4444', showAvatar: true, footer: 'User ID: {userId}' };
            
          const embedConfig = (isWelcome ? commMod?.config?.welcomeEmbed : commMod?.config?.leaveEmbed) || defaultEmbed;
          const channelId = isWelcome ? commMod?.config?.welcomeChannelId : (embedConfig.channelId || commMod?.config?.welcomeChannelId);
          
          if (!channelId) return interaction.reply({ content: `❌ No channel configured for ${action}.`, ephemeral: true });
          
          const { EmbedBuilder } = await import('discord.js');
          const channel = interaction.guild?.channels.cache.get(channelId);
          
          if (channel && channel.isTextBased()) {
            const parseStr = (str: string) => (str || '')
              .replace(/{user}/g, interaction.user.toString())
              .replace(/{userTag}/g, interaction.user.tag)
              .replace(/{server}/g, interaction.guild.name)
              .replace(/{memberCount}/g, interaction.guild.memberCount.toString())
              .replace(/{userId}/g, interaction.user.id);

            const embed = new EmbedBuilder()
              .setTitle(parseStr(embedConfig.title))
              .setDescription(parseStr(embedConfig.description))
              .setColor(embedConfig.color as any);
              
            if (embedConfig.showAvatar) {
              embed.setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }));
            }
            if (embedConfig.footer) {
              embed.setFooter({ text: parseStr(embedConfig.footer) });
            }

            await channel.send({ content: isWelcome ? `Hey ${interaction.user}, welcome! (TEST)` : `Goodbye (TEST)`, embeds: [embed] });
            await interaction.reply({ content: `✅ Test ${action} sent to ${channel}.`, ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ Target channel not found or not a text channel.', ephemeral: true });
          }
        }
      }
    },
    {
      name: 'command_avatar',
      handler: async (client: any, interaction: any, context: any) => {
        const user = interaction.options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder()
          .setTitle(`${user.username}'s Avatar`)
          .setImage(user.displayAvatarURL({ size: 1024, forceStatic: false }))
          .setColor('#4f8cff');
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_userinfo',
      handler: async (client: any, interaction: any, context: any) => {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        const embed = new EmbedBuilder()
          .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
          .setThumbnail(user.displayAvatarURL())
          .setColor('#4f8cff')
          .addFields(
            { name: 'ID', value: user.id, inline: true },
            { name: 'Joined Discord', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
          );
        
        if (member) {
          embed.addFields(
            { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: 'Roles', value: member.roles.cache.filter((r: any) => r.name !== '@everyone').map((r: any) => `<@&${r.id}>`).join(', ') || 'None' }
          );
        }
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_serverinfo',
      handler: async (client: any, interaction: any, context: any) => {
        const guild = interaction.guild;
        const embed = new EmbedBuilder()
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL())
          .setColor('#4f8cff')
          .addFields(
            { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Members', value: `${guild.memberCount}`, inline: true },
            { name: 'Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
            { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
            { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_ping',
      handler: async (client: any, interaction: any, context: any) => {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 Pong! Latency is ${latency}ms. API Latency is ${Math.round(client.ws.ping)}ms`);
      }
    },
    {
      name: 'command_help',
      handler: async (client: any, interaction: any, context: any) => {
        const embed = new EmbedBuilder()
          .setTitle('RAGE OPTIMISER Commands')
          .setDescription('Here are some available commands:')
          .addFields(
            { name: '🛡️ Moderation', value: '`/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/lock`, `/slowmode`' },
            { name: '🎮 Community', value: '`/avatar`, `/userinfo`, `/serverinfo`, `/ping`, `/poll`, `/giveaway`' },
            { name: '💰 Economy', value: '`/balance`, `/daily`, `/work`, `/pay`, `/rob`, `/shop`, `/inventory`' },
            { name: '🎲 Fun', value: '`/8ball`, `/flip`, `/roll`, `/meme`, `/joke`, `/weather`' },
            { name: '🛠️ Utilities', value: '`/afk`, `/remindme`, `/stats`' }
          )
          .setColor('#2ecc71');
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_invite',
      handler: async (client: any, interaction: any, context: any) => {
        await interaction.reply('https://discord.com/api/oauth2/authorize?client_id=' + client.user.id + '&permissions=8&scope=bot%20applications.commands');
      }
    },
    {
      name: 'command_stats',
      handler: async (client: any, interaction: any, context: any) => {
        const memory = process.memoryUsage();
        const memStr = `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        
        const embed = new EmbedBuilder()
          .setTitle('Bot Statistics')
          .setColor('#4f8cff')
          .addFields(
            { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Memory', value: memStr, inline: true },
            { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
            { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_poll',
      handler: async (client: any, interaction: any, context: any) => {
        const question = interaction.options.getString('question');
        const embed = new EmbedBuilder()
          .setTitle('📊 Poll')
          .setDescription(question)
          .setColor('#4f8cff')
          .setFooter({ text: `Asked by ${interaction.user.tag}` });
          
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('👍');
        await msg.react('👎');
      }
    },
    {
      name: 'command_giveaway',
      handler: async (client: any, interaction: any, context: any) => {
        const durationStr = interaction.options.getString('duration');
        const prize = interaction.options.getString('prize');
        // Very simple mock implementation
        const embed = new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY 🎉')
          .setDescription(`**Prize**: ${prize}\n**Duration**: ${durationStr}\nReact with 🎉 to enter!`)
          .setColor('#f1c40f');
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('🎉');
      }
    },
    {
      name: 'command_weather',
      handler: async (client: any, interaction: any, context: any) => {
        const location = interaction.options.getString('location');
        await interaction.reply(`☀️ The weather in **${location}** is looking sunny with a chance of RAGE! (Mock API response)`);
      }
    },
    {
      name: 'command_afk',
      handler: async (client: any, interaction: any, context: any) => {
        const reason = interaction.options.getString('reason') || 'AFK';
        const afkData = loadAFK();
        afkData[interaction.user.id] = { reason, timestamp: Date.now() };
        saveAFK(afkData);
        await interaction.reply(`✅ I set your AFK: ${reason}`);
      }
    },
    {
      name: 'command_remindme',
      handler: async (client: any, interaction: any, context: any) => {
        const time = interaction.options.getString('time');
        const message = interaction.options.getString('message');
        let ms = 60000;
        if (time.endsWith('s')) ms = parseInt(time) * 1000;
        else if (time.endsWith('m')) ms = parseInt(time) * 60000;
        else if (time.endsWith('h')) ms = parseInt(time) * 3600000;
        
        await interaction.reply(`✅ I will remind you in ${time}.`);
        setTimeout(() => {
          interaction.user.send(`⏰ **Reminder:** ${message}`).catch(() => {});
        }, ms);
      }
    },
    {
      name: 'command_8ball',
      handler: async (client: any, interaction: any, context: any) => {
        const answers = ['It is certain.', 'Without a doubt.', 'Yes.', 'Reply hazy, try again.', 'Ask again later.', 'Don\'t count on it.', 'My sources say no.', 'Very doubtful.'];
        const question = interaction.options.getString('question');
        const answer = answers[Math.floor(Math.random() * answers.length)];
        await interaction.reply(`🎱 **Question:** ${question}\n**Answer:** ${answer}`);
      }
    },
    {
      name: 'command_flip',
      handler: async (client: any, interaction: any, context: any) => {
        const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
        await interaction.reply(`🪙 The coin landed on: **${result}**`);
      }
    },
    {
      name: 'command_roll',
      handler: async (client: any, interaction: any, context: any) => {
        const result = Math.floor(Math.random() * 6) + 1;
        await interaction.reply(`🎲 You rolled a **${result}**`);
      }
    },
    {
      name: 'command_meme',
      handler: async (client: any, interaction: any, context: any) => {
        const memes = [
          'https://i.redd.it/9n5s6q7z97q51.jpg',
          'https://i.redd.it/6z531z4b9z161.png',
          'https://i.imgflip.com/1g8my4.jpg'
        ];
        const meme = memes[Math.floor(Math.random() * memes.length)];
        const embed = new EmbedBuilder().setTitle('Here\'s a meme!').setImage(meme).setColor('#4f8cff');
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      name: 'command_joke',
      handler: async (client: any, interaction: any, context: any) => {
        const jokes = [
          'Why do programmers prefer dark mode? Because light attracts bugs!',
          'How many programmers does it take to change a light bulb? None, that\'s a hardware problem.',
          'There are 10 types of people in the world: those who understand binary, and those who don\'t.'
        ];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        await interaction.reply(`😂 ${joke}`);
      }
    },
    {
      name: 'guildMemberAdd',
      handler: async (client: any, member: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const commModule = modules.find((m: any) => m.id === 'community');
        if (!commModule || commModule.status !== 'enabled') return;

        const config = commModule.config;
        const channelId = config.welcomeChannelId;
        if (!channelId) return;

        const defaultEmbed = { title: '👋 Welcome to {server}!', description: 'Welcome {user}!', color: '#4f8cff', showAvatar: true, footer: 'User ID: {userId}' };
        const embedConfig = config.welcomeEmbed || defaultEmbed;

        try {
          let channel = member.guild.channels.cache.get(channelId);
          if (!channel) {
            channel = await member.guild.channels.fetch(channelId).catch(() => null);
          }
          if (channel && channel.isTextBased()) {
            const parseStr = (str: string) => (str || '')
              .replace(/{user}/g, member.toString())
              .replace(/{userTag}/g, member.user.tag)
              .replace(/{user\.tag}/g, member.user.tag)
              .replace(/{server}/g, member.guild.name)
              .replace(/{memberCount}/g, member.guild.memberCount.toString())
              .replace(/{userId}/g, member.user.id)
              .replace(/{date}/g, new Date().toLocaleDateString());

            const embed = new EmbedBuilder()
              .setColor(embedConfig.color as any);
              
            if (embedConfig.description) {
              embed.setDescription(parseStr(embedConfig.description));
            }
            if (embedConfig.title) {
              embed.setTitle(parseStr(embedConfig.title));
            }
            if (embedConfig.author) {
              embed.setAuthor({ name: parseStr(embedConfig.author) });
            }
            if (embedConfig.imageUrl) {
              embed.setImage(embedConfig.imageUrl);
            }
            if (embedConfig.showAvatar) {
              embed.setThumbnail(member.user.displayAvatarURL({ forceStatic: false }));
            }
            if (embedConfig.footer) {
              embed.setFooter({ text: parseStr(embedConfig.footer) });
            }
            if (embedConfig.timestamp) {
              embed.setTimestamp();
            }
            if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
              embed.addFields(embedConfig.fields.map((f: any) => ({
                name: parseStr(f.name),
                value: parseStr(f.value),
                inline: !!f.inline
              })));
            }

            const messageContent = embedConfig.content !== undefined ? parseStr(embedConfig.content) : `Hey ${member}, welcome!`;
            
            const payload: any = { content: messageContent };
            if (embedConfig.title || embedConfig.description || (embedConfig.fields && embedConfig.fields.length > 0)) {
              payload.embeds = [embed];
            }
            
            await channel.send(payload);
            context.logSyncEvent(`Community Welcomer: Dispatched welcome embed for "${member.user.tag}".`, 'success');
          }
        } catch (err) {
          console.error('Failed to send welcome embed:', err);
        }
      }
    },
    {
      name: 'guildMemberRemove',
      handler: async (client: any, member: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const commModule = modules.find((m: any) => m.id === 'community');
        if (!commModule || commModule.status !== 'enabled') return;

        const config = commModule.config;
        const defaultEmbed = { title: '😢 Goodbye {user}!', description: '**{userTag}** has left.', color: '#ff4444', showAvatar: true, footer: 'User ID: {userId}' };
        const embedConfig = config.leaveEmbed || defaultEmbed;
        const channelId = embedConfig.channelId || config.welcomeChannelId;
        
        if (!channelId) return;

        try {
          let channel = member.guild.channels.cache.get(channelId);
          if (!channel) {
            channel = await member.guild.channels.fetch(channelId).catch(() => null);
          }
          if (channel && channel.isTextBased()) {
            const parseStr = (str: string) => (str || '')
              .replace(/{user}/g, member.user.username)
              .replace(/{userTag}/g, member.user.tag)
              .replace(/{user\.tag}/g, member.user.tag)
              .replace(/{server}/g, member.guild.name)
              .replace(/{memberCount}/g, member.guild.memberCount.toString())
              .replace(/{userId}/g, member.user.id)
              .replace(/{date}/g, new Date().toLocaleDateString());

            const embed = new EmbedBuilder()
              .setColor(embedConfig.color as any);
              
            if (embedConfig.description) {
              embed.setDescription(parseStr(embedConfig.description));
            }
            if (embedConfig.title) {
              embed.setTitle(parseStr(embedConfig.title));
            }
            if (embedConfig.author) {
              embed.setAuthor({ name: parseStr(embedConfig.author) });
            }
            if (embedConfig.imageUrl) {
              embed.setImage(embedConfig.imageUrl);
            }
            if (embedConfig.showAvatar) {
              embed.setThumbnail(member.user.displayAvatarURL({ forceStatic: false }));
            }
            if (embedConfig.footer) {
              embed.setFooter({ text: parseStr(embedConfig.footer) });
            }
            if (embedConfig.timestamp) {
              embed.setTimestamp();
            }
            if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
              embed.addFields(embedConfig.fields.map((f: any) => ({
                name: parseStr(f.name),
                value: parseStr(f.value),
                inline: !!f.inline
              })));
            }

            const messageContent = embedConfig.content !== undefined ? parseStr(embedConfig.content) : `**${member.user.tag}** left.`;
            
            const payload: any = { content: messageContent };
            if (embedConfig.title || embedConfig.description || (embedConfig.fields && embedConfig.fields.length > 0)) {
              payload.embeds = [embed];
            }

            await channel.send(payload);
            context.logSyncEvent(`Community Welcomer: Dispatched goodbye embed for "${member.user.tag}".`, 'info');
          }
        } catch (err) {
          console.error('Failed to send goodbye embed:', err);
        }
      }
    },
    {
      name: 'messageCreate',
      handler: async (client: any, message: any, context: any) => {
        if (message.author.bot) return;
        
        // Handle AFK check
        const afkData = loadAFK();
        
        // Remove AFK if the user speaks
        if (afkData[message.author.id]) {
          delete afkData[message.author.id];
          saveAFK(afkData);
          await message.reply(`Welcome back! I've removed your AFK status.`).then((m: any) => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        // Check if mentioned users are AFK
        if (message.mentions.users.size > 0) {
          message.mentions.users.forEach((user: any) => {
            if (afkData[user.id]) {
              message.reply(`💤 **${user.username}** is currently AFK: ${afkData[user.id].reason} (Since <t:${Math.floor(afkData[user.id].timestamp / 1000)}:R>)`);
            }
          });
        }
      }
    }
  ]
};
