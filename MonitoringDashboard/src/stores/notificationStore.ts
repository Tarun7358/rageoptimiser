import { create } from 'zustand';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  isPinned: boolean;
  read: boolean;
}

interface NotificationState {
  notifications: ToastNotification[];
  addNotification: (notif: Omit<ToastNotification, 'id' | 'timestamp' | 'read' | 'isPinned'> & { isPinned?: boolean }) => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;
  togglePin: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notif) =>
    set((state) => {
      const newNotif: ToastNotification = {
        ...notif,
        id: 'notif_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        isPinned: notif.isPinned || false,
        read: false,
      };
      return { notifications: [newNotif, ...state.notifications] };
    }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clearNotifications: () => set((state) => ({ notifications: state.notifications.filter((n) => n.isPinned) })),
  togglePin: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n)),
    })),
}));
