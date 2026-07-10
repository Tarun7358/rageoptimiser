import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Hash, MessageSquare, Mic, Disc } from 'lucide-react';
import type { DiscordRole, DiscordChannel } from '../hooks/useDiscordSync';

// Shared hook: calculates fixed dropdown position from a trigger element's bounds.
// This is the core fix for the overflow:hidden clipping bug — the dropdown panel
// is rendered with position:fixed at exact coordinates from getBoundingClientRect(),
// so it escapes any parent container with overflow:hidden.
function useDropdownPosition(triggerRef: React.RefObject<HTMLDivElement | null>, isOpen: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,   // viewport-relative — no scroll offset needed for position:fixed
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, triggerRef]);

  return pos;
}

// --- ROLE SELECT ---
interface RoleSelectProps {
  label: string;
  roles: DiscordRole[];
  selectedRoleId?: string;
  selectedRoleIds?: string[];
  onChange: (id: any) => void;
  isMulti?: boolean;
  helpText?: string;
}

export function RoleSelect({
  label,
  roles = [],
  selectedRoleId,
  selectedRoleIds = [],
  onChange,
  isMulti = false,
  helpText
}: RoleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(triggerRef, isOpen);

  const filtered = roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (id: string) => {
    if (isMulti) {
      if (selectedRoleIds.includes(id)) {
        onChange(selectedRoleIds.filter(x => x !== id));
      } else {
        onChange([...selectedRoleIds, id]);
      }
    } else {
      onChange(id);
      setIsOpen(false);
      setSearch('');
    }
  };

  const getActiveLabel = () => {
    if (isMulti) {
      if (selectedRoleIds.length === 0) return 'No roles selected';
      if (selectedRoleIds.length === 1) {
        const found = roles.find(r => r.id === selectedRoleIds[0]);
        return found ? found.name : '1 role selected';
      }
      return `${selectedRoleIds.length} roles selected`;
    } else {
      if (!selectedRoleId) return 'Select a role...';
      const found = roles.find(r => r.id === selectedRoleId);
      return found ? found.name : 'Select a role...';
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div
        ref={triggerRef}
        className="form-select"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isMulti && selectedRoleId && (
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: roles.find(r => r.id === selectedRoleId)?.color || 'var(--text-muted)'
              }}
            />
          )}
          {getActiveLabel()}
        </span>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        />
      </div>

      {helpText && <span className="form-help">{helpText}</span>}

      {isOpen && (
        <>
          {/* Backdrop — closes dropdown on outside click */}
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 990 }}
            onClick={() => { setIsOpen(false); setSearch(''); }}
          />
          {/* Dropdown panel — position:fixed escapes all parent overflow:hidden clipping */}
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              zIndex: 1000,
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}>
              <Search size={12} color="var(--text-muted)" style={{ marginRight: '8px', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search server roles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
                style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No roles match query
                </div>
              ) : (
                filtered.map(role => {
                  const isChecked = isMulti ? selectedRoleIds.includes(role.id) : selectedRoleId === role.id;
                  return (
                    <div
                      key={role.id}
                      onClick={(e) => { e.stopPropagation(); handleSelect(role.id); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'rgba(79, 140, 255, 0.08)' : 'transparent'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(79, 140, 255, 0.12)' : 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(79, 140, 255, 0.08)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{role.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Pos: {role.position}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {role.permissions.includes('Administrator') && (
                          <span style={{ fontSize: '9px', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', padding: '2px 4px', borderRadius: '3px' }}>
                            ADMIN
                          </span>
                        )}
                        {isChecked && <Check size={12} color="var(--accent-primary)" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- CHANNEL SELECT ---
interface ChannelSelectProps {
  label: string;
  channels: DiscordChannel[];
  selectedChannelId?: string;
  selectedChannelIds?: string[];
  onChange: (id: any) => void;
  isMulti?: boolean;
  helpText?: string;
  typeFilter?: DiscordChannel['type'][];
}

export function ChannelSelect({
  label,
  channels = [],
  selectedChannelId,
  selectedChannelIds = [],
  onChange,
  isMulti = false,
  helpText,
  typeFilter
}: ChannelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(triggerRef, isOpen);

  const filtered = channels.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter ? typeFilter.includes(c.type) : true;
    return matchesSearch && matchesType;
  });

  const handleSelect = (id: string) => {
    if (isMulti) {
      if (selectedChannelIds.includes(id)) {
        onChange(selectedChannelIds.filter(x => x !== id));
      } else {
        onChange([...selectedChannelIds, id]);
      }
    } else {
      onChange(id);
      setIsOpen(false);
      setSearch('');
    }
  };

  const getActiveLabel = () => {
    if (isMulti) {
      if (selectedChannelIds.length === 0) return 'No channels selected';
      if (selectedChannelIds.length === 1) {
        const found = channels.find(c => c.id === selectedChannelIds[0]);
        return found ? `#${found.name}` : '1 channel selected';
      }
      return `${selectedChannelIds.length} channels selected`;
    } else {
      if (!selectedChannelId) return 'Select a channel...';
      const found = channels.find(c => c.id === selectedChannelId);
      return found ? `#${found.name}` : 'Select a channel...';
    }
  };

  const getChannelIcon = (type: DiscordChannel['type']) => {
    if (type === 'voice') return <Mic size={12} />;
    if (type === 'forum') return <MessageSquare size={12} />;
    if (type === 'stage') return <Disc size={12} />;
    return <Hash size={12} />;
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div
        ref={triggerRef}
        className="form-select"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <span>{getActiveLabel()}</span>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        />
      </div>

      {helpText && <span className="form-help">{helpText}</span>}

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 990 }}
            onClick={() => { setIsOpen(false); setSearch(''); }}
          />
          {/* Dropdown panel — position:fixed escapes parent overflow:hidden */}
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              zIndex: 1000,
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}>
              <Search size={12} color="var(--text-muted)" style={{ marginRight: '8px', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search server channels..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
                style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No channels match query
                </div>
              ) : (
                filtered.map(channel => {
                  const isChecked = isMulti ? selectedChannelIds.includes(channel.id) : selectedChannelId === channel.id;
                  return (
                    <div
                      key={channel.id}
                      onClick={(e) => { e.stopPropagation(); handleSelect(channel.id); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'rgba(79, 140, 255, 0.08)' : 'transparent'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(79, 140, 255, 0.12)' : 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(79, 140, 255, 0.08)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{getChannelIcon(channel.type)}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{channel.name}</span>
                        {channel.category && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({channel.category})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', padding: '2px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>
                          {channel.type}
                        </span>
                        {isChecked && <Check size={12} color="var(--accent-primary)" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
