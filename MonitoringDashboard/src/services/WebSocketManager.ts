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
    console.log('Dashboard booting...');
    console.log('Creating WebSocketManager...');
    
    const gatewayUrl = import.meta.env.VITE_MONITORING_GATEWAY;
    console.log(`Using Gateway URL: ${gatewayUrl || 'Undefined'}`);

    if (!gatewayUrl) {
      console.error('❌ WebSocket Startup Failed: import.meta.env.VITE_MONITORING_GATEWAY is undefined or empty!');
      this.url = '';
    } else {
      this.url = gatewayUrl;
    }
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

    if (!this.url) {
      console.error('❌ Cannot connect: Gateway URL is not configured.');
      return;
    }

    useConnectionStore.getState().setConnecting(true);

    // Token priority: Zustand store (user login) → VITE env var → empty (rejected by gateway)
    const envToken = import.meta.env.VITE_MONITORING_AUTH_TOKEN as string | undefined;
    const resolvedToken = token || envToken || '';

    const tokenParam = resolvedToken ? `?token=${encodeURIComponent(resolvedToken)}` : '';
    const wsUrl = `${this.url}${tokenParam}`;


    console.log('Attempting WebSocket connection...');

    // Fetch historical events asynchronously to populate the console on boot
    const httpUrl = this.url.replace(/^ws/, 'http').replace(/\/telemetry$/, '') + '/api/events?limit=100';
    fetch(httpUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((e: any) => ({
            eventId: `ev_${e.sequence}`,
            sequence: e.sequence,
            timestamp: e.timestamp,
            category: e.payload.category?.toUpperCase() || 'SYSTEM',
            severity: e.payload.severity?.toUpperCase() || 'INFO',
            sourceModule: e.payload.category || 'system',
            guildId: e.payload.guildId,
            guildName: e.payload.guildName,
            action: e.payload.title || 'Telemetry Event',
            description: e.payload.description || '',
            metadata: e.payload.metadata || {}
          }));
          useConsoleStore.getState().setEvents(formatted);
          console.log(`[Dashboard] Loaded ${formatted.length} historical events from REST API.`);
        }
      })
      .catch((err) => {
        console.error('Failed to load historical events:', err);
      });

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket opened');
        this.handleOpen();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.handleClose();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    } catch (err) {
      console.error('WebSocket creation threw error:', err);
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

      console.log(`Received packet:
type: ${packet.type}
sequence: ${packet.sequence || 0}
sessionId: ${packet.sessionId || 'global'}
timestamp: ${packet.timestamp || new Date().toISOString()}
payload: ${JSON.stringify(packet.payload)}`);

      switch (packet.type) {
        case 'HELLO':
          useConnectionStore.getState().setHello({
            ...packet.payload,
            sessionId: packet.sessionId
          });
          console.log('[Dashboard] Zustand store updated for type: HELLO');
          useNotificationStore.getState().addNotification({
            title: 'Monitoring Gateway Connected',
            message: `Established connection to agent on host ${packet.payload.machineIdentity.hostname}`,
            type: 'success',
          });
          break;

        case 'HEARTBEAT':
          this.lastPingTime = Date.now();
          useConnectionStore.getState().setHeartbeat(packet.payload);
          console.log('[Dashboard] Zustand store updated for type: HEARTBEAT');
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
          console.log('[Dashboard] Zustand store updated for type: HEALTH');
          break;

        case 'EVENT':
          useConsoleStore.getState().addEvent(packet.payload);
          console.log('[Dashboard] Zustand store updated for type: EVENT');
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
          console.log('[Dashboard] Zustand store updated for type: ALERT');
          useNotificationStore.getState().addNotification({
            title: `[ALERT] ${packet.payload.title}`,
            message: packet.payload.description,
            type: packet.payload.severity === 'EMERGENCY' ? 'error' : 'warning',
            isPinned: true,
          });
          break;

        case 'METRICS':
          useMetricsStore.getState().setBotMetrics(packet.payload);
          if (packet.payload.guilds) {
            useServerStore.getState().setServers(packet.payload.guilds);
          }
          console.log('[Dashboard] Zustand store updated for type: METRICS');
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
