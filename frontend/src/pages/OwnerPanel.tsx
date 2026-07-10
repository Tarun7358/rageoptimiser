import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, HardDrive, RefreshCw, EyeOff, UserCheck, Shield, Radio, Terminal, Send, Plus, Trash2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';

interface OwnerPanelProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  globalSettings: Record<string, any>;
}

export function OwnerPanel({ onSaveConfig, onManualTrigger, globalSettings }: OwnerPanelProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState('rage_live_pk_392019485892019485aa02381ff');
  const maintenanceMode = globalSettings?.maintenanceMode || false;

  const { token, user, requireElevation } = useAuth();
  const isOwnerCredentials = user?.role === 'owner';
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('staff');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    '[SYSTEM] Shard #001 initialized successfully.',
    '[SYSTEM] Redis Cache connection established at redis://localhost:6379',
    '[SYSTEM] Gateway syncing guild list (2 active approved nodes)'
  ]);

  // Fetch staff
  const fetchStaff = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/system/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setStaff(json);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStaff();
  }, [token]);

  const handleToggleMaintenance = (checked: boolean) => {
    requireElevation(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system/override', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'toggle_maintenance', value: checked })
        });
        if (res.ok) {
          onSaveConfig(`Maintenance Mode toggled ${checked ? 'ON' : 'OFF'}.`);
          onManualTrigger(`System Policy: Maintenance Mode set to ${checked ? 'ON (Staff only bypass)' : 'OFF (Public live)'}.`, checked ? 'warning' : 'success', 'System');
        } else {
          onSaveConfig('Failed to toggle Maintenance Mode.');
        }
      } catch (e) {
        onSaveConfig('API Error: Could not reach backend.');
      }
    });
  };

  const handleRotateKey = () => {
    requireElevation(() => {
      const fakeKey = `rage_live_pk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      setApiKey(fakeKey);
      onSaveConfig('Primary bot API token rotated.');
      onManualTrigger('Owner Panel: Rotated primary bot API token. Updating config points.', 'purple', 'System');
    });
  };

  const handleDeployCommands = () => {
    requireElevation(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/commands/sync', { 
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          onSaveConfig('All slash commands successfully deployed to Discord.');
          onManualTrigger('System: Administrator forcefully re-synced global Slash Commands.', 'success', 'System');
        } else {
          onSaveConfig('Failed to deploy slash commands. Gateway might be disconnected.');
        }
      } catch (err) {
        onSaveConfig('Failed to trigger slash command deployment (API error).');
      }
    });
  };

  // Add staff
  const handleAddStaff = () => {
    if (!newStaffName.trim() || !newStaffPass.trim()) return;
    requireElevation(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system/staff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username: newStaffName, password: newStaffPass, role: newStaffRole })
        });
        if (res.ok) {
          onSaveConfig(`Staff account ${newStaffName} created.`);
          onManualTrigger(`Owner Panel: Provisioned staff user "${newStaffName}" with role "${newStaffRole}".`, 'success', 'System');
          setNewStaffName(''); setNewStaffPass('');
          fetchStaff();
        } else {
          const errData = await res.json();
          onSaveConfig(errData.error || 'Failed to create staff account.');
        }
      } catch {
        onSaveConfig('Network error creating staff user.');
      }
    });
  };

  // Delete staff
  const handleDeleteStaff = (username: string) => {
    requireElevation(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/system/staff/${username}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          onSaveConfig(`Staff account ${username} deleted.`);
          onManualTrigger(`Owner Panel: Deleted staff user "${username}".`, 'warning', 'System');
          fetchStaff();
        } else {
          onSaveConfig('Failed to delete staff.');
        }
      } catch {
        onSaveConfig('Network error deleting staff user.');
      }
    });
  };

  // Broadcast announcement
  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    requireElevation(async () => {
      setBroadcasting(true);
      try {
        const res = await fetch('http://localhost:5000/api/system/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: broadcastMessage })
        });
        if (res.ok) {
          const data = await res.json();
          onSaveConfig(`Announcement broadcasted to ${data.count} servers.`);
          onManualTrigger(`System Broadcast: Global alert dispatched.`, 'purple', 'System');
          setBroadcastMessage('');
        } else {
          onSaveConfig('Broadcast failed. No active shards connected.');
        }
      } catch {
        onSaveConfig('API connection failed during broadcast.');
      }
      setBroadcasting(false);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Owner Administration Panel</h1>
        <p className="page-subtitle">Highly sensitive global overrides, database controls, and staff credentials audits.</p>
      </div>

      <div className="dashboard-layout-grid">
        
        {/* Left Side: Server Systems health and DB keys */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Controls panel */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">System Gateway Overrides</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div className="form-group-row">
                <div>
                  <div className="form-label">System Maintenance Mode</div>
                  <div className="form-help">Locks public commands; only listed trusted staff can interact.</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={maintenanceMode} onChange={e => handleToggleMaintenance(e.target.checked)} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="form-group-row">
                <div>
                  <div className="form-label">Global Emergency Lock</div>
                  <div className="form-help">Locks all server channels & pauses invite codes in 1 click.</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => {
                  requireElevation(async () => {
                    try {
                      const res = await fetch('http://localhost:5000/api/system/override', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ action: 'emergency_lock' })
                      });
                      if (res.ok) {
                        onSaveConfig('EMERGENCY LOCK APPLIED. All channels locked.');
                        onManualTrigger('CRITICAL: Emergency Server Lock applied by Server Owner. ALL channels set to Read-Only.', 'danger', 'Security');
                      } else {
                        onSaveConfig('Failed to apply emergency lock.');
                      }
                    } catch (e) {
                      onSaveConfig('API Error.');
                    }
                  });
                }}>
                  Trigger Lock
                </button>
              </div>

              <div className="form-group-row">
                <div>
                  <div className="form-label">Deploy & Sync Slash Commands</div>
                  <div className="form-help">Forcefully re-register all bot commands to the Discord server immediately.</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleDeployCommands}>
                  Deploy Commands
                </button>
              </div>

            </div>
          </div>

          {/* Platform Broadcast Announcer */}
          {isOwnerCredentials && (
            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title"><Radio size={16} /> Global Announcements Broadcaster</span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  className="form-input-text"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="Compose a platform announcement to send to all server owners via bot DM..."
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleBroadcast} disabled={broadcasting || !broadcastMessage.trim()} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send size={12} /> {broadcasting ? 'Broadcasting...' : 'Broadcast Message'}
                </button>
              </div>
            </div>
          )}

          {/* Database API keys */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Secure Credentials & Key Rings</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Private API Gateway Key</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type={apiKeyVisible ? 'text' : 'password'} 
                    className="form-input-text" 
                    value={apiKey} 
                    readOnly 
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    if (apiKeyVisible) {
                      setApiKeyVisible(false);
                    } else {
                      setApiKeyVisible(true);
                    }
                  }}>
                    {apiKeyVisible ? 'Hide' : 'Reveal'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRotateKey}>
                    Rotate Key
                  </button>
                </div>
                <span className="form-help">Private key used to authenticate dashboard socket clients to backend nodes.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Trusted Staff List & health dials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Staff Manager */}
          {isOwnerCredentials && (
            <div className="section-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="panel-title">
                  <UserCheck size={16} />
                  <span>Authorized Dashboard Users</span>
                </div>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input-text" placeholder="Username" style={{ flex: 1 }} value={newStaffName} onChange={e => setNewStaffName(e.target.value)} />
                    <input className="form-input-text" type="password" placeholder="Password" style={{ flex: 1 }} value={newStaffPass} onChange={e => setNewStaffPass(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select className="form-input-text" style={{ width: 120 }} value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)}>
                      <option value="staff">Staff Mod</option>
                      <option value="owner">Co-Owner</option>
                    </select>
                    <button className="btn btn-secondary btn-sm" onClick={handleAddStaff} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={12} /> Add User
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Staff Account</th>
                        <th>Access Profile</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((user, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{user.username}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{user.role} ({user.access || 'Staff Level'})</td>
                          <td>
                            <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>
                              Active
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {user.username !== 'admin' && (
                              <button onClick={() => handleDeleteStaff(user.username)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Shard diagnostics console */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title"><Terminal size={16} /> System Operations Log</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', color: '#10B981', background: '#0a0a0c', padding: 12, borderRadius: 8 }}>
              {systemLogs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>

          {/* Micro diagnostics */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Gateway Shards Health</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              {[
                { label: 'Primary PostgreSQL Database connection', val: 'CONNECTED', status: 'success' },
                { label: 'Redis Event Queue Cache load', val: '0.4% LOAD (OK)', status: 'success' },
                { label: 'Bot Shard Node #001 (Gateway)', val: '10ms LATENCY', status: 'success' },
                { label: 'Bot Shard Node #002 (Gateway)', val: '12ms LATENCY', status: 'success' }
              ].map((diagnostic, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{diagnostic.label}</span>
                  <StatusBadge status={diagnostic.status} label={diagnostic.val} />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
