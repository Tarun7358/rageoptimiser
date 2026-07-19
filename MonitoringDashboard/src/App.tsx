import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore.js';
import { useConnectionStore } from './stores/connectionStore.js';
import { useConsoleStore } from './stores/consoleStore.js';
import { useMetricsStore } from './stores/metricsStore.js';
import { useAlertStore } from './stores/alertStore.js';
import { useNotificationStore } from './stores/notificationStore.js';
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

// Telemetry Types
import type { TelemetryEvent, TelemetryAlert } from './types/protocol.js';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { isConnected } = useConnectionStore();
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

  // Fallback simulator loop: generates realistic telemetry when offline so dashboard works independently
  useEffect(() => {
    if (!isAuthenticated || isConnected) return;

    // Seed initial Hello state when starting offline simulation
    useConnectionStore.getState().setHello({
      sessionId: 'ses_sim_' + Math.random().toString(36).substring(2, 7),
      botName: 'Rage Sim Engine',
      botVersion: 'v2.4.2-sim',
      agentVersion: 'v1.0.0-sim',
      supportedCapabilities: ['live_console', 'health_metrics', 'music_telemetry', 'security_audit', 'voice_monitoring'],
      machineIdentity: {
        machineId: 'mac_simulated_host',
        hostname: 'localhost-simulator',
        os: 'Windows 11 Localhost',
        architecture: 'x64',
        timezone: 'GMT+5:30',
        nodeVersion: 'v20.11.0',
      },
    });

    const simulatorTimer = setInterval(() => {
      // 1. System Hardware fluctuators
      const mockCpu = Math.floor(15 + Math.random() * 20);
      const mockRam = Math.floor(65 + Math.random() * 8);
      const mockEps = parseFloat((12 + Math.random() * 15).toFixed(1));
      const mockCpm = Math.floor(2 + Math.random() * 8);

      useMetricsStore.getState().setSystemMetrics({
        cpu: { usagePercentage: mockCpu, cores: 8 },
        memory: { processRSS: 165 + Math.floor(Math.random() * 20), hostUsed: 10450, hostTotal: 16384, percentage: mockRam },
        disk: { totalGB: 250, usedGB: 85, freeGB: 165, percentage: 34 },
        eventLoopDelayMs: Math.floor(1 + Math.random() * 4),
        services: { database: 'connected', redis: 'unconfigured', websocket: 'healthy' },
      });

      useMetricsStore.getState().setBotMetrics({
        guildCount: 3,
        userCount: 20670,
        onlineUserCount: 5410,
        commandsPerMinute: mockCpm,
        eventsPerSecond: mockEps,
        activeVoiceSessions: 12,
        activeMusicSessions: 8,
        openTicketsCount: 1,
      });

      useConnectionStore.getState().setHeartbeat({
        uptime: useConnectionStore.getState().uptime + 3,
        gatewayStatus: 'connected',
        gatewayPing: Math.floor(12 + Math.random() * 10),
        lastSequenceReceived: 0,
      });

      // 2. Randomized Telemetry events
      const rand = Math.random();
      if (rand < 0.25) {
        const categories = ['COMMAND', 'MUSIC', 'DATABASE', 'DISCORD', 'MEMBER'] as const;
        const selectedCat = categories[Math.floor(Math.random() * categories.length)];

        let event: TelemetryEvent;
        if (selectedCat === 'COMMAND') {
          const cmds = ['/play', '/volume', '/help', '/voice quarantine', '/ticket close'];
          const selectedCmd = cmds[Math.floor(Math.random() * cmds.length)];
          event = {
            eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
            sequence: Math.floor(Math.random() * 100),
            timestamp: new Date().toISOString(),
            category: 'COMMAND',
            severity: 'INFO',
            sourceModule: 'gateway',
            guildId: '8749204058302058',
            guildName: 'Clutch Nation Official',
            userId: '1294820593020592',
            action: 'SLASH_COMMAND',
            description: `Slash command executed: ${selectedCmd}`,
            metadata: { command: selectedCmd, args: {} },
          };
        } else if (selectedCat === 'MUSIC') {
          event = {
            eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
            sequence: Math.floor(Math.random() * 100),
            timestamp: new Date().toISOString(),
            category: 'MUSIC',
            severity: 'SUCCESS',
            sourceModule: 'music',
            guildId: '8749204058302058',
            guildName: 'Clutch Nation Official',
            action: 'TRACK_PLAYING',
            description: 'Now streaming: Synthwave Lofi Chill Mix',
            metadata: { track: 'Synthwave Lofi Chill Mix', duration: '05:12' },
          };
        } else {
          event = {
            eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
            sequence: Math.floor(Math.random() * 100),
            timestamp: new Date().toISOString(),
            category: selectedCat,
            severity: 'INFO',
            sourceModule: 'database',
            action: 'DATABASE_QUERY',
            description: 'SQLite index sweep completed successfully.',
            metadata: { table: 'guild_configurations', queryTimeMs: 1.2 },
          };
        }

        useConsoleStore.getState().addEvent(event);
      }

      // 3. Periodic warning alert
      if (rand < 0.03) {
        const alert: TelemetryAlert = {
          alertId: 'alt_' + Math.random().toString(36).substring(2, 9),
          sequence: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString(),
          category: 'SECURITY',
          severity: 'CRITICAL',
          sourceModule: 'anti-nuke',
          title: 'Anti-Nuke Action Triggered',
          description: 'Potential raid detected: user blocked from deleting multiple roles.',
          metadata: { limitThreshold: 3, user: 'raid_bot' },
          status: 'active',
        };
        useAlertStore.getState().addAlert(alert);
        useNotificationStore.getState().addNotification({
          title: `[ALERT] ${alert.title}`,
          message: alert.description,
          type: 'error',
          isPinned: true,
        });
      }
    }, 3000);

    return () => clearInterval(simulatorTimer);
  }, [isAuthenticated, isConnected]);

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
              <span>⚠️ Local telemetry server offline. Dashboard running in simulation mode.</span>
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
