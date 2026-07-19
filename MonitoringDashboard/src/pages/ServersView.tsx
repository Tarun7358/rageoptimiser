import React, { useState } from 'react';
import { Search, Server, ShieldCheck, Activity, Users } from 'lucide-react';
import { useServerStore } from '../stores/serverStore.js';
import { StatusBadge } from '../components/StatusBadge/index.js';

export const ServersView: React.FC = () => {
  const servers = useServerStore((state) => state.servers);
  const [search, setSearch] = useState('');

  const filtered = servers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* View Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            SERVER EXPLORER ({servers.length})
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Realtime telemetry overview for all connected Discord guilds
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1"
            placeholder="Search by name or guild ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">
            No guilds found matching search filter.
          </div>
        ) : (
          filtered.map((server) => (
            <div
              key={server.id}
              className="panel-glass-interactive rounded-xl border border-slate-800/40 p-5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />

              {/* Title & Status */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-tight">{server.name}</h3>
                  <p className="text-[9px] text-slate-500 font-mono">ID: {server.id}</p>
                </div>
                <StatusBadge status={server.health} />
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-900 font-mono text-[10px]">
                <div className="space-y-1">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Members
                  </span>
                  <div className="text-slate-200 font-semibold">{server.memberCount} ({server.onlineMembers} online)</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    Daily Activity
                  </span>
                  <div className="text-slate-200 font-semibold">{server.commandsToday} cmd / {server.eventsToday} evts</div>
                </div>
              </div>

              {/* Alerts Warning Banner */}
              {server.activeAlertsCount > 0 && (
                <div className="mt-4 p-2 bg-red-950/20 border border-red-900/30 rounded-lg flex items-center gap-1.5 text-[9px] font-mono text-red-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{server.activeAlertsCount} Active security alert pending review</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default ServersView;
