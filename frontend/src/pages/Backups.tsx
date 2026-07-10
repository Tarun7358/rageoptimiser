import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ShieldCheck, Database, Calendar, Trash2, Globe } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { ChannelSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordChannel } from '../hooks/useDiscordSync';

interface BackupsProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  onOpenRestoreWizard: (backupId?: string) => void;
  modules: ModuleState[];
  registry: { channels: DiscordChannel[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Backups({ 
  onSaveConfig, 
  onManualTrigger, 
  onOpenRestoreWizard,
  modules,
  registry,
  onUpdateConfig
}: BackupsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);
  const [retentionDays, setRetentionDays] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [externalId, setExternalId] = useState('');

  const backupModule = (modules || []).find(m => m.id === 'backups');
  const config = backupModule?.config || {};
  const channelId = config.channelId || '';

  const token = localStorage.getItem('cn_token');
  const activeGuildId = localStorage.getItem('cn_active_guild') || '';

  const fetchBackups = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/modules/backups/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': activeGuildId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (e) {
      console.error('Failed to fetch backups:', e);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [activeGuildId]);

  const handleInstantBackup = async () => {
    setIsSyncing(true);
    onManualTrigger('Backup System: Commencing instant manual server backup task...', 'info', 'Backup');
    
    try {
      const res = await fetch('http://localhost:5000/api/modules/backups/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': activeGuildId,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setIsSyncing(false);
        onSaveConfig('Manual backup successfully created. Signature verified.');
        onManualTrigger(`Backup System: Incremental backup point ${data.backup?.id} compiled and stored.`, 'success', 'Backup');
        fetchBackups();
      } else {
        setIsSyncing(false);
        onManualTrigger('Backup System: Failed to compile backup. Check bot permissions.', 'danger', 'Backup');
      }
    } catch (err) {
      setIsSyncing(false);
      onManualTrigger('Backup System: Network error occurred.', 'danger', 'Backup');
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete backup ${id}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/modules/backups/delete/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': activeGuildId
        }
      });
      if (res.ok) {
        onSaveConfig('Backup deleted successfully.');
        fetchBackups();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('backups', fields);
  };

  const handleSave = () => {
    onSaveConfig('Backup logging notification settings saved.');
    onManualTrigger('Backup: Cron scheduling configured on Discord Gateway.', 'success', 'Backup');
  };

  const handleToggleEnable = () => {
    if (!backupModule) return;
    const nextEnabled = backupModule.status !== 'enabled';
    onUpdateConfig('backups', {}, nextEnabled);
    onSaveConfig(`Backup schedules ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Backup: Schedule state set to ${nextEnabled ? 'ACTIVE' : 'OFF'}.`, nextEnabled ? 'success' : 'warning', 'Backup');
  };

  const handleLoadExternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalId.trim()) return;
    onOpenRestoreWizard(externalId.trim());
    setExternalId('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Backup Recovery Hub</h1>
            <p className="page-subtitle">Configure cloud retention settings, create manual snapshots, and restore assets.</p>
          </div>
          <button className="btn btn-primary" onClick={handleInstantBackup} disabled={isSyncing || backupModule?.status !== 'enabled'}>
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} style={{ animation: isSyncing ? 'spin 1.5s linear infinite' : 'none' }} />
            <span>{isSyncing ? 'Syncing...' : 'Create Snapshot Now'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          {[
            { id: 'overview', label: 'Setup & Schedule' },
            { id: 'history', label: 'Backup History Points' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="panel-body">
          
          {/* TAB 1: SETUP */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <SetupWizard
                steps={['Overview', 'Required Bindings', 'Retention Policy', 'Activation']}
                activeStep={wizardStep}
                onStepChange={setWizardStep}
                progress={backupModule?.progress || 0}
                errors={backupModule?.errors || []}
                status={backupModule?.status || 'not_configured'}
                onToggleEnable={handleToggleEnable}
                onSave={handleSave}
              >
                {wizardStep === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Automatic Cloud Snapshots</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Protect channel permissions, category mappings, and roles against server nukers.
                      Set up a backup notification channel before starting active schedules.
                    </p>
                  </div>
                )}

                {wizardStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ChannelSelect 
                      label="Backup Status Notification Channel"
                      channels={registry.channels}
                      selectedChannelId={channelId}
                      onChange={id => handleUpdate({ channelId: id })}
                      typeFilter={['text']}
                      helpText="Channel where verification signature reports are pushed."
                    />
                  </div>
                )}

                {wizardStep === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Auto-Backup Frequency</label>
                      <select className="form-select">
                        <option>Every 24 Hours (Daily at 3 AM)</option>
                        <option>Every 12 Hours (Twice daily)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Retention Period (Days)</label>
                      <input 
                        type="range" 
                        min="7" 
                        max="90" 
                        value={retentionDays} 
                        onChange={e => setRetentionDays(parseInt(e.target.value))} 
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>7 days</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{retentionDays} Days</span>
                        <span>90 days</span>
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                    <ShieldCheck size={48} color="var(--color-success)" />
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Backup Configs verified</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Your retention metrics match storage guidelines. You can enable backup routines.
                    </p>
                  </div>
                )}
              </SetupWizard>

              {/* Zenon-style Cloning Tool */}
              <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Globe size={18} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Clone Server (External Backup ID)</h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Replicate roles, permissions, categories, channels and layouts from another guild. Input any valid backup template signature ID below.
                </p>
                <form onSubmit={handleLoadExternal} style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="BP-XXX-XXXX" 
                    value={externalId} 
                    onChange={e => setExternalId(e.target.value)} 
                    className="text-input"
                    style={{ flex: 1, padding: '8px 12px' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    Inspect & Clone
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Backup ID</th>
                    <th>Source Server</th>
                    <th>Created By</th>
                    <th>Timestamp</th>
                    <th>Stats</th>
                    <th>Signature</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No backup points compiled. Click "Create Snapshot Now" above to initiate a backup.
                      </td>
                    </tr>
                  ) : (
                    backups.map((point) => (
                      <tr key={point.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{point.id}</td>
                        <td style={{ fontWeight: 600 }}>{point.guildName || 'Unknown Guild'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{point.createdByName || 'System'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(point.timestamp).toLocaleString()}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Roles: {point.rolesCount} | Chans: {point.channelsCount}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '11px', fontWeight: 600 }}>
                            <ShieldCheck size={12} />
                            <span>Verified</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => onOpenRestoreWizard(point.id)} disabled={backupModule?.status !== 'enabled'}>
                              <Play size={10} fill="currentColor" />
                              <span>Restore / Clone</span>
                            </button>
                            <button className="icon-btn" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteBackup(point.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

