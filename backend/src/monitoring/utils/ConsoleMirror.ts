export class ConsoleMirror {
  private static colors = {
    reset: '\x1b[0m',
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    magenta: '\x1b[35m', // Magenta
  };

  public static info(msg: string): void {
    console.log(`${this.colors.info}[Telemetry:INFO] ${msg}${this.colors.reset}`);
  }

  public static success(msg: string): void {
    console.log(`${this.colors.success}[Telemetry:SUCCESS] ${msg}${this.colors.reset}`);
  }

  public static warn(msg: string): void {
    console.warn(`${this.colors.warn}[Telemetry:WARNING] ${msg}${this.colors.reset}`);
  }

  public static error(msg: string): void {
    console.error(`${this.colors.error}[Telemetry:ERROR] ${msg}${this.colors.reset}`);
  }
}
