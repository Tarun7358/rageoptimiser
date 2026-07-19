import React from 'react';
import { Server, Users, Terminal, Play } from 'lucide-react';
import { useMetricsStore } from '../stores/metricsStore.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { MetricCard } from '../components/MetricCard/index.js';
import { LiveConsole } from '../components/LiveConsole/index.js';

export const DashboardView: React.FC = () => {
  const botMetrics = useMetricsStore((state) => state.botMetrics);
  const { isConnected, sessionId } = useConnectionStore();

  const hasAgent = isConnected && sessionId && sessionId !== 'no_active_agent';

  if (!hasAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 p-8 text-center space-y-4 glow-blue">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 animate-pulse">
          <Server className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100">Waiting for Monitoring Agent...</h2>
        <p className="text-sm text-slate-400 max-w-md">
          No Live Telemetry Available. Please start the Rage Optimiser bot application to establish the gateway connection link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Top Row: Quick stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Guilds"
          value={botMetrics?.guildCount || 0}
          icon={<Server className="w-4 h-4" />}
          description="Total Discord guilds connected"
        />
        <MetricCard
          title="Observed Users"
          value={botMetrics?.userCount || 0}
          icon={<Users className="w-4 h-4" />}
          description="Total users cached in shards"
        />
        <MetricCard
          title="Command Load"
          value={`${botMetrics?.commandsPerMinute || 0} CPM`}
          icon={<Terminal className="w-4 h-4" />}
          description="Commands processed per minute"
        />
        <MetricCard
          title="Active Music Streams"
          value={botMetrics?.activeMusicSessions || 0}
          icon={<Play className="w-4 h-4" />}
          description="Active voice stream rooms"
        />
      </div>

      {/* 2. Main Live Console centerpiece */}
      <div className="w-full">
        <LiveConsole />
      </div>
    </div>
  );
};
export default DashboardView;
