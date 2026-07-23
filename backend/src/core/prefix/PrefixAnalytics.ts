export interface PrefixMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgParseTimeMs: number;
  avgExecutionTimeMs: number;
  unknownCommandsCount: number;
  cooldownHits: number;
  permissionFailures: number;
  commandUsage: Record<string, number>;
  categoryUsage: Record<string, number>;
}

export class PrefixAnalytics {
  private static metrics: PrefixMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgParseTimeMs: 0.5,
    avgExecutionTimeMs: 12,
    unknownCommandsCount: 0,
    cooldownHits: 0,
    permissionFailures: 0,
    commandUsage: {},
    categoryUsage: {}
  };

  private static parseTimes: number[] = [];
  private static execTimes: number[] = [];

  public static recordParseTime(timeMs: number): void {
    this.parseTimes.push(timeMs);
    if (this.parseTimes.length > 200) this.parseTimes.shift();
    const sum = this.parseTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgParseTimeMs = parseFloat((sum / this.parseTimes.length).toFixed(2));
  }

  public static trackExecution(commandName: string, category: string, executionTimeMs: number, success = true): void {
    this.metrics.totalExecutions++;
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    this.execTimes.push(executionTimeMs);
    if (this.execTimes.length > 200) this.execTimes.shift();
    const sum = this.execTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgExecutionTimeMs = Math.round(sum / this.execTimes.length);

    this.metrics.commandUsage[commandName] = (this.metrics.commandUsage[commandName] || 0) + 1;
    this.metrics.categoryUsage[category] = (this.metrics.categoryUsage[category] || 0) + 1;
  }

  public static trackFailure(type: 'unknown' | 'cooldown' | 'permission'): void {
    if (type === 'unknown') this.metrics.unknownCommandsCount++;
    else if (type === 'cooldown') this.metrics.cooldownHits++;
    else if (type === 'permission') this.metrics.permissionFailures++;
  }

  public static getMetrics(): PrefixMetrics {
    return { ...this.metrics };
  }
}
