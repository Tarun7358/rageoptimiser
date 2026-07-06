const http = require('http');
const { exec } = require('child_process');

class HealthMonitor {
  constructor(config, logger, processManager, onStatus) {
    this.config = config;
    this.logger = logger;
    this.pm = processManager;
    this.onStatus = onStatus || (() => {});
    this.interval = null;
    this.lastStatus = {};
    this.basePath = null;
  }

  start(basePath) {
    this.basePath = basePath;
    const ms = this.config.health.checkIntervalMs || 5000;
    this.logger.info(`Health monitor started (interval: ${ms}ms)`);
    this.interval = setInterval(() => this._check(), ms);
    // Run once immediately
    this._check();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.logger.info('Health monitor stopped.');
    }
  }

  async _check() {
    const backendPort = this.config.ports.backend;
    const dashPort = this.config.ports.dashboard;

    const [backendOk, dashOk, mem, cpu] = await Promise.all([
      this._pingHttp(`http://localhost:${backendPort}/api/health`),
      this._pingHttp(`http://localhost:${dashPort}`),
      this._getMemUsage(),
      this._getCpuUsage()
    ]);

    const procStatus = this.pm.getStatus();

    const status = {
      timestamp: new Date().toISOString(),
      backend: {
        running: procStatus.backend,
        responding: backendOk,
        pid: procStatus.backendPid
      },
      musicBot: {
        running: procStatus.musicBot,
        responding: procStatus.musicBot, // musicBot runs headless without an HTTP server
        pid: procStatus.musicBotPid
      },
      dashboard: {
        running: procStatus.dashboard,
        responding: dashOk,
        pid: procStatus.dashboardPid
      },
      system: {
        memoryMB: mem,
        cpuPercent: cpu
      }
    };

    this.lastStatus = status;
    this.onStatus(status);

    // Auto-recovery: if process is tracked as running but not responding
    if (procStatus.backend && !backendOk) {
      this.logger.warn('Backend process running but not responding to HTTP — may still be starting up.');
    }
    if (procStatus.dashboard && !dashOk) {
      this.logger.warn('Dashboard process running but not responding — may still be starting up.');
    }
    if (!procStatus.musicBot) {
      this.logger.warn('Music Bot process is not running.');
    }
  }

  _pingHttp(url) {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
  }

  _getMemUsage() {
    return new Promise((resolve) => {
      try {
        const mem = process.memoryUsage();
        // Return total RSS in MB (launcher + approximation)
        resolve(Math.round(mem.rss / 1024 / 1024));
      } catch {
        resolve(0);
      }
    });
  }

  _getCpuUsage() {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') { resolve(0); return; }
      exec('wmic cpu get loadpercentage /value', (err, stdout) => {
        if (err) { resolve(0); return; }
        const match = stdout.match(/LoadPercentage=(\d+)/);
        resolve(match ? parseInt(match[1]) : 0);
      });
    });
  }

  getLastStatus() {
    return this.lastStatus;
  }
}

module.exports = HealthMonitor;
