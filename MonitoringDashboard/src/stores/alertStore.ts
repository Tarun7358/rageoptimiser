import { create } from 'zustand';
import type { TelemetryAlert } from '../types/protocol.js';

interface AlertState {
  alerts: TelemetryAlert[];
  addAlert: (alert: TelemetryAlert) => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((state) => {
      // Avoid duplicate alertId insertions
      if (state.alerts.some((a) => a.alertId === alert.alertId)) return {};
      return { alerts: [alert, ...state.alerts] };
    }),
  acknowledgeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.alertId === alertId ? { ...a, status: 'acknowledged' as const } : a
      ),
    })),
  resolveAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.alertId === alertId
          ? { ...a, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
          : a
      ),
    })),
  clearAlerts: () => set({ alerts: [] }),
}));
