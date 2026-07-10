import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

export interface ManagedGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface ApprovalInfo {
  status: string;
  guildName: string;
}

interface AuthUser {
  username: string;
  role: 'owner' | 'admin' | 'moderator' | 'viewer' | 'guild_manager';
  // Discord OAuth fields (only for guild_manager)
  discordId?: string;
  avatar?: string | null;
  managedGuildIds?: string[];
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  loginDiscord: (token: string, user: any, managedGuilds: ManagedGuild[], approvals: Record<string, ApprovalInfo>) => void;
  logout: () => void;
  /** @deprecated 2FA removed — callback is invoked immediately */
  requireElevation: (callback: () => void) => void;
  // Guild manager specific
  managedGuilds: ManagedGuild[];
  guildApprovals: Record<string, ApprovalInfo>;
  activeGuildId: string | null;
  setActiveGuildId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  loginDiscord: () => {},
  logout: () => {},
  requireElevation: (cb) => cb(),
  managedGuilds: [],
  guildApprovals: {},
  activeGuildId: null,
  setActiveGuildId: () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('cn_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('cn_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [managedGuilds, setManagedGuilds] = useState<ManagedGuild[]>(() => {
    const saved = localStorage.getItem('cn_managed_guilds');
    return saved ? JSON.parse(saved) : [];
  });
  const [guildApprovals, setGuildApprovals] = useState<Record<string, ApprovalInfo>>(() => {
    const saved = localStorage.getItem('cn_guild_approvals');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeGuildId, setActiveGuildIdState] = useState<string | null>(localStorage.getItem('cn_active_guild'));

  /** @deprecated No-op wrapper kept for call-site compatibility */
  const requireElevation = (callback: () => void) => callback();

  const setActiveGuildId = (id: string | null) => {
    setActiveGuildIdState(id);
    if (id) localStorage.setItem('cn_active_guild', id);
    else localStorage.removeItem('cn_active_guild');
  };

  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('cn_token', newToken);
    localStorage.setItem('cn_user', JSON.stringify(newUser));
  };

  /** Discord OAuth2 login — stores guild data and issues session */
  const loginDiscord = (
    newToken: string,
    discordUser: any,
    guilds: ManagedGuild[],
    approvals: Record<string, ApprovalInfo>
  ) => {
    const authUser: AuthUser = {
      username: discordUser.global_name || discordUser.username,
      role: 'guild_manager',
      discordId: discordUser.id,
      avatar: discordUser.avatar,
      managedGuildIds: guilds.map((g: ManagedGuild) => g.id)
    };
    setToken(newToken);
    setUser(authUser);
    setManagedGuilds(guilds);
    setGuildApprovals(approvals);
    localStorage.setItem('cn_token', newToken);
    localStorage.setItem('cn_user', JSON.stringify(authUser));
    localStorage.setItem('cn_managed_guilds', JSON.stringify(guilds));
    localStorage.setItem('cn_guild_approvals', JSON.stringify(approvals));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setManagedGuilds([]);
    setGuildApprovals({});
    setActiveGuildIdState(null);
    localStorage.removeItem('cn_token');
    localStorage.removeItem('cn_user');
    localStorage.removeItem('cn_managed_guilds');
    localStorage.removeItem('cn_guild_approvals');
    localStorage.removeItem('cn_active_guild');
    localStorage.removeItem('cn_elevated_token');
  };

  // Simple token expiration check
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) logout();
      } catch {
        logout();
      }
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{
      token, user, isAuthenticated: !!token,
      login, loginDiscord, logout,
      requireElevation,
      managedGuilds, guildApprovals, activeGuildId, setActiveGuildId
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
