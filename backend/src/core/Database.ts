import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export class Database {
  private static isConnected = false;
  private static firestoreInstance: Firestore | null = null;

  public static async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      let keyPath = path.join(process.cwd(), 'firebase-key.json');
      if (!fs.existsSync(keyPath)) {
        keyPath = path.join(process.cwd(), 'backend', 'firebase-key.json');
      }
      if (!fs.existsSync(keyPath)) {
        try {
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          keyPath = path.resolve(currentDir, '../../firebase-key.json');
        } catch {
          // ignore url conversion errors if run outside ESM context
        }
      }

      // Automatically generate key file from env variable if available and file is missing
      const envKeyContent = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (envKeyContent && !fs.existsSync(keyPath)) {
        try {
          fs.writeFileSync(keyPath, envKeyContent, 'utf8');
          console.log('[Database] Written Firebase credentials dynamically from environment variable.');
        } catch (e: any) {
          console.error('[Database] Failed to write dynamic Firebase key:', e.message);
        }
      }

      if (getApps().length === 0) {
        if (fs.existsSync(keyPath)) {
          console.log(`[Database] Initializing Firebase with key from: ${keyPath}`);
          const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          initializeApp({
            credential: cert(serviceAccount)
          });
        } else {
          console.log('[Database] Initializing Firebase with applicationDefault credentials...');
          initializeApp({
            credential: applicationDefault()
          });
        }
      }
      
      this.firestoreInstance = getFirestore();
      this.isConnected = true;
      console.log('✅ Successfully connected to Firebase Firestore.');
    } catch (error: any) {
      console.error('❌ Failed to connect to Firebase:', error.message || error);
      throw error;
    }
  }

  public static getDb() {
    return this.firestoreInstance;
  }
}
