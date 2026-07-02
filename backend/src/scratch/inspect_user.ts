import dotenv from 'dotenv';
import { Database } from '../core/Database.js';
import { SecurityService } from '../core/SecurityService.js';

dotenv.config();

async function inspect() {
  await Database.connect();
  const db = Database.getDb();
  if (!db) {
    console.error('No DB connection');
    return;
  }

  const userDoc = await db.collection('admin_users').where('username', '==', 'admin').get();
  if (userDoc.empty) {
    console.log('No user found');
    return;
  }

  const adminData = userDoc.docs[0].data();
  console.log('Admin username:', adminData.username);
  console.log('totpEnabled:', adminData.totpEnabled);
  console.log('totpSecret encrypted:', adminData.totpSecret);

  if (adminData.totpSecret) {
    try {
      const secret = SecurityService.decrypt(adminData.totpSecret);
      console.log('Decrypted secret:', secret);
    } catch (e: any) {
      console.error('Decryption failed:', e.message);
    }
  }
  process.exit(0);
}

inspect().catch(console.error);
