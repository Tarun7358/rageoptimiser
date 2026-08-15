import { Database } from '../core/Database.js';

async function analyzeNukeResults() {
  const TARGET_GUILD = '1508399161798819840';
  await Database.connect();
  const db = Database.getDb();

  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  console.log('\n=======================================================');
  console.log(`📊 POST-ATTACK COMPREHENSIVE ANALYSIS REPORT`);
  console.log(`TARGET GUILD ID: ${TARGET_GUILD}`);
  console.log(`TIME: ${new Date().toISOString()}`);
  console.log('=======================================================\n');

  // 1. Fetch all sync_logs logged in the last 15 minutes
  const recentLogs = await db.all<any>(
    `SELECT * FROM sync_logs WHERE (guildId = ? OR msg LIKE '%1508399161798819840%' OR msg LIKE '%Anti-Nuke%') ORDER BY id DESC LIMIT 50`,
    [TARGET_GUILD]
  );

  console.log(`📥 RECENT SECURITY LOGS (${recentLogs.length} entries):`);
  for (const log of recentLogs.reverse()) {
    console.log(`  [${log.time || log.createdAt}] [${log.type.toUpperCase()}] ${log.msg}`);
  }

  // 2. Fetch trusted actor abuse logs
  const abuseLogs = await db.all<any>(
    `SELECT * FROM trusted_actor_abuse_logs WHERE guildId = ? ORDER BY id DESC LIMIT 10`,
    [TARGET_GUILD]
  );

  if (abuseLogs && abuseLogs.length > 0) {
    console.log(`\n🚨 TRUSTED ACTOR ABUSE INCIDENTS (${abuseLogs.length} entries):`);
    for (const abuse of abuseLogs) {
      console.log(`  - User: ${abuse.userId} | Type: ${abuse.trustType} | Punishment: ${abuse.punishmentType}`);
      console.log(`    Actions: ${abuse.actionsTimeline}`);
    }
  } else {
    console.log('\n✅ No trusted actor abuse overrides recorded.');
  }

  // 3. Fetch prebot whitelist state
  const prebots = await db.all<any>(
    `SELECT * FROM prebot_whitelist WHERE guildId = ?`,
    [TARGET_GUILD]
  );
  console.log(`\n🤖 PREBOT WHITELIST STATE: ${prebots.length} registered prebots.`);
  for (const b of prebots) {
    console.log(`  - Bot ID: ${b.botId} (${b.botName}) | Added by: ${b.addedBy}`);
  }

  console.log('\n=======================================================\n');
}

analyzeNukeResults().catch(console.error);
