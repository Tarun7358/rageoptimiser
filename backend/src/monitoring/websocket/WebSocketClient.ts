import WebSocket from 'ws';
import { MonitoringEvent, HeartbeatPayload } from '../types/index.js';
import { ConsoleMirror } from '../utils/ConsoleMirror.js';

export class TelemetryWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // Max 30 seconds
  private initialReconnectDelay = 2000; // Start at 2 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private offlineQueue: MonitoringEvent[] = [];
  private maxOfflineQueueSize = 500;
  private isConnecting = false;

  constructor() {
    this.url = process.env.MONITORING_DASHBOARD_URL || 'ws://localhost:6002/telemetry';
    this.token = process.env.MONITORING_AUTH_TOKEN || 'default_telemetry_token';
  }

  public connect(): void {
    if (this.isConnected || this.isConnecting) return;

    // Check if dashboard monitoring is enabled (could check environment)
    if (!process.env.MONITORING_DASHBOARD_URL) {
      ConsoleMirror.info('MONITORING_DASHBOARD_URL not set. Telemetry client running in silent/buffer mode.');
    }

    this.isConnecting = true;
    const finalUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(finalUrl, {
        perMessageDeflate: true, // Compression support
        handshakeTimeout: 5000,
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        ConsoleMirror.success('Gateway Connected - Established connection to Telemetry Dashboard.');
        this.startHeartbeat();
        this.flushOfflineQueue();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'PONG') {
            // Heartbeat acknowledged
          }
        } catch {
          // Ignore parse errors
        }
      });

      this.ws.on('close', () => {
        this.handleDisconnect();
      });

      this.ws.on('error', (err) => {
        // Suppress print to standard console, mirror silently or log as warning
        ConsoleMirror.warn(`Telemetry connection error: ${err.message}`);
        // Let close event trigger reconnection
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    this.ws = null;

    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'PING', timestamp: new Date().toISOString() });
    }, 15000); // 15 seconds heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public sendEvent(event: MonitoringEvent): void {
    if (this.isConnected) {
      this.send({
        type: 'EVENT',
        payload: event,
      });
    } else {
      this.queueOfflineEvent(event);
    }
  }

  public sendHeartbeat(payload: HeartbeatPayload): void {
    if (this.isConnected) {
      this.send({
        type: 'HEARTBEAT',
        payload,
      });
    }
  }

  private send(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(data));
    } catch (err) {
      // Ignore websocket write issues
    }
  }

  private queueOfflineEvent(event: MonitoringEvent): void {
    if (this.offlineQueue.length >= this.maxOfflineQueueSize) {
      this.offlineQueue.shift(); // Evict oldest to respect bounds
    }
    this.offlineQueue.push(event);
  }

  private flushOfflineQueue(): void {
    while (this.offlineQueue.length > 0 && this.isConnected) {
      const event = this.offlineQueue.shift();
      if (event) {
        this.sendEvent(event);
      }
    }
  }
}
