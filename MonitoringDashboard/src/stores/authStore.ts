import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Priority 1: Previously saved token from localStorage (user typed it manually)
  const savedToken = localStorage.getItem('monitoring_auth_token');

  // Priority 2: Pre-configured token from Netlify/build env var (VITE_MONITORING_AUTH_TOKEN)
  // This allows the deployed dashboard to auto-authenticate without requiring user input.
  // The env var is set in Netlify → Site Settings → Environment Variables.
  const envToken = import.meta.env.VITE_MONITORING_AUTH_TOKEN as string | undefined;

  // Use localStorage token first (respects manual override), then fall back to env token
  const initialToken = savedToken || envToken || null;

  // If the env token is providing auth, persist it to localStorage so reconnects
  // (which happen before React mounts) also have a token available.
  if (!savedToken && envToken) {
    localStorage.setItem('monitoring_auth_token', envToken);
  }

  return {
    token: initialToken,
    isAuthenticated: !!initialToken,
    login: (token) => {
      localStorage.setItem('monitoring_auth_token', token);
      set({ token, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem('monitoring_auth_token');
      set({ token: null, isAuthenticated: false });
    },
  };
});
