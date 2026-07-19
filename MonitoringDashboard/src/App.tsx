import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore.js';
import { useConnectionStore } from './stores/connectionStore.js';
import { telemetryWS } from './services/WebSocketManager.js';

// Layout Components
import { Header } from './components/Header/index.js';
import { Sidebar } from './components/Sidebar/index.js';
import type { DashboardTab } from './components/Sidebar/index.js';
import { RightStatusPanel } from './components/RightStatusPanel/index.js';
import { CommandPalette } from './components/CommandPalette/index.js';

// Pages / Tabs
import { LoginView } from './pages/LoginView.js';
import { DashboardView } from './pages/DashboardView.js';
import { ServersView } from './pages/ServersView.js';
import { AlertsView } from './pages/AlertsView.js';
import { AnalyticsView } from './pages/AnalyticsView.js';
import { LogsView } from './pages/LogsView.js';
import { SettingsView } from './pages/SettingsView.js';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const isConnected = useConnectionStore((state) => state.isConnected);
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');

  // Trigger WebSocket connection once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      telemetryWS.connect();
    } else {
      telemetryWS.disconnect();
    }
    return () => {
      telemetryWS.disconnect();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'servers':
        return <ServersView />;
      case 'alerts':
        return <AlertsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'logs':
        return <LogsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans select-none overflow-x-hidden text-slate-200">
      {/* 1. Global Header */}
      <Header />

      {/* 2. Main content container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Dynamic Inner page console area */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-950/20">
          {!isConnected && (
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs font-mono text-blue-400 glow-blue animate-pulse">
              <span>⚠️ Gateway Telemetry server offline. Attempting to establish link...</span>
              <button
                onClick={() => telemetryWS.connect()}
                className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] uppercase font-bold hover:bg-blue-500/40"
              >
                Reconnect
              </button>
            </div>
          )}

          {renderActiveView()}
        </main>

        {/* Right Status Sidebar */}
        <RightStatusPanel />
      </div>

      {/* 3. Command Palette Modal */}
      <CommandPalette />
    </div>
  );
};
export default App;
