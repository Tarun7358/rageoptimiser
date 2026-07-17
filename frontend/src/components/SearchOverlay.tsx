import React, { useState, useEffect, useRef } from 'react';
import { Search, Shield, ShieldAlert, Settings, User, FileText, X, ArrowRight } from 'lucide-react';

interface SearchItem {
  id: string;
  category: 'Pages' | 'Settings' | 'Users' | 'Roles' | 'Security';
  title: string;
  subtitle: string;
  targetPage: string;
  targetTab?: string;
  icon: React.ReactNode;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, tab?: string) => void;
}

export function SearchOverlay({ isOpen, onClose, onNavigate }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchItems: SearchItem[] = [
    { id: 'sh-1', category: 'Pages', title: 'Dashboard Overview', subtitle: 'Global server health and stats', targetPage: 'dashboard', icon: <FileText size={16} /> },
    { id: 'sh-2', category: 'Security', title: 'Privileged Role Protection', subtitle: 'Manage Administrator & dangerous roles', targetPage: 'security', targetTab: 'privileged', icon: <Shield size={16} /> },
    { id: 'sh-3', category: 'Security', title: 'Recovery & Quarantine Engine', subtitle: 'Monitor active quarantines & recover assets', targetPage: 'security', targetTab: 'recovery', icon: <ShieldAlert size={16} /> },
    { id: 'sh-4', category: 'Security', title: 'Anti Raid configuration', subtitle: 'Set join filters and automated locks', targetPage: 'security', targetTab: 'antiraid', icon: <Shield size={16} /> },
    { id: 'sh-5', category: 'Security', title: 'Anti Nuke policy options', subtitle: 'Limit mass channel/role deletions', targetPage: 'security', targetTab: 'antinuke', icon: <ShieldAlert size={16} /> },
    { id: 'sh-6', category: 'Pages', title: 'Moderation Console', subtitle: 'Warn, Timeout, and Ban cases', targetPage: 'moderation', icon: <Shield size={16} /> },
    { id: 'sh-8', category: 'Pages', title: 'Ticket Management', subtitle: 'Open claims, transcripts, and departments', targetPage: 'tickets', icon: <FileText size={16} /> },
    { id: 'sh-9', category: 'Pages', title: 'Verification Center', subtitle: 'Captcha, Button, Math, and Manual approvals', targetPage: 'verification', icon: <Shield size={16} /> },
    { id: 'sh-10', category: 'Pages', title: 'System Audit Logs', subtitle: 'Timeline and filters for message, role, webhooks', targetPage: 'logs', icon: <FileText size={16} /> },
    { id: 'sh-11', category: 'Pages', title: 'Backup Recovery Points', subtitle: 'Create backups and trigger restore wizards', targetPage: 'backups', icon: <Settings size={16} /> },
    { id: 'sh-12', category: 'Pages', title: 'Owner Control Panel', subtitle: 'Maintenance mode, trusted staff, DB keys', targetPage: 'owner', icon: <Settings size={16} /> },
    { id: 'sh-13', category: 'Settings', title: 'Discord Integration', subtitle: 'Bot permissions and guild configs', targetPage: 'settings', targetTab: 'discord', icon: <Settings size={16} /> },
    { id: 'sh-14', category: 'Settings', title: 'Notification Alerts', subtitle: 'Webhook dispatch and alerts config', targetPage: 'settings', targetTab: 'notifications', icon: <Settings size={16} /> },
  ];

  const filteredItems = searchItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          const item = filteredItems[selectedIndex];
          onNavigate(item.targetPage, item.targetTab);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose, onNavigate]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ padding: '40px 20px', alignItems: 'flex-start' }} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '650px', 
          marginTop: '60px', 
          display: 'flex', 
          flexDirection: 'column',
          maxHeight: '480px' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search dashboard command, users, settings..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button className="icon-btn btn-sm" onClick={onClose} style={{ width: '28px', height: '28px' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              No matches found for "{query}"
            </div>
          ) : (
            <div>
              {/* Grouping by category */}
              {Array.from(new Set(filteredItems.map(i => i.category))).map(cat => (
                <div key={cat} style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    padding: '4px 8px'
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {filteredItems.filter(i => i.category === cat).map((item) => {
                      const absoluteIndex = filteredItems.indexOf(item);
                      const isSelected = absoluteIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.targetPage, item.targetTab);
                            onClose();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: 'var(--border-radius-md)',
                            backgroundColor: isSelected ? 'rgba(79, 140, 255, 0.08)' : 'transparent',
                            border: isSelected ? '1px solid rgba(79, 140, 255, 0.2)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        >
                          <div style={{ 
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                            display: 'flex', 
                            alignItems: 'center' 
                          }}>
                            {item.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.subtitle}
                            </div>
                          </div>
                          {isSelected && (
                            <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', fontSize: '11px', gap: '4px' }}>
                              <span>Go</span>
                              <ArrowRight size={12} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ 
          padding: '10px 16px', 
          borderTop: '1px solid var(--border-color)', 
          fontSize: '11px', 
          color: 'var(--text-muted)', 
          display: 'flex', 
          gap: '12px',
          backgroundColor: 'rgba(0,0,0,0.15)'
        }}>
          <span><kbd style={{ background: 'var(--bg-primary)', padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>↑↓</kbd> to navigate</span>
          <span><kbd style={{ background: 'var(--bg-primary)', padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>Enter</kbd> to select</span>
          <span><kbd style={{ background: 'var(--bg-primary)', padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
