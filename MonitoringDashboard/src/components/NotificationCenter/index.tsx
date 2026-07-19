import React, { useState } from 'react';
import { Bell, BellOff, X, Pin, Check } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore.js';

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, markAsRead, clearNotifications, togglePin } = useNotificationStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) markAsRead(n.id);
    });
  };

  return (
    <div className="relative">
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-200 bg-slate-900/60 rounded-lg border border-slate-800/80 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 text-slate-100 font-mono text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse border border-[#0b0d13]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Overlay Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-80 max-h-96 overflow-hidden border rounded-xl panel-glass border-slate-800 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between font-mono text-xs">
              <span className="font-semibold text-slate-300">Notifications ({notifications.length})</span>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 text-[10px]"
                    title="Mark all as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={clearNotifications}
                  className="text-slate-500 hover:text-slate-400 flex items-center gap-0.5 text-[10px]"
                  title="Clear non-pinned notifications"
                >
                  <BellOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-72">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-mono text-[10px]">No alerts or notices.</div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-lg border text-left font-mono text-[10px] relative transition-colors ${
                      notif.read
                        ? 'bg-slate-950/20 border-slate-900/40 text-slate-400'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`font-semibold uppercase ${
                          notif.type === 'error'
                            ? 'text-red-400'
                            : notif.type === 'warning'
                            ? 'text-amber-400'
                            : notif.type === 'success'
                            ? 'text-emerald-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => togglePin(notif.id)}
                          className={`p-0.5 rounded transition-colors ${
                            notif.isPinned ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="p-0.5 text-slate-600 hover:text-slate-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-slate-400 pr-4 leading-relaxed text-[9px]">{notif.message}</p>
                    <div className="mt-2 text-[8px] text-slate-600 flex justify-between">
                      <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default NotificationCenter;
