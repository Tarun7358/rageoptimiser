import os from 'os';
import fs from 'fs';
import { monitorEventLoopDelay } from 'perf_hooks';
import { SystemMetrics } from '../types/index.js';
import dns from 'dns/promises';

export class SystemCollector {
  private lastCpuUsage: { user: number; system: number; time: number } | null = null;
  private elDelayMonitor = monitorEventLoopDelay({ resolution: 10 });

  constructor() {
    this.elDelayMonitor.enable();
  }

  public async collect(): Promise<SystemMetrics> {
    const memory = process.memoryUsage();
    const ramUsage = Math.round(memory.rss / (1024 * 1024)); // MB
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryPercentage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const cpuUsagePercent = this.getCpuUsage();
    const diskUsage = this.getDiskUsage();
    const networkStatus = await this.checkNetworkStatus();

    // Event loop delay in ms
    const eventLoopDelay = Math.round(this.elDelayMonitor.mean / 1e6); // ns to ms
    this.elDelayMonitor.reset();

    return {
      cpuUsage: cpuUsagePercent,
      ramUsage,
      memoryPercentage,
      diskUsage,
      nodeVersion: process.version,
      pid: process.pid,
      eventLoopDelay,
      networkStatus,
    };
  }

  private getCpuUsage(): number {
    const currentUsage = process.cpuUsage();
    const currentTime = Date.now();

    if (!this.lastCpuUsage) {
      this.lastCpuUsage = {
        user: currentUsage.user,
        system: currentUsage.system,
        time: currentTime,
      };
      return 0;
    }

    const elapsedCpu = (currentUsage.user - this.lastCpuUsage.user) + (currentUsage.system - this.lastCpuUsage.system);
    const elapsedTime = currentTime - this.lastCpuUsage.time;

    this.lastCpuUsage = {
      user: currentUsage.user,
      system: currentUsage.system,
      time: currentTime,
    };

    if (elapsedTime === 0) return 0;

    // process.cpuUsage values are in microseconds (1e-6 seconds), elapsed time is in milliseconds
    const percentage = (elapsedCpu / (elapsedTime * 1000)) * 100;
    // Cap to 100% per core, or divide by cpu count for overall machine percentage
    const cpusCount = os.cpus().length || 1;
    return Math.min(100, Math.max(0, Math.round(percentage / cpusCount)));
  }

  private getDiskUsage(): { total: number; free: number; used: number; percentage: number } {
    try {
      // Use fs.statfsSync if available (Node.js 18+)
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(process.cwd());
        const total = stats.bsize * stats.blocks;
        const free = stats.bsize * stats.bfree;
        const used = total - free;
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        return {
          total: Math.round(total / (1024 * 1024 * 1024)), // GB
          free: Math.round(free / (1024 * 1024 * 1024)),
          used: Math.round(used / (1024 * 1024 * 1024)),
          percentage,
        };
      }
    } catch {
      // Fallback
    }

    // Default mock disk usage if system stats fail
    return {
      total: 100,
      free: 75,
      used: 25,
      percentage: 25,
    };
  }

  private async checkNetworkStatus(): Promise<'connected' | 'disconnected'> {
    try {
      await dns.resolve('discord.com');
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}
