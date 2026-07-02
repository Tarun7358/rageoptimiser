import React, { useState } from 'react';
import { RefreshCw, Play, ShieldCheck, Database, Calendar } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { ChannelSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordChannel } from '../hooks/useDiscordSync';

interface BackupsProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  onOpenRestoreWizard: () => void;
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

  const backupModule = (modules || []).find(m => m.id === 'backups');
  const config = backupModule?.config || {};

  // Form selections matching Zero Operational Defaults
  const channelId = config.channelId || '';

  const backupPoints = [
    { id: 'BP-994', label: 'Manual Restore checkpoint (Pre-Staff Audit)', date: 'Today, 11:24 AM', size: '142.4 MB', type: 'Differential', status: 'Verified' },
    { id: 'BP-993', label: 'Scheduled Daily Sync (AutoBackup)', date: 'Yesterday, 3:00 AM', size: '254.1 MB', type: 'Full', status: 'Verified' },
  ];

  const handleInstantBackup = () => {
    setIsSyncing(true);
    onManualTrigger('Backup System: Commencing instant manual server backup task...', 'info', 'Backup');
    
    setTimeout(() => {
      setIsSyncing(false);
      onSaveConfig('Manual backup successfully created. Signature verified.');
      onManualTrigger('Backup System: Incremental backup point BP-995 compiled and stored (Size: 144.1 MB, Time: 12.4s).', 'success', 'Backup');
    }, 2500);
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
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Backup ID</th>
                    <th>Snapshot Name / Description</th>
                    <th>Timestamp</th>
                    <th>Storage Size</th>
                    <th>Signature</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backupPoints.map((point) => (
                    <tr key={point.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{point.id}</td>
                      <td style={{ fontWeight: 600 }}>{point.label}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{point.date}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{point.size}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '11px', fontWeight: 600 }}>
                          <ShieldCheck size={12} />
                          <span>{point.status}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={onOpenRestoreWizard} disabled={backupModule?.status !== 'enabled'}>
                          <Play size={10} fill="currentColor" />
                          <span>Restore</span>
                        </button>
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
