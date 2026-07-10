import dotenv from 'dotenv';
import { ModuleRegistry } from './core/ModuleRegistry.js';
import { WebServer } from './core/WebServer.js';
import { Gateway } from './core/Gateway.js';
import { Database } from './core/Database.js';
import { PublicFeedManager } from './core/PublicFeedManager.js';
import { AuthService } from './core/AuthService.js';

// ---- Existing Feature Module Manifests ----
import { SecurityManifest } from './modules/security/manifest.js';
import { ModerationManifest } from './modules/moderation/manifest.js';
import { TicketsManifest } from './modules/tickets/manifest.js';
import { VerificationManifest } from './modules/verification/manifest.js';
import { LoggingManifest } from './modules/logging/manifest.js';
import { BackupsManifest } from './modules/backups/manifest.js';
import { CommunityManifest } from './modules/community/manifest.js';
import { AutomationManifest } from './modules/automation/manifest.js';
import { VoiceManifest } from './modules/voice/manifest.js';
import { BotWhitelistManifest } from './modules/bot_whitelist/manifest.js';
import { MemberWhitelistManifest } from './modules/member_whitelist/manifest.js';
import { RoleWhitelistManifest } from './modules/role_whitelist/manifest.js';
import { ReactionRolesManifest } from './modules/reaction-roles/manifest.js';
import { LevelingManifest } from './modules/leveling/manifest.js';
import { AutomodManifest } from './modules/automod/manifest.js';
import { ApprovalManifest } from './modules/approval/manifest.js';
import { DiscordDashboardManifest } from './modules/discord-dashboard/manifest.js';
import { MusicManifest } from './modules/music/manifest.js';
import { QueueManager } from './modules/music/QueueManager.js';

// ---- NEW Feature Module Manifests ----
import { BlacklistManifest } from './modules/blacklist/manifest.js';
import { GiveawayManifest } from './modules/giveaway/manifest.js';
import { RemindersManifest } from './modules/reminders/manifest.js';
import { AnnouncementsManifest } from './modules/announcements/manifest.js';
import { JoinToCreateManifest } from './modules/joinToCreate/manifest.js';
import { VoiceManagerManifest } from './modules/voice_manager/manifest.js';
import { BulkOpsManifest } from './modules/bulk_ops/manifest.js';
import { OwnerManifest } from './modules/owner/manifest.js';
import { DiagnosticsManifest } from './modules/diagnostics/manifest.js';
import { VoiceProtectionManifest } from './modules/voice-protection/index.js';

dotenv.config();

// All manifests in one place for easy iteration
export const ALL_MANIFESTS = [
  // Existing
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
  // New
  BlacklistManifest,
  GiveawayManifest,
  RemindersManifest,
  AnnouncementsManifest,
  JoinToCreateManifest,
  VoiceManagerManifest,
  BulkOpsManifest,
  OwnerManifest,
  DiagnosticsManifest,
  VoiceProtectionManifest,
];

// Web-server excluded manifests (no routes needed for some)
const WEB_MANIFESTS = ALL_MANIFESTS.filter(m =>
  m.id !== 'diagnostics' && m.id !== 'bulk_ops' && m.id !== 'voice_manager'
);

let registry: ModuleRegistry;
let webServer: WebServer;
let gateway: Gateway;

async function bootstrap() {
  try {
    // 0. Connect Database
    await Database.connect();
    await AuthService.provisionDefaultOwner();

    // 1. Initialize Module Registry
    registry = new ModuleRegistry((msgObj) => {
      if (webServer) webServer.broadcast(msgObj);
    });
    QueueManager.registry = registry;

    // 2. Register Feature Modules
    for (const manifest of ALL_MANIFESTS) {
      registry.registerModule(manifest);
    }

    // Run initial evaluation across all registered configurations
    registry.reevaluateAllModules();

    // 3. Initialize Express Web Server & WebSockets Gateway
    webServer = new WebServer(registry, (guildId) => {
      if (gateway) gateway.syncRegistry(guildId);
    });

    const publicFeed = new PublicFeedManager((msgObj) => webServer.broadcast(msgObj));
    webServer.setPublicFeed(publicFeed);

    webServer.registerModuleManifests(WEB_MANIFESTS);

    const PORT = Number(process.env.PORT || 5000);
    webServer.listen(PORT);

    // 4. Initialize Discord Bot Gateway Client
    gateway = new Gateway(
      (guildId, msg, type) => registry.logSyncEvent(guildId, msg, type),
      (guildId) => registry.getRegistry(guildId),
      (guildId, reg) => registry.setRegistry(guildId, reg),
      (guildId) => registry.reevaluateAllModules(guildId),
      (msgObj) => webServer.broadcast(msgObj),
      (guildId) => registry.getModulesState(guildId),
      (guildId) => registry.getGlobalSettings(guildId),
      publicFeed,
      (guildId, id, config) => registry.updateModuleConfig(guildId, id, config)
    );

    // Hook for auto-syncing quarantine when security config changes
    const originalUpdate = registry.updateModuleConfig.bind(registry);
    registry.updateModuleConfig = (guildId, id, config) => {
      const mod = originalUpdate(guildId, id, config);
      if (id === 'security' && gateway) {
        gateway.syncQuarantineQueue(guildId);
      }
      return mod;
    };

    webServer.getBotMetrics = () => gateway.getMetrics();
    webServer.deployCommandsCallback = () => gateway.forceDeployCommands();
    webServer.onApprovalAction = async (guildId, action, reason) => {
      await gateway.handleApprovalAction(guildId, action, reason);
    };
    webServer.triggerEmergencyLock = async (guildId?) => gateway.triggerEmergencyLock(guildId);
    webServer.getDiscordClient = () => gateway.client;
    webServer.syncRegistryCallback = (guildId?) => gateway.syncRegistry(guildId);

    gateway.registerModuleManifests(ALL_MANIFESTS);

    gateway.connect();
    console.log(`✅ Rage Optimiser booted with ${ALL_MANIFESTS.length} modules (${ALL_MANIFESTS.length - 18} new).`);
  } catch (error) {
    console.error('❌ Critical bootstrap error:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception caught by global handler:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Rejection caught by global handler:', reason);
});

bootstrap();

export { registry, webServer, gateway };
