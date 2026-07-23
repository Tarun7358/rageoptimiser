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
    this.url = process.env.MONITORING_GATEWAY_URL || process.env.MONITORING_DASHBOARD_URL || '';
    this.token = process.env.MONITORING_AUTH_TOKEN || '';
  }

  public connect(): void {
    if (this.isConnected || this.isConnecting) return;

    const hasDashboardUrl = !!process.env.MONITORING_DASHBOARD_URL;
    const hasGatewayUrl = !!process.env.MONITORING_GATEWAY_URL;
    const hasToken = !!process.env.MONITORING_AUTH_TOKEN;

    const urlSource = hasGatewayUrl 
      ? 'MONITORING_GATEWAY_URL' 
      : (hasDashboardUrl ? 'MONITORING_DASHBOARD_URL' : 'None');

    const isValidUrl = this.url && (this.url.startsWith('ws://') || this.url.startsWith('wss://'));

    if (!this.url || !this.token || !isValidUrl) {
      console.warn('Gateway URL not set.');
      ConsoleMirror.warn('Telemetry client running in silent/buffer mode.');
      
      console.log('Telemetry Configuration');
      const maskedToken = this.token ? (this.token.substring(0, 4) + '*'.repeat(Math.max(0, this.token.length - 4))) : 'Missing';
      console.log(`Gateway URL: ${this.url || 'Missing'}`);
      console.log(`Gateway URL Source: ${urlSource}`);
      console.log(`Dashboard URL Alias: ${hasDashboardUrl ? 'Found' : 'Missing'}`);
      console.log(`Authentication Token: ${hasToken ? 'Loaded' : 'Missing'}`);
      console.log(`Protocol: 1.0.0`);
      return;
    }

    console.log('Configuration Loaded');
    console.log('Telemetry Configuration');
    const maskedToken = this.token ? (this.token.substring(0, 4) + '*'.repeat(Math.max(0, this.token.length - 4))) : 'Missing';
    console.log(`Gateway URL: ${this.url}`);
    console.log(`Gateway URL Source: ${urlSource}`);
    console.log(`Dashboard URL Alias: ${hasDashboardUrl ? 'Found' : 'Missing'}`);
    console.log(`Authentication Token: ${hasToken ? 'Loaded' : 'Missing'}`);
    console.log(`Protocol: 1.0.0`);

    console.log('Gateway URL Loaded');
    console.log('Connecting...');
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
        console.log('WebSocket Open');
        console.log('Authentication Sent');
        this.startHeartbeat();
        this.flushOfflineQueue();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'HELLO') {
            console.log('Authentication Accepted');
            console.log('HELLO Sent');
            console.log('HELLO Accepted');
            console.log('Heartbeat Started');
            console.log('Monitoring Gateway Connected');
          } else if (message.type === 'PONG') {
            // Heartbeat acknowledged
          }
        } catch {
          // Ignore parse errors
        }
      });

      this.ws.on('close', () => {
        this.handleDisconnect();
      });

      this.ws.on('error', (err: any) => {
        if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
          console.log(`[Telemetry] Waiting for Gateway to be ready at ${this.url}...`);
        } else {
          ConsoleMirror.warn(`Telemetry connection error: ${err.message}`);
        }
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
      console.log(`Agent → Gateway: ${data.type} | timestamp: ${new Date().toISOString()}`);
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
