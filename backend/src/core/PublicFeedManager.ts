import { Database } from './Database.js';

export interface PublicEvent {
  id: string;
  category: 'Members' | 'Voice' | 'Messages' | 'Server' | 'Music' | 'Tickets' | 'Events';
  text: string;
  timestamp: number;
}

export class PublicFeedManager {
  constructor(private broadcast: (msg: any) => void) {
    // Run cleanup immediately and then every hour
    this.cleanupOldEvents();
    setInterval(() => this.cleanupOldEvents(), 60 * 60 * 1000);
  }

  private async cleanupOldEvents() {
    try {
      const db = Database.getDb();
      if (!db) return;

      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const res = await db.run('DELETE FROM public_feed WHERE timestamp < ?', [sevenDaysAgo]);
      if (res.changes > 0) {
        console.log(`[PublicFeed] Cleaned up ${res.changes} expired events.`);
      }
    } catch (e) {
      console.error('Failed to cleanup old public events:', e);
    }
  }

  public async addEvent(category: PublicEvent['category'], text: string) {
    const event: PublicEvent = {
      id: Math.random().toString(36).substring(2, 9),
      category,
      text,
      timestamp: Date.now()
    };

    // Broadcast immediately to WebSockets
    this.broadcast({ type: 'PUBLIC_EVENT', event });

    // Store in SQLite asynchronously
    try {
      const db = Database.getDb();
      if (db) {
        await db.run(
          'INSERT INTO public_feed (id, category, text, timestamp) VALUES (?, ?, ?, ?)',
          [event.id, event.category, event.text, event.timestamp]
        );
      }
    } catch (e) {
      console.error('Failed to write event to SQLite:', e);
    }
  }

  public async getEvents(category?: string, timeFilter?: number, page: number = 1, limit: number = 10) {
    try {
      const db = Database.getDb();
      if (!db) {
        return { events: [], total: 0, page, totalPages: 1 };
      }

      let query = 'SELECT * FROM public_feed WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as count FROM public_feed WHERE 1=1';
      const params: any[] = [];

      if (category && category !== 'All') {
        query += ' AND category = ?';
        countQuery += ' AND category = ?';
        params.push(category);
      }

      if (timeFilter) {
        const minTime = Date.now() - timeFilter;
        query += ' AND timestamp > ?';
        countQuery += ' AND timestamp > ?';
        params.push(minTime);
      }

      const countResult = await db.get(countQuery, params);
      const total = countResult ? countResult.count : 0;

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * limit;
      const events = await db.all(query, [...params, limit, offset]);

      const totalPages = Math.ceil(total / limit) || 1;

      return {
        events,
        total,
        page,
        totalPages
      };
    } catch (e) {
      console.error('Failed to get public feed events from SQLite:', e);
      return { events: [], total: 0, page, totalPages: 1 };
    }
  }
}
