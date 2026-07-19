import { SessionManager } from '../sessions/index.js';

export interface HealthReport {
  status: 'online';
  connectedBots: number;
  connectedDashboards: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu: NodeJS.CpuUsage;
  uptime: number;
  version: string;
  protocol: string;
}

export class HealthHelper {
  private static dashboardConnectionsCount = 0;

  public static incrementDashboardConnections(): void {
    this.dashboardConnectionsCount++;
  }

  public static decrementDashboardConnections(): void {
    this.dashboardConnectionsCount = Math.max(0, this.dashboardConnectionsCount - 1);
  }

  public static getReport(): HealthReport {
    return {
      status: 'online',
      connectedBots: SessionManager.getActiveSessions().length,
      connectedDashboards: this.dashboardConnectionsCount,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      version: '1.0.0',
      protocol: '1.0.0',
    };
  }
}
