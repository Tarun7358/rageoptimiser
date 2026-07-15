import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.all('SELECT modules FROM guild_configs WHERE guildId = ?', ['1266048940101599293'], (err, rows: any[]) => {
  if (err) {
    console.error(err);
    return;
  }
  for (const row of rows) {
    const modules = JSON.parse(row.modules);
    const sec = modules.find((m: any) => m.id === 'security');
    if (sec) {
      console.log('SECURITY MODULE:', sec.status);
      console.log('RULES CONFIG:', JSON.stringify(sec.config.rules, null, 2));
    }
  }
  db.close();
});
