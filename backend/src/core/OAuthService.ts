import jwt from 'jsonwebtoken';
import { Database } from './Database.js';

const DISCORD_API = 'https://discord.com/api/v10';
const PERMISSIONS_MANAGE_SERVER = 0x20; // ManageGuild permission bit
const PERMISSIONS_ADMINISTRATOR = 0x8; // Administrator permission bit

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  global_name?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string; // bitfield as string
}

export interface OAuthSession {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  accessToken: string;
  managedGuildIds: string[]; // guild IDs where user has Manage Server or is owner
  loginAt: number;
}

export class OAuthService {
  /**
   * Helper to run a promise with a timeout. Resolves to the fallback value if the timeout expires.
   */
  private static async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[OAuthService] Operation timed out after ${ms}ms. Proceeding with fallback.`);
        resolve(fallback);
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutId!) clearTimeout(timeoutId);
    }
  }

  private static getClientId(): string {
    return (process.env.CLIENT_ID || '').trim();
  }

  private static getClientSecret(): string {
    return (process.env.CLIENT_SECRET || '').trim();
  }

  private static getRedirectUri(): string {
    return (process.env.OAUTH_REDIRECT_URI || 'http://localhost:5000/api/auth/discord/callback').trim();
  }

  /**
   * Build the Discord OAuth2 authorization URL
   */
  public static getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: 'identify guilds',
      ...(state ? { state } : {})
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public static async exchangeCode(code: string): Promise<{ access_token: string; token_type: string }> {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.getRedirectUri()
    });

    const res = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to exchange OAuth code: ${err}`);
    }

    return res.json() as Promise<{ access_token: string; token_type: string }>;
  }

  /**
   * Fetch the Discord user info for an access token
   */
  public static async fetchUser(accessToken: string): Promise<DiscordUser> {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Failed to fetch Discord user');
    return res.json() as Promise<DiscordUser>;
  }

  /**
   * Fetch all guilds the user is a member of
   */
  public static async fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Failed to fetch user guilds');
    return res.json() as Promise<DiscordGuild[]>;
  }

  /**
   * Filter guilds to ones the user can manage (owner OR ManageGuild OR Administrator)
   */
  public static filterManageableGuilds(guilds: DiscordGuild[]): DiscordGuild[] {
    return guilds.filter(g => {
      const perms = BigInt(g.permissions);
      const hasManage = (perms & BigInt(PERMISSIONS_MANAGE_SERVER)) !== 0n;
      const hasAdmin = (perms & BigInt(PERMISSIONS_ADMINISTRATOR)) !== 0n;
      return g.owner || hasManage || hasAdmin;
    });
  }

  /**
   * Full OAuth2 flow: exchange code → fetch user + guilds → save session → return JWT
   */
  public static async processCallback(code: string): Promise<{ 
    token: string; 
    user: DiscordUser; 
    managedGuilds: DiscordGuild[];
    approvals: Record<string, { status: string; guildName: string }>;
  }> {
    // 1. Exchange code for access token
    const tokenData = await this.exchangeCode(code);
    const { access_token } = tokenData;

    // 2. Fetch user info
    const discordUser = await this.fetchUser(access_token);

    // 3. Fetch + filter manageable guilds
    const allGuilds = await this.fetchUserGuilds(access_token);
    const manageableGuilds = this.filterManageableGuilds(allGuilds);

    // 4. Check approval status for each manageable guild from our DB
    const db = Database.getDb();
    const approvals: Record<string, { status: string; guildName: string }> = {};
    
    if (db && manageableGuilds.length > 0) {
      for (const guild of manageableGuilds) {
        try {
          const docSnap = await this.withTimeout(
            db.collection('approvals').doc(guild.id).get(),
            3000,
            { exists: false } as any
          );
          if (docSnap.exists) {
            const data = docSnap.data() as any;
            let status = data.status;
            if (status !== 'Blacklisted' && status !== 'Approved') {
              status = 'Approved';
              await docSnap.ref.update({ status: 'Approved', lastUpdated: Date.now() }).catch(() => {});
            }
            approvals[guild.id] = { status, guildName: data.guildName };
          } else {
            approvals[guild.id] = { status: 'Not Registered', guildName: guild.name };
          }
        } catch {
          approvals[guild.id] = { status: 'Unknown', guildName: guild.name };
        }
      }
    }

    // 5. Save/update Discord OAuth session in DB
    if (db) {
      const sessionData: OAuthSession = {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar,
        accessToken: access_token,
        managedGuildIds: manageableGuilds.map(g => g.id),
        loginAt: Date.now()
      };
      
      console.log(`[OAuthService] Writing session data for user ${discordUser.username} to Firestore...`);
      await this.withTimeout(
        db.collection('discord_sessions').doc(discordUser.id).set(sessionData, { merge: true }),
        4000,
        null
      );
      console.log(`[OAuthService] Session write sequence completed.`);
    }

    // 6. Issue a JWT for the dashboard session (role: 'guild_manager')
    const token = jwt.sign(
      {
        id: discordUser.id,
        username: discordUser.username,
        role: 'guild_manager',
        avatar: discordUser.avatar,
        managedGuildIds: manageableGuilds.map(g => g.id)
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return { token, user: discordUser, managedGuilds: manageableGuilds, approvals };
  }

  /**
   * Get guild icon URL
   */
  public static getGuildIconUrl(guildId: string, iconHash: string | null): string | null {
    if (!iconHash) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png`;
  }

  /**
   * Get user avatar URL
   */
  public static getAvatarUrl(userId: string, avatarHash: string | null): string {
    if (!avatarHash) {
      const defaultIndex = (BigInt(userId) >> 22n) % 6n;
      return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  }
}
