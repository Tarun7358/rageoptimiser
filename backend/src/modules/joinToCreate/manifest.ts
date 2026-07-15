import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { IJoinToCreate } from '../../models/index.js';

export const JoinToCreateManifest: ModuleManifest = {
  id: 'join_to_create',
  name: 'Join To Create',
  version: '1.0.0',
  description: 'Auto-create private voice channels when a user joins a trigger channel. Full owner controls.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;
      
      let triggerId = config.triggerChannelId;
      if (!triggerId && registry?.channels) {
        const found = registry.channels.find(c => c.type === 'voice' && c.name.toLowerCase().includes('join to create'));
        if (found) {
          triggerId = found.id;
        }
      }

      if (triggerId) {
        progress += 100;
        if (registry?.channels && !registry.channels.some(c => c.id === triggerId)) {
          errors.push(`JTC Trigger channel was deleted or is invalid.`);
        }
      } else {
        errors.push(`JTC Trigger channel not configured and no voice channel containing "join to create" was found.`);
      }
      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'jtc',
      description: 'Join To Create management',
      options: [
        {
          name: 'setup',
          description: 'Setup the Join to Create system',
          type: 1,
          options: [
            { name: 'channel', type: 7, description: 'The voice channel users join to create', required: true, channel_types: [2, 13] },
            { name: 'category', type: 7, description: 'Category to create new channels in', required: false, channel_types: [4] },
            { name: 'default_name', type: 3, description: 'Default channel name template ({username})', required: false },
            { name: 'default_limit', type: 4, description: 'Default user limit (0 = unlimited)', required: false },
            { name: 'privacy', type: 3, description: 'Default privacy', required: false, choices: [{ name: 'Public', value: 'public' }, { name: 'Private', value: 'private' }, { name: 'Locked', value: 'locked' }] }
          ]
        },
        {
          name: 'name',
          description: 'Rename your JTC channel',
          type: 1,
          options: [{ name: 'name', type: 3, description: 'New channel name', required: true }]
        },
        {
          name: 'limit',
          description: 'Set user limit for your JTC channel',
          type: 1,
          options: [{ name: 'limit', type: 4, description: 'User limit (0 = unlimited)', required: true }]
        },
        {
          name: 'lock',
          description: 'Lock your JTC channel',
          type: 1
        },
        {
          name: 'unlock',
          description: 'Unlock your JTC channel',
          type: 1
        },
        {
          name: 'transfer',
          description: 'Transfer ownership of your JTC channel',
          type: 1,
          options: [{ name: 'user', type: 6, description: 'New owner', required: true }]
        },
        {
          name: 'kick',
          description: 'Kick a user from your JTC channel',
          type: 1,
          options: [{ name: 'user', type: 6, description: 'User to kick', required: true }]
        },
        {
          name: 'invite',
          description: 'Invite a user to your private JTC channel',
          type: 1,
          options: [{ name: 'user', type: 6, description: 'User to invite', required: true }]
        },
        {
          name: 'info',
          description: 'View info about your JTC channel',
          type: 1
        },
        {
          name: 'list',
          description: 'List all active JTC channels',
          type: 1
        },
        {
          name: 'bitrate',
          description: 'Set the bitrate of your JTC channel',
          type: 1,
          options: [{ name: 'bitrate', type: 4, description: 'Bitrate in kbps (e.g. 64)', required: true }]
        },
        {
          name: 'region',
          description: 'Set the voice region for your JTC channel',
          type: 1,
          options: [{ name: 'region', type: 3, description: 'Region (e.g. us-west, europe)', required: true }]
        },
        {
          name: 'reset',
          description: 'Reset your JTC channel to defaults',
          type: 1
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_jtc',
      handler: async (client: any, interaction: any, context: any) => {
        const sub = interaction.options.getSubcommand(false);
        const modules = context.getModulesState ? context.getModulesState() : [];
        const jtcMod = modules.find((m: any) => m.id === 'join_to_create');

        if (!jtcMod || jtcMod.status !== 'enabled') {
          return interaction.reply({ content: '❌ Join To Create module is not enabled.', flags: 64 });
        }

        const config: IJoinToCreate = jtcMod.config || {};
        const activeChannels: IJoinToCreate['activeChannels'] = config.activeChannels || [];
        const saveConfig = (updated: Partial<IJoinToCreate>) => context.updateModuleConfig('join_to_create', { ...config, ...updated });

        if (sub === 'setup') {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '🔒 Administrator permission required.', flags: 64 });
          }
          const channel = interaction.options.getChannel('channel');
          const category = interaction.options.getChannel('category');
          const defaultName = interaction.options.getString('default_name') || "{username}'s Channel";
          const defaultLimit = interaction.options.getInteger('default_limit') ?? 0;
          const privacy = interaction.options.getString('privacy') || 'public';

          saveConfig({
            id: `jtc_${interaction.guildId}`,
            guildId: interaction.guildId,
            triggerChannelId: channel.id,
            categoryId: category?.id || null,
            defaultName,
            defaultLimit,
            privacy: privacy as any,
            allowOwnerRename: true,
            allowOwnerLimit: true,
            allowOwnerLock: true,
            activeChannels: [],
            createdAt: new Date()
          });

          context.logSyncEvent(`[JTC] Setup by ${interaction.user.username}. Trigger: #${channel.name}.`, 'success');
          return interaction.reply({ content: `✅ **Join To Create** configured!\n- **Trigger Channel:** ${channel}\n- **Default Name:** \`${defaultName}\`\n- **Privacy:** \`${privacy}\``, flags: 64 });
        }

        // Find user's active channel
        const myChannel = activeChannels.find((c: any) => c.ownerId === interaction.user.id);

        if (sub === 'name') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const name = interaction.options.getString('name');
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.setName(name).catch(() => {});
          myChannel.name = name;
          saveConfig({ activeChannels });
          return interaction.reply({ content: `✅ Renamed your channel to **${name}**.`, flags: 64 });
        }

        if (sub === 'limit') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const limit = interaction.options.getInteger('limit');
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel || channel.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.setUserLimit(limit).catch(() => {});
          return interaction.reply({ content: `✅ Set user limit to **${limit === 0 ? 'unlimited' : limit}**.`, flags: 64 });
        }

        if (sub === 'lock') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.permissionOverwrites.edit(interaction.guildId, { Connect: false }).catch(() => {});
          myChannel.locked = true;
          saveConfig({ activeChannels });
          return interaction.reply({ content: '🔒 Your channel is now **locked**.', flags: 64 });
        }

        if (sub === 'unlock') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.permissionOverwrites.edit(interaction.guildId, { Connect: null }).catch(() => {});
          myChannel.locked = false;
          saveConfig({ activeChannels });
          return interaction.reply({ content: '🔓 Your channel is now **unlocked**.', flags: 64 });
        }

        if (sub === 'transfer') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const user = interaction.options.getUser('user');
          myChannel.ownerId = user.id;
          myChannel.ownerTag = user.username;
          saveConfig({ activeChannels });
          context.logSyncEvent(`[JTC] ${interaction.user.username} transferred channel to ${user.username}.`, 'info');
          return interaction.reply({ content: `✅ Transferred channel ownership to ${user}.`, flags: 64 });
        }

        if (sub === 'kick') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const user = interaction.options.getUser('user');
          const member = interaction.guild?.members.cache.get(user.id);
          if (!member) return interaction.reply({ content: '❌ Member not found.', flags: 64 });
          if (member.voice?.channelId === myChannel.channelId) {
            await member.voice.disconnect('Kicked from JTC channel').catch(() => {});
          }
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (channel) await channel.permissionOverwrites.edit(user.id, { Connect: false }).catch(() => {});
          return interaction.reply({ content: `✅ Kicked ${user} from your channel.`, flags: 64 });
        }

        if (sub === 'invite') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const user = interaction.options.getUser('user');
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.permissionOverwrites.edit(user.id, { Connect: true, ViewChannel: true }).catch(() => {});
          return interaction.reply({ content: `✅ Invited ${user} to your channel.`, flags: 64 });
        }

        if (sub === 'info') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const embed = new EmbedBuilder()
            .setTitle(`🎙️ Your JTC Channel`)
            .setColor('#4f8cff')
            .addFields(
              { name: 'Channel', value: `<#${myChannel.channelId}>`, inline: true },
              { name: 'Name', value: myChannel.name, inline: true },
              { name: 'Locked', value: myChannel.locked ? '🔒 Yes' : '🔓 No', inline: true },
              { name: 'Created', value: `<t:${Math.floor(new Date(myChannel.createdAt).getTime() / 1000)}:R>`, inline: true }
            );
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'list') {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '🔒 Manage Server permission required.', flags: 64 });
          }
          if (activeChannels.length === 0) return interaction.reply({ content: '📋 No active JTC channels.', flags: 64 });
          const lines = activeChannels.map((c: any, i: number) => `**${i + 1}.** <#${c.channelId}> — Owner: <@${c.ownerId}> ${c.locked ? '🔒' : '🔓'}`);
          return interaction.reply({ content: `🎙️ **Active JTC Channels (${activeChannels.length}):**\n${lines.join('\n')}`, flags: 64 });
        }

        if (sub === 'bitrate') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const bitrate = interaction.options.getInteger('bitrate');
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel || channel.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          await channel.setBitrate(bitrate * 1000).catch(() => {});
          return interaction.reply({ content: `✅ Set bitrate to **${bitrate}kbps**.`, flags: 64 });
        }

        if (sub === 'reset') {
          if (!myChannel) return interaction.reply({ content: '❌ You don\'t own an active JTC channel.', flags: 64 });
          const channel = interaction.guild?.channels.cache.get(myChannel.channelId);
          if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });
          const defaultName = (config.defaultName || "{username}'s Channel").replace('{username}', interaction.user.username);
          await channel.setName(defaultName).catch(() => {});
          if (channel.type === ChannelType.GuildVoice) await channel.setUserLimit(config.defaultLimit || 0).catch(() => {});
          await channel.permissionOverwrites.edit(interaction.guildId, { Connect: null }).catch(() => {});
          myChannel.name = defaultName;
          myChannel.locked = false;
          saveConfig({ activeChannels });
          return interaction.reply({ content: '✅ Reset your JTC channel to defaults.', flags: 64 });
        }
      }
    },
    // Auto-create channel when user joins trigger
    {
      name: 'voiceStateUpdate',
      handler: async (client: any, data: any, context: any) => {
        const { oldState, newState } = data;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const jtcMod = modules.find((m: any) => m.id === 'join_to_create');
        if (!jtcMod || jtcMod.status !== 'enabled') return;

        const config: IJoinToCreate = jtcMod.config || {};
        let activeChannels: IJoinToCreate['activeChannels'] = config.activeChannels || [];
        const guild = newState.guild || oldState.guild;
        if (!guild) return;

        // Resolve trigger channel ID dynamically if not configured
        let triggerId = config.triggerChannelId;
        if (!triggerId) {
          const found = guild.channels.cache.find((c: any) => c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes('join to create'));
          if (found) {
            triggerId = found.id;
          }
        }

        // 1. User joined dynamic trigger channel -> Create voice room
        if (newState.channelId === triggerId && newState.member) {
          const member = newState.member;

          // Resolve parent category dynamically from the trigger channel
          let parentId = null;
          try {
            const triggerChannel = guild.channels.cache.get(triggerId) || await guild.channels.fetch(triggerId).catch(() => null);
            if (triggerChannel && triggerChannel.parentId) {
              parentId = triggerChannel.parentId;
            }
          } catch (e) {
            console.error('[JTC] Failed to fetch trigger channel parent category:', e);
          }

          if (!parentId && config.categoryId) {
            parentId = config.categoryId;
          }

          // Template replacement for both {username} and {user} formats
          const templateName = config.defaultName || (config as any).channelNameTemplate || "{username}'s Channel";
          const channelName = templateName
            .replace(/{username}/g, member.user.username)
            .replace(/{user}/g, member.displayName);

          try {
            const newChannel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildVoice,
              parent: parentId,
              userLimit: config.defaultLimit || 0,
              permissionOverwrites: config.privacy !== 'public' ? [
                { id: guild.id, deny: [PermissionFlagsBits.Connect] },
                { id: member.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel] }
              ] : [
                { id: member.id, allow: [PermissionFlagsBits.ManageChannels] }
              ]
            });

            await member.voice.setChannel(newChannel).catch(() => {});

            activeChannels.push({
              channelId: newChannel.id,
              ownerId: member.id,
              ownerTag: member.user.username,
              name: channelName,
              locked: config.privacy === 'locked',
              createdAt: new Date()
            });

            context.updateModuleConfig('join_to_create', { activeChannels });
            context.logSyncEvent(`[JTC] Created channel "${channelName}" inside category "${parentId || 'root'}" for ${member.user.username}.`, 'success');
          } catch (err) { console.error('[JTC] Create error:', err); }
        }

        // 2. Scan and auto-delete all empty JTC channels to ensure none are orphaned
        let configChanged = false;
        for (let i = activeChannels.length - 1; i >= 0; i--) {
          const activeCh = activeChannels[i];
          try {
            const channel = guild.channels.cache.get(activeCh.channelId) || await guild.channels.fetch(activeCh.channelId).catch(() => null);
            if (!channel || channel.members.size === 0) {
              if (channel) {
                await channel.delete('JTC: Channel empty').catch(() => {});
              }
              activeChannels.splice(i, 1);
              configChanged = true;
              context.logSyncEvent(`[JTC] Auto-deleted empty channel "${activeCh.name || activeCh.channelId}".`, 'info');
            }
          } catch (e) {
            activeChannels.splice(i, 1);
            configChanged = true;
          }
        }

        if (configChanged) {
          context.updateModuleConfig('join_to_create', { activeChannels });
        }
      }
    },
    // Keep DB synchronized when channel is manually deleted
    {
      name: 'channelDelete',
      handler: async (client: any, channel: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const jtcMod = modules.find((m: any) => m.id === 'join_to_create');
        if (!jtcMod || jtcMod.status !== 'enabled') return;

        const config: IJoinToCreate = jtcMod.config || {};
        let activeChannels: IJoinToCreate['activeChannels'] = config.activeChannels || [];

        const jtcIndex = activeChannels.findIndex((c: any) => c.channelId === channel.id);
        if (jtcIndex !== -1) {
          activeChannels.splice(jtcIndex, 1);
          context.updateModuleConfig('join_to_create', { activeChannels });
          context.logSyncEvent(`[JTC] Channel "${channel.name}" was manually deleted; cleared from tracking list.`, 'info');
        }
      }
    }
  ],
  routes: [
    {
      path: '/state',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const modules = context.getModulesState();
        const mod = modules.find((m: any) => m.id === 'join_to_create');
        res.json({ config: mod?.config || {}, activeChannels: mod?.config?.activeChannels || [] });
      }
    }
  ]
};
