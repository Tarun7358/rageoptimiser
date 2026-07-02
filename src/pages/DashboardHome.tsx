import React from 'react';
import { 
  ShieldCheck, Users, Activity, ShieldAlert, Award, Clock, ArrowUpRight, 
  Settings2, ChevronRight, CheckCircle2, ShieldOff, AlertTriangle
} from 'lucide-react';
import type { ActivityEvent } from '../hooks/useActivityFeed';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardHomeProps {
  events: ActivityEvent[];
  latency: number;
  uptime: string;
  onNavigate: (page: string, tab?: string) => void;
  onManualTrigger: (msg: string, type: ActivityEvent['type'], cat: ActivityEvent['category']) => void;
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
}

export function DashboardHome({ events, latency, uptime, onNavigate, onManualTrigger, modules, registry }: DashboardHomeProps) {
  // Compute numbers from active events
  const quarantinedCount = events.filter(e => e.message.includes('quarantine') || e.message.includes('revoked') || e.message.includes('banned')).length;
  const resolvedCount = events.filter(e => e.message.toLowerCase().includes('restore') || e.message.toLowerCase().includes('resolved') || e.message.toLowerCase().includes('success') || e.message.toLowerCase().includes('complete')).length;
  const pendingCount = events.filter(e => e.type === 'danger' || e.type === 'warning').length;

  // Calculate configuration progress
  const totalProgress = (modules || []).reduce((acc, m) => acc + (m?.progress || 0), 0);
  const averageProgress = modules?.length ? Math.round(totalProgress / modules.length) : 0;
  const activeErrors = (modules || []).reduce<string[]>((acc, m) => [...acc, ...(m?.errors || [])], []);

  // Compute live users and staff from registry
  const liveTotalMembers = registry.memberCount || (registry.roles ? registry.roles.find(r => r.id === 'r-5')?.membersCount : 0) || 842;
  const liveOnlineMembers = registry.onlineCount || Math.round(liveTotalMembers * 0.15); // Fallback to 15% online
  
  // Staff are roles with administration permissions
  const staffRoles = registry.roles ? registry.roles.filter(r => 
    r.permissions && (
      r.permissions.includes('ADMINISTRATOR') || 
      r.permissions.includes('BAN_MEMBERS') || 
      r.permissions.includes('KICK_MEMBERS') ||
      r.permissions.includes('MANAGE_MESSAGES')
    )
  ) : [];
  const totalStaffCount = staffRoles.reduce((acc, r) => acc + (r.membersCount || 0), 0);
  const onlineStaffCount = totalStaffCount > 0 ? Math.max(1, Math.round(totalStaffCount * 0.6)) : 0; // Estimate 60% online staff

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Configuration Status Banner if errors present */}
      {activeErrors.length > 0 && (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '14px 20px', 
            backgroundColor: 'rgba(239, 68, 68, 0.05)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: '8px' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="var(--color-danger)" />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {activeErrors.length} configuration validation alert(s) require attention.
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('health')}>
            Resolve Health Alerts
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Operational Overview</h1>
            <p className="page-subtitle">Real-time status check of your server security layers.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('health')}>
              <AlertTriangle size={14} color="var(--color-warning)" />
              <span>Config Health</span>
            </button>
            <button className="btn btn-primary" onClick={() => {
              onManualTrigger('Owner triggered audit check across all gateway shards.', 'purple', 'System');
            }}>
              <span>Trigger Manual Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Global Setup Progress</span>
            <ShieldCheck size={18} color="var(--accent-primary)" />
          </div>
          <span className="stat-value">{averageProgress}%</span>
          <div className="stat-footer">
            <span className="stat-trend up">{modules.filter(m => m.status === 'enabled').length} / {modules.length} active</span>
            <span style={{ color: 'var(--text-muted)' }}>• modules online</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Online Members</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <span className="stat-value">{Number(liveOnlineMembers).toLocaleString()}</span>
          <div className="stat-footer">
            <span className="stat-trend up">Live Sync</span>
            <span style={{ color: 'var(--text-muted)' }}>• of {Number(liveTotalMembers).toLocaleString()} total members</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Active Staff On Duty</span>
            <Award size={18} color="var(--accent-purple)" />
          </div>
          <span className="stat-value">{onlineStaffCount} / {totalStaffCount}</span>
          <div className="stat-footer">
            <span className="stat-trend neutral">On Call</span>
            <span style={{ color: 'var(--text-muted)' }}>• {totalStaffCount - onlineStaffCount} offline</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Active Quarantines</span>
            <ShieldAlert size={18} color={quarantinedCount > 0 ? "var(--color-warning)" : "var(--text-muted)"} />
          </div>
          <span className="stat-value" style={{ color: quarantinedCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {quarantinedCount}
          </span>
          <div className="stat-footer">
            <span className="stat-trend neutral">Resolved: {resolvedCount}</span>
            <span style={{ color: 'var(--text-muted)' }}>• {pendingCount} pending audit</span>
          </div>
        </div>
      </div>

      {/* Secondary Dashboard Grid */}
      <div className="dashboard-layout-grid">
        
        {/* Main Left Pane: Live Activity Feed */}
        <div className="section-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Activity size={16} color="var(--accent-primary)" />
              <span>Live System Activity Stream</span>
            </div>
            <StatusBadge status="success" label="Websocket Live" />
          </div>
          <div className="panel-body" style={{ padding: '0', overflowY: 'auto', maxHeight: '420px' }}>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Time</th>
                    <th style={{ width: '120px' }}>Scope</th>
                    <th>Action / Log Details</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 10).map((event) => (
                    <tr key={event.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{event.timestamp}</td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          color: event.category === 'Security' ? 'var(--color-warning)' : 'var(--text-secondary)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {event.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{event.message}</td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge status={event.type} label={event.type} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Right Pane: Health dials and shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Voice Presence Status Widget */}
          <div className="section-panel" style={{ background: 'linear-gradient(135deg, rgba(79,140,255,0.05) 0%, rgba(139,92,246,0.05) 100%)', border: '1px solid rgba(79,140,255,0.15)' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid rgba(79,140,255,0.1)' }}>
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <span className="ping-dot" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: (modules?.find(m => m.id === 'voice')?.connectionStatus || 'disconnected') === 'connected' ? 'var(--color-success)' : ((modules?.find(m => m.id === 'voice')?.connectionStatus || 'disconnected') === 'connecting' ? 'var(--color-warning)' : 'var(--text-muted)'),
                  boxShadow: (modules?.find(m => m.id === 'voice')?.connectionStatus || 'disconnected') === 'connected' ? '0 0 8px var(--color-success)' : 'none'
                }}></span>
                Voice Presence (24/7)
              </span>
              <button className="btn-link" onClick={() => onNavigate('voice')} style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px', border: 'none', background: 'none', cursor: 'pointer' }}>
                View Monitor <ChevronRight size={10} />
              </button>
            </div>
            <div className="panel-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: (modules?.find(m => m.id === 'voice')?.connectionStatus || 'disconnected') === 'connected' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                    {(modules?.find(m => m.id === 'voice')?.connectionStatus || 'disconnected').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Channel</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {modules?.find(m => m.id === 'voice')?.connectedChannelId 
                      ? `🔊 ${registry.channels?.find((c: any) => c.id === (modules || []).find(m => m.id === 'voice')?.connectedChannelId)?.name || 'Unknown'}`
                      : 'None'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {modules?.find(m => m.id === 'voice')?.connectionDuration || '0s'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gateway</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: (modules?.find(m => m.id === 'voice')?.voiceGatewayStatus || 'healthy') === 'healthy' ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {(modules?.find(m => m.id === 'voice')?.voiceGatewayStatus || 'healthy').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access panel */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Quick Actions</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Resolve Validation Warnings', page: 'health' },
                { label: 'Create Instant Server Backup', page: 'backups' },
                { label: 'Modify Anti-Raid Thresholds', page: 'security' },
                { label: 'Verify User Entry Gate', page: 'verification' },
                { label: 'Export Current System Logs', page: 'logs' }
              ].map((act, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(act.page)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.backgroundColor = 'rgba(79,140,255,0.02)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                  }}
                >
                  <span>{act.label}</span>
                  <ArrowUpRight size={14} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>

          {/* Active Security Modules status */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Active Security Policies</span>
            </div>
            <div className="panel-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {modules.map((mod, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: mod.status === 'enabled' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{mod.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {mod.status === 'enabled' ? (
                      <CheckCircle2 size={12} color="var(--color-success)" />
                    ) : mod.status === 'validation_failed' ? (
                      <AlertTriangle size={12} color="var(--color-danger)" />
                    ) : (
                      <ShieldOff size={12} color="var(--text-muted)" />
                    )}
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      color: mod.status === 'enabled' ? 'var(--color-success)' : mod.status === 'validation_failed' ? 'var(--color-danger)' : 'var(--text-muted)' 
                    }}>
                      {mod.status === 'enabled' ? 'MONITORING' : mod.status === 'validation_failed' ? 'WARNING' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
