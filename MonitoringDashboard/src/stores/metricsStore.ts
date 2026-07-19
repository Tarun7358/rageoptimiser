import { create } from 'zustand';
import type { SystemMetrics, BotMetrics } from '../types/protocol.js';

interface MetricsHistoryPoint {
  timestamp: string;
  cpu: number;
  ram: number;
  eps: number;
  cpm: number;
  latency: number;
}

interface MetricsState {
  systemMetrics: SystemMetrics | null;
  botMetrics: BotMetrics | null;
  history: MetricsHistoryPoint[];
  setSystemMetrics: (metrics: SystemMetrics) => void;
  setBotMetrics: (metrics: BotMetrics) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_POINTS = 40;

export const useMetricsStore = create<MetricsState>((set) => ({
  systemMetrics: null,
  botMetrics: null,
  history: [],
  setSystemMetrics: (systemMetrics) =>
    set((state) => {
      // Create new history point combined with current state
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newPoint: MetricsHistoryPoint = {
        timestamp: timeStr,
        cpu: systemMetrics.cpu.usagePercentage,
        ram: systemMetrics.memory.percentage,
        eps: state.botMetrics?.eventsPerSecond || 0,
        cpm: state.botMetrics?.commandsPerMinute || 0,
        latency: systemMetrics.eventLoopDelayMs,
      };

      const updatedHistory = [...state.history, newPoint];
      if (updatedHistory.length > MAX_HISTORY_POINTS) {
        updatedHistory.shift();
      }

      return { systemMetrics, history: updatedHistory };
    }),
  setBotMetrics: (botMetrics) => set({ botMetrics }),
  clearHistory: () => set({ history: [] }),
}));
