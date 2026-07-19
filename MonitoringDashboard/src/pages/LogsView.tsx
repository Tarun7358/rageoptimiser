import React, { useState } from 'react';
import { ScrollText, Search, Copy, Download, Calendar } from 'lucide-react';
import { useConsoleStore } from '../stores/consoleStore.js';

export const LogsView: React.FC = () => {
  const events = useConsoleStore((state) => state.events);
  const [search, setSearch] = useState('');

  const filtered = events.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rage_historical_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-blue-400" />
            HISTORICAL LOGS EXPLORER
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Audit and filter past operational telemetry stored in the local session buffer
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={handleDownload}
            disabled={filtered.length === 0}
            className="px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Log Set
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel-glass rounded-xl p-4 border border-slate-800/40 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500/50"
            placeholder="Query keyword search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="panel-glass rounded-xl border border-slate-800/40 overflow-hidden font-mono text-[10px]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-900/60 text-slate-500 border-b border-slate-800 font-bold uppercase tracking-wider">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-3">Action/Module</div>
          <div className="col-span-5">Message</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-slate-900/60 max-h-[450px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500">No logs captured yet in this session.</div>
          ) : (
            filtered.map((log) => (
              <div
                key={`log_${log.eventId}`}
                className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-900/10 text-slate-350 transition-colors items-center"
              >
                <div className="col-span-2 text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-900 border border-slate-800 font-bold text-slate-400">
                    {log.category}
                  </span>
                </div>
                <div className="col-span-3 truncate text-slate-300 font-semibold uppercase text-[9px]">
                  {log.action} ({log.sourceModule})
                </div>
                <div className="col-span-5 flex items-center justify-between gap-4">
                  <span className="truncate flex-1 text-slate-400">{log.description}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(log, null, 2))}
                    className="p-1 hover:bg-slate-800 rounded text-slate-600 hover:text-slate-400 flex-shrink-0 transition-colors"
                    title="Copy detail JSON"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default LogsView;
