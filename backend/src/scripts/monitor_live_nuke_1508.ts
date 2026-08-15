import { Database } from '../core/Database.js';

async function monitorLiveNuke() {
  const TARGET_GUILD = '1508399161798819840';
  console.log(`=======================================================`);
  console.log(`🛡️ RAGE OPTIMISER V3: LIVE ATTACK MONITOR & ANALYSIS`);
  console.log(`TARGET GUILD ID: ${TARGET_GUILD}`);
  console.log(`=======================================================\n`);

  await Database.connect();
  const db = Database.getDb();

  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  // Fetch current config for target guild
  const configRow = await db.get<any>('SELECT * FROM guild_configs WHERE guildId = ?', [TARGET_GUILD]);
  if (configRow) {
    const modules = JSON.parse(configRow.modules || '[]');
    const sec = modules.find((m: any) => m.id === 'security');
    console.log('⚙️ SECURITY CONFIGURATION MATRIX FOR GUILD:');
    console.log(`   - Anti-Nuke Engine: ${sec?.config?.antiNukeEnabled !== false ? '🟢 ENABLED' : '🔴 DISABLED'}`);
    console.log(`   - Anti-Channel Delete Rule:`, sec?.config?.rules?.anti_channel_delete || 'Default (1 per 10s)');
    console.log(`   - Anti-Channel Create Rule:`, sec?.config?.rules?.anti_channel_create || 'Default (3 per 10s)');
    console.log(`   - Anti-Ban Rule:`, sec?.config?.rules?.anti_ban || 'Default (3 per 10s)');
    console.log(`   - Security Whitelist:`, sec?.config?.bypassUserIds || []);
    console.log(`-------------------------------------------------------\n`);
  }

  console.log('📡 STREAMING LIVE SECURITY EVENTS (Press Ctrl+C to stop)...');

  let lastSeenLogId = 0;

  setInterval(async () => {
    try {
      // 1. Fetch Sync & Security Logs
      const logs = await db.all<any>(
        `SELECT * FROM sync_logs WHERE (guildId = ? OR guildId IS NULL OR guildId = '') AND id > ? ORDER BY id ASC LIMIT 20`,
        [TARGET_GUILD, lastSeenLogId]
      );

      for (const log of logs) {
        lastSeenLogId = Math.max(lastSeenLogId, log.id);
        const timeStr = log.time || new Date().toLocaleTimeString();
        let icon = 'ℹ️';
        if (log.type === 'warn' || (log.msg && log.msg.includes('🚨'))) icon = '🚨 [ATTACK DETECTED]';
        else if (log.type === 'success' || (log.msg && (log.msg.includes('Restored') || log.msg.includes('Re-created')))) icon = '✅ [RECOVERY EXECUTION]';
        
        console.log(`[${timeStr}] ${icon} ${log.msg}`);
      }

    } catch (e) {
      console.error('Error reading live logs:', e);
    }
  }, 1000);
}

monitorLiveNuke().catch(console.error);
