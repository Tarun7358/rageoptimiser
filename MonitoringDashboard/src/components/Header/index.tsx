import React from 'react';
import { ShieldCheck, LogOut, Terminal, Activity, Wifi, WifiOff } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { NotificationCenter } from '../NotificationCenter/index.js';

export const Header: React.FC = () => {
  const isConnected = useConnectionStore((state) => state.isConnected);
  const isConnecting = useConnectionStore((state) => state.isConnecting);
  const botVersion = useConnectionStore((state) => state.botVersion);
  const botName = useConnectionStore((state) => state.botName);
  const gatewayPing = useConnectionStore((state) => state.gatewayPing);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between z-30 select-none">
      {/* Brand Logo */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20 border border-blue-400/20 glow-blue">
          <Activity className="w-5 h-5 text-slate-100 animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100 font-mono tracking-tight flex items-center gap-1.5">
            RAGE OPTIMISER
            <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-normal px-1.5 py-0.5 rounded uppercase font-mono">
              Mission Control
            </span>
          </h1>
          <p className="text-[10px] text-slate-500 font-mono">
            {botName || 'System Offline'} {botVersion ? `(${botVersion})` : ''} • Protocol v1.0.0
          </p>
        </div>
      </div>

      {/* Center Search / Command bar tip */}
      <div className="hidden md:flex items-center px-3 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded-lg max-w-sm flex-1 mx-8 text-slate-500 text-[10px] font-mono justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span>Search or execute commands...</span>
        </div>
        <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-[9px] font-mono text-slate-400">Ctrl + K</kbd>
      </div>

      {/* Right Stats & Avatar Actions */}
      <div className="flex items-center space-x-4">
        {/* Gateway Ping latency */}
        {isConnected && (
          <div className="hidden sm:flex items-center space-x-1.5 font-mono text-[10px] text-slate-400 bg-slate-900/50 border border-slate-800/60 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>PING: {gatewayPing}ms</span>
          </div>
        )}

        {/* Connection status tag */}
        <div
          className={`flex items-center space-x-1.5 font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isConnecting
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>ONLINE</span>
            </>
          ) : isConnecting ? (
            <>
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>CONNECTING</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>OFFLINE</span>
            </>
          )}
        </div>

        {/* Notification Center */}
        <NotificationCenter />

        {/* User Log out */}
        <div className="flex items-center space-x-3 border-l border-slate-800/80 pl-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700/60 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
            TR
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-500 hover:text-red-400 bg-slate-900/40 hover:bg-red-950/10 rounded-lg border border-slate-800/80 hover:border-red-900/30 transition-all"
            title="Disconnect from session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
export default Header;
