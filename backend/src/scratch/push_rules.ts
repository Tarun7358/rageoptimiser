import dotenv from 'dotenv';
import { Database } from '../core/Database.js';

dotenv.config();

const GUILD_ID = process.env.GUILD_ID || '1508399161798819840';

const rules = {
  anti_channel_delete: { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true },
  anti_channel_create: { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true },
  anti_channel_update: { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true },
  anti_role_delete:    { enabled: true, limit: 1, window: 10, action: 'quarantine', recovery: true },
  anti_role_create:    { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true },
  anti_role_update:    { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true },
  anti_ban:            { enabled: true, limit: 2, window: 10, action: 'quarantine', recovery: true },
  anti_kick:           { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true },
  anti_bot_add:        { enabled: true, limit: 1, window: 10, action: 'ban',        recovery: true },
  anti_webhook_create: { enabled: true, limit: 2, window: 10, action: 'quarantine', recovery: true },
  anti_webhook_delete: { enabled: true, limit: 2, window: 10, action: 'quarantine', recovery: true },
};

async function pushRules() {
  await Database.connect();
  const db = Database.getDb();
  if (!db) {
    console.error('Database not connected');
    process.exit(1);
  }

  const docRef = db.collection('guild_configs').doc(GUILD_ID);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.error(`Guild config not found for ${GUILD_ID}`);
    process.exit(1);
  }

  const data = doc.data()!;
  const modules = data.modules || [];
  const secIdx = modules.findIndex((m: any) => m.id === 'security');

  if (secIdx === -1) {
    console.error('Security module not found in guild config');
    process.exit(1);
  }

  modules[secIdx].config = {
    ...modules[secIdx].config,
    rules
  };

  await docRef.update({ modules });
  console.log('✅ Rules pushed to Firestore successfully!');
  console.log('anti_channel_delete limit:', modules[secIdx].config.rules.anti_channel_delete.limit);
  console.log('anti_role_delete limit:', modules[secIdx].config.rules.anti_role_delete.limit);
  process.exit(0);
}

pushRules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
