import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Check, X, Ban, Activity, Server, Users, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { Layout } from '../components/Layout';
import type { NotificationItem } from '../hooks/useActivityFeed';

export function ApprovalCenter({
  notifications, latency, uptime, isLive, onToggleLive, onMarkAllRead, onClearNotifications, onOpenSearch, modules
}: any) {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Pending' | 'Approved' | 'Rejected' | 'Blacklisted'>('Pending');
  const [actionReason, setActionReason] = useState('');
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const token = localStorage.getItem('cn_token');
      const res = await fetch('http://localhost:5000/api/approvals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (guildId: string, action: string) => {
    try {
      const token = localStorage.getItem('cn_token');
      await fetch(`http://localhost:5000/api/approvals/${guildId}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, reason: actionReason })
      });
      setSelectedGuild(null);
      setActionReason('');
      fetchApprovals();
    } catch (e) {
      console.error('Action failed', e);
    }
  };

  const filteredApprovals = approvals.filter(a => a.status === activeTab);

  return (
    <div className="approval-center-container" style={{ padding: '24px' }}>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldAlert color="var(--accent-primary)" />
              Server Approval Center
            </h1>
            <p className="page-subtitle">Manage private bot invitations and review risk scores.</p>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header"><span>Pending Approvals</span><Clock size={16} /></div>
          <div className="stat-value">{approvals.filter(a => a.status === 'Pending').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span>Active Servers</span><Server size={16} /></div>
          <div className="stat-value">{approvals.filter(a => a.status === 'Approved').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span>Rejected / Blacklisted</span><Ban size={16} /></div>
          <div className="stat-value">{approvals.filter(a => a.status === 'Rejected' || a.status === 'Blacklisted').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span>Avg Risk Score</span><Activity size={16} /></div>
          <div className="stat-value">
            {approvals.length > 0 
              ? Math.round(approvals.reduce((sum, a) => sum + a.riskScore, 0) / approvals.length) 
              : 0}
          </div>
        </div>
      </div>

      <div className="section-panel">
        <div className="tabs-nav">
          {(['Pending', 'Approved', 'Rejected', 'Blacklisted'] as const).map(t => (
            <button 
              key={t}
              className={`tab-btn ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t} ({approvals.filter(a => a.status === t).length})
            </button>
          ))}
        </div>
        
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
          ) : filteredApprovals.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <div>No {activeTab.toLowerCase()} servers found.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>Owner</th>
                    <th>Members (Bots)</th>
                    <th>Risk Score</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map(guild => (
                    <tr key={guild.guildId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{guild.guildName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{guild.guildId}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {guild.ownerAvatar ? (
                            <img src={guild.ownerAvatar} alt="owner" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                          ) : (
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--bg-card)' }} />
                          )}
                          <span>{guild.ownerUsername}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={14} color="var(--text-muted)" /> {guild.memberCount} 
                          <span style={{ color: 'var(--color-warning)', fontSize: '11px' }}>({guild.botCount} bots)</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${guild.riskLevel === 'Critical' ? 'danger' : guild.riskLevel === 'High' ? 'warning' : 'success'}`}>
                          {guild.riskLevel} ({guild.riskScore})
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(guild.joinedAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {selectedGuild === guild.guildId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <input 
                              className="form-input-text" 
                              style={{ padding: '4px 8px', fontSize: '12px', width: '150px' }}
                              placeholder="Reason (optional)"
                              value={actionReason}
                              onChange={e => setActionReason(e.target.value)}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => handleAction(guild.guildId, 'approve')}><Check size={14} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAction(guild.guildId, 'reject')}><X size={14} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleAction(guild.guildId, 'blacklist')} style={{ backgroundColor: '#000' }}><Ban size={14} /></button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedGuild(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedGuild(guild.guildId)}>Manage</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
    </div>
  );
}
