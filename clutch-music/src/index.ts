import dotenv from 'dotenv';
import { ModuleRegistry } from './core/ModuleRegistry.js';

import { Gateway } from './core/Gateway.js';
import { Database } from './core/Database.js';
import { PublicFeedManager } from './core/PublicFeedManager.js';
import { AuthService } from './core/AuthService.js';

// Feature Module Manifests
import { MusicManifest } from './modules/music/manifest.js';

dotenv.config();

let registry: ModuleRegistry;
let gateway: Gateway;

async function bootstrap() {
  try {
    // 0. Connect Database
    await Database.connect();
    await AuthService.provisionDefaultOwner();

    // 1. Initialize Module Registry
    registry = new ModuleRegistry((msgObj) => {
      // music bot doesn't broadcast internally
    });

    // 2. Register Feature Modules
    registry.registerModule(MusicManifest);

    // Run initial evaluation across all registered configurations
    registry.reevaluateAllModules();

    // 3. (Skipped WebServer initialization for Music Bot)

    // Setup native fetch for pushing logs to Core Backend
    const CORE_API = `http://localhost:${process.env.PORT || 5000}`;

    // 4. Initialize Discord Bot Gateway Client
    gateway = new Gateway(
      (guildId, msg, type) => {
        // Log locally
        console.log(`[MUSIC:${type}] ${msg}`);
        // Push log to Core backend to appear in shared dashboard
        fetch(`${CORE_API}/api/internal/music/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, msg, type, source: 'MUSIC' })
        }).catch(() => {}); // ignore if core is down
      },
      () => registry.getRegistry(),
      (reg) => registry.setRegistry(reg),
      () => registry.reevaluateAllModules(),
      (msgObj) => {
        // Forward gateway state/metrics updates to Core Backend
        if (msgObj.type === 'METRICS_UPDATE' || msgObj.type === 'STATE_UPDATE') {
          fetch(`${CORE_API}/api/internal/music/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msgObj)
          }).catch(() => {});
        }
      },
      () => registry.getModulesState(),
      () => registry.getGlobalSettings(),
      null as any, // publicFeed not needed
      (id, config) => registry.updateModuleConfig(id, config)
    );

    (gateway.client as any).registry = registry;
    (gateway.client as any).gatewayInstance = gateway;

    // Hook for auto-syncing quarantine when security config changes
    const originalUpdate = registry.updateModuleConfig.bind(registry);
    registry.updateModuleConfig = (id, config) => {
      const mod = originalUpdate(id, config);
      if (id === 'security' && gateway) {
        gateway.syncQuarantineQueue();
      }
      return mod;
    };

    gateway.registerModuleManifests([
      MusicManifest
    ]);

    await gateway.connect();
    await gateway.forceDeployCommands();
    console.log('Rage Music bot fully booted.');
  } catch (error) {
    console.error('❌ Critical music bot bootstrap error:', error);
    process.exit(1);
  }
}

bootstrap();

export { registry, gateway };
