import dotenv from 'dotenv';
import { Database } from '../core/Database.js';
import { SecurityService } from '../core/SecurityService.js';
import crypto from 'crypto';

dotenv.config();

function decryptWithFallback(encryptedText: string): string {
  const key = crypto.createHash('sha256').update(String('fallback_secret')).digest();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function migrate() {
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

  const doc = userDoc.docs[0];
  const adminData = doc.data();

  if (adminData.totpSecret) {
    try {
      // 1. Decrypt with fallback_secret
      const plainSecret = decryptWithFallback(adminData.totpSecret);
      console.log('Successfully decrypted secret:', plainSecret);

      // 2. Encrypt with current JWT_SECRET (loaded from dotenv)
      const newEncrypted = SecurityService.encrypt(plainSecret);
      console.log('New encrypted secret:', newEncrypted);

      // 3. Update database
      await doc.ref.update({
        totpSecret: newEncrypted
      });
      console.log('✅ Stored migrated encrypted secret in database!');
    } catch (e: any) {
      console.error('Migration failed:', e.message);
    }
  }
  process.exit(0);
}

migrate().catch(console.error);
