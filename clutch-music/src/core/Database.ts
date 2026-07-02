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
      if (getApps().length === 0) {
        const keyPath = path.join(process.cwd(), '../backend/firebase-key.json');
        if (fs.existsSync(keyPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          initializeApp({
            credential: cert(serviceAccount)
          });
        } else {
          initializeApp({
            credential: applicationDefault()
          });
        }
      }
      
      this.firestoreInstance = getFirestore();
      this.isConnected = true;
      console.log('✅ Successfully connected to Firebase Firestore.');
    } catch (error) {
      console.error('❌ Failed to connect to Firebase:', error);
      console.warn('⚠️ Proceeding without database connection.');
    }
  }

  public static getDb() {
    return this.firestoreInstance;
  }
}
