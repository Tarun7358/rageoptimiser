import { create } from 'zustand';

interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  maxConsoleEvents: number;
  setMaxConsoleEvents: (max: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  const savedTheme = localStorage.getItem('dashboard_theme') as SettingsState['theme'] | null;
  const savedSound = localStorage.getItem('dashboard_sound_enabled');

  return {
    theme: savedTheme || 'dark',
    setTheme: (theme) => {
      localStorage.setItem('dashboard_theme', theme);
      // Handle HTML root element class updates
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      set({ theme });
    },
    soundEnabled: savedSound === null ? true : savedSound === 'true',
    setSoundEnabled: (enabled) => {
      localStorage.setItem('dashboard_sound_enabled', String(enabled));
      set({ soundEnabled: enabled });
    },
    maxConsoleEvents: 10000,
    setMaxConsoleEvents: (max) => set({ maxConsoleEvents: max }),
  };
});
