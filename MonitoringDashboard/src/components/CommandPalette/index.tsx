import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Search, Play, RefreshCw, Database, ShieldAlert, Sparkles } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore.js';

interface CommandOption {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  icon: React.ReactNode;
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const commands: CommandOption[] = [
    { id: 'restart_music', name: 'restart music', description: 'Reboot active guild audio stream connections', icon: <Play className="w-4 h-4 text-emerald-400" /> },
    { id: 'reload_config', name: 'reload config', description: 'Force reload configuration registry from SQLite', icon: <RefreshCw className="w-4 h-4 text-amber-400" /> },
    { id: 'search_guild', name: 'search guild', description: 'Inspect details for a specific Discord guild ID', icon: <Search className="w-4 h-4 text-blue-400" /> },
    { id: 'sync_commands', name: 'sync commands', description: 'Redeploy application slash commands to Discord API', icon: <Database className="w-4 h-4 text-purple-400" /> },
    { id: 'backup', name: 'backup database', description: 'Create dynamic snapshot backup of SQLite tables', icon: <ShieldAlert className="w-4 h-4 text-red-400" /> },
    { id: 'ai_diagnose', name: 'ai audit', description: 'Trigger AI Assistant runtime diagnostic sweep', icon: <Sparkles className="w-4 h-4 text-pink-400" /> },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filtered = commands.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (cmd: CommandOption) => {
    addNotification({
      title: 'Command Acknowledged',
      message: `Execution of [${cmd.name}] requested. (Remote Operations are locked in UI mode)`,
      type: 'info',
    });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden border rounded-xl panel-glass border-slate-800 shadow-2xl">
        {/* Search header */}
        <div className="flex items-center px-4 border-b border-slate-800/80">
          <Terminal className="w-5 h-5 text-slate-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="w-full py-4 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-sm font-mono"
            placeholder="Type a command to execute (e.g. restart music)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs font-mono">No operations found.</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left text-xs font-mono transition-colors ${
                  i === selectedIndex
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                    : 'border border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                }`}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800">{cmd.icon}</div>
                  <div>
                    <div className="font-semibold text-slate-200">{cmd.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{cmd.description}</div>
                  </div>
                </div>
                {cmd.shortcut && (
                  <kbd className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-500 rounded">{cmd.shortcut}</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/30 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Use ↑↓ to navigate, Enter to run</span>
          <span>CTRL + K to close</span>
        </div>
      </div>
    </div>
  );
};
export default CommandPalette;
