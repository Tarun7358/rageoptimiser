import { useAuthStore } from '../stores/authStore.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { useConsoleStore } from '../stores/consoleStore.js';
import { useMetricsStore } from '../stores/metricsStore.js';
import { useAlertStore } from '../stores/alertStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import type { Packet } from '../types/protocol.js';

export class TelemetryWebSocketManager {
  private static instance: TelemetryWebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private url = 'ws://localhost:6002/telemetry'; // Match MonitoringAgent url
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private lastPingTime = Date.now();
  private maxReconnectDelay = 30000;
  private initialReconnectDelay = 2000;
  private lastProcessedSequence = 0;

  private constructor() {
    this.url = import.meta.env.VITE_MONITORING_GATEWAY || 'ws://localhost:6002/telemetry';
  }

  public static getInstance(): TelemetryWebSocketManager {
    if (!this.instance) {
      this.instance = new TelemetryWebSocketManager();
    }
    return this.instance;
  }

  public connect(): void {
    const { token } = useAuthStore.getState();
    const { isConnected, isConnecting } = useConnectionStore.getState();

    if (isConnected || isConnecting) return;

    useConnectionStore.getState().setConnecting(true);

    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${this.url}${tokenParam}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.handleOpen();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.handleClose();
      };

      this.ws.onerror = () => {
        // Handled via onclose
      };
    } catch (err) {
      this.handleClose();
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useConnectionStore.getState().setConnectionStatus(false);
    useConnectionStore.getState().setConnecting(false);
  }

  private handleOpen(): void {
    useConnectionStore.getState().setConnectionStatus(true);
    useConnectionStore.getState().setConnecting(false);
    useConnectionStore.getState().resetReconnectAttempts();
    this.startHeartbeat();

    // Check if we should attempt a protocol resume
    const { sessionId } = useConnectionStore.getState();
    if (sessionId && this.lastProcessedSequence > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'RESUME',
        sessionId,
        lastSequence: this.lastProcessedSequence
      }));
    }
  }

  private handleMessage(dataStr: string): void {
    try {
      const packet = JSON.parse(dataStr) as Packet;
      if (packet.sequence) {
        this.lastProcessedSequence = packet.sequence;
      }

      switch (packet.type) {
        case 'HELLO':
          useConnectionStore.getState().setHello({
            ...packet.payload,
            sessionId: packet.sessionId
          });
          useNotificationStore.getState().addNotification({
            title: 'Monitoring Gateway Connected',
            message: `Established connection to agent on host ${packet.payload.machineIdentity.hostname}`,
            type: 'success',
          });
          break;

        case 'HEARTBEAT':
          this.lastPingTime = Date.now();
          useConnectionStore.getState().setHeartbeat(packet.payload);
          // Auto reply pong to agent
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'RESPONSE',
              version: '1.0.0',
              sessionId: packet.sessionId,
              timestamp: new Date().toISOString(),
              sequence: packet.sequence,
              payload: { status: 'ok' }
            }));
          }
          break;

        case 'HEALTH':
          useMetricsStore.getState().setSystemMetrics(packet.payload);
          break;

        case 'EVENT':
          useConsoleStore.getState().addEvent(packet.payload);
          if (packet.payload.guildId) {
            useServerStore.getState().recordServerActivity(
              packet.payload.guildId,
              packet.payload.guildName || 'Unknown Server',
              packet.payload.category === 'COMMAND'
            );
          }
          break;

        case 'ALERT':
          useAlertStore.getState().addAlert(packet.payload);
          useNotificationStore.getState().addNotification({
            title: `[ALERT] ${packet.payload.title}`,
            message: packet.payload.description,
            type: packet.payload.severity === 'EMERGENCY' ? 'error' : 'warning',
            isPinned: true,
          });
          break;

        case 'METRICS':
          useMetricsStore.getState().setBotMetrics(packet.payload);
          break;

        case 'ERROR':
          useNotificationStore.getState().addNotification({
            title: `Agent Error: ${packet.payload.errorCode}`,
            message: packet.payload.message,
            type: 'error',
          });
          break;
      }
    } catch {
      // Ignore malformed protocol packets
    }
  }

  private handleClose(): void {
    useConnectionStore.getState().setConnectionStatus(false);
    useConnectionStore.getState().setConnecting(false);
    this.stopHeartbeat();

    // Reconnection loop with backoff
    const { reconnectAttempts } = useConnectionStore.getState();
    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, reconnectAttempts),
      this.maxReconnectDelay
    );

    useConnectionStore.getState().incrementReconnectAttempts();
    useNotificationStore.getState().addNotification({
      title: 'Gateway Connection Lost',
      message: `Retrying connection in ${(delay / 1000).toFixed(0)} seconds...`,
      type: 'warning',
    });

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPingTime = Date.now();
    this.heartbeatTimer = setInterval(() => {
      // If no heartbeat packet received for more than 40s, drop connection to reconnect
      if (Date.now() - this.lastPingTime > 40000) {
        this.disconnect();
        this.connect();
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
export const telemetryWS = TelemetryWebSocketManager.getInstance();
