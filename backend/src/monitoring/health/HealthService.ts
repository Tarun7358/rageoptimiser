import { Database } from '../../core/Database.js';
import { HealthStatus } from '../types/index.js';
import os from 'os';

export class HealthService {
  private startTime = Date.now();

  public check(): HealthStatus {
    const isDbConnected = Database.getDb() !== null;
    const databaseStatus = isDbConnected ? 'connected' : 'disconnected';

    // Redis is not implemented in this bot currently
    const redisStatus = process.env.REDIS_URL ? 'offline' : 'unconfigured';

    // Calculate overall status based on database connection and system load
    let status: HealthStatus['status'] = 'healthy';

    const memoryPercentage = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    
    if (!isDbConnected) {
      status = 'error';
    } else if (memoryPercentage > 90) {
      status = 'degraded';
    } else if (memoryPercentage > 80) {
      status = 'warning';
    }

    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    return {
      status,
      databaseStatus,
      redisStatus,
      uptime,
    };
  }
}
