import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Bot, UserCheck, RefreshCw, Check, X, Filter } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface Incident {
  id: string;
  time: string;
  type: string;
  severity: string;
  actor: string;
  target: string;
  action: string;
  status: string;
  policyApplied: string;
  recoveryAttempted: boolean;
}

interface IncidentsProps {
  syncLogs: { time: string; msg: string; type: string }[];
  onNavigate: (page: string) => void;
}

export function Incidents({ syncLogs, onNavigate }: IncidentsProps) {
  const [wtpsIncidents, setWtpsIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');

  const fetchIncidents = async () => {
    setLoading(true);
    // WTPS was refactored into Advanced Whitelist, incident generation is pending re-implementation.
    setWtpsIncidents([]);
    setLoading(false);
  };

  useEffect(() => { fetchIncidents(); }, []);

  // Derive security incidents from syncLogs (warn type)
  const securityLogIncidents = syncLogs
    .filter(l => l.type === 'warn')
    .map((l, i) => ({
      id: `log-${i}`,
      time: l.time,
      type: 'security',
      severity: l.msg.includes('CRITICAL') ? 'critical' : l.msg.includes('Anti-Raid') ? 'high' : 'medium',
      actor: 'Discord Gateway',
      target: 'Server',
      action: l.msg,
      status: 'resolved',
      policyApplied: 'auto_recovery',
      recoveryAttempted: l.msg.includes('RESTOR') || l.msg.includes('Quarantined')
    }));

  const allIncidents: Incident[] = [
    ...wtpsIncidents,
    ...securityLogIncidents
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const filtered = allIncidents.filter(inc => {
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (moduleFilter !== 'all' && inc.type !== moduleFilter) return false;
    return true;
  });

  const openCount = allIncidents.filter(i => i.status === 'open').length;
  const criticalCount = allIncidents.filter(i => i.severity === 'critical').length;
  const resolvedCount = allIncidents.filter(i => i.status === 'resolved').length;

  const severityColor = (s: string) =>
    s === 'critical' ? 'var(--color-danger)' :
    s === 'high' ? 'var(--color-warning)' :
    s === 'medium' ? 'var(--accent-primary)' : 'var(--text-muted)';

  const typeIcon = (t: string) =>
    t === 'role_protection' ? <Shield size={13} /> :
    t === 'bot_violation' ? <Bot size={13} /> :
    t === 'user_protection' ? <UserCheck size={13} /> :
    <AlertTriangle size={13} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Incident Center</h1>
            <p className="page-subtitle">Unified real-time view of all CLUTCH NATION security incidents, WTPS violations, and system alerts.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Incidents', val: allIncidents.length, color: 'var(--text-primary)' },
          { label: 'Open', val: openCount, color: 'var(--color-danger)' },
          { label: 'Critical', val: criticalCount, color: 'var(--color-warning)' },
          { label: 'Resolved', val: resolvedCount, color: 'var(--color-success)' },
        ].map((stat, i) => (
          <div key={i} className="section-panel" style={{ padding: '16px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: stat.color }}>{stat.val}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} color="var(--text-muted)" />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'open', 'resolved', 'dismissed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${statusFilter === s ? 'var(--accent-primary)' : 'var(--border-color)'}`, backgroundColor: statusFilter === s ? 'rgba(79,140,255,0.1)' : 'transparent', color: statusFilter === s ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${severityFilter === s ? severityColor(s) : 'var(--border-color)'}`, backgroundColor: severityFilter === s ? `${severityColor(s)}18` : 'transparent', color: severityFilter === s ? severityColor(s) : 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Incident Timeline */}
      <div className="section-panel">
        <div className="panel-header">
          <span className="panel-title">Incident Timeline ({filtered.length})</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading
            ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading incidents...</div>
            : filtered.length === 0
              ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No incidents match the selected filters. The system is operating normally.
                </div>
              : filtered.map(inc => (
                  <div key={inc.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    {/* Severity Indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: severityColor(inc.severity), boxShadow: inc.status === 'open' ? `0 0 8px ${severityColor(inc.severity)}` : 'none' }} />
                      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: severityColor(inc.severity) }}>{typeIcon(inc.type)}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{inc.action}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {typeof inc.time === 'string' && inc.time.includes('T') ? new Date(inc.time).toLocaleString() : inc.time}
                        {inc.target && inc.target !== 'Server' && ` · Target: ${inc.target}`}
                        {inc.actor && inc.actor !== 'Discord Gateway' && ` · Actor: ${inc.actor}`}
                        {inc.policyApplied && ` · Policy: ${inc.policyApplied}`}
                      </div>
                      {inc.recoveryAttempted && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={10} /> Recovery attempted
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <StatusBadge
                        status={inc.severity === 'critical' ? 'danger' : inc.severity === 'high' ? 'warn' : 'info'}
                        label={inc.severity.toUpperCase()}
                      />
                      <StatusBadge
                        status={inc.status === 'open' ? 'danger' : inc.status === 'resolved' ? 'success' : 'warn'}
                        label={inc.status}
                      />
                      {/* Incident resolve action for WTPS removed for now */}
                    </div>
                  </div>
                ))
          }
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('whitelist-overview')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserCheck size={13} /> Whitelist Dashboard
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('security')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={13} /> Security Panel
        </button>
      </div>
    </div>
  );
}
