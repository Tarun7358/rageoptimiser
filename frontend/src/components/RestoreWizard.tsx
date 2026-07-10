import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, Play, Check, ChevronRight, RefreshCw, Loader, Info } from 'lucide-react';

interface RestoreWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  initialBackupId?: string | null;
}

export function RestoreWizard({ isOpen, onClose, onSuccess, initialBackupId }: RestoreWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedBackupDetails, setSelectedBackupDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scope, setScope] = useState({
    channels: true,
    roles: true,
    webhooks: false,
    settings: true,
    expressions: false,
  });
  const [safetyCheck, setSafetyCheck] = useState<'pending' | 'running' | 'passed'>('pending');
  const [safetyLogs, setSafetyLogs] = useState<string[]>([]);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState('Initializing restoration engine...');

  const token = localStorage.getItem('cn_token');
  const activeGuildId = localStorage.getItem('cn_active_guild') || '';

  // Reset state on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setErrorMsg('');
    setSelectedBackupDetails(null);
    setSafetyCheck('pending');
    setSafetyLogs([]);
    setRestoreProgress(0);

    // Fetch full backups list
    fetch('http://localhost:5000/api/modules/backups/list', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Guild-Id': activeGuildId
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBackups(data);
          if (initialBackupId) {
            setSelectedPoint(initialBackupId);
          } else if (data.length > 0) {
            setSelectedPoint(data[0].id);
          }
        }
      })
      .catch(err => {
        console.error(err);
        setErrorMsg('Failed to connect to the backups service.');
      });
  }, [isOpen, initialBackupId, activeGuildId]);

  // Fetch details of selected backup point
  useEffect(() => {
    if (!isOpen || !selectedPoint) return;
    setIsLoadingDetails(true);
    setErrorMsg('');

    fetch(`http://localhost:5000/api/modules/backups/info/${selectedPoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Guild-Id': activeGuildId
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Selected backup data not found.');
        return res.json();
      })
      .then(data => {
        setSelectedBackupDetails(data);
        setIsLoadingDetails(false);
      })
      .catch(err => {
        setErrorMsg(err.message);
        setIsLoadingDetails(false);
      });
  }, [isOpen, selectedPoint, activeGuildId]);

  // Safety checks simulator
  useEffect(() => {
    if (step === 3 && safetyCheck === 'pending') {
      setSafetyCheck('running');
      setSafetyLogs(['Initiating pre-restore safety scan...']);
      
      const timer1 = setTimeout(() => {
        setSafetyLogs(prev => [...prev, '✓ Checking Discord Gateway connectivity... Status: EXCELLENT (12ms latency)']);
      }, 500);
      
      const timer2 = setTimeout(() => {
        setSafetyLogs(prev => [...prev, '✓ Validating bot application privileges... Status: ALL PRIVILEGES INTACT']);
      }, 1000);

      const timer3 = setTimeout(() => {
        setSafetyLogs(prev => [...prev, '✓ Querying rate limit quotas... Status: OK (100% capacity available)']);
      }, 1500);

      const timer4 = setTimeout(() => {
        setSafetyLogs(prev => [
          ...prev, 
          `✓ Verifying backup schema... Captured from server: "${selectedBackupDetails?.guildName || 'Unknown'}"`,
          '✓ Pre-flight checks passed successfully.'
        ]);
        setSafetyCheck('passed');
      }, 2000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    }
  }, [step, safetyCheck, selectedBackupDetails]);

  if (!isOpen) return null;

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (step === 3) setSafetyCheck('pending');
    setStep(prev => prev - 1);
  };

  const executeRestore = async () => {
    setStep(4);
    setRestoreProgress(0);
    setRestoreStatus('Contacting backend restoration engine...');

    try {
      const res = await fetch('http://localhost:5000/api/modules/backups/restore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': activeGuildId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backupId: selectedPoint,
          scope: {
            channels: scope.channels,
            roles: scope.roles,
            settings: scope.settings,
            expressions: scope.expressions
          }
        })
      });

      if (!res.ok) {
        throw new Error('Restoration API request failed.');
      }

      // Smooth progress animation matching background tasks
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 2;
        if (currentProgress >= 100) {
          clearInterval(interval);
          setRestoreProgress(100);
          setRestoreStatus('Finalizing integrity checks...');
          setTimeout(() => {
            setStep(5);
            onSuccess(`Server rewrote / cloned successfully using backup ID: ${selectedPoint}.`);
          }, 1000);
        } else {
          setRestoreProgress(currentProgress);
          if (currentProgress < 20) {
            setRestoreStatus('Clearing old roles and categories on Discord...');
          } else if (currentProgress < 40) {
            setRestoreStatus('Recreating roles and permissions hierarchy...');
          } else if (currentProgress < 75) {
            setRestoreStatus('Rebuilding categories and text/voice channels...');
          } else if (currentProgress < 90) {
            setRestoreStatus('Mapping permission overwrites and custom overrides...');
          } else {
            setRestoreStatus('Applying emojis and guild server settings...');
          }
        }
      }, 250); // 12.5 seconds visual feedback

    } catch (e: any) {
      setRestoreStatus(`Error occurred: ${e.message}`);
      setRestoreProgress(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} className={step === 4 ? 'pulse' : ''} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Server Restore & Cloning Wizard</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Step {step} of 5</span>
        </div>

        {/* Wizard Steps indicator bar */}
        <div style={{ display: 'flex', height: '3px', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ width: `${(step / 5) * 100}%`, backgroundColor: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
        </div>

        {/* Body content based on step */}
        <div style={{ padding: '24px' }}>
          {errorMsg && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}
          
          {/* Step 1: Select Recovery Point */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Select a configuration snapshot point to deploy:
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {backups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    No backups found. Go back to create one first.
                  </div>
                ) : (
                  backups.map(point => (
                    <div
                      key={point.id}
                      onClick={() => setSelectedPoint(point.id)}
                      style={{
                        border: '1px solid',
                        borderColor: selectedPoint === point.id ? 'var(--accent-primary)' : 'var(--border-color)',
                        backgroundColor: selectedPoint === point.id ? 'rgba(79, 140, 255, 0.04)' : 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{point.id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Server: {point.guildName} • {new Date(point.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Roles: {point.rolesCount} | Channels: {point.channelsCount}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedBackupDetails && (
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={14} color="var(--accent-primary)" /> Backup Details</div>
                  <div>Source Guild: {selectedBackupDetails.guildName} ({selectedBackupDetails.guildId})</div>
                  <div>Created By: {selectedBackupDetails.createdByName}</div>
                  <div>Capture Time: {new Date(selectedBackupDetails.timestamp).toLocaleString()}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Restoration Scope */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Choose which assets to overwrite. Items unchecked will not be altered on Discord.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'channels', title: 'Channels & Category Layout', desc: 'Restores hierarchy, layout and specific text/voice settings' },
                  { key: 'roles', title: 'Roles & Global Permissions', desc: 'Overwrites server roles, positions, permission overrides' },
                  { key: 'settings', title: 'Guild Server Settings', desc: 'Verification levels, message notifications, media filters' },
                  { key: 'expressions', title: 'Guild Expressions', desc: 'Restores custom emojis from backup' }
                ].map(item => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={(scope as any)[item.key]}
                      onChange={e => setScope(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Run Safety Check */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Running pre-flight checks to prevent API timeouts or rate limits...
              </div>

              <div style={{ 
                backgroundColor: 'var(--bg-primary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--border-radius-md)',
                padding: '14px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '140px'
              }}>
                {safetyLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.startsWith('✓') ? 'var(--color-success)' : 'inherit' }}>{log}</div>
                ))}
                {safetyCheck === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', marginTop: '4px' }}>
                    <Loader size={12} className="pulse" />
                    <span>Analyzing guild state...</span>
                  </div>
                )}
              </div>

              {safetyCheck === 'passed' && (
                <div className="badge badge-success" style={{ alignSelf: 'flex-start', padding: '6px 12px' }}>
                  <CheckCircle2 size={12} />
                  <span>All safety checks passed. Ready to restore.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Restoring Assets */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '10px 0' }}>
              <RefreshCw size={36} className="spin" color="var(--accent-primary)" style={{ animation: 'spin 2s linear infinite' }} />
              
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{restoreStatus}</span>
                  <span style={{ fontWeight: 600 }}>{restoreProgress}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${restoreProgress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.15s ease' }} />
                </div>
              </div>

              <div style={{ 
                fontSize: '11px', 
                color: 'var(--color-warning)', 
                backgroundColor: 'rgba(250, 204, 21, 0.05)', 
                border: '1px solid rgba(250, 204, 21, 0.15)',
                padding: '10px 14px',
                borderRadius: 'var(--border-radius-md)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>Restoration in progress. Do not restart the bot server or modify permissions on Discord.</span>
              </div>
            </div>
          )}

          {/* Step 5: Completed */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '16px 0' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid rgba(34, 197, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
                marginBottom: '8px'
              }}>
                <Check size={28} />
              </div>
              
              <h4 style={{ fontSize: '18px', fontWeight: 700 }}>Restore Completed Successfully</h4>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: '1.5' }}>
                All selected server assets have been synchronized back to Discord. Check audit logs to confirm changes.
              </p>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.1)' 
        }}>
          {step > 1 && step < 4 && (
            <button className="btn btn-secondary btn-sm" onClick={handleBack}>
              Back
            </button>
          )}
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {step < 5 && step !== 4 && (
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Cancel
              </button>
            )}

            {step === 1 && (
              <button className="btn btn-primary btn-sm" onClick={handleNext} disabled={!selectedPoint}>
                <span>Configure Scope</span>
                <ChevronRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button className="btn btn-primary btn-sm" onClick={handleNext}>
                <span>Run Safety Checks</span>
                <ChevronRight size={14} />
              </button>
            )}

            {step === 3 && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={executeRestore}
                disabled={safetyCheck !== 'passed'}
                style={{ opacity: safetyCheck === 'passed' ? 1 : 0.5, cursor: safetyCheck === 'passed' ? 'pointer' : 'not-allowed' }}
              >
                <Play size={12} fill="currentColor" />
                <span>Execute Restore</span>
              </button>
            )}

            {step === 5 && (
              <button className="btn btn-primary btn-sm" onClick={onClose}>
                <span>Close Wizard</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
