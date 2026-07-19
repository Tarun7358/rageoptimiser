import React, { useRef, useState, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Play, Pause, Trash2, ArrowDown, Download, Terminal, Pin } from 'lucide-react';
import { useConsoleStore } from '../../stores/consoleStore.js';
import { ConsoleRow } from './ConsoleRow.js';
import { ConsoleFilters } from './ConsoleFilters.js';

export const LiveConsole: React.FC = () => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const { isPaused, setPaused, clearConsole, getFilteredEvents, pinnedEvents } = useConsoleStore();

  const filteredEvents = getFilteredEvents();

  // Scroll to bottom when new events arrive if auto-scroll is on
  useEffect(() => {
    if (atBottom && !isPaused && filteredEvents.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: filteredEvents.length - 1,
          align: 'end',
          behavior: 'auto'
        });
      }, 50);
    }
  }, [filteredEvents.length, atBottom, isPaused]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rage_operations_dump_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="panel-glass rounded-xl border border-slate-800/40 overflow-hidden flex flex-col h-[600px] console-scanlines bg-slate-950/40">
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-slate-500">|</span>
          <div className="flex items-center text-slate-300 font-mono text-xs font-semibold gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            LIVE OPERATIONS STREAM
          </div>
        </div>

        {/* Console Controls */}
        <div className="flex items-center space-x-2">
          {/* Pause / Play */}
          <button
            onClick={() => setPaused(!isPaused)}
            className={`p-1.5 rounded-lg border transition-all text-xs font-mono flex items-center gap-1 ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isPaused ? 'Resume Streaming' : 'Pause Streaming'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'PAUSED' : 'PAUSE'}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
            title="Export JSON Logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear Console */}
          <button
            onClick={clearConsole}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-red-500/70 hover:text-red-400 hover:bg-red-950/10 transition-all"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <ConsoleFilters />

      {/* Pinned Events Section */}
      {pinnedEvents.length > 0 && (
        <div className="bg-blue-500/5 border-b border-blue-500/10 max-h-28 overflow-y-auto">
          <div className="px-4 py-1.5 bg-blue-500/10 flex items-center gap-1.5 text-[9px] font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Pin className="w-3 h-3" /> Pinned Warnings & Critical Alerts
          </div>
          {pinnedEvents.map((event) => (
            <ConsoleRow key={`pinned_${event.eventId}`} event={event} />
          ))}
        </div>
      )}

      {/* Virtualized Log Stream */}
      <div className="flex-1 bg-slate-950/60 overflow-hidden relative">
        {filteredEvents.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
            <div className="p-3 bg-slate-900/50 rounded-full border border-slate-800/40 mb-3 animate-pulse">
              <Terminal className="w-6 h-6 text-slate-600" />
            </div>
            <span>No events matching the active filters.</span>
            <span className="text-[10px] text-slate-600 mt-1">Waiting for incoming telemetry packets...</span>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={filteredEvents}
            scrollerRef={(ref) => {
              // Custom bottom scroll detection
              if (ref && ref instanceof HTMLElement) {
                ref.addEventListener('scroll', () => {
                  const isBottom = ref.scrollHeight - ref.scrollTop - ref.clientHeight < 40;
                  setAtBottom(isBottom);
                });
              }
            }}
            itemContent={(_, event) => <ConsoleRow event={event} />}
            className="h-full"
          />
        )}

        {/* Jump to bottom alert */}
        {!atBottom && filteredEvents.length > 0 && (
          <button
            onClick={() => {
              setAtBottom(true);
              virtuosoRef.current?.scrollToIndex({
                index: filteredEvents.length - 1,
                align: 'end',
                behavior: 'smooth'
              });
            }}
            className="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded-lg text-[10px] font-mono flex items-center gap-1.5 shadow-lg border border-blue-400/20 z-20 animate-bounce"
          >
            <ArrowDown className="w-3 h-3" />
            Scroll to bottom
          </button>
        )}
      </div>
    </div>
  );
};
export default LiveConsole;
