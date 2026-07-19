import { EventEmitter } from 'events';
import { MonitoringEvent } from '../types/index.js';

export class MonitoringEventBus extends EventEmitter {
  private static instance: MonitoringEventBus | null = null;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): MonitoringEventBus {
    if (!this.instance) {
      this.instance = new MonitoringEventBus();
    }
    return this.instance;
  }

  public publish(event: MonitoringEvent): void {
    this.emit('event', event);
  }

  public subscribe(callback: (event: MonitoringEvent) => void): () => void {
    this.on('event', callback);
    return () => {
      this.off('event', callback);
    };
  }
}
