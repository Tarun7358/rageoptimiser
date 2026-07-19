import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('../database.sqlite');
console.log('Checking database path:', dbPath);
console.log('Exists:', fs.existsSync(dbPath));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], async (err, rows) => {
    if (err) {
      console.error('Failed to list tables:', err.message);
      process.exit(1);
    }
    
    console.log(`Found ${rows.length} tables in database:`);
    for (const row of rows as any[]) {
      await new Promise<void>((resolve) => {
        db.get(`SELECT COUNT(*) as count FROM ${row.name}`, [], (err, countRow: any) => {
          if (err) {
            console.error(`  - ${row.name}: Error - ${err.message}`);
          } else {
            console.log(`  - ${row.name}: ${countRow.count} rows`);
          }
          resolve();
        });
      });
    }
    db.close();
  });
});
