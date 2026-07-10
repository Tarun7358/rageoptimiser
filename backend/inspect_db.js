import { Database } from './src/core/Database.js';

async function run() {
  await Database.connect();
  const db = Database.getDb();
  if (!db) {
    console.error('Database connection failed.');
    process.exit(1);
  }
  const guildId = '1266048940101599293';
  console.log('Fetching snapshot for guildId:', guildId);
  const snapDoc = await db.collection('upm_snapshots').doc(guildId).get();
  if (snapDoc.exists) {
    console.log('Snapshot found!');
    const data = snapDoc.data();
    console.log('Timestamp:', data.timestamp);
    if (data.channels) {
      console.log('Channels count:', data.channels.length);
      console.log('Sample channel details:');
      console.log(JSON.stringify(data.channels[0], null, 2));
    }
    if (data.roles) {
      console.log('Roles count:', data.roles.length);
      console.log('Sample role details:');
      console.log(JSON.stringify(data.roles[0], null, 2));
    }
    if (data.guildSettings) {
      console.log('Guild Settings:', JSON.stringify(data.guildSettings, null, 2));
    }
  } else {
    console.log('No snapshot found for guildId:', guildId);
  }
  process.exit(0);
}
run().catch(console.error);
