import React from 'react';
import { Settings, Volume2, VolumeX, Moon, Sun, Monitor, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useConsoleStore } from '../stores/consoleStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

export const SettingsView: React.FC = () => {
  const { theme, setTheme, soundEnabled, setSoundEnabled } = useSettingsStore();
  const clearConsole = useConsoleStore((state) => state.clearConsole);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleClearLogs = () => {
    clearConsole();
    addNotification({
      title: 'Console Reset',
      message: 'Telemetry console log buffers cleared successfully.',
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          CONSOLE SETTINGS
        </h2>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          Configure operations center visual theme, sound triggers, and buffer sizes
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Card 1: Theme Options */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4">
          <h3 className="text-xs font-bold font-mono text-slate-200 uppercase border-b border-slate-900 pb-2">
            Visual Color Theme
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`py-3 rounded-lg border font-mono text-xs flex flex-col items-center justify-center gap-2 transition-all ${
                  theme === t
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                    : 'bg-slate-950/20 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-350'
                }`}
              >
                {t === 'dark' ? <Moon className="w-4 h-4" /> : t === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="capitalize">{t} Theme</span>
              </button>
            ))}
          </div>
        </div>

        {/* Card 2: Alerts Sound */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4">
          <h3 className="text-xs font-bold font-mono text-slate-200 uppercase border-b border-slate-900 pb-2">
            Audio Alert Configuration
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-300 font-mono">Alarm Sound Trigger</div>
              <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                Play an audible tone when CRITICAL or EMERGENCY security alerts are reported
              </div>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Card 3: Database Reset */}
        <div className="panel-glass rounded-xl p-5 border border-slate-800/40 space-y-4">
          <h3 className="text-xs font-bold font-mono text-slate-200 uppercase border-b border-slate-900 pb-2 text-red-400">
            Maintenance Operations
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-300 font-mono">Flush Log Buffers</div>
              <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                Discard all cached telemetry events in active state memory to reduce DOM overhead
              </div>
            </div>

            <button
              onClick={handleClearLogs}
              className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsView;
