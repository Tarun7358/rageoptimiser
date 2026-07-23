export interface CooldownCheckResult {
  onCooldown: boolean;
  retryAfter: number;
}

export class PrefixCooldownManager {
  private static userCooldowns = new Map<string, number>();
  private static guildCooldowns = new Map<string, number>();

  public static checkCooldown(
    userId: string,
    guildId: string | null,
    commandName: string,
    cooldownSec = 3,
    isOwner = false
  ): CooldownCheckResult {
    if (isOwner || cooldownSec <= 0) {
      return { onCooldown: false, retryAfter: 0 };
    }

    const now = Date.now();
    const userKey = `${userId}:${commandName}`;
    const userExpiration = this.userCooldowns.get(userKey) || 0;

    if (now < userExpiration) {
      const retryAfter = Math.ceil((userExpiration - now) / 1000);
      return { onCooldown: true, retryAfter };
    }

    // Set new cooldown
    this.userCooldowns.set(userKey, now + cooldownSec * 1000);

    // Garbage collect expired cooldowns periodically
    if (this.userCooldowns.size > 5000) {
      this.cleanup();
    }

    return { onCooldown: false, retryAfter: 0 };
  }

  private static cleanup(): void {
    const now = Date.now();
    for (const [key, exp] of this.userCooldowns.entries()) {
      if (now >= exp) {
        this.userCooldowns.delete(key);
      }
    }
  }
}
