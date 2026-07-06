import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export class Database {
  private static isConnected = false;
  private static firestoreInstance: Firestore | null = null;

  public static async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      let keyPath = path.join(process.cwd(), '../backend/firebase-key.json');
      if (!fs.existsSync(keyPath)) {
        keyPath = path.join(process.cwd(), 'firebase-key.json');
      }

      if (getApps().length === 0) {
        if (fs.existsSync(keyPath)) {
          console.log(`[Music Database] Initializing Firebase with key from: ${keyPath}`);
          const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          initializeApp({
            credential: cert(serviceAccount)
          });
        } else {
          console.log('[Music Database] Initializing Firebase with applicationDefault...');
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
