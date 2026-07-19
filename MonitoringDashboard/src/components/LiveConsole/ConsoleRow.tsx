import React, { useState } from 'react';
import { Pin, Copy, ChevronDown, ChevronUp, Check, Shield, MessageSquare, Music, Database, Terminal, User } from 'lucide-react';
import type { TelemetryEvent, EventCategory } from '../../types/protocol.js';
import { useConsoleStore } from '../../stores/consoleStore.js';

interface ConsoleRowProps {
  event: TelemetryEvent;
}

export const ConsoleRow: React.FC<ConsoleRowProps> = ({ event }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const togglePin = useConsoleStore((state) => state.togglePin);

  const getCategoryIcon = (cat: EventCategory) => {
    switch (cat) {
      case 'SECURITY':
        return <Shield className="w-3.5 h-3.5" />;
      case 'COMMAND':
        return <Terminal className="w-3.5 h-3.5" />;
      case 'MUSIC':
      case 'VOICE':
        return <Music className="w-3.5 h-3.5" />;
      case 'DATABASE':
        return <Database className="w-3.5 h-3.5" />;
      case 'MEMBER':
        return <User className="w-3.5 h-3.5" />;
      case 'TICKETS':
      case 'DISCORD':
      default:
        return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'SUCCESS':
        return 'border-l-emerald-500 text-emerald-400 bg-emerald-500/5';
      case 'WARNING':
        return 'border-l-amber-500 text-amber-400 bg-amber-500/5';
      case 'ERROR':
      case 'CRITICAL':
      case 'EMERGENCY':
        return 'border-l-red-500 text-red-400 bg-red-500/5';
      case 'INFO':
      default:
        return 'border-l-blue-500 text-blue-400 bg-blue-500/5';
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`border-l-2 border-b border-slate-900/60 transition-colors cursor-pointer hover:bg-slate-900/20 ${getSeverityStyle(
        event.severity
      )}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex items-center px-4 py-3 select-none text-xs font-mono">
        {/* Time */}
        <span className="text-slate-500 w-20 flex-shrink-0">{formattedTime}</span>

        {/* Category Icon */}
        <span className="w-8 flex-shrink-0 flex items-center justify-center opacity-70">
          {getCategoryIcon(event.category)}
        </span>

        {/* Title / Action */}
        <span className="font-semibold text-slate-300 w-44 flex-shrink-0 truncate uppercase text-[10px] tracking-wide">
          {event.action}
        </span>

        {/* Guild */}
        <span className="text-slate-500 w-40 flex-shrink-0 truncate text-[11px] font-semibold">
          {event.guildName || 'SYSTEM'}
        </span>

        {/* Description */}
        <span className="text-slate-400 flex-1 truncate pr-4">{event.description}</span>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => togglePin(event.eventId)}
            className={`p-1.5 rounded hover:bg-slate-800/80 transition-colors ${
              event.isPinned ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
            }`}
            title="Pin event"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-slate-800/80 text-slate-600 hover:text-slate-400 transition-colors"
            title="Copy JSON payload"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded hover:bg-slate-800/80 text-slate-600 hover:text-slate-400 transition-colors"
          >
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Metadata JSON block */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 bg-slate-950/40 border-t border-slate-900/50">
          <div className="rounded-lg p-3 bg-slate-950/80 border border-slate-850 font-mono text-[10px] text-slate-400 overflow-x-auto">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-900/60">
              <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Metadata Payload</span>
              <span className="text-[9px] text-slate-500">ID: {event.eventId} • Seq: {event.sequence}</span>
            </div>
            <pre className="text-blue-300/90 leading-relaxed">{JSON.stringify(event.metadata, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
export default ConsoleRow;
