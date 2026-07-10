import { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import fs from 'fs';
import path from 'path';

const BACKUPS_FILE = path.join(process.cwd(), 'src', 'backups.json');
const pendingBackupLoads = new Map<string, string>(); // Format: "guildId:userId" -> backupId

function loadBackups(): any[] {
  try {
    if (fs.existsSync(BACKUPS_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUPS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load backups:', err);
  }
  return [];
}

function saveBackups(backups: any[]) {
  try {
    fs.writeFileSync(BACKUPS_FILE, JSON.stringify(backups, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save backups:', err);
  }
}

async function createBackupData(guild: any, creatorTag: string): Promise<any> {
  const roles = await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  const emojis = await guild.emojis.fetch().catch(() => new Map());

  const backupRoles = roles.filter((r: any) => r.name !== '@everyone' && !r.managed).map((r: any) => ({
    name: r.name,
    color: r.color,
    hoist: r.hoist,
    permissions: r.permissions.toArray(),
    position: r.position,
    mentionable: r.mentionable
  }));

  const backupChannels = channels.filter((c: any) => c).map((c: any) => {
    return {
      name: c.name,
      type: c.type,
      topic: c.topic || null,
      nsfw: c.nsfw || false,
      userLimit: c.userLimit || null,
      parentName: c.parent ? c.parent.name : null,
      position: c.position,
      permissionOverwrites: c.permissionOverwrites?.cache?.map((o: any) => {
        let name = '';
        let targetType = o.type; // 0 for role, 1 for member
        if (o.type === 0) {
          const role = roles.get(o.id);
          name = role ? role.name : '';
        } else {
          const member = guild.members.cache.get(o.id);
          name = member ? member.user.tag : '';
        }
        return {
          name,
          type: targetType,
          allow: o.allow.toArray(),
          deny: o.deny.toArray()
        };
      }).filter((o: any) => o.name !== '') || []
    };
  });

  const backupEmojis = emojis.map((e: any) => ({
    name: e.name,
    url: e.url
  }));

  const backupSettings = {
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter
  };

  const snapshotId = `BP-${Math.floor(100 + Math.random() * 900)}-${Date.now().toString().slice(-4)}`;
  const snapshot = {
    id: snapshotId,
    timestamp: new Date().toISOString(),
    guildId: guild.id,
    guildName: guild.name,
    createdByName: creatorTag,
    channelsCount: backupChannels.length,
    rolesCount: backupRoles.length,
    emojisCount: backupEmojis.length,
    data: {
      channels: backupChannels,
      roles: backupRoles,
      emojis: backupEmojis,
      settings: backupSettings
    }
  };

  return snapshot;
}

async function executeRestoration(guild: any, snapshot: any, scope: any, context: any) {
  const log = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    context.logSyncEvent(guild.id, `Backup Restore: ${msg}`, type);
    console.log(`[Backup Restore] [${guild.id}] ${msg}`);
  };

  log(`Initiating restoration/cloning of snapshot "${snapshot.id}" (${snapshot.guildName})...`, 'warn');

  try {
    const rolesScope = scope?.roles !== false;
    const channelsScope = scope?.channels !== false;
    const settingsScope = scope?.settings !== false;
    const emojisScope = scope?.expressions !== false;

    // 1. Roles restoration
    const newRolesMap = new Map<string, any>();
    if (rolesScope && snapshot.data.roles) {
      log('Restoring server roles hierarchy...', 'info');
      const existingRoles = await guild.roles.fetch();
      
      // Delete old roles (except bot managed roles and @everyone)
      for (const [id, r] of existingRoles) {
        if (r.name === '@everyone' || r.managed) continue;
        const highestRole = guild.members.me.roles.highest;
        if (r.position >= highestRole.position) {
          log(`Skipping role "${r.name}" (higher or equal in hierarchy than bot)`, 'info');
          continue;
        }
        try {
          await r.delete('Backup restoration - clean rewrite');
          await new Promise(res => setTimeout(res, 200));
        } catch (e: any) {
          log(`Failed to delete role "${r.name}": ${e.message}`, 'warn');
        }
      }

      // Recreate roles in order of position (ascending)
      const sortedRoles = [...snapshot.data.roles].sort((a: any, b: any) => a.position - b.position);
      for (const roleData of sortedRoles) {
        try {
          const created = await guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            hoist: roleData.hoist,
            mentionable: roleData.mentionable,
            permissions: roleData.permissions
          });
          newRolesMap.set(roleData.name, created);
          log(`Created role: "${roleData.name}"`, 'info');
          await new Promise(res => setTimeout(res, 250));
        } catch (e: any) {
          log(`Failed to recreate role "${roleData.name}": ${e.message}`, 'warn');
        }
      }
    }

    // 2. Settings restoration
    if (settingsScope && snapshot.data.settings) {
      log('Updating guild settings configurations...', 'info');
      try {
        await guild.edit({
          verificationLevel: snapshot.data.settings.verificationLevel,
          defaultMessageNotifications: snapshot.data.settings.defaultMessageNotifications,
          explicitContentFilter: snapshot.data.settings.explicitContentFilter
        });
        log('Guild settings synchronized successfully.', 'info');
      } catch (e: any) {
        log(`Failed to edit guild settings: ${e.message}`, 'warn');
      }
    }

    // 3. Channels restoration
    if (channelsScope && snapshot.data.channels) {
      log('Restoring channel layout structure (this will delete and recreate channels)...', 'info');
      const existingChannels = await guild.channels.fetch();
      
      // Create a temporary progress/logging channel so bot interaction isn't orphaned
      let tempChannel: any = null;
      try {
        tempChannel = await guild.channels.create({
          name: 'restoring-progress',
          type: ChannelType.GuildText,
          topic: 'Temporary channel created during server restoration/cloning.'
        });
        log('Temporary progress channel created.', 'info');
      } catch (e) {
        tempChannel = existingChannels.find((c: any) => c && c.type === ChannelType.GuildText);
      }

      // Delete all other existing channels
      for (const [id, c] of existingChannels) {
        if (!c || (tempChannel && c.id === tempChannel.id)) continue;
        try {
          await c.delete('Backup restoration - clean rewrite');
          await new Promise(res => setTimeout(res, 300));
        } catch (e) {}
      }

      // Recreate categories first
      const newCategoriesMap = new Map<string, any>();
      const categories = snapshot.data.channels.filter((c: any) => c.type === ChannelType.GuildCategory || c.type === 4);
      for (const catData of categories) {
        try {
          const created = await guild.channels.create({
            name: catData.name,
            type: ChannelType.GuildCategory,
            position: catData.position
          });
          newCategoriesMap.set(catData.name, created);
          log(`Created Category: [${catData.name}]`, 'info');
          await new Promise(res => setTimeout(res, 350));
        } catch (e: any) {
          log(`Failed to create category "${catData.name}": ${e.message}`, 'warn');
        }
      }

      // Recreate text and voice channels
      const nonCategories = snapshot.data.channels.filter((c: any) => c.type !== ChannelType.GuildCategory && c.type !== 4);
      const newChannelsList: { created: any; backup: any }[] = [];

      for (const chanData of nonCategories) {
        try {
          const parent = chanData.parentName ? newCategoriesMap.get(chanData.parentName) : null;
          const type = chanData.type === 2 || chanData.type === ChannelType.GuildVoice ? ChannelType.GuildVoice : ChannelType.GuildText;
          const created = await guild.channels.create({
            name: chanData.name,
            type,
            parent: parent ? parent.id : null,
            topic: chanData.topic,
            nsfw: chanData.nsfw,
            userLimit: chanData.userLimit,
            position: chanData.position
          });
          newChannelsList.push({ created, backup: chanData });
          log(`Created Channel: #${chanData.name}`, 'info');
          await new Promise(res => setTimeout(res, 350));
        } catch (e: any) {
          log(`Failed to create channel "#${chanData.name}": ${e.message}`, 'warn');
        }
      }

      // Apply permission overwrites
      log('Synchronizing permission overrides across all channels...', 'info');
      for (const item of newChannelsList) {
        const { created, backup } = item;
        const overwrites: any[] = [];

        for (const ov of backup.permissionOverwrites || []) {
          let targetId = '';
          if (ov.type === 0) {
            if (ov.name === '@everyone') {
              targetId = guild.roles.everyone.id;
            } else {
              const roleObj = newRolesMap.get(ov.name);
              if (roleObj) targetId = roleObj.id;
            }
          } else {
            const memberObj = guild.members.cache.find((m: any) => m.user.tag === ov.name);
            if (memberObj) targetId = memberObj.id;
          }

          if (targetId) {
            overwrites.push({
              id: targetId,
              type: ov.type,
              allow: ov.allow,
              deny: ov.deny
            });
          }
        }

        if (overwrites.length > 0) {
          try {
            await created.permissionOverwrites.set(overwrites);
            await new Promise(res => setTimeout(res, 200));
          } catch (e: any) {
            log(`Failed to apply overwrites on channel #${backup.name}: ${e.message}`, 'warn');
          }
        }
      }

      // Delete progress channel at end
      if (tempChannel) {
        try {
          await tempChannel.delete('Restoration complete');
        } catch (e) {}
      }
    }

    // 4. Emojis restoration
    if (emojisScope && snapshot.data.emojis && snapshot.data.emojis.length > 0) {
      log('Restoring custom server emojis...', 'info');
      const existingEmojis = await guild.emojis.fetch().catch(() => new Map());
      for (const [id, e] of existingEmojis) {
        try {
          await e.delete();
          await new Promise(res => setTimeout(res, 200));
        } catch (err) {}
      }

      for (const emoji of snapshot.data.emojis) {
        try {
          await guild.emojis.create({ attachment: emoji.url, name: emoji.name });
          log(`Restored emoji: :${emoji.name}:`, 'info');
          await new Promise(res => setTimeout(res, 300));
        } catch (e: any) {
          log(`Failed to create emoji :${emoji.name}: ${e.message}`, 'warn');
        }
      }
    }

    log(`Restoration of snapshot "${snapshot.id}" completed successfully!`, 'success');
  } catch (err: any) {
    log(`Restoration failed: ${err.message}`, 'warn');
  }
}

export const BackupsManifest: ModuleManifest = {
  id: 'backups',
  name: 'Backup Recovery',
  version: '2.0.0',
  description: 'Full template backups, clean server restore, and server cloning configurations.',
  configSchema: {
    requiredFields: ['channelId'],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;
      const channelExists = (id: string) => registry.channels.some(c => c.id === id);

      if (config.channelId) {
        progress += 100;
        if (!channelExists(config.channelId)) errors.push(`Backup alerts channel ID (${config.channelId}) was deleted!`);
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'backup',
      description: 'Manage and restore server backup templates',
      options: [
        {
          name: 'create',
          description: 'Create a backup snapshot of the current server.',
          type: 1
        },
        {
          name: 'list',
          description: 'List all backup templates.',
          type: 1
        },
        {
          name: 'info',
          description: 'Show details of a specific backup.',
          type: 1,
          options: [
            {
              name: 'backup-id',
              description: 'The ID of the backup snapshot.',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'load',
          description: 'Load a backup snapshot (rewrites/clones server).',
          type: 1,
          options: [
            {
              name: 'backup-id',
              description: 'The ID of the backup snapshot to load.',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'delete',
          description: 'Delete a backup snapshot.',
          type: 1,
          options: [
            {
              name: 'backup-id',
              description: 'The ID of the backup snapshot to delete.',
              type: 3,
              required: true
            }
          ]
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_backup',
      handler: async (client: any, interaction: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const backupModule = modules.find((m: any) => m.id === 'backups');
        if (!backupModule || backupModule.status !== 'enabled') {
          return interaction.reply({ content: '❌ Backup Recovery module is not enabled.', flags: 64 });
        }

        const guild = interaction.guild;
        if (!guild) return;

        const sub = interaction.options.getSubcommand();

        // 1. CREATE SUBCOMMAND
        if (sub === 'create') {
          try {
            await interaction.deferReply({ flags: 64 });
            const snapshot = await createBackupData(guild, interaction.user.tag);
            const backups = loadBackups();
            backups.push(snapshot);
            saveBackups(backups);

            const embed = new EmbedBuilder()
              .setTitle('💾 Backup Snapshot Created')
              .setDescription(`Successfully captured server config template!\n\n` + 
                              `🔑 **Backup ID**: \`${snapshot.id}\`\n` +
                              `🔢 **Channels**: ${snapshot.channelsCount}\n` +
                              `🛡️ **Roles**: ${snapshot.rolesCount}\n` +
                              `😀 **Emojis**: ${snapshot.emojisCount}\n\n` +
                              `💡 *You can load this backup on another server by running \`/backup load ${snapshot.id}\` to clone it!*`)
              .setColor('#2ecc71')
              .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            context.logSyncEvent(`Backup Recovery: Created configuration backup snapshot "${snapshot.id}".`, 'success');
          } catch (err: any) {
            console.error(err);
            await interaction.editReply({ content: `❌ Failed to generate configuration backup: ${err.message}` });
          }
        }

        // 2. LIST SUBCOMMAND
        else if (sub === 'list') {
          const backups = loadBackups();
          const guildBackups = backups.filter(b => b.guildId === guild.id);

          const embed = new EmbedBuilder()
            .setTitle('📁 Server Backups')
            .setDescription(guildBackups.length === 0 ? 'No backups saved for this server yet.' : `Found ${guildBackups.length} backups for this server:`)
            .setColor('#3498db')
            .setTimestamp();

          guildBackups.slice(0, 10).forEach(b => {
            embed.addFields({
              name: `ID: ${b.id}`,
              value: `📅 Date: ${new Date(b.timestamp).toLocaleString()}\n🛡️ Roles: ${b.rolesCount} | 🔢 Channels: ${b.channelsCount} | Created By: ${b.createdByName}`
            });
          });

          await interaction.reply({ embeds: [embed], flags: 64 });
        }

        // 3. INFO SUBCOMMAND
        else if (sub === 'info') {
          const backupId = interaction.options.getString('backup-id');
          const backups = loadBackups();
          const snapshot = backups.find(b => b.id === backupId);

          if (!snapshot) {
            return interaction.reply({ content: `❌ Backup with ID \`${backupId}\` was not found.`, flags: 64 });
          }

          const embed = new EmbedBuilder()
            .setTitle(`ℹ️ Backup details: ${snapshot.id}`)
            .setDescription(`Information on server snapshot template:`)
            .setColor('#9b59b6')
            .addFields(
              { name: 'Source Guild', value: snapshot.guildName, inline: true },
              { name: 'Source Guild ID', value: snapshot.guildId, inline: true },
              { name: 'Created By', value: snapshot.createdByName || 'Unknown', inline: true },
              { name: 'Created At', value: new Date(snapshot.timestamp).toLocaleString(), inline: false },
              { name: 'Channels & Layouts', value: `${snapshot.channelsCount} channels`, inline: true },
              { name: 'Roles Hierarchy', value: `${snapshot.rolesCount} roles`, inline: true },
              { name: 'Custom Emojis', value: `${snapshot.emojisCount || 0} emojis`, inline: true }
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed], flags: 64 });
        }

        // 4. DELETE SUBCOMMAND
        else if (sub === 'delete') {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '🔒 Administrator permissions required to delete backups.', flags: 64 });
          }

          const backupId = interaction.options.getString('backup-id');
          const backups = loadBackups();
          const filtered = backups.filter(b => b.id !== backupId);

          if (backups.length === filtered.length) {
            return interaction.reply({ content: `❌ Backup with ID \`${backupId}\` was not found.`, flags: 64 });
          }

          saveBackups(filtered);
          context.logSyncEvent(`Backup Recovery: Deleted backup snapshot "${backupId}".`, 'warn');
          await interaction.reply({ content: `✅ Backup snapshot \`${backupId}\` was deleted successfully.`, flags: 64 });
        }

        // 5. LOAD/RESTORE SUBCOMMAND
        else if (sub === 'load') {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '🔒 Administrator permissions required to load backups.', flags: 64 });
          }

          const backupId = interaction.options.getString('backup-id');
          const backups = loadBackups();
          const snapshot = backups.find(b => b.id === backupId);

          if (!snapshot) {
            return interaction.reply({ content: `❌ Backup with ID \`${backupId}\` was not found.`, flags: 64 });
          }

          // Save load intent mapping
          pendingBackupLoads.set(`${guild.id}:${interaction.user.id}`, backupId);

          const embed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Server Rewrite/Cloning')
            .setDescription(`You are about to load backup ID **\`${backupId}\`**.\n\n` + 
                            `🌐 **Source Server**: ${snapshot.guildName}\n` +
                            `🔢 **Channels**: ${snapshot.channelsCount}\n` +
                            `🛡️ **Roles**: ${snapshot.rolesCount}\n\n` +
                            `🚨 **WARNING**: This operation is **destructive**! It will delete all existing channels, categories, and roles (except the bot's roles, booster roles, and @everyone) and rewrite them using the template.`)
            .setColor('#e74c3c')
            .setTimestamp();

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('backup_confirm')
                .setLabel('Confirm & Rewrite')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('backup_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
            );

          await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
      }
    },
    {
      name: 'button_backup_confirm',
      handler: async (client: any, interaction: any, context: any) => {
        const guild = interaction.guild;
        if (!guild) return;

        const key = `${guild.id}:${interaction.user.id}`;
        const backupId = pendingBackupLoads.get(key);

        if (!backupId) {
          return interaction.reply({ content: '❌ No pending backup load intent found. Please rerun `/backup load`.', flags: 64 });
        }

        pendingBackupLoads.delete(key);

        const backups = loadBackups();
        const snapshot = backups.find(b => b.id === backupId);

        if (!snapshot) {
          return interaction.reply({ content: '❌ Backup snapshot data not found.', flags: 64 });
        }

        try {
          await interaction.reply({ content: '💾 **Restoration Commencing**\nBot is rebuilding channels and roles in the background. Watch dashboard/logs for live updates.', flags: 64 });
          executeRestoration(guild, snapshot, { roles: true, channels: true, settings: true, expressions: true }, context).catch(console.error);
        } catch (e: any) {
          console.error(e);
          await interaction.followUp({ content: `❌ Failed to execute restoration: ${e.message}`, flags: 64 });
        }
      }
    },
    {
      name: 'button_backup_cancel',
      handler: async (client: any, interaction: any, context: any) => {
        const guild = interaction.guild;
        if (!guild) return;

        pendingBackupLoads.delete(`${guild.id}:${interaction.user.id}`);
        await interaction.reply({ content: '❌ Backup restoration canceled.', flags: 64 });
      }
    }
  ],
  routes: [
    {
      path: '/list',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const backups = loadBackups();
        // Return backups relevant to current guild or all to allow cloning!
        res.json(backups);
      }
    },
    {
      path: '/info/:id',
      method: 'get',
      handler: async (req: any, res: any, context: any) => {
        const backups = loadBackups();
        const backup = backups.find(b => b.id === req.params.id);
        if (!backup) return res.status(404).json({ error: 'Backup not found' });
        res.json(backup);
      }
    },
    {
      path: '/create',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const guild = context.client?.guilds.cache.get(context.guildId);
        if (!guild) return res.status(400).json({ error: 'Discord guild not connected or available' });
        try {
          const snapshot = await createBackupData(guild, req.user?.username || 'Dashboard Admin');
          const backups = loadBackups();
          backups.push(snapshot);
          saveBackups(backups);
          context.logSyncEvent(`Backup Recovery: Created configuration backup snapshot "${snapshot.id}".`, 'success');
          res.json({ success: true, backup: snapshot });
        } catch (e: any) {
          console.error(e);
          res.status(500).json({ error: e.message });
        }
      }
    },
    {
      path: '/restore',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const { backupId, scope } = req.body;
        const backups = loadBackups();
        const snapshot = backups.find(b => b.id === backupId);
        if (!snapshot) return res.status(404).json({ error: 'Backup snapshot not found' });

        const guild = context.client?.guilds.cache.get(context.guildId);
        if (!guild) return res.status(400).json({ error: 'Discord guild not connected or available' });

        res.json({ success: true, message: 'Restoration started' });
        executeRestoration(guild, snapshot, scope, context).catch(console.error);
      }
    },
    {
      path: '/delete/:id',
      method: 'post',
      handler: async (req: any, res: any, context: any) => {
        const backups = loadBackups();
        const filtered = backups.filter(b => b.id !== req.params.id);
        if (backups.length === filtered.length) return res.status(404).json({ error: 'Backup not found' });
        saveBackups(filtered);
        res.json({ success: true });
      }
    }
  ]
};

