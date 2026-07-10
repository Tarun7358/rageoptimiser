import React from 'react';
import { Bell, ShieldAlert, CheckCircle, Info, AlertTriangle, Check, Trash2 } from 'lucide-react';
import type { NotificationItem } from '../hooks/useActivityFeed';

interface NotificationsMenuProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onNavigate: (page: string, tab?: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

export function NotificationsMenu({ notifications, onClose, onNavigate, onMarkAllRead, onClear }: NotificationsMenuProps) {
  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="badge-success" style={{ padding: 0, border: 'none', background: 'none' }} />;
      case 'danger':
        return <ShieldAlert size={14} className="badge-danger" style={{ padding: 0, border: 'none', background: 'none' }} />;
      case 'warning':
        return <AlertTriangle size={14} className="badge-warning" style={{ padding: 0, border: 'none', background: 'none' }} />;
      default:
        return <Info size={14} className="badge-info" style={{ padding: 0, border: 'none', background: 'none' }} />;
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: '56px',
        right: '0',
        width: '320px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 500,
        overflow: 'hidden',
        animation: 'slide-up-anim 150ms ease'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
          <Bell size={16} />
          <span>Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span style={{ fontSize: '10px', backgroundColor: 'var(--color-danger)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
              {notifications.filter(n => !n.read).length} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            title="Mark all as read" 
            onClick={onMarkAllRead} 
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Check size={14} />
          </button>
          <button 
            title="Clear all" 
            onClick={onClear} 
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No notifications
          </div>
        ) : (
          notifications.map(item => (
            <div 
              key={item.id} 
              onClick={() => {
                onNavigate(item.link);
                onClose();
              }}
              style={{
                display: 'flex',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
                backgroundColor: item.read ? 'transparent' : 'rgba(79, 140, 255, 0.03)',
                transition: 'background-color var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = item.read ? 'transparent' : 'rgba(79, 140, 255, 0.03)'}
            >
              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                {getIcon(item.type)}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ 
                  fontSize: '12px', 
                  color: item.read ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontWeight: item.read ? 400 : 500,
                  lineHeight: '1.4'
                }}>
                  {item.title}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {item.time}
                </span>
              </div>
              {!item.read && (
                <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-primary)', borderRadius: '50%', marginTop: '6px', flexShrink: 0 }} />
              )}
            </div>
          ))
        )}
      </div>
      
      <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
        <button 
          onClick={onClose} 
          style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
