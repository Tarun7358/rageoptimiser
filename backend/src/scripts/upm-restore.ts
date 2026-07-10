import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Client, GatewayIntentBits } from 'discord.js';
import { Database } from '../core/Database.js';
import { restoreFromLiveSnapshot } from '../modules/security/manifest.js';

dotenv.config();

const guildId = (process.argv[2] || process.env.GUILD_ID) as string;
if (!guildId) {
  console.error("❌ Error: Please provide a Guild ID as an argument. Example: npm run upm:restore <guildId>");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function updateSecurityConfigInDb(guildId: string, updates: Record<string, any>) {
  const db = Database.getDb();
  if (!db) return;
  const docRef = db.collection('guild_configs').doc(guildId);
  const doc = await docRef.get();
  let state: any = { modules: [] };
  if (doc.exists) {
    state = doc.data();
  }
  let secModule = state.modules?.find((m: any) => m.id === 'security');
  if (!secModule) {
    secModule = { id: 'security', name: 'Security Hardening', status: 'enabled', config: {} };
    if (!state.modules) state.modules = [];
    state.modules.push(secModule);
  }
  secModule.config = { ...(secModule.config || {}), ...updates };
  await docRef.set(state);
}

async function logSyncEventInDb(guildId: string, msg: string, type: 'info' | 'warn' | 'success') {
  const db = Database.getDb();
  if (!db) return;
  const docRef = db.collection('guild_configs').doc(guildId);
  const doc = await docRef.get();
  let state: any = {};
  if (doc.exists) {
    state = doc.data();
  }
  if (!state.syncLogs) state.syncLogs = [];
  const time = new Date().toTimeString().split(' ')[0];
  state.syncLogs.unshift({ time, msg, type });
  if (state.syncLogs.length > 100) state.syncLogs.pop();
  await docRef.set(state);
}

async function run() {
  // Generate System JWT token
  const token = jwt.sign(
    { id: 'system', username: 'System CLI', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '5m' }
  );

  console.log(`[UPM CLI] Attempting to connect to running WebServer...`);
  try {
    const response = await fetch(`http://localhost:${PORT}/api/modules/security/upm/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Guild-Id': guildId
      } as Record<string, string>
    });

    if (response.ok) {
      console.log(`✅ Success (via API): Restoration initialized successfully.`);
      process.exit(0);
    } else {
      const errText = await response.text();
      console.warn(`⚠️ WebServer returned error status ${response.status}: ${errText}. Falling back to standalone execution...`);
    }
  } catch (err: any) {
    console.log(`ℹ️ WebServer is not reachable (${err.message}). Falling back to standalone execution...`);
  }

  // Standalone Fallback
  console.log(`[UPM CLI] Connecting to Database...`);
  await Database.connect();

  const db = Database.getDb();
  if (!db) {
    console.error("❌ Database connection failed.");
    process.exit(1);
  }

  // Fetch current state synchronously
  const doc = await db.collection('guild_configs').doc(guildId).get();
  const modulesState = doc.exists ? doc.data()?.modules || [] : [];

  console.log(`[UPM CLI] Connecting to Discord Gateway...`);
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildWebhooks
    ]
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`[UPM CLI] Logged in as bot user ${client.user?.tag}`);

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ Error: Guild ${guildId} not found.`);
      client.destroy();
      process.exit(1);
    }

    const context = {
      guildId,
      client,
      getModulesState: () => modulesState,
      updateModuleConfig: (id: string, configUpdates: Record<string, any>) => {
        const mod = modulesState.find((m: any) => m.id === id);
        if (mod) {
          mod.config = { ...(mod.config || {}), ...configUpdates };
        }
        updateSecurityConfigInDb(guildId, configUpdates).catch(console.error);
      },
      logSyncEvent: (msgOrGuildId: string | undefined, msgOrType?: string, type?: 'info' | 'warn' | 'success') => {
        const msg = type !== undefined ? msgOrType : msgOrGuildId;
        const finalType = type !== undefined ? type : (msgOrType as any || 'info');
        console.log(`[LOG] [${finalType.toUpperCase()}]: ${msg}`);
        logSyncEventInDb(guildId, msg || '', finalType).catch(console.error);
      }
    };

    console.log(`[UPM CLI] Starting standalone restoration for guild "${guild.name}"...`);
    await restoreFromLiveSnapshot(guild, client, context);
    console.log(`✅ Success (standalone): Restoration completed.`);
  } catch (e: any) {
    console.error(`❌ Standalone Execution Failed:`, e.message || e);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

run().catch(err => {
  console.error(`❌ Critical Script Error:`, err);
  process.exit(1);
});
