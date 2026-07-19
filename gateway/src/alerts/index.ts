import { v4 as uuidv4 } from 'uuid';
import { Alert, HeartbeatPayload } from '../types/index.js';
import { Storage } from '../storage/index.js';
import { logger } from '../logging/index.js';

export class AlertEngine {
  private static activeAlerts = new Map<string, Alert>(); // Key: botId:alertType
  private static onAlertTriggeredCallback: ((alert: Alert) => void) | null = null;

  public static setOnAlertTriggered(callback: (alert: Alert) => void): void {
    this.onAlertTriggeredCallback = callback;
  }

  public static async initialize(): Promise<void> {
    try {
      const rows = await Storage.all(`SELECT * FROM alerts WHERE resolved = 0`);
      for (const row of rows) {
        this.activeAlerts.set(`${row.botId}:${row.type}`, row);
      }
      logger.info('AlertEngine initialized with active alerts');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize AlertEngine');
    }
  }

  public static async evaluateHeartbeat(botId: string, heartbeat: HeartbeatPayload): Promise<void> {
    const { system } = heartbeat.metrics;

    // 1. Check CPU Usage
    if (system.cpuUsage > 90) {
      await this.triggerAlert(botId, 'HIGH_CPU', 'CRITICAL', 'High CPU Usage Detected', `CPU usage is currently at ${system.cpuUsage.toFixed(1)}%`);
    } else {
      await this.resolveAlert(botId, 'HIGH_CPU');
    }

    // 2. Check Memory Usage
    if (system.memoryPercentage > 90) {
      await this.triggerAlert(botId, 'HIGH_RAM', 'CRITICAL', 'High Memory Usage Detected', `Memory usage is currently at ${system.memoryPercentage.toFixed(1)}%`);
    } else {
      await this.resolveAlert(botId, 'HIGH_RAM');
    }

    // 3. Check Database Health
    if (heartbeat.health.databaseStatus === 'error' || heartbeat.health.databaseStatus === 'disconnected') {
      await this.triggerAlert(botId, 'DB_FAILURE', 'EMERGENCY', 'Database Connection Failure', `Bot database report status: ${heartbeat.health.databaseStatus}`);
    } else {
      await this.resolveAlert(botId, 'DB_FAILURE');
    }
  }

  public static async triggerAlert(
    botId: string,
    type: string,
    severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY',
    title: string,
    description: string
  ): Promise<void> {
    const key = `${botId}:${type}`;
    if (this.activeAlerts.has(key)) return; // Alert already active

    const id = uuidv4();
    const alert: Alert = {
      id,
      botId,
      timestamp: new Date().toISOString(),
      type,
      title,
      description,
      severity,
      resolved: 0,
    };

    this.activeAlerts.set(key, alert);

    await Storage.run(
      `INSERT INTO alerts (id, botId, timestamp, type, title, description, severity, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [alert.id, alert.botId, alert.timestamp, alert.type, alert.title, alert.description, alert.severity, alert.resolved]
    ).catch((err) => logger.error({ err }, 'Failed to persist new alert'));

    logger.warn({ botId, type, severity }, `Alert Triggered: ${title}`);
    if (this.onAlertTriggeredCallback) {
      this.onAlertTriggeredCallback(alert);
    }
  }

  public static async resolveAlert(botId: string, type: string): Promise<void> {
    const key = `${botId}:${type}`;
    const alert = this.activeAlerts.get(key);
    if (!alert) return; // No active alert of this type

    const resolvedAt = new Date().toISOString();
    alert.resolved = 1;
    alert.resolvedAt = resolvedAt;
    this.activeAlerts.delete(key);

    await Storage.run(
      `UPDATE alerts SET resolved = 1, resolvedAt = ? WHERE id = ?`,
      [resolvedAt, alert.id]
    ).catch((err) => logger.error({ err }, 'Failed to persist alert resolution'));

    logger.info({ botId, type }, `Alert Resolved: ${alert.title}`);
    
    // Broadcast alert resolution
    const resolvedEvent: Alert = {
      ...alert,
      resolved: 1,
      resolvedAt,
    };
    if (this.onAlertTriggeredCallback) {
      this.onAlertTriggeredCallback(resolvedEvent);
    }
  }

  public static getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
}
