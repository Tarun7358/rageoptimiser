import dotenv from 'dotenv';
import { ModuleRegistry } from './core/ModuleRegistry.js';
import { WebServer } from './core/WebServer.js';
import { Gateway } from './core/Gateway.js';
import { Database } from './core/Database.js';
import { PublicFeedManager } from './core/PublicFeedManager.js';
import { AuthService } from './core/AuthService.js';

// Feature Module Manifests
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

dotenv.config();

// 0. Connect Database
Database.connect().then(() => {
  AuthService.provisionDefaultOwner();
});

// 1. Initialize Module Registry
const registry = new ModuleRegistry((msgObj) => {
  if (webServer) webServer.broadcast(msgObj);
});

// 2. Register Feature Modules
registry.registerModule(SecurityManifest);
registry.registerModule(ModerationManifest);
registry.registerModule(TicketsManifest);
registry.registerModule(VerificationManifest);
registry.registerModule(LoggingManifest);
registry.registerModule(BackupsManifest);
registry.registerModule(CommunityManifest);
registry.registerModule(AutomationManifest);
registry.registerModule(VoiceManifest);
registry.registerModule(BotWhitelistManifest);
registry.registerModule(MemberWhitelistManifest);
registry.registerModule(RoleWhitelistManifest);
registry.registerModule(ReactionRolesManifest);
registry.registerModule(LevelingManifest);
registry.registerModule(AutomodManifest);
registry.registerModule(ApprovalManifest);
registry.registerModule(DiscordDashboardManifest);
registry.registerModule(MusicManifest);

// Run initial evaluation across all registered configurations
registry.reevaluateAllModules();

// 3. Initialize Express Web Server & WebSockets Gateway
const webServer = new WebServer(registry, (guildId) => {
  if (gateway) gateway.syncRegistry(guildId);
});

const publicFeed = new PublicFeedManager((msgObj) => webServer.broadcast(msgObj));
webServer.setPublicFeed(publicFeed);

webServer.registerModuleManifests([
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
  DiscordDashboardManifest
]);

const PORT = Number(process.env.PORT || 5000);
webServer.listen(PORT);

// 4. Initialize Discord Bot Gateway Client
const gateway = new Gateway(
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
webServer.triggerEmergencyLock = async () => gateway.triggerEmergencyLock();
webServer.getDiscordClient = () => gateway.client;
webServer.syncRegistryCallback = (guildId?) => gateway.syncRegistry(guildId);

gateway.registerModuleManifests([
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
  DiscordDashboardManifest
]);

gateway.connect();
console.log('Backend server fully booted with Rage Optimiser manifest');
export { registry, webServer, gateway };
