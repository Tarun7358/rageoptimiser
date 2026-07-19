import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Try loading from localStorage
  const savedToken = localStorage.getItem('monitoring_auth_token');
  return {
    token: savedToken,
    isAuthenticated: !!savedToken,
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
