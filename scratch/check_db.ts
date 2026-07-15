import { Database } from '../backend/src/core/Database.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('../backend/.env') });

async function run() {
  await Database.initialize();
  const db = Database.getDb();
  if (!db) {
    console.error('Database not connected');
    process.exit(1);
  }

  const doc = await db.collection('guild_configs').doc('1266048940101599293').get();
  if (!doc.exists) {
    console.log('No config document for guild 1266048940101599293');
  } else {
    const data = doc.data();
    console.log('Document data found:');
    const mw = data.modules?.find(m => m.id === 'member_whitelist');
    console.log('member_whitelist config members:', JSON.stringify(mw?.config?.members, null, 2));

    const bw = data.modules?.find(m => m.id === 'bot_whitelist');
    console.log('bot_whitelist config bots:', JSON.stringify(bw?.config?.bots, null, 2));

    const rw = data.modules?.find(m => m.id === 'role_whitelist');
    console.log('role_whitelist config roles:', JSON.stringify(rw?.config?.roles, null, 2));
  }
  process.exit(0);
}

run().catch(console.error);
