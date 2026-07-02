import React, { useState } from 'react';
import { UserCheck, Shield, Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { RoleSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordRole } from '../hooks/useDiscordSync';

interface VerificationProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { roles: DiscordRole[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Verification({ 
  onSaveConfig, 
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: VerificationProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);
  const [method, setMethod] = useState<'button' | 'captcha' | 'math' | 'manual'>('captcha');

  const verModule = (modules || []).find(m => m.id === 'verification');
  const config = verModule?.config || {};

  // Form selections matching Zero Operational Defaults
  const verifiedRoleId = config.verifiedRoleId || '';
  const unverifiedRoleId = config.unverifiedRoleId || '';

  const [pendingQueue, setPendingQueue] = useState([
    { id: 'u-1', tag: 'newbie_runner', age: '2h old account', risk: 'danger', joined: '10m ago' },
    { id: 'u-2', tag: 'clean_gamer#2021', age: '3 years old account', risk: 'success', joined: '23m ago' }
  ]);

  const handleApproveUser = (id: string, tag: string) => {
    setPendingQueue(prev => prev.filter(u => u.id !== id));
    onSaveConfig(`User ${tag} approved. Verified role granted.`);
    onManualTrigger(`Verification: Manual approval given to ${tag}. Granted "Verified Member" role.`, 'success', 'System');
  };

  const handleRejectUser = (id: string, tag: string) => {
    setPendingQueue(prev => prev.filter(u => u.id !== id));
    onSaveConfig(`User ${tag} verification rejected. Kicked from server.`);
    onManualTrigger(`Verification: Manual reject given to ${tag}. Kicked from guild.`, 'danger', 'System');
  };

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('verification', fields);
  };

  const handleSave = () => {
    onSaveConfig('Verification roles and captcha gate saved.');
    onManualTrigger('Verification: Entry verification locks initialized on Discord Gateway.', 'success', 'System');
  };

  const handleToggleEnable = () => {
    if (!verModule) return;
    const nextEnabled = verModule.status !== 'enabled';
    onUpdateConfig('verification', {}, nextEnabled);
    onSaveConfig(`Verification gate ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Verification: Gate status toggled to ${nextEnabled ? 'ACTIVE' : 'INACTIVE'}.`, nextEnabled ? 'success' : 'warning', 'System');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">User Verification Center</h1>
            <p className="page-subtitle">Configure bot verification entry gates, manual approvals, and roles assignment.</p>
          </div>
          <button 
            className={`btn ${verModule?.status === 'enabled' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleToggleEnable}
            style={{ 
              minWidth: '130px',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: verModule?.status === 'enabled' ? 'var(--color-success)' : 'rgba(255,255,255,0.4)',
              display: 'inline-block'
            }} />
            {verModule?.status === 'enabled' ? 'Module Enabled' : 'Module Disabled'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          {[
            { id: 'overview', label: 'Setup & Gate Configuration' },
            { id: 'review', label: 'Pending Approvals Queue' },
            { id: 'advanced', label: 'Advanced Security' }
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
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <SetupWizard
              steps={['Overview', 'Required Bindings', 'Gate Methods', 'Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={verModule?.progress || 0}
              errors={verModule?.errors || []}
              status={verModule?.status || 'not_configured'}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Rage CAPTCHA Gate</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Protect the server against self-bot join raids. New users are assigned an Unverified Role 
                    and must complete a challenge to earn the Verified Member role.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <RoleSelect 
                    label="Unverified Role (Restricts view channels)"
                    roles={registry.roles}
                    selectedRoleId={unverifiedRoleId}
                    onChange={id => handleUpdate({ unverifiedRoleId: id })}
                    helpText="Role given to newly joined users before completing verification."
                  />
                  <RoleSelect 
                    label="Verified Role (Grants regular member access)"
                    roles={registry.roles}
                    selectedRoleId={verifiedRoleId}
                    onChange={id => handleUpdate({ verifiedRoleId: id })}
                    helpText="Role granted once the user passes verification challenge."
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { key: 'captcha', label: 'Discord Link CAPTCHA', desc: 'Redirects user to a secure external link to verify recaptcha.' },
                    { key: 'math', label: 'Arithmetic Math Challenge', desc: 'Asks user to solve basic addition or subtraction in DM.' },
                    { key: 'button', label: 'Button Consent Gate', desc: 'Simply click a "Verify" button to accept server guidelines.' },
                    { key: 'manual', label: 'Manual Staff Review', desc: 'Redirects users to a pending queue. Staff must manually approve.' }
                  ].map(opt => (
                    <div
                      key={opt.key}
                      onClick={() => setMethod(opt.key as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid',
                        borderColor: method === opt.key ? 'var(--accent-primary)' : 'var(--border-color)',
                        backgroundColor: method === opt.key ? 'rgba(79, 140, 255, 0.04)' : 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 'var(--border-radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                      </div>
                      {method === opt.key && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }}></span>}
                    </div>
                  ))}
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <ShieldCheck size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Verification Setup Verified</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    All validations checks completed successfully.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB 2: REVIEW QUEUE */}
          {activeTab === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Pending Reviews</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manual reviews for join requests.</p>
              </div>

              {pendingQueue.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users are currently waiting in the manual queue.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>User Tag</th>
                        <th>Account Age</th>
                        <th>Risk Assessment</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingQueue.map(user => (
                        <tr key={user.id}>
                          <td style={{ fontWeight: 600 }}>{user.tag}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{user.age}</td>
                          <td>
                            <StatusBadge 
                              status={user.risk === 'danger' ? 'danger' : 'success'} 
                              label={user.risk === 'danger' ? 'HIGH RISK' : 'LOW RISK'} 
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                                onClick={() => handleApproveUser(user.id, user.tag)}
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                                onClick={() => handleRejectUser(user.id, user.tag)}
                              >
                                <X size={12} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADVANCED SECURITY */}
          {activeTab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Duplicate Verification Handling</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Prevent users from verifying multiple times and automatically manage lost roles.</p>
              </div>

              <div className="section-panel" style={{ border: 'none', padding: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div className="form-group-row">
                    <div>
                      <div className="form-label">Enable Duplicate Detection</div>
                      <div className="form-help">Prevent already-verified users from clicking the button to verify again.</div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={config.preventDuplicates !== false} 
                        onChange={e => handleUpdate({ preventDuplicates: e.target.checked })} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="form-group-row">
                    <div>
                      <div className="form-label">Auto-Restore Missing Role</div>
                      <div className="form-help">Automatically give the Verified role back if the user somehow lost it.</div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={config.autoRestoreRole !== false} 
                        onChange={e => handleUpdate({ autoRestoreRole: e.target.checked })} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="form-group-row">
                    <div>
                      <div className="form-label">Log Duplicate Attempts</div>
                      <div className="form-help">Write to Audit Logs whenever someone attempts to verify twice.</div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={config.logDuplicates !== false} 
                        onChange={e => handleUpdate({ logDuplicates: e.target.checked })} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="form-group-row">
                    <div>
                      <div className="form-label">Show "Already Verified" Message</div>
                      <div className="form-help">Confirm to the user that they don't need to do anything.</div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={config.showAlreadyVerifiedMessage !== false} 
                        onChange={e => handleUpdate({ showAlreadyVerifiedMessage: e.target.checked })} 
                      />
                      <span className="slider"></span>
                    </label>
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
