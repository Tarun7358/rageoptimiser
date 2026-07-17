import { API_BASE } from '../../config';
import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Download, RefreshCw, Shield, Plus, Minus, Edit3, Clock, Bot, Users, ChevronDown } from 'lucide-react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  added: <Plus size={12} color="#22C55E" />,
  removed: <Minus size={12} color="#EF4444" />,
  modified: <Edit3 size={12} color="#FACC15" />,
};
const EVENT_COLORS: Record<string, string> = { added: '#22C55E', removed: '#EF4444', modified: '#FACC15' };
const TYPE_COLORS: Record<string, string> = { bot: '#7C5CFC', member: '#60A5FA', role: '#F97316' };

interface ActivityEvent {
  id: string; type: 'bot' | 'member' | 'role'; action: 'added' | 'removed' | 'modified';
  target: string; targetId: string; actor: string; reason?: string; timestamp: number;
}

const MOCK_EVENTS: ActivityEvent[] = [
  { id: '1', type: 'bot', action: 'added', target: 'MEE6#4876', targetId: '159985870458322944', actor: 'admin', reason: 'Approved utility bot', timestamp: Date.now() - 300000 },
  { id: '2', type: 'member', action: 'removed', target: 'SpamUser#1234', targetId: '777888999000111222', actor: 'moderator_lisa', reason: 'Spam violation', timestamp: Date.now() - 900000 },
  { id: '3', type: 'role', action: 'added', target: '@Trusted', targetId: '987654321', actor: 'admin', reason: 'Community role approval', timestamp: Date.now() - 1800000 },
  { id: '4', type: 'bot', action: 'modified', target: 'Carl-bot#1536', targetId: '235148962103951360', actor: 'admin', reason: 'Updated permissions', timestamp: Date.now() - 3600000 },
  { id: '5', type: 'member', action: 'added', target: 'TrustedDev#9876', targetId: '111222333444555666', actor: 'staff_alex', reason: 'Developer partner', timestamp: Date.now() - 7200000 },
  { id: '6', type: 'role', action: 'removed', target: '@OldVIP', targetId: '111111111', actor: 'admin', reason: 'Role restructure', timestamp: Date.now() - 14400000 },
];

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function WhitelistActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<'all' | 'bot' | 'member' | 'role'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'added' | 'removed' | 'modified'>('all');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      const res = await fetch(`${API_BASE}/api/whitelist/activity`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        }
      });
      if (res.ok) { const data = await res.json(); setEvents(data); }
    } catch { /* use mock */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, []);

  const filtered = events.filter(e =>
    (filter === 'all' || e.type === filter) &&
    (actionFilter === 'all' || e.action === actionFilter)
  );

  const counts = { added: events.filter(e => e.action === 'added').length, removed: events.filter(e => e.action === 'removed').length, modified: events.filter(e => e.action === 'modified').length };

  return (
    <div className="module-page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Whitelist Activity</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Real-time log of all whitelist additions, removals, and modifications.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={refresh} disabled={loading} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <button onClick={() => {
              const csv = ['ID,Type,Action,Target,Actor,Reason,Timestamp',
                ...filtered.map(e => `${e.id},${e.type},${e.action},"${e.target}","${e.actor}","${e.reason || ''}",${new Date(e.timestamp).toISOString()}`)
              ].join('\n');
              const b = new Blob([csv], { type: 'text/csv' });
              const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'whitelist-activity.csv'; a.click();
            }} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { label: 'Added', val: counts.added, color: '#22C55E' },
            { label: 'Removed', val: counts.removed, color: '#EF4444' },
            { label: 'Modified', val: counts.modified, color: '#FACC15' },
          ].map(s => (
            <div key={s.label} className="section-panel" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>TYPE:</span>
          {(['all', 'bot', 'member', 'role'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: filter === f ? 'rgba(124,92,252,0.15)' : 'transparent',
                borderColor: filter === f ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.1)',
                color: filter === f ? '#A78BFA' : 'var(--text-muted)' }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600, marginLeft: 8 }}>ACTION:</span>
          {(['all', 'added', 'removed', 'modified'] as const).map(f => (
            <button key={f} onClick={() => setActionFilter(f)}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: actionFilter === f ? 'rgba(124,92,252,0.15)' : 'transparent',
                borderColor: actionFilter === f ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.1)',
                color: actionFilter === f ? '#A78BFA' : 'var(--text-muted)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="section-panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: 13 }}>No activity matching filters.</div>
            ) : (
              <div style={{ position: 'relative' }}>
                {filtered.map((ev, i) => (
                  <div key={ev.id} style={{
                    display: 'flex', gap: 14, padding: '14px 20px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                    transition: 'background 0.15s'
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    {/* Action icon */}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${EVENT_COLORS[ev.action]}15`, border: `1px solid ${EVENT_COLORS[ev.action]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {EVENT_ICONS[ev.action]}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{ev.target}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: `${TYPE_COLORS[ev.type]}15`, color: TYPE_COLORS[ev.type] }}>{ev.type}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: `${EVENT_COLORS[ev.action]}15`, color: EVENT_COLORS[ev.action] }}>{ev.action}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        By <strong style={{ color: 'var(--text-primary)' }}>{ev.actor}</strong>
                        {ev.reason && <> · <span style={{ color: 'var(--text-muted)' }}>{ev.reason}</span></>}
                      </div>
                    </div>
                    {/* Time */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {timeAgo(ev.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
