import dotenv from 'dotenv';
import { Database } from '../core/Database.js';

dotenv.config();

async function run() {
  await Database.connect();
  const db = Database.getDb();
  if (!db) {
    console.error('No database connection');
    return;
  }

  const doc = await db.collection('guild_configs').doc('1524869545590915262').get();
  if (!doc.exists) {
    console.error('No guild config doc found');
    return;
  }

  const data = doc.data();
  console.log('Guild config loaded.');
  const modules = data?.modules || [];
  for (const m of modules) {
    console.log(`\n--- Module: ${m.id} (${m.name}) ---`);
    console.log(JSON.stringify(m.config, null, 2));
  }

  process.exit(0);
}

run().catch(console.error);
