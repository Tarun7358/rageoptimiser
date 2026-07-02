import React, { useState } from 'react';
import { Gavel, Search, ShieldAlert, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { RoleSelect, ChannelSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordRole, DiscordChannel } from '../hooks/useDiscordSync';

interface ModerationProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Moderation({ 
  onSaveConfig, 
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: ModerationProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const modModule = (modules || []).find(m => m.id === 'moderation');
  const config = modModule?.config || {};

  // Form selections matching Zero Operational Defaults
  const logChannelId = config.logChannelId || '';
  const modRoleIds = config.modRoleIds || [];
  const warnsToTimeout = config.warnsToTimeout || '';
  const warnsToBan = config.warnsToBan || '';

  const [cases, setCases] = useState([
    { id: 'CASE-492', user: 'toxic_spammer#1290', type: 'BAN', mod: 'AutoMod', reason: 'Invite link spam in #general', date: '10m ago', active: true },
    { id: 'CASE-491', user: 'slow_hand#2004', type: 'TIMEOUT', mod: 'mod_alex', reason: 'Chat flooding (14 messages in 3s)', date: '1h ago', active: true },
    { id: 'CASE-490', user: 'skater_boi', type: 'WARN', mod: 'staff_lisa', reason: 'Disrespectful language in VC chat', date: '3h ago', active: false },
  ]);

  const handlePardonCase = (id: string, user: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
    onSaveConfig(`Pardoned case ${id} for user ${user}.`);
    onManualTrigger(`Pardon case: ${id} status set to inactive for user ${user}.`, 'info', 'Moderation');
  };

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('moderation', fields);
  };

  const handleSave = () => {
    onSaveConfig('Moderation escalation and channel logs configured.');
    onManualTrigger('Moderation: Active infraction policies applied successfully.', 'success', 'Moderation');
  };

  const handleToggleEnable = () => {
    if (!modModule) return;
    const nextEnabled = modModule.status !== 'enabled';
    onUpdateConfig('moderation', {}, nextEnabled);
    onSaveConfig(`Moderation module ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Moderation: Module status toggled to ${nextEnabled ? 'ACTIVE' : 'INACTIVE'}.`, nextEnabled ? 'success' : 'warning', 'Moderation');
  };

  const filteredCases = cases.filter(c => {
    const matchesQuery = c.user.toLowerCase().includes(query.toLowerCase()) || c.reason.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filterType === 'ALL' || c.type === filterType;
    return matchesQuery && matchesFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Moderation Console</h1>
        <p className="page-subtitle">Track infraction reports, pardons, automated rules, and moderator analytics.</p>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          {[
            { id: 'overview', label: 'Setup & Rules' },
            { id: 'cases', label: 'Incraction Logs Database' }
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
              steps={['Overview', 'Required Bindings', 'Escalation Rules', 'Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={modModule?.progress || 0}
              errors={modModule?.errors || []}
              status={modModule?.status || 'not_configured'}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Moderation Suite</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Enable log tracking, warning triggers, and moderator permissions checks. 
                    Configure designated staff roles and log channels to start capturing infraction histories.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <ChannelSelect 
                    label="Log Channel Destination"
                    channels={registry.channels}
                    selectedChannelId={logChannelId}
                    onChange={id => handleUpdate({ logChannelId: id })}
                    typeFilter={['text']}
                    helpText="Channel where logs of bans, kicks, and warnings are pushed."
                  />
                  <RoleSelect 
                    label="Moderator Roles (Allowed to run commands)"
                    roles={registry.roles}
                    selectedRoleIds={modRoleIds}
                    onChange={ids => handleUpdate({ modRoleIds: ids })}
                    isMulti={true}
                    helpText="Users with these roles have permission to issue warnings, kicks, and bans."
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Warning triggers count to auto-timeout</label>
                    <input 
                      type="number" 
                      className="form-input-text" 
                      placeholder="e.g. 3"
                      value={warnsToTimeout}
                      onChange={e => handleUpdate({ warnsToTimeout: parseInt(e.target.value) || '' })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warning triggers count to auto-ban</label>
                    <input 
                      type="number" 
                      className="form-input-text" 
                      placeholder="e.g. 5"
                      value={warnsToBan}
                      onChange={e => handleUpdate({ warnsToBan: parseInt(e.target.value) || '' })}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <ShieldCheck size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Validation Checks Passed</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your moderator configurations match role structures. You can now enable moderation locks.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB 2: CASES */}
          {activeTab === 'cases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '4px 10px', width: '220px' }}>
                  <Search size={12} color="var(--text-muted)" style={{ marginRight: '6px' }} />
                  <input 
                    type="text" 
                    placeholder="Search infractor tag..." 
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{ fontSize: '11px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <select 
                  className="form-select" 
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)}
                  style={{ width: '120px', padding: '4px 10px', fontSize: '11px' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="BAN">Bans</option>
                  <option value="TIMEOUT">Timeouts</option>
                  <option value="WARN">Warnings</option>
                </select>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Infractor User</th>
                      <th>Infraction Type</th>
                      <th>Moderator</th>
                      <th>Reason</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace' }}>{c.id}</td>
                        <td style={{ fontWeight: 600 }}>{c.user}</td>
                        <td>
                          <StatusBadge 
                            status={c.type === 'BAN' ? 'danger' : c.type === 'TIMEOUT' ? 'warning' : 'info'} 
                            label={c.type} 
                          />
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.mod}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.reason}</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.active ? (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                              onClick={() => handlePardonCase(c.id, c.user)}
                            >
                              <Check size={12} />
                              <span>Pardon</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pardoned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
