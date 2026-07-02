import { IEventBus } from './types.js';

export class EventBus implements IEventBus {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  public publish(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error executing event listener for ${event}:`, err);
        }
      });
    }
  }

  public subscribe(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
}
