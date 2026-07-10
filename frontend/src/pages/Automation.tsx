import React, { useState } from 'react';
import { Zap, MessageSquare, Trash, Plus, ShieldCheck } from 'lucide-react';
import { SetupWizard } from '../components/SetupWizard';
import { RoleSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordRole } from '../hooks/useDiscordSync';

interface AutomationProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { roles: DiscordRole[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Automation({ 
  onSaveConfig, 
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: AutomationProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);
  const [cleanupTime, setCleanupTime] = useState(24);

  const autoModule = (modules || []).find(m => m.id === 'automation');
  const config = autoModule?.config || {};

  // Form selections matching Zero Operational Defaults
  const roleId = config.roleId || '';

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('automation', fields);
  };

  const handleSave = () => {
    onSaveConfig('Automation keyword rules and default roles saved.');
    onManualTrigger('Automation: Auto roles configured on Discord Gateway.', 'success', 'System');
  };

  const handleToggleEnable = () => {
    if (!autoModule) return;
    const nextEnabled = autoModule.status !== 'enabled';
    onUpdateConfig('automation', {}, nextEnabled);
    onSaveConfig(`Automation modules ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Automation: Core routines toggled to ${nextEnabled ? 'MONITORING' : 'OFF'}.`, nextEnabled ? 'success' : 'warning', 'System');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Automation Studio</h1>
        <p className="page-subtitle">Configure scheduled jobs, keyword response rules, auto-cleanup processes, and default roles.</p>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          {[
            { id: 'overview', label: 'Setup & Auto Roles' },
            { id: 'cleanup', label: 'Keyword Cleanups' }
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
              steps={['Overview', 'Required Bindings', 'Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={autoModule?.progress || 0}
              errors={autoModule?.errors || []}
              status={autoModule?.status || 'not_configured'}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Automation Suite</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Configure rules such as granting a default role automatically when a user joins the server.
                    Verify your default role settings before activating the module.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <RoleSelect 
                    label="Default Auto Role on Join"
                    roles={registry.roles}
                    selectedRoleId={roleId}
                    onChange={id => handleUpdate({ roleId: id })}
                    helpText="Role given to newly joined users immediately."
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <ShieldCheck size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Automation Configs validated</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your default role configs are healthy. Enable the module to launch listeners.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB 2: CLEANUP */}
          {activeTab === 'cleanup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="section-panel" style={{ border: 'none', padding: 0 }}>
                <span className="panel-title" style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'block' }}>Keyword Auto-Responses</span>
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Trigger</th>
                        <th>Response Content</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontFamily: 'monospace' }}>!ip</td>
                        <td style={{ color: 'var(--text-secondary)' }}>Connect via play.rageoptimiser.com</td>
                      </tr>
                      <tr>
                        <td style={{ fontFamily: 'monospace' }}>!help</td>
                        <td style={{ color: 'var(--text-secondary)' }}>Directing your request to #support-tickets...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="section-panel" style={{ border: 'none', padding: 0 }}>
                <span className="panel-title" style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'block' }}>Auto Cleanup Channels</span>
                <div className="form-group">
                  <label className="form-label">Expiration (Hours)</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="48" 
                    value={cleanupTime} 
                    onChange={e => setCleanupTime(parseInt(e.target.value))} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>1h</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{cleanupTime} Hours</span>
                    <span>48h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
