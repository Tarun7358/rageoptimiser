import React from 'react';
import { BarChart3, Cpu, Activity, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { useMetricsStore } from '../stores/metricsStore.js';

export const AnalyticsView: React.FC = () => {
  const history = useMetricsStore((state) => state.history);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          REALTIME METRICS & GRAPHING
        </h2>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          Live timeseries tracking of hardware utilization and gateway event throughput
        </p>
      </div>

      {/* Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Hardware Resource Load */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <span className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              CPU & Memory Allocation (%)
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>

          <div className="h-64 w-full text-[10px] font-mono">
            {history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">Awaiting timeseries data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.2)" />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(11,13,19,0.9)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" name="CPU Usage" stroke="#6366f1" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="ram" name="Memory" stroke="#ec4899" fillOpacity={1} fill="url(#colorRam)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Shard Activity Rates */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <span className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Event Stream Rates (EPS)
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>

          <div className="h-64 w-full text-[10px] font-mono">
            {history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">Awaiting timeseries data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.2)" />
                  <YAxis stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(11,13,19,0.9)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                    }}
                  />
                  <Line type="monotone" dataKey="eps" name="Events/Sec (EPS)" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="cpm" name="Commands/Min (CPM)" stroke="#eab308" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Node.js Event Loop delay latency */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <span className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              Node.js Event Loop Delay (ms)
            </span>
          </div>

          <div className="h-56 w-full text-[10px] font-mono">
            {history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">Awaiting timeseries data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.2)" />
                  <YAxis stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(11,13,19,0.9)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="latency" name="Loop Delay (ms)" stroke="#10b981" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default AnalyticsView;
