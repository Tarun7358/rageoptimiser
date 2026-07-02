const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logsDir) {
    this.logsDir = logsDir;
    this.maxDays = 7;
    this._ensureDir();
    this._rotate();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  _getLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `launcher-${date}.log`);
  }

  _rotate() {
    try {
      const files = fs.readdirSync(this.logsDir)
        .filter(f => f.startsWith('launcher-') && f.endsWith('.log'))
        .map(f => ({ name: f, time: fs.statSync(path.join(this.logsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      // Delete files older than maxDays
      const cutoff = Date.now() - (this.maxDays * 24 * 60 * 60 * 1000);
      files.forEach(f => {
        if (f.time < cutoff) {
          fs.unlinkSync(path.join(this.logsDir, f.name));
        }
      });
    } catch (e) {
      // ignore rotation errors
    }
  }

  _write(level, message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.padEnd(7)}] ${message}\n`;

    // Write to file
    try {
      fs.appendFileSync(this._getLogFile(), line, 'utf8');
    } catch (e) {
      console.error('Logger write error:', e);
    }

    // Also print to console
    const colors = { INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m', DEBUG: '\x1b[90m', SUCCESS: '\x1b[32m' };
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    console.log(`${color}${line.trim()}${reset}`);
  }

  info(msg)    { this._write('INFO',    msg); }
  warn(msg)    { this._write('WARN',    msg); }
  error(msg)   { this._write('ERROR',   msg); }
  debug(msg)   { this._write('DEBUG',   msg); }
  success(msg) { this._write('SUCCESS', msg); }

  section(title) {
    this._write('INFO', `${'═'.repeat(60)}`);
    this._write('INFO', `  ${title}`);
    this._write('INFO', `${'═'.repeat(60)}`);
  }

  getLogPath() {
    return this._getLogFile();
  }

  getLogsDir() {
    return this.logsDir;
  }
}

module.exports = Logger;
