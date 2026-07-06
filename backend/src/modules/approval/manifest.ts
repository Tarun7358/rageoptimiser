import { ModuleManifest } from '../../core/types.js';
import { Database } from '../../core/Database.js';
import { IGuildApproval } from '../../models/index.js';
import { EmbedBuilder } from 'discord.js';

const OWNER_ID = process.env.OWNER_ID || '1508399161798819840';

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
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const docRef = db.collection('approvals').doc(guildId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return interaction.reply({ content: 'Guild not found in approval database.', flags: 64 });
        
        const approval = docSnap.data() as IGuildApproval;
        await docRef.update({
          status: 'Approved',
          approvedBy: interaction.user.id,
          approvedAt: Date.now(),
          lastUpdated: Date.now()
        });
        
        if (context?.handleApprovalAction) {
          await context.handleApprovalAction(guildId, 'approve');
        }

        await interaction.reply(`✅ **${approval.guildName}** (${guildId}) has been successfully approved! All features are now enabled.`);
      }
    },
    {
      name: 'command_reject-server',
      handler: async (client, interaction, context: any) => {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const docRef = db.collection('approvals').doc(guildId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return interaction.reply({ content: 'Guild not found in approval database.', flags: 64 });
        
        const approval = docSnap.data() as IGuildApproval;
        await docRef.update({
          status: 'Rejected',
          rejectedBy: interaction.user.id,
          rejectedAt: Date.now(),
          rejectionReason: reason,
          lastUpdated: Date.now()
        });

        if (context?.handleApprovalAction) {
          await context.handleApprovalAction(guildId, 'reject', reason);
        }

        await interaction.reply(`🚫 **${approval.guildName}** (${guildId}) has been rejected and the bot has left the server.`);
      }
    },
    {
      name: 'command_blacklist-server',
      handler: async (client, interaction, context: any) => {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        const guildId = interaction.options.getString('guild_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const docRef = db.collection('approvals').doc(guildId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          await docRef.update({
            status: 'Blacklisted',
            blacklistedBy: interaction.user.id,
            blacklistedAt: Date.now(),
            notes: reason,
            lastUpdated: Date.now()
          });
        } else {
          await docRef.set({
            guildId,
            guildName: 'Unknown (Blacklisted before join)',
            ownerId: 'Unknown',
            ownerUsername: 'Unknown',
            memberCount: 0,
            botCount: 0,
            humanCount: 0,
            verificationLevel: 0,
            premiumTier: 0,
            premiumSubscriptionCount: 0,
            riskScore: 100,
            riskLevel: 'Critical',
            status: 'Blacklisted',
            blacklistedBy: interaction.user.id,
            blacklistedAt: Date.now(),
            notes: reason,
            joinedAt: Date.now(),
            lastUpdated: Date.now()
          });
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
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Unauthorized', flags: 64 });
        
        const db = Database.getDb();
        if (!db) return interaction.reply({ content: 'Database not connected.', flags: 64 });

        const snapshot = await db.collection('approvals').where('status', '==', 'Pending').get();
        if (snapshot.empty) return interaction.reply({ content: '✅ No pending servers!', flags: 64 });

        const pending = snapshot.docs.map(doc => doc.data() as IGuildApproval);

        const embed = new EmbedBuilder()
          .setTitle('⏳ Pending Server Approvals')
          .setColor('#FACC15')
          .setDescription(pending.map(p => `**${p.guildName}** (\`${p.guildId}\`) - Score: ${p.riskScore} (${p.riskLevel})`).join('\n'));
          
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
    }
  ]
};
