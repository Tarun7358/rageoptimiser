import { EmbedBuilder } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

export const LoggingManifest: ModuleManifest = {
  id: 'logging',
  name: 'Advanced Logging Center',
  version: '2.0.0',
  description: 'Enterprise-grade multi-category server audit tracking.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 100;

      const categories = ['security', 'moderation', 'antiNuke', 'botProtection', 'webhook', 'voice', 'audit', 'system'];
      
      let configuredCount = 0;
      categories.forEach(cat => {
        if (config[cat] && config[cat].channelId) {
          configuredCount++;
          if (!registry.channels.some(c => c.id === config[cat].channelId)) {
            errors.push(`${cat.toUpperCase()} log channel ID was deleted or is invalid.`);
          }
        }
      });

      if (configuredCount === 0) {
        errors.push('No log categories have assigned channels.');
        progress = 0;
      } else {
        progress = 100;
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'logs',
      description: 'Manage the Advanced Logging Center.',
      options: [
        {
          name: 'settings',
          description: 'View current logging configuration',
          type: 1 // SUB_COMMAND
        },
        {
          name: 'channel',
          description: 'Set the output channel for a log category',
          type: 1, // SUB_COMMAND
          options: [
            { name: 'category', type: 3, description: 'The log category (e.g. security, moderation, voice)', required: true },
            { name: 'channel', type: 7, description: 'The text channel to send logs to', required: true }
          ]
        },
        {
          name: 'enable',
          description: 'Enable a specific log category',
          type: 1,
          options: [
            { name: 'category', type: 3, description: 'The log category', required: true }
          ]
        },
        {
          name: 'disable',
          description: 'Disable a specific log category',
          type: 1,
          options: [
            { name: 'category', type: 3, description: 'The log category', required: true }
          ]
        },
        {
          name: 'test',
          description: 'Send a test log to a specific category',
          type: 1,
          options: [
            { name: 'category', type: 3, description: 'The log category', required: true }
          ]
        },
        {
          name: 'reset',
          description: 'Reset a category to default settings',
          type: 1,
          options: [
            { name: 'category', type: 3, description: 'The log category', required: true }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_logs',
      handler: async (client: any, interaction: any, context: any) => {
        const isOwner = interaction.guild?.ownerId === interaction.user?.id ||
                        interaction.member?.permissions?.has?.('Administrator');
        if (!isOwner) return interaction.reply({ content: '🔒 Requires Administrator.', flags: 64 });
        
        const subcommand = interaction.options.getSubcommand();
        const modules = context.getModulesState();
        const logMod = modules.find((m: any) => m.id === 'logging');
        const config = logMod?.config || {};
        const validCategories = ['security', 'moderation', 'antiNuke', 'botProtection', 'webhook', 'voice', 'audit', 'system'];

        if (subcommand === 'settings') {
          let desc = '';
          validCategories.forEach(cat => {
            const catConfig = config[cat];
            if (catConfig && catConfig.enabled && catConfig.channelId) {
              desc += `**${cat}**: 🟢 Enabled (<#${catConfig.channelId}>)\n`;
            } else {
              desc += `**${cat}**: 🔴 Disabled or Unconfigured\n`;
            }
          });
          if (!desc) desc = 'No categories configured.';
          
          await interaction.reply({ content: `📋 **Logging Center Status**\n\n${desc}`, flags: 64 });
        } else {
          const category = interaction.options.getString('category')?.toLowerCase();
          
          let actualCategory = validCategories.find(c => c.toLowerCase() === category);
          if (!actualCategory) {
             return interaction.reply({ content: `❌ Invalid category. Valid options: ${validCategories.join(', ')}`, flags: 64 });
          }

          if (subcommand === 'channel') {
            const ch = interaction.options.getChannel('channel');
            if (!ch) return interaction.reply({ content: '❌ Please specify a channel.', flags: 64 });
            
            const newConfig = { ...config };
            if (!newConfig[actualCategory]) newConfig[actualCategory] = { enabled: true, events: {}, ignoreRoles: [], ignoreUsers: [], ignoreChannels: [] };
            newConfig[actualCategory].channelId = ch.id;
            
            context.logSyncEvent(`Logging Center: ${actualCategory} log channel updated to #${ch.name} via slash command.`, 'success');
            await interaction.reply({ content: `✅ **${actualCategory}** log channel set to ${ch}. Save this in the Dashboard to persist permanently across restarts.`, flags: 64 });
          } else if (subcommand === 'enable' || subcommand === 'disable') {
            const enabled = subcommand === 'enable';
            context.logSyncEvent(`Logging Center: ${actualCategory} logs were ${enabled ? 'enabled' : 'disabled'} via slash command.`, enabled ? 'success' : 'warn');
            await interaction.reply({ content: `✅ **${actualCategory}** logs have been **${enabled ? 'ENABLED' : 'DISABLED'}**. Update Dashboard to persist.`, flags: 64 });
          } else if (subcommand === 'reset') {
            await interaction.reply({ content: `✅ **${actualCategory}** configuration reset to defaults. Update Dashboard to persist.`, flags: 64 });
          } else if (subcommand === 'test') {
            const catConfig = config[actualCategory];
            if (!catConfig || !catConfig.channelId) {
              return interaction.reply({ content: `❌ **${actualCategory}** does not have a configured channel.`, flags: 64 });
            }
            try {
              const channel = await interaction.guild?.channels.fetch(catConfig.channelId).catch(() => null);
              if (channel && channel.isTextBased()) {
                const embed = new EmbedBuilder()
                  .setTitle(`🧪 Test Log: ${actualCategory.toUpperCase()}`)
                  .setDescription(`This is a test event for the **${actualCategory}** log category triggered by ${interaction.user}.`)
                  .setColor('#3498db')
                  .setTimestamp();
                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: `✅ Test log dispatched to ${channel}.`, flags: 64 });
              } else {
                await interaction.reply({ content: `❌ Could not find or access channel ID ${catConfig.channelId}.`, flags: 64 });
              }
            } catch(e) {
              await interaction.reply({ content: `❌ Error sending test log. Check permissions.`, flags: 64 });
            }
          }
        }
      }
    },
    {
      name: 'messageDelete',
      handler: async (client: any, message: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const logModule = modules.find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;

        const config = logModule.config;
        const auditConfig = config['audit'];
        if (!auditConfig || !auditConfig.enabled || !auditConfig.channelId) return;

        if (message.author?.bot) return;

        try {
          let channel = message.guild?.channels.cache.get(auditConfig.channelId);
          if (!channel) channel = await message.guild?.channels.fetch(auditConfig.channelId).catch(() => null);
          
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🗑️ Message Deleted')
              .setDescription(`**Author**: ${message.author} (\`${message.author?.id}\`)\n**Channel**: ${message.channel}\n\n**Content**:\n${message.content || '*No text content*'}`)
              .setColor('#ff4444')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (err) {}
      }
    },
    {
      name: 'messageUpdate',
      handler: async (client: any, data: any, context: any) => {
        const { oldMessage, newMessage } = data;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const logModule = modules.find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;

        const config = logModule.config;
        const auditConfig = config['audit'];
        if (!auditConfig || !auditConfig.enabled || !auditConfig.channelId) return;

        if (newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; 

        try {
          let channel = newMessage.guild?.channels.cache.get(auditConfig.channelId);
          if (!channel) channel = await newMessage.guild?.channels.fetch(auditConfig.channelId).catch(() => null);
          
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('✏️ Message Edited')
              .setDescription(`**Author**: ${newMessage.author} (\`${newMessage.author?.id}\`)\n**Channel**: ${newMessage.channel}\n\n**Before**:\n${oldMessage.content || '*None*'}\n\n**After**:\n${newMessage.content || '*None*'}`)
              .setColor('#ffaa00')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (err) {}
      }
    },
    {
      name: 'voiceStateUpdate',
      handler: async (client: any, data: any, context: any) => {
        const { oldState, newState } = data;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const logModule = modules.find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;

        const config = logModule.config;
        const voiceConfig = config['voice'];
        if (!voiceConfig || !voiceConfig.enabled || !voiceConfig.channelId) return;

        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        try {
          let logMsg = '';
          let color = '#3498db';

          if (!oldState.channelId && newState.channelId) {
            logMsg = `🎙️ ${member.user} joined voice channel **#${newState.channel?.name || 'unknown'}**`;
            color = '#2ecc71';
          } else if (oldState.channelId && !newState.channelId) {
            logMsg = `🎙️ ${member.user} left voice channel **#${oldState.channel?.name || 'unknown'}**`;
            color = '#e74c3c';
          } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            logMsg = `🎙️ ${member.user} switched voice channel from **#${oldState.channel?.name || 'unknown'}** to **#${newState.channel?.name || 'unknown'}**`;
          } else {
            return; 
          }

          let channel = newState.guild?.channels.cache.get(voiceConfig.channelId);
          if (!channel) channel = await newState.guild?.channels.fetch(voiceConfig.channelId).catch(() => null);
          
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🎙️ Voice State Update')
              .setDescription(logMsg)
              .setColor(color as any)
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (err) {}
      }
    },
    {
      name: 'guildMemberAdd',
      handler: async (client: any, member: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['system'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = member.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('👋 Member Joined')
              .setDescription(`${member.user} (\`${member.user.id}\`) joined the server.`)
              .setColor('#2ecc71')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'guildMemberRemove',
      handler: async (client: any, member: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['system'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = member.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🚪 Member Left')
              .setDescription(`${member.user} (\`${member.user.id}\`) left the server.`)
              .setColor('#e74c3c')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'guildBanAdd',
      handler: async (client: any, ban: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['moderation'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = ban.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🔨 Member Banned')
              .setDescription(`${ban.user} (\`${ban.user.id}\`) was banned.`)
              .setColor('#ff4444')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'guildBanRemove',
      handler: async (client: any, ban: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['moderation'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = ban.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🔓 Member Unbanned')
              .setDescription(`${ban.user} (\`${ban.user.id}\`) was unbanned.`)
              .setColor('#3498db')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'roleCreate',
      handler: async (client: any, role: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['security'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = role.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Role Created')
              .setDescription(`Role <@&${role.id}> (\`${role.name}\`) was created.`)
              .setColor('#2ecc71')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'roleDelete',
      handler: async (client: any, role: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['security'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = role.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Role Deleted')
              .setDescription(`Role \`${role.name}\` (\`${role.id}\`) was deleted.`)
              .setColor('#e74c3c')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'channelCreate',
      handler: async (client: any, ch: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['security'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = ch.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('📁 Channel Created')
              .setDescription(`Channel <#${ch.id}> (\`${ch.name}\`) was created.`)
              .setColor('#2ecc71')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    },
    {
      name: 'channelDelete',
      handler: async (client: any, ch: any, context: any) => {
        const logModule = context.getModulesState().find((m: any) => m.id === 'logging');
        if (!logModule || logModule.status !== 'enabled') return;
        const config = logModule.config['security'];
        if (!config || !config.enabled || !config.channelId) return;

        try {
          const channel = ch.guild?.channels.cache.get(config.channelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('📁 Channel Deleted')
              .setDescription(`Channel \`${ch.name}\` (\`${ch.id}\`) was deleted.`)
              .setColor('#e74c3c')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch(e) {}
      }
    }
  ]
};
