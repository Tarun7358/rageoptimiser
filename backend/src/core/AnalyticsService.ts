import { Database } from './Database.js';

export interface DailyAnalytics {
  joins: number;
  leaves: number;
  messages: number;
  commands: Record<string, number>;
  voiceMinutes: number;
}

export class AnalyticsService {
  private static metricBuffer: Record<string, Record<'joins' | 'leaves' | 'messages' | 'voiceMinutes', number>> = {};
  private static commandBuffer: Record<string, Record<string, number>> = {};
  private static flushInterval: any = null;
  private static isFlushing = false;

  public static async incrementMetric(guildId: string, metric: 'joins' | 'leaves' | 'messages' | 'voiceMinutes', amount: number = 1): Promise<void> {
    if (!this.metricBuffer[guildId]) {
      this.metricBuffer[guildId] = { joins: 0, leaves: 0, messages: 0, voiceMinutes: 0 };
    }
    this.metricBuffer[guildId][metric] += amount;
    this.ensureFlushTimer();
  }

  public static async trackCommand(guildId: string, commandName: string): Promise<void> {
    if (!this.commandBuffer[guildId]) {
      this.commandBuffer[guildId] = {};
    }
    this.commandBuffer[guildId][commandName] = (this.commandBuffer[guildId][commandName] || 0) + 1;
    this.ensureFlushTimer();
  }

  private static ensureFlushTimer() {
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        this.flush().catch(err => console.error('[AnalyticsService] Error flushing analytics:', err));
      }, 180000); // Flush every 3 minutes
    }
  }
 
  public static async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;
 
    const db = Database.getDb();
    if (!db) {
      this.isFlushing = false;
      return;
    }
 
    const currentMetrics = { ...this.metricBuffer };
    const currentCommands = { ...this.commandBuffer };
 
    // Clear buffers
    this.metricBuffer = {};
    this.commandBuffer = {};
 
    const allGuildIds = new Set([...Object.keys(currentMetrics), ...Object.keys(currentCommands)]);
    const date = new Date().toISOString().split('T')[0];
 
    for (const guildId of allGuildIds) {
      try {
        const metrics = currentMetrics[guildId] || { joins: 0, leaves: 0, messages: 0, voiceMinutes: 0 };
        const commands = currentCommands[guildId] || {};

        // Fetch existing record
        const row = await db.get<any>(
          'SELECT * FROM guild_analytics WHERE guildId = ? AND date = ?',
          [guildId, date]
        );

        if (row) {
          const newJoins = (row.joins || 0) + metrics.joins;
          const newLeaves = (row.leaves || 0) + metrics.leaves;
          const newMessages = (row.messages || 0) + metrics.messages;
          const newVoiceMinutes = (row.voiceMinutes || 0) + metrics.voiceMinutes;

          const existingCommands = JSON.parse(row.commands || '{}');
          for (const cmd of Object.keys(commands)) {
            existingCommands[cmd] = (existingCommands[cmd] || 0) + commands[cmd];
          }

          await db.run(
            `UPDATE guild_analytics 
             SET joins = ?, leaves = ?, messages = ?, voiceMinutes = ?, commands = ? 
             WHERE guildId = ? AND date = ?`,
            [newJoins, newLeaves, newMessages, newVoiceMinutes, JSON.stringify(existingCommands), guildId, date]
          );
        } else {
          await db.run(
            `INSERT INTO guild_analytics (guildId, date, joins, leaves, messages, voiceMinutes, commands) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [guildId, date, metrics.joins, metrics.leaves, metrics.messages, metrics.voiceMinutes, JSON.stringify(commands)]
          );
        }
      } catch (e: any) {
        console.warn(`[AnalyticsService] Failed to flush analytics for guild ${guildId}:`, e.message || e);
        // Restore metrics to buffers on failure
        const metricsToRestore = currentMetrics[guildId];
        if (metricsToRestore) {
          if (!this.metricBuffer[guildId]) {
            this.metricBuffer[guildId] = { joins: 0, leaves: 0, messages: 0, voiceMinutes: 0 };
          }
          this.metricBuffer[guildId].joins += metricsToRestore.joins;
          this.metricBuffer[guildId].leaves += metricsToRestore.leaves;
          this.metricBuffer[guildId].messages += metricsToRestore.messages;
          this.metricBuffer[guildId].voiceMinutes += metricsToRestore.voiceMinutes;
        }

        const commandsToRestore = currentCommands[guildId];
        if (commandsToRestore) {
          if (!this.commandBuffer[guildId]) {
            this.commandBuffer[guildId] = {};
          }
          for (const cmd of Object.keys(commandsToRestore)) {
            this.commandBuffer[guildId][cmd] = (this.commandBuffer[guildId][cmd] || 0) + commandsToRestore[cmd];
          }
        }
      }
    }
    
    this.isFlushing = false;
  }

  public static async getSummary(guildId: string, days: number = 7): Promise<any> {
    const db = Database.getDb();
    if (!db) {
      return this.getEmptySummary(days);
    }

    try {
      const rows = await db.all<any>(
        'SELECT * FROM guild_analytics WHERE guildId = ? ORDER BY date DESC LIMIT ?',
        [guildId, days]
      );
      
      const records: Record<string, DailyAnalytics> = {};
      for (const row of rows) {
        records[row.date] = {
          joins: row.joins || 0,
          leaves: row.leaves || 0,
          messages: row.messages || 0,
          voiceMinutes: row.voiceMinutes || 0,
          commands: JSON.parse(row.commands || '{}')
        };
      }

      // Fill in empty days if needed
      const result: Array<{ date: string } & DailyAnalytics> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const data = records[dateStr] || { joins: 0, leaves: 0, messages: 0, commands: {}, voiceMinutes: 0 };
        result.push({
          date: dateStr,
          joins: data.joins,
          leaves: data.leaves,
          messages: data.messages,
          commands: data.commands,
          voiceMinutes: data.voiceMinutes
        });
      }

      return result;
    } catch (e) {
      console.error(`[AnalyticsService] Failed to get summary for guild ${guildId}:`, e);
      return this.getEmptySummary(days);
    }
  }

  private static getEmptySummary(days: number): any[] {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        joins: 0,
        leaves: 0,
        messages: 0,
        voiceMinutes: 0,
        commands: {}
      });
    }
    return result;
  }
}
