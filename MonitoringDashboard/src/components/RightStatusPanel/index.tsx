import React from 'react';
import { Cpu, Database, Shield, Zap, RefreshCw, BarChart2 } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore.js';
import { useMetricsStore } from '../../stores/metricsStore.js';
import { HealthCard } from '../HealthCard/index.js';
import { StatusBadge } from '../StatusBadge/index.js';

export const RightStatusPanel: React.FC = () => {
  const isConnected = useConnectionStore((state) => state.isConnected);
  const uptime = useConnectionStore((state) => state.uptime);
  const gatewayPing = useConnectionStore((state) => state.gatewayPing);

  const systemMetrics = useMetricsStore((state) => state.systemMetrics);
  const botMetrics = useMetricsStore((state) => state.botMetrics);

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="w-80 border-l border-slate-800/80 bg-slate-950/40 backdrop-blur-md p-4 space-y-6 overflow-y-auto select-none z-10">
      {/* 1. Gateway Status */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-blue-400" />
          CONNECTION ENGINE
        </h2>
        <div className="panel-glass rounded-xl p-3.5 border border-slate-900 space-y-2.5 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Gateway Status:</span>
            <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {isConnected ? 'STREAMING' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Gateway Uptime:</span>
            <span className="text-slate-300">{formatUptime(uptime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Gateway Ping:</span>
            <span className="text-slate-300">{gatewayPing}ms</span>
          </div>
        </div>
      </section>

      {/* 2. System Hardware Resources */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          SYSTEM RESOURCES
        </h2>
        <div className="space-y-2">
          <HealthCard
            title="Processor Core Load"
            value={systemMetrics?.cpu.usagePercentage || 0}
            label={`${systemMetrics?.cpu.usagePercentage || 0}%`}
            detail={`${systemMetrics?.cpu.cores || 0} Cores`}
          />
          <HealthCard
            title="System Memory RSS"
            value={systemMetrics?.memory.percentage || 0}
            label={`${systemMetrics?.memory.percentage || 0}%`}
            detail={`${systemMetrics?.memory.processRSS || 0} MB RSS`}
          />
          <HealthCard
            title="Host Storage"
            value={systemMetrics?.disk.percentage || 0}
            label={`${systemMetrics?.disk.percentage || 0}%`}
            detail={`${systemMetrics?.disk.usedGB || 0} GB / ${systemMetrics?.disk.totalGB || 0} GB`}
            color="blue"
          />
        </div>
      </section>

      {/* 3. Operational Workloads */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
          WORKLOAD METRICS
        </h2>
        <div className="panel-glass rounded-xl p-3.5 border border-slate-900 space-y-2.5 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Guilds Registered:</span>
            <span className="text-slate-200">{botMetrics?.guildCount || 0} Servers</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Cached Users:</span>
            <span className="text-slate-200">{botMetrics?.userCount || 0} Users</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Events Throughput:</span>
            <span className="text-slate-200">{botMetrics?.eventsPerSecond?.toFixed(1) || 0} EPS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Command Frequency:</span>
            <span className="text-slate-200">{botMetrics?.commandsPerMinute || 0} CPM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Active Music Rooms:</span>
            <span className="text-slate-200">{botMetrics?.activeMusicSessions || 0} Channels</span>
          </div>
        </div>
      </section>

      {/* 4. Core Services Health */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          SERVICE HEALTH
        </h2>
        <div className="panel-glass rounded-xl p-3.5 border border-slate-900 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500 flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" />
              SQLite DB Status:
            </span>
            <StatusBadge status={systemMetrics?.services.database || 'offline'} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              Redis Cache:
            </span>
            <StatusBadge status={systemMetrics?.services.redis || 'unconfigured'} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-slate-400" />
              Agent Telemetry:
            </span>
            <StatusBadge status={isConnected ? 'healthy' : 'error'} />
          </div>
        </div>
      </section>
    </div>
  );
};
export default RightStatusPanel;
