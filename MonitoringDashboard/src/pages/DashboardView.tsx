import React from 'react';
import { Server, Users, Terminal, Play } from 'lucide-react';
import { useMetricsStore } from '../stores/metricsStore.js';
import { MetricCard } from '../components/MetricCard/index.js';
import { LiveConsole } from '../components/LiveConsole/index.js';

export const DashboardView: React.FC = () => {
  const botMetrics = useMetricsStore((state) => state.botMetrics);

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
