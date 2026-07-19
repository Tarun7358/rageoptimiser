import { create } from 'zustand';

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  supportedCapabilities: string[];
  gatewayPing: number;
  reconnectAttempts: number;
  uptime: number;
  botName: string | null;
  botVersion: string | null;
  agentVersion: string | null;
  machineInfo: any | null;
  setConnectionStatus: (status: boolean) => void;
  setConnecting: (status: boolean) => void;
  setHello: (payload: any) => void;
  setHeartbeat: (payload: any) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: false,
  isConnecting: false,
  sessionId: null,
  supportedCapabilities: [],
  gatewayPing: 0,
  reconnectAttempts: 0,
  uptime: 0,
  botName: null,
  botVersion: null,
  agentVersion: null,
  machineInfo: null,
  setConnectionStatus: (status) => set({ isConnected: status }),
  setConnecting: (status) => set({ isConnecting: status }),
  setHello: (payload) =>
    set({
      sessionId: payload.sessionId,
      botName: payload.botName,
      botVersion: payload.botVersion,
      agentVersion: payload.agentVersion,
      machineInfo: payload.machineIdentity,
      supportedCapabilities: payload.supportedCapabilities,
    }),
  setHeartbeat: (payload) =>
    set({
      uptime: payload.uptime,
      gatewayPing: payload.gatewayPing,
    }),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
