import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';

// Import individual manifests directly to avoid running index.ts bootstrap()
import { SecurityManifest } from '../modules/security/manifest.js';
import { ModerationManifest } from '../modules/moderation/manifest.js';
import { TicketsManifest } from '../modules/tickets/manifest.js';
import { VerificationManifest } from '../modules/verification/manifest.js';
import { LoggingManifest } from '../modules/logging/manifest.js';
import { BackupsManifest } from '../modules/backups/manifest.js';
import { CommunityManifest } from '../modules/community/manifest.js';
import { AutomationManifest } from '../modules/automation/manifest.js';
import { VoiceManifest } from '../modules/voice/manifest.js';
import { BotWhitelistManifest } from '../modules/bot_whitelist/manifest.js';
import { MemberWhitelistManifest } from '../modules/member_whitelist/manifest.js';
import { RoleWhitelistManifest } from '../modules/role_whitelist/manifest.js';
import { ReactionRolesManifest } from '../modules/reaction-roles/manifest.js';
import { LevelingManifest } from '../modules/leveling/manifest.js';
import { AutomodManifest } from '../modules/automod/manifest.js';
import { ApprovalManifest } from '../modules/approval/manifest.js';
import { DiscordDashboardManifest } from '../modules/discord-dashboard/manifest.js';
import { MusicManifest } from '../modules/music/manifest.js';
import { BlacklistManifest } from '../modules/blacklist/manifest.js';
import { GiveawayManifest } from '../modules/giveaway/manifest.js';
import { RemindersManifest } from '../modules/reminders/manifest.js';
import { AnnouncementsManifest } from '../modules/announcements/manifest.js';
import { JoinToCreateManifest } from '../modules/joinToCreate/manifest.js';
import { VoiceManagerManifest } from '../modules/voice_manager/manifest.js';
import { BulkOpsManifest } from '../modules/bulk_ops/manifest.js';
import { OwnerManifest } from '../modules/owner/manifest.js';
import { DiagnosticsManifest } from '../modules/diagnostics/manifest.js';
import { VoiceProtectionManifest } from '../modules/voice-protection/index.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be specified in the environment.');
  process.exit(1);
}

const clientStr = clientId as string;
const guildStr = guildId as string;

const manifests = [
  SecurityManifest,
  ModerationManifest,
  TicketsManifest,
  VerificationManifest,
  LoggingManifest,
  BackupsManifest,
  CommunityManifest,
  AutomationManifest,
  VoiceManifest,
  BotWhitelistManifest,
  MemberWhitelistManifest,
  RoleWhitelistManifest,
  ReactionRolesManifest,
  LevelingManifest,
  AutomodManifest,
  ApprovalManifest,
  DiscordDashboardManifest,
  MusicManifest,
  BlacklistManifest,
  GiveawayManifest,
  RemindersManifest,
  AnnouncementsManifest,
  JoinToCreateManifest,
  VoiceManagerManifest,
  BulkOpsManifest,
  OwnerManifest,
  DiagnosticsManifest,
  VoiceProtectionManifest
];

// Recursively serialize options, preserving channel_types, autocomplete, min/max
const serializeOption = (opt: any): any => {
  const out: any = {
    name: opt.name,
    type: opt.type,
    description: opt.description
  };
  if (opt.required !== undefined) out.required = opt.required;
  if (opt.choices) out.choices = opt.choices;
  if (opt.channel_types) out.channel_types = opt.channel_types;
  if (opt.autocomplete !== undefined) out.autocomplete = opt.autocomplete;
  if (opt.min_value !== undefined) out.min_value = opt.min_value;
  if (opt.max_value !== undefined) out.max_value = opt.max_value;
  if (opt.options) out.options = opt.options.map(serializeOption);
  return out;
};

const commands: any[] = [];
manifests.forEach(m => {
  if (m.commands) {
    m.commands.forEach(c => {
      commands.push({
        name: c.name,
        description: c.description,
        options: (c.options || []).map(serializeOption)
      });
    });
  }
});

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    if (guildStr) {
      console.log(`🚀 Deploying ${commands.length} application commands to Guild ${guildStr}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientStr, guildStr),
        { body: commands }
      );
      console.log('✅ Slash commands successfully registered on Discord REST API for the target guild.');
    } else {
      console.log(`🚀 Deploying ${commands.length} application commands globally...`);
      await rest.put(
        Routes.applicationCommands(clientStr),
        { body: commands }
      );
      console.log('✅ Slash commands successfully registered globally.');
    }
  } catch (error) {
    console.error('❌ Failed to deploy slash commands:', error);
    process.exit(1);
  }
}

deploy();
