import { API_BASE } from '../../config';
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Clock, User, Filter, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';

interface AuditEntry {
  id: string; actor: string; actorId: string; action: string;
  category: 'bot' | 'member' | 'role' | 'settings'; targetBefore?: any; targetAfter?: any;
  ip?: string; timestamp: number;
}

const MOCK_AUDITS: AuditEntry[] = [
  { id: '1', actor: 'admin', actorId: '111', action: 'Added bot MEE6 to whitelist', category: 'bot', targetBefore: null, targetAfter: { id: '159985870458322944', name: 'MEE6#4876', permissions: ['ManageMessages'] }, timestamp: Date.now() - 600000 },
  { id: '2', actor: 'moderator_lisa', actorId: '222', action: 'Removed member SpamUser from whitelist', category: 'member', targetBefore: { id: '777', reason: 'Trial member' }, targetAfter: null, timestamp: Date.now() - 1800000 },
  { id: '3', actor: 'admin', actorId: '111', action: 'Modified whitelist settings', category: 'settings', targetBefore: { autoApprove: false, scanBots: true }, targetAfter: { autoApprove: true, scanBots: true }, timestamp: Date.now() - 3600000 },
  { id: '4', actor: 'staff_alex', actorId: '333', action: 'Added role @Trusted to whitelist', category: 'role', targetBefore: null, targetAfter: { id: '987', name: 'Trusted' }, timestamp: Date.now() - 7200000 },
  { id: '5', actor: 'admin', actorId: '111', action: 'Bulk removed 3 expired members', category: 'member', targetBefore: [{ id: '1' }, { id: '2' }, { id: '3' }], targetAfter: [], timestamp: Date.now() - 14400000 },
];

const CATEGORY_COLORS: Record<string, string> = { bot: '#7C5CFC', member: '#60A5FA', role: '#F97316', settings: '#FACC15' };

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function DiffView({ before, after }: { before?: any; after?: any }) {
  if (!before && !after) return null;
  return (
    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: before && after ? '1fr 1fr' : '1fr', gap: 10 }}>
      {before && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', marginBottom: 6, textTransform: 'uppercase' }}>Before</div>
          <pre style={{ fontSize: 11, color: '#FCA5A5', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(before, null, 2)}</pre>
        </div>
      )}
      {after && (
        <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', marginBottom: 6, textTransform: 'uppercase' }}>After</div>
          <pre style={{ fontSize: 11, color: '#86EFAC', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(after, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export function WhitelistAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>(MOCK_AUDITS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'bot' | 'member' | 'role' | 'settings'>('all');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      const res = await fetch(`${API_BASE}/api/whitelist/audit`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        }
      });
      if (res.ok) { const data = await res.json(); setEntries(data); }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = entries.filter(e =>
    (filter === 'all' || e.category === filter) &&
    (search === '' || e.action.toLowerCase().includes(search.toLowerCase()) || e.actor.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleExpand = (id: string) => setExpanded(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const exportCSV = () => {
    const csv = ['ID,Actor,Action,Category,Timestamp',
      ...filtered.map(e => `${e.id},"${e.actor}","${e.action}",${e.category},${new Date(e.timestamp).toISOString()}`)
    ].join('\n');
    const b = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'whitelist-audit.csv'; a.click();
  };

  return (
    <div className="module-page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Audit Logs</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Full change history — who changed what, when, and what it looked like before and after.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={refresh} disabled={loading} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <button onClick={exportCSV} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input-text" style={{ flex: '1', minWidth: 200, maxWidth: 320 }}
            placeholder="Search by action or actor..." value={search} onChange={e => setSearch(e.target.value)} />
          {(['all', 'bot', 'member', 'role', 'settings'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: filter === f ? 'rgba(124,92,252,0.15)' : 'transparent',
                borderColor: filter === f ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.1)',
                color: filter === f ? '#A78BFA' : 'var(--text-muted)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Audit Table */}
        <div className="section-panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: 13 }}>No audit entries found.</div>
            ) : filtered.map((entry, i) => (
              <div key={entry.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                {/* Row */}
                <div
                  onClick={() => toggleExpand(entry.id)}
                  style={{ display: 'flex', gap: 14, padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[entry.category], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{entry.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> {entry.actor}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {timeAgo(entry.timestamp)}</span>
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: `${CATEGORY_COLORS[entry.category]}15`, color: CATEGORY_COLORS[entry.category] }}>
                    {entry.category}
                  </span>
                  {(entry.targetBefore || entry.targetAfter) && (
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {expanded.has(entry.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </div>
                {/* Diff view */}
                {expanded.has(entry.id) && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <DiffView before={entry.targetBefore} after={entry.targetAfter} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Showing {filtered.length} of {entries.length} entries · Audit logs retained for 90 days
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
