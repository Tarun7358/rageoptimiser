import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Client, GatewayIntentBits } from 'discord.js';
import { Database } from '../core/Database.js';
import { captureLiveSnapshot, saveLiveSnapshotToDb } from '../modules/security/manifest.js';

dotenv.config();

const guildId = (process.argv[2] || process.env.GUILD_ID) as string;
if (!guildId) {
  console.error("❌ Error: Please provide a Guild ID as an argument. Example: npm run upm:snapshot <guildId>");
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
    const response = await fetch(`http://localhost:${PORT}/api/modules/security/upm/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Guild-Id': guildId
      } as Record<string, string>
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success (via API): Captured UPM snapshot at timestamp ${data.timestamp}`);
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

    console.log(`[UPM CLI] Capturing live snapshot for guild "${guild.name}"...`);
    const snap = await captureLiveSnapshot(guild);
    await saveLiveSnapshotToDb(guildId, snap);

    console.log(`[UPM CLI] Syncing config and audit logs to database...`);
    await updateSecurityConfigInDb(guildId, {
      upmSnapshot: {
        timestamp: snap.timestamp,
        channelsCount: snap.channels?.length || 0,
        rolesCount: snap.roles?.length || 0
      }
    });

    await logSyncEventInDb(guildId, 'Live Snapshot manually captured via CLI script.', 'success');

    console.log(`✅ Success (standalone): Snapshot captured with ${snap.channels?.length} channels and ${snap.roles?.length} roles.`);
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
