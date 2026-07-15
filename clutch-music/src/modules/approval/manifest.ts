import { ModuleManifest } from '../../core/types.js';
import { Database } from '../../core/Database.js';
import { IGuildApproval } from '../../models/index.js';
import { EmbedBuilder } from 'discord.js';

const OWNER_ID = process.env.OWNER_ID || '1508399161798819840';

const checkIsOwner = (client: any, userId: string) => {
  return userId === OWNER_ID;
};

export const ApprovalManifest: ModuleManifest = {
  id: 'approval',
  name: 'Owner Approval System',
  description: 'Manage bot server approvals globally',
  version: '1.0.0',
  configSchema: {
    requiredFields: [],
    validate: () => ({ progress: 100, errors: [] })
  },
  commands: [
    {
      name: 'approve-server',
      description: '(Owner Only) Approve a pending server',
      options: [{ type: 3, name: 'guild_id', description: 'The ID of the guild to approve', required: true }]
    },
    {
      name: 'reject-server',
      description: '(Owner Only) Reject a pending server and leave',
      options: [
        { type: 3, name: 'guild_id', description: 'The ID of the guild to reject', required: true },
        { type: 3, name: 'reason', description: 'Reason for rejection', required: false }
      ]
    },
    {
      name: 'blacklist-server',
      description: '(Owner Only) Blacklist a server from ever using the bot',
      options: [
        { type: 3, name: 'guild_id', description: 'The ID of the guild to blacklist', required: true },
        { type: 3, name: 'reason', description: 'Reason for blacklisting', required: false }
      ]
    },
    {
      name: 'pending-servers',
      description: '(Owner Only) List all pending servers'
    }
  ],
  events: [
    {
      name: 'command_approve-server',
      handler: async (client, interaction, context: any) => {
        if (!checkIsOwner(client, interaction.user.id)) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const approval = await db.get<any>('SELECT guildName FROM approvals WHERE guildId = ?', [guildId]);
        if (!approval) return interaction.reply({ content: 'Guild not found in approval database.', flags: 64 });
        
        await db.run(
          `UPDATE approvals SET 
            status = 'Approved', 
            approvedBy = ?, 
            approvedAt = ?, 
            lastUpdated = ? 
          WHERE guildId = ?`,
          [interaction.user.id, Date.now(), Date.now(), guildId]
        );
        
        if (context?.handleApprovalAction) {
          await context.handleApprovalAction(guildId, 'approve');
        }

        await interaction.reply(`✅ **${approval.guildName}** (${guildId}) has been successfully approved! All features are now enabled.`);
      }
    },
    {
      name: 'command_reject-server',
      handler: async (client, interaction, context: any) => {
        if (!checkIsOwner(client, interaction.user.id)) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const approval = await db.get<any>('SELECT guildName FROM approvals WHERE guildId = ?', [guildId]);
        if (!approval) return interaction.reply({ content: 'Guild not found in approval database.', flags: 64 });
        
        await db.run(
          `UPDATE approvals SET 
            status = 'Rejected', 
            rejectedBy = ?, 
            rejectedAt = ?, 
            rejectionReason = ?, 
            lastUpdated = ? 
          WHERE guildId = ?`,
          [interaction.user.id, Date.now(), reason, Date.now(), guildId]
        );

        if (context?.handleApprovalAction) {
          await context.handleApprovalAction(guildId, 'reject', reason);
        }

        await interaction.reply(`🚫 **${approval.guildName}** (${guildId}) has been rejected and the bot has left the server.`);
      }
    },
    {
      name: 'command_blacklist-server',
      handler: async (client, interaction, context: any) => {
        if (!checkIsOwner(client, interaction.user.id)) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const existing = await db.get<any>('SELECT guildId FROM approvals WHERE guildId = ?', [guildId]);

        if (existing) {
          await db.run(
            `UPDATE approvals SET 
              status = 'Blacklisted', 
              blacklistedBy = ?, 
              blacklistedAt = ?, 
              notes = ?, 
              lastUpdated = ? 
            WHERE guildId = ?`,
            [interaction.user.id, Date.now(), reason, Date.now(), guildId]
          );
        } else {
          await db.run(
            `INSERT INTO approvals (
              guildId, guildName, ownerId, ownerUsername, memberCount, botCount, humanCount,
              verificationLevel, premiumTier, premiumSubscriptionCount, riskScore, riskLevel,
              status, blacklistedBy, blacklistedAt, notes, joinedAt, lastUpdated
            ) VALUES (?, 'Unknown (Blacklisted before join)', 'Unknown', 'Unknown', 0, 0, 0, 0, 0, 0, 100, 'Critical', 'Blacklisted', ?, ?, ?, ?, ?)`,
            [
              guildId,
              interaction.user.id,
              Date.now(),
              reason,
              Date.now(),
              Date.now()
            ]
          );
        }

        if (context?.handleApprovalAction) {
          await context.handleApprovalAction(guildId, 'blacklist', reason);
        }

        await interaction.reply(`⛔ **${guildId}** has been blacklisted. The bot will automatically leave if it is added.`);
      }
    },
    {
      name: 'command_pending-servers',
      handler: async (client, interaction) => {
        if (!checkIsOwner(client, interaction.user.id)) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const pending = await db.all<any>("SELECT guildName, guildId, riskScore, riskLevel FROM approvals WHERE status = 'Pending'");
        if (pending.length === 0) return interaction.reply({ content: '✅ No pending servers!', flags: 64 });

        const embed = new EmbedBuilder()
          .setTitle('⏳ Pending Server Approvals')
          .setColor('#FACC15')
          .setDescription(pending.map(p => `**${p.guildName}** (\`${p.guildId}\`) - Score: ${p.riskScore} (${p.riskLevel})`).join('\n'));
          
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
    }
  ]
};
