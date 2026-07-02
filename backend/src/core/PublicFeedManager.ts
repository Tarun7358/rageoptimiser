import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'public-feed.json');

export interface PublicEvent {
  id: string;
  category: 'Members' | 'Voice' | 'Messages' | 'Server' | 'Music' | 'Tickets' | 'Events';
  text: string;
  timestamp: number;
}

export class PublicFeedManager {
  private events: PublicEvent[] = [];

  constructor(private broadcast: (msg: any) => void) {
    this.loadDatabase();
    this.cleanupOldEvents();
    // Run cleanup every hour
    setInterval(() => this.cleanupOldEvents(), 60 * 60 * 1000);
  }

  private loadDatabase() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        this.events = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load public feed database:', e);
    }
  }

  private saveDatabase() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.events, null, 2));
    } catch (e) {
      console.error('Failed to save public feed database:', e);
    }
  }

  private cleanupOldEvents() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const originalLength = this.events.length;
    this.events = this.events.filter(e => e.timestamp > sevenDaysAgo);
    
    if (this.events.length !== originalLength) {
      this.saveDatabase();
    }
  }

  public addEvent(category: PublicEvent['category'], text: string) {
    const event: PublicEvent = {
      id: Math.random().toString(36).substring(2, 9),
      category,
      text,
      timestamp: Date.now()
    };
    
    // Add to beginning of array
    this.events.unshift(event);
    
    // Cap at 10,000 events to prevent massive memory usage over 7 days
    if (this.events.length > 10000) {
      this.events = this.events.slice(0, 10000);
    }
    
    this.saveDatabase();
    this.broadcast({ type: 'PUBLIC_EVENT', event });
  }

  public getEvents(category?: string, timeFilter?: number, page: number = 1, limit: number = 10) {
    let filtered = this.events;
    
    if (category && category !== 'All') {
      filtered = filtered.filter(e => e.category === category);
    }
    
    if (timeFilter) {
      const minTime = Date.now() - timeFilter;
      filtered = filtered.filter(e => e.timestamp > minTime);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      events: paginated,
      total,
      page,
      totalPages
    };
  }
}
