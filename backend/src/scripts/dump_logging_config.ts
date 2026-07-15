import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all('SELECT guildId, modules FROM guild_configs', [], (err, rows: any[]) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }
  for (const row of rows) {
    const modules = JSON.parse(row.modules);
    const logMod = modules.find((m: any) => m.id === 'logging');
    if (logMod && JSON.stringify(logMod.config) !== '{}' && JSON.stringify(logMod.config) !== '{"security":{"ignoreRoles":[],"events":{},"enabled":false,"ignoreUsers":[]}}') {
      console.log(`GUILD ID: ${row.guildId}`);
      console.log('LOGGING MODULE STATUS:', logMod.status);
      console.log('LOGGING MODULE CONFIG:', JSON.stringify(logMod.config, null, 2));
    }
  }
  db.close();
});
