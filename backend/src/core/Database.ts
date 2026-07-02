import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function parseDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    const generalIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (generalIso.test(obj) && !isNaN(Date.parse(obj))) {
      return new Date(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(parseDates);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = parseDates(obj[key]);
    }
    return res;
  }
  return obj;
}

class MockDocumentSnapshot {
  constructor(public id: string, private docData: any, public exists: boolean, public ref: any) {}
  data() {
    return parseDates(this.docData);
  }
}

class MockQuerySnapshot {
  constructor(public docs: MockDocumentSnapshot[]) {}
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

class MockDocument {
  constructor(private collectionName: string, private docId: string, private db: MockDbHelper) {}

  async get(): Promise<MockDocumentSnapshot> {
    const data = this.db.readDoc(this.collectionName, this.docId);
    return new MockDocumentSnapshot(this.docId, data, data !== null, this);
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    this.db.writeDoc(this.collectionName, this.docId, data, options?.merge);
  }

  async update(data: any): Promise<void> {
    this.db.writeDoc(this.collectionName, this.docId, data, true);
  }

  async delete(): Promise<void> {
    this.db.deleteDoc(this.collectionName, this.docId);
  }
}

class MockQuery {
  private wheres: Array<[string, string, any]> = [];
  private orderField: string | null = null;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private limitCount: number | null = null;

  constructor(protected collectionName: string, protected db: MockDbHelper) {}

  where(field: string, op: string, value: any): MockQuery {
    this.wheres.push([field, op, value]);
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    this.orderField = field;
    this.orderDirection = direction;
    return this;
  }

  limit(count: number): MockQuery {
    this.limitCount = count;
    return this;
  }

  async get(): Promise<MockQuerySnapshot> {
    let docs = this.db.readCollection(this.collectionName);
    
    // Apply wheres
    for (const [field, op, value] of this.wheres) {
      docs = docs.filter(d => {
        const val = d.data[field];
        if (op === '==') return val === value;
        if (op === 'array-contains') return Array.isArray(val) && val.includes(value);
        return false;
      });
    }

    // Apply orderBy
    if (this.orderField) {
      docs.sort((a, b) => {
        const valA = a.data[this.orderField!];
        const valB = b.data[this.orderField!];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const res = valA > valB ? 1 : -1;
        return this.orderDirection === 'asc' ? res : -res;
      });
    }

    // Apply limit
    if (this.limitCount !== null) {
      docs = docs.slice(0, this.limitCount);
    }

    return new MockQuerySnapshot(
      docs.map(d => new MockDocumentSnapshot(d.id, d.data, true, new MockDocument(this.collectionName, d.id, this.db)))
    );
  }
}

class MockCollection extends MockQuery {
  constructor(collectionName: string, db: MockDbHelper) {
    super(collectionName, db);
  }

  doc(docId?: string): MockDocument {
    const id = docId || 'doc_' + Math.random().toString(36).substring(2, 15);
    return new MockDocument(this.collectionName, id, this.db);
  }

  async add(data: any): Promise<MockDocument> {
    const docId = 'doc_' + Math.random().toString(36).substring(2, 15);
    const docRef = this.doc(docId);
    await docRef.set(data);
    return docRef;
  }
}

class MockDbHelper {
  private filePath = path.join(process.cwd(), 'guilds_data', 'local_db.json');

  constructor() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private readAll(): Record<string, Array<{ id: string; data: any }>> {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeAll(data: any) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  readCollection(collectionName: string): Array<{ id: string; data: any }> {
    const db = this.readAll();
    return db[collectionName] || [];
  }

  readDoc(collectionName: string, docId: string): any | null {
    const collection = this.readCollection(collectionName);
    const item = collection.find(d => d.id === docId);
    return item ? item.data : null;
  }

  writeDoc(collectionName: string, docId: string, data: any, merge = false) {
    const db = this.readAll();
    if (!db[collectionName]) {
      db[collectionName] = [];
    }

    const index = db[collectionName].findIndex(d => d.id === docId);
    if (index >= 0) {
      if (merge) {
        db[collectionName][index].data = { ...db[collectionName][index].data, ...data };
      } else {
        db[collectionName][index].data = data;
      }
    } else {
      db[collectionName].push({ id: docId, data });
    }

    this.writeAll(db);
  }

  deleteDoc(collectionName: string, docId: string) {
    const db = this.readAll();
    if (!db[collectionName]) return;
    db[collectionName] = db[collectionName].filter(d => d.id !== docId);
    this.writeAll(db);
  }
}

export class MockFirestore {
  private dbHelper = new MockDbHelper();

  collection(collectionName: string): MockCollection {
    return new MockCollection(collectionName, this.dbHelper);
  }
}

export class Database {
  private static isConnected = false;
  private static firestoreInstance: Firestore | null = null;

  public static async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      if (getApps().length === 0) {
        const keyPath = path.join(process.cwd(), 'firebase-key.json');
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
      console.warn('⚠️ Proceeding with local database fallback.');
      this.firestoreInstance = new MockFirestore() as any;
      this.isConnected = true;
    }
  }

  public static getDb() {
    return this.firestoreInstance;
  }
}

