import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, ShieldCheck, Key, Shield, UserX, AlertTriangle, 
  Trash, Check, Play, Settings, RefreshCw, Users, Server, HelpCircle, Eye, EyeOff, Bot,
  Lock, Unlock, Zap, Activity, Info, BarChart2, Calendar, Clock, Plus, ShieldX, CheckCircle, ArrowRight, X, UserCheck, ShieldAlert as ScanIcon, Download, Upload, Copy, History, Sliders, ChevronDown, ChevronUp
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { RoleSelect, ChannelSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordRole, DiscordChannel } from '../hooks/useDiscordSync';
import { useAuth } from '../hooks/useAuth';

interface SecurityProps {
  initialTab?: string;
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Security({ 
  initialTab = 'dashboard', 
  onSaveConfig, 
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: SecurityProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [wizardStep, setWizardStep] = useState(0);
  const { requireElevation, token, activeGuildId } = useAuth();
  
  const securityModule = (modules || []).find(m => m.id === 'security');
  const config = securityModule?.config || {};

  const handleToggleEnable = () => {
    if (!securityModule) return;
    const nextEnabled = securityModule.status !== 'enabled';
    requireElevation(() => {
      onUpdateConfig('security', {}, nextEnabled);
      onSaveConfig(`Security module ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
      onManualTrigger(`Security: Module status toggled to ${nextEnabled ? 'ACTIVE' : 'INACTIVE'}.`, nextEnabled ? 'success' : 'warning', 'Security');
    });
  };

  const handleSave = () => {
    onSaveConfig('Anti-Nuke settings saved successfully.');
    onManualTrigger('Security: Settings updated and applied to Gateway.', 'success', 'Security');
  };

  // Local configurations
  const quarantineRoleId = config.quarantineRoleId || '';
  const alertChannelId = config.alertChannelId || '';
  const emergencyMode = config.emergencyMode || false;
  const currentPreset = config.preset || 'balanced';
  
  // Quarantined users list from config
  const quarantinedUsers = config.quarantinedUsers || [];
  const whitelist = config.whitelist || [];
  const trustedManagers = config.trustedManagers || [];
  const rules = config.rules || {};

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Form states for rule editing
  const [editRuleData, setEditRuleData] = useState<any>(null);

  // Whitelist form states
  const [wlType, setWlType] = useState('user');
  const [wlTargetId, setWlTargetId] = useState('');
  const [wlNotes, setWlNotes] = useState('');
  const [wlExpiration, setWlExpiration] = useState('');
  const [wlScope, setWlScope] = useState('all');

  // Trusted Manager form states
  const [tmUserId, setTmUserId] = useState('');
  const [tmUsername, setTmUsername] = useState('');
  const [tmRole, setTmRole] = useState('security_manager');
  const [tmPermissions, setTmPermissions] = useState<string[]>(['view_logs']);

  // Version history state
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Emergency lockdown PIN
  const [showLockdownModal, setShowLockdownModal] = useState(false);
  const [lockdownAction, setLockdownAction] = useState<'enable' | 'disable'>('enable');
  const [securityPin, setSecurityPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Fetch scan results initially
  useEffect(() => {
    fetchScan();
    fetchHistory();
  }, [token]);

  const fetchScan = async () => {
    try {
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
      const res = await fetch(`http://localhost:5000/api/modules/security/scan`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setScanResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
      const res = await fetch(`http://localhost:5000/api/modules/security/history`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      fetchScan();
      setIsScanning(false);
      onManualTrigger('Security vulnerability scan completed successfully.', 'success', 'Security');
    }, 2000);
  };

  const handleApplyPreset = async (presetName: string) => {
    requireElevation(async () => {
      try {
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
        const res = await fetch(`http://localhost:5000/api/modules/security/presets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ preset: presetName })
        });
        if (res.ok) {
          const data = await res.json();
          onSaveConfig(`Security preset applied: ${presetName.toUpperCase()}`);
          onManualTrigger(`Applied security preset: "${presetName.toUpperCase()}"`, 'success', 'Security');
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleToggleEmergency = () => {
    setLockdownAction(emergencyMode ? 'disable' : 'enable');
    setSecurityPin('');
    setPinError('');
    setShowLockdownModal(true);
  };

  const confirmLockdown = async () => {
    if (securityPin !== '1234') {
      setPinError('Invalid Security PIN credentials.');
      return;
    }

    requireElevation(async () => {
      try {
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
        const res = await fetch(`http://localhost:5000/api/modules/security/lockdown`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: lockdownAction })
        });
        if (res.ok) {
          const data = await res.json();
          setShowLockdownModal(false);
          onSaveConfig(`Emergency Lockdown ${lockdownAction === 'enable' ? 'ENABLED' : 'DISABLED'}.`);
          onManualTrigger(
            `Emergency Lockdown: Server protection controls ${lockdownAction === 'enable' ? 'ENABLED' : 'DEACTIVATED'}.`,
            lockdownAction === 'enable' ? 'danger' : 'success',
            'Security'
          );
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  // Add whitelist entry
  const handleAddWhitelist = async () => {
    if (!wlTargetId) return;
    const newItem = {
      id: `wl-${Date.now()}`,
      type: wlType,
      targetId: wlTargetId,
      name: wlType === 'user' ? 'Target User' : 'Target Asset',
      expiration: wlExpiration || null,
      notes: wlNotes,
      createdBy: 'admin',
      scope: wlScope
    };

    const updated = [...whitelist, newItem];
    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
      const res = await fetch(`http://localhost:5000/api/modules/security/whitelist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ whitelist: updated })
      });
      if (res.ok) {
        onUpdateConfig('security', { whitelist: updated });
        setWlTargetId('');
        setWlNotes('');
        onSaveConfig('Whitelist configuration updated successfully.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveWhitelist = async (id: string) => {
    const updated = whitelist.filter((item: any) => item.id !== id);
    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
      const res = await fetch(`http://localhost:5000/api/modules/security/whitelist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ whitelist: updated })
      });
      if (res.ok) {
        onUpdateConfig('security', { whitelist: updated });
        onSaveConfig('Removed item from whitelist.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add trusted manager
  const handleAddManager = () => {
    if (!tmUserId || !tmUsername) return;
    const newManager = {
      userId: tmUserId,
      username: tmUsername,
      role: tmRole,
      permissions: tmPermissions
    };
    const updated = [...trustedManagers, newManager];
    onUpdateConfig('security', { trustedManagers: updated });
    setTmUserId('');
    setTmUsername('');
    onSaveConfig('Added trusted manager successfully.');
  };

  const handleRemoveManager = (userId: string) => {
    const updated = trustedManagers.filter((m: any) => m.userId !== userId);
    onUpdateConfig('security', { trustedManagers: updated });
    onSaveConfig('Removed trusted manager.');
  };

  // Open rule editor modal
  const openRuleEditor = (ruleKey: string, ruleVal: any) => {
    setEditRuleData({ key: ruleKey, ...ruleVal });
  };

  // Save rule config
  const saveRuleConfig = () => {
    if (!editRuleData) return;
    const updatedRules = {
      ...rules,
      [editRuleData.key]: {
        enabled: editRuleData.enabled,
        limit: editRuleData.limit,
        window: editRuleData.window,
        action: editRuleData.action,
        recovery: editRuleData.recovery
      }
    };
    onUpdateConfig('security', { rules: updatedRules });
    setEditRuleData(null);
    onSaveConfig(`Rule "${editRuleData.key}" config saved.`);
  };

  // Release Quarantined user
  const handleReleaseUser = async (userId: string, tag: string) => {
    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (activeGuildId) headers['X-Guild-Id'] = activeGuildId;
      const res = await fetch(`http://localhost:5000/api/modules/security/quarantine/${userId}/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'release' })
      });
      if (res.ok) {
        onSaveConfig(`User "${tag}" released from quarantine.`);
        onManualTrigger(`Quarantine release: User "${tag}" reinstated to original roles.`, 'success', 'Security');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Categories list
  const protectionCategories = [
    {
      id: 'member',
      name: 'Member Protection',
      desc: 'Guard against unauthorized bans, kicks, timeouts, prune actions, and nickname updating abuse.',
      rulesList: [
        { key: 'anti_ban', name: 'Anti Ban', desc: 'Prevents mass banning of server members' },
        { key: 'anti_kick', name: 'Anti Kick', desc: 'Prevents mass kicking of server members' },
        { key: 'anti_timeout', name: 'Anti Timeout', desc: 'Flags users spamming timeouts' },
        { key: 'anti_prune', name: 'Anti Prune', desc: 'Blocks massive member pruning' }
      ]
    },
    {
      id: 'channel',
      name: 'Channel Protection',
      desc: 'Prevent mass channel creation, deletion, or renaming operations.',
      rulesList: [
        { key: 'anti_channel_create', name: 'Anti Channel Create', desc: 'Prevents spam creation of channels' },
        { key: 'anti_channel_delete', name: 'Anti Channel Delete', desc: 'Blocks mass deletion of channels' },
        { key: 'anti_channel_update', name: 'Anti Channel Update', desc: 'Flags rapid updates to channel properties' }
      ]
    },
    {
      id: 'role',
      name: 'Role Protection',
      desc: 'Flags unauthorized role creation, position adjustments, deletion, and administrator permission grants.',
      rulesList: [
        { key: 'anti_role_create', name: 'Anti Role Create', desc: 'Blocks unauthorized role creations' },
        { key: 'anti_role_delete', name: 'Anti Role Delete', desc: 'Blocks mass deletion of roles' },
        { key: 'anti_role_update', name: 'Anti Role Update', desc: 'Flags permission elevations or adjustments' }
      ]
    },
    {
      id: 'webhook',
      name: 'Webhook Protection',
      desc: 'Isolates webhooks being rapidly created, updated, or executed with malicious content.',
      rulesList: [
        { key: 'anti_webhook_create', name: 'Anti Webhook Create', desc: 'Blocks rogue webhook provisioning' },
        { key: 'anti_webhook_delete', name: 'Anti Webhook Delete', desc: 'Blocks deletion of system webhooks' }
      ]
    },
    {
      id: 'bot',
      name: 'Bot & Integration Protection',
      desc: 'Controls bot additions and blocks unauthorized API integration creations/deletions.',
      rulesList: [
        { key: 'anti_bot_add', name: 'Anti Bot Add', desc: 'Blocks rogue bot invites without owner approval' }
      ]
    }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Header */}
      <div className="page-header" style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: 700, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              <Shield size={28} style={{ stroke: 'var(--accent-primary)' }} />
              Enterprise Security Operations Center (SOC)
            </h1>
            <p className="page-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Advanced security scanning, rate limit engines, automatic recovery procedures, and emergency lockdowns.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className={`btn ${securityModule?.status === 'enabled' ? 'btn-secondary' : 'btn-primary'}`}
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
                backgroundColor: securityModule?.status === 'enabled' ? 'var(--color-success)' : 'rgba(255,255,255,0.4)',
                display: 'inline-block'
              }} />
              {securityModule?.status === 'enabled' ? 'Module Enabled' : 'Module Disabled'}
            </button>
            <button 
              onClick={handleToggleEmergency} 
              className={`btn ${emergencyMode ? 'btn-success' : 'btn-danger'}`} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', fontWeight: 700 }}
            >
              {emergencyMode ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{emergencyMode ? 'EXIT LOCKDOWN' : 'EMERGENCY LOCKDOWN'}</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="section-panel" style={{ padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Security Health Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: scanResult?.score > 80 ? '#10b981' : '#f59e0b' }}>
              {scanResult?.score || 95}%
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(16, 185, 129, 0.2)', borderTopColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color="#10b981" />
            </div>
          </div>
        </div>

        <div className="section-panel" style={{ padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Threat Risk Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: emergencyMode ? '#ef4444' : '#10b981' }}>
              {emergencyMode ? 'LOCKDOWN ACTIVE' : 'SECURE'}
            </span>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: emergencyMode ? '#ef4444' : '#10b981', boxShadow: `0 0 10px ${emergencyMode ? '#ef4444' : '#10b981'}` }}></div>
          </div>
        </div>

        <div className="section-panel" style={{ padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Active Protection Rules</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-purple)', marginTop: '8px' }}>
            {Object.values(rules).filter((r: any) => r.enabled).length} / {Object.keys(rules).length || 14}
          </div>
        </div>

        <div className="section-panel" style={{ padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Quarantined Users</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: quarantinedUsers.length > 0 ? '#ef4444' : 'var(--text-primary)', marginTop: '8px' }}>
            {quarantinedUsers.length}
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="section-panel" style={{ padding: '0px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 0, 0, 0.1)' }}>
          {[
            { id: 'dashboard', label: 'SOC Dashboard', icon: <Activity size={16} /> },
            { id: 'wizard', label: 'Setup Wizard', icon: <Sliders size={16} /> },
            { id: 'monitored_roles', label: 'Role Monitoring', icon: <ShieldCheck size={16} /> },
            { id: 'rules', label: 'Protection Rules', icon: <Settings size={16} /> },
            { id: 'whitelist', label: 'Smart Whitelist', icon: <Key size={16} /> },
            { id: 'managers', label: 'Trusted Managers', icon: <Users size={16} /> },
            { id: 'health', label: 'Vulnerability Scan', icon: <ScanIcon size={16} /> },
            { id: 'logs', label: 'Security Timeline', icon: <History size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 20px',
                border: 'none',
                background: activeTab === tab.id ? 'rgba(79, 140, 255, 0.08)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          
          {/* TAB 1: SOC DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Security Profiles (Presets)</h3>
                    <p style={{ color: 'var(--text-secondary)', opacity: 0.8, fontSize: '12px', marginBottom: '16px' }}>Quickly switch configuration profiles tailored to your guild size and safety needs.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                      {['relaxed', 'balanced', 'strict', 'maximum'].map(p => (
                        <button
                          key={p}
                          onClick={() => handleApplyPreset(p)}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: `1px solid ${currentPreset === p ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                            background: currentPreset === p ? 'rgba(79, 140, 255, 0.15)' : 'rgba(0,0,0,0.2)',
                            color: currentPreset === p ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Required Resources</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <RoleSelect 
                        label="Quarantine Role (incidents will be auto-assigned here)"
                        roles={registry.roles}
                        selectedRoleId={quarantineRoleId}
                        onChange={id => onUpdateConfig('security', { quarantineRoleId: id })}
                      />
                      <ChannelSelect 
                        label="Alert Notification Channel (sends gateway alarms)"
                        channels={registry.channels}
                        selectedChannelId={alertChannelId}
                        onChange={id => onUpdateConfig('security', { alertChannelId: id })}
                        typeFilter={['text']}
                      />
                    </div>
                  </div>
                </div>

                <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Active Incidents Queue</h3>
                  {quarantinedUsers.length === 0 ? (
                    <div style={{ padding: '32px 10px', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.6, fontSize: '12px' }}>
                      No active users are currently quarantined. All safe.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {quarantinedUsers.map((user: any) => (
                        <div key={user.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{user.tag}</div>
                            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{user.reason}</div>
                          </div>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ borderColor: '#10b981', color: '#10b981', padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => handleReleaseUser(user.userId, user.tag)}
                          >
                            Release
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETUP WIZARD */}
          {activeTab === 'wizard' && (
            <SetupWizard
              steps={['Overview', 'Quarantine Setup', 'Alert Logging', 'Exception Settings', 'Final Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={securityModule?.progress || 0}
              errors={securityModule?.errors || []}
              status={securityModule?.status || 'not_configured'}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Enterprise Anti-Nuke Protection</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Protect your server against rogue administrators and bot integration raids. 
                    Anti-Nuke monitors all critical events in real-time and acts immediately to quarantine abusers, 
                    recreate deleted channels or roles, and revoke administrative permissions.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <RoleSelect 
                    label="Quarantine Isolation Role"
                    roles={registry.roles}
                    selectedRoleId={quarantineRoleId}
                    onChange={id => onUpdateConfig('security', { quarantineRoleId: id })}
                    helpText="Violating users will be stripped of all roles and assigned this isolation role."
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <ChannelSelect 
                    label="Alert Notifications Channel"
                    channels={registry.channels}
                    selectedChannelId={alertChannelId}
                    onChange={id => onUpdateConfig('security', { alertChannelId: id })}
                    typeFilter={['text']}
                    helpText="Specify the channel where real-time security warnings and actions will be logged."
                  />
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <RoleSelect 
                    label="Exception / Bypass Roles"
                    roles={registry.roles}
                    selectedRoleIds={config.exceptionRoleIds || []}
                    onChange={ids => onUpdateConfig('security', { exceptionRoleIds: ids })}
                    isMulti={true}
                    helpText="Users with any of these roles will bypass all anti-nuke threshold limits."
                  />
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px', display: 'block' }}>
                      Global Anti-Raid Threshold
                    </label>
                    <input 
                      type="number" 
                      className="form-input-text" 
                      value={config.antiRaidLimit || 7} 
                      onChange={e => onUpdateConfig('security', { antiRaidLimit: parseInt(e.target.value) || 7 })}
                      placeholder="e.g. 7" 
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <ShieldCheck size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Anti-Nuke Engine Configured</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your configuration is ready. Once activated, the bot will monitor the gateway and protect your resources.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB: MONITORED ROLES */}
          {activeTab === 'monitored_roles' && (
            <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Monitored Roles & Alerts Configuration</h3>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Role Monitoring Mode</label>
                <select 
                  className="form-input-text" 
                  value={config.roleMonitorMode || 'All Roles'} 
                  onChange={e => onUpdateConfig('security', { roleMonitorMode: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: '#fff' }}
                >
                  <option value="All Roles">Monitor All Roles</option>
                  <option value="Custom Selection">Monitor Custom Selection</option>
                </select>
              </div>

              {(config.roleMonitorMode === 'Custom Selection') && (
                <div className="table-container" style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Role Name</th>
                        <th>Role ID</th>
                        <th>Role Color</th>
                        <th style={{ textAlign: 'right' }}>Monitor Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registry.roles.map(role => {
                        const isMonitored = (config.monitoredRoleIds || []).includes(role.id);
                        return (
                          <tr key={role.id}>
                            <td style={{ fontWeight: 600 }}>{role.name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{role.id}</td>
                            <td>
                              <span style={{ 
                                display: 'inline-block', 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%', 
                                backgroundColor: role.color || '#fff',
                                marginRight: '8px'
                              }} />
                              {role.color || '#none'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input 
                                type="checkbox" 
                                checked={isMonitored}
                                onChange={e => {
                                  const currentIds = config.monitoredRoleIds || [];
                                  const nextIds = e.target.checked 
                                    ? [...currentIds, role.id] 
                                    : currentIds.filter((id: string) => id !== role.id);
                                  onUpdateConfig('security', { monitoredRoleIds: nextIds });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: '10px' }}>Privileged Role Alert Policies</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={config.alertOnRoleDelete ?? true}
                      onChange={e => onUpdateConfig('security', { alertOnRoleDelete: e.target.checked })}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Alert when monitored roles are deleted</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={config.alertOnRolePermissionsModify ?? true}
                      onChange={e => onUpdateConfig('security', { alertOnRolePermissionsModify: e.target.checked })}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Alert when monitored role permissions are modified</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={config.alertOnAdminGrant ?? true}
                      onChange={e => onUpdateConfig('security', { alertOnAdminGrant: e.target.checked })}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Alert when Administrator permission is granted to non-whitelisted members</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROTECTION RULES */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Granular Threat Detection Rules</h3>
                  <p style={{ color: 'var(--text-secondary)', opacity: 0.8, fontSize: '12px' }}>Click on a category to expand, and click the gear icon to configure threshold parameters.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {protectionCategories.map(cat => {
                  const isExpanded = activeCategory === cat.id;
                  return (
                    <div key={cat.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div 
                        onClick={() => setActiveCategory(isExpanded ? null : cat.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-secondary)', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{cat.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '2px' }}>{cat.desc}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
                      </div>

                      {isExpanded && (
                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)' }}>
                          {cat.rulesList.map(rule => {
                            const rVal = rules[rule.key] || { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true };
                            return (
                              <div key={rule.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {rule.name}
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: rVal.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)', color: rVal.enabled ? '#10b981' : '#9ca3af' }}>
                                      {rVal.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '2px' }}>{rule.desc}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.9 }}>
                                    Limit: <strong style={{ color: '#fff' }}>{rVal.limit}</strong> / <strong style={{ color: '#fff' }}>{rVal.window}s</strong> | Action: <strong style={{ color: '#fff' }}>{rVal.action}</strong>
                                  </div>
                                  <button 
                                    onClick={() => openRuleEditor(rule.key, rVal)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                                  >
                                    <Settings size={16} color="var(--text-secondary)" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SMART WHITELIST */}
          {activeTab === 'whitelist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Add Whitelist Bypass Rule</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input-text" value={wlType} onChange={e => setWlType(e.target.value)}>
                      <option value="user">User</option>
                      <option value="role">Role</option>
                      <option value="bot">Bot</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target ID (Discord ID)</label>
                    <input type="text" className="form-input-text" placeholder="e.g. 1508399..." value={wlTargetId} onChange={e => setWlTargetId(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scope</label>
                    <select className="form-input-text" value={wlScope} onChange={e => setWlScope(e.target.value)}>
                      <option value="all">Global Bypass</option>
                      <option value="channel_protection">Channels Only</option>
                      <option value="role_protection">Roles Only</option>
                      <option value="member_protection">Members Only</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Notes (Reason)</label>
                    <input type="text" className="form-input-text" placeholder="e.g. Integration bot" value={wlNotes} onChange={e => setWlNotes(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date (Optional)</label>
                    <input type="datetime-local" className="form-input-text" value={wlExpiration} onChange={e => setWlExpiration(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleAddWhitelist} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  Add Bypass Entry
                </button>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Target ID</th>
                      <th>Scope</th>
                      <th>Expiration</th>
                      <th>Notes</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whitelist.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', opacity: 0.6, padding: '20px' }}>
                          No whitelisted entries found.
                        </td>
                      </tr>
                    ) : (
                      whitelist.map((item: any) => (
                        <tr key={item.id}>
                          <td style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', color: 'var(--accent-primary)' }}>{item.type}</td>
                          <td style={{ fontFamily: 'monospace' }}>{item.targetId}</td>
                          <td>{item.scope}</td>
                          <td>{item.expiration ? new Date(item.expiration).toLocaleString() : 'Permanent'}</td>
                          <td>{item.notes}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => handleRemoveWhitelist(item.id)} className="btn btn-sm" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                              <Trash size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TRUSTED MANAGERS */}
          {activeTab === 'managers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="section-panel" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Delegate Security Controls</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">User ID</label>
                    <input type="text" className="form-input-text" placeholder="Discord User ID" value={tmUserId} onChange={e => setTmUserId(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input type="text" className="form-input-text" placeholder="Username Tag" value={tmUsername} onChange={e => setTmUsername(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role Profile</label>
                    <select className="form-input-text" value={tmRole} onChange={e => setTmRole(e.target.value)}>
                      <option value="security_manager">Security Manager</option>
                      <option value="recovery_manager">Recovery Manager</option>
                      <option value="lead_moderator">Lead Moderator</option>
                      <option value="trusted_owner">Trusted Owner</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleAddManager} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  Authorize Manager
                </button>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>User ID</th>
                      <th>Role</th>
                      <th>Scope Controls</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trustedManagers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', opacity: 0.6, padding: '20px' }}>
                          No managers assigned yet.
                        </td>
                      </tr>
                    ) : (
                      trustedManagers.map((m: any) => (
                        <tr key={m.userId}>
                          <td>{m.username}</td>
                          <td style={{ fontFamily: 'monospace' }}>{m.userId}</td>
                          <td style={{ textTransform: 'capitalize', color: 'var(--accent-primary)', fontWeight: 600 }}>{m.role.replace('_', ' ')}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', background: 'rgba(79, 140, 255, 0.15)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                                Full Access
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => handleRemoveManager(m.userId)} className="btn btn-sm" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: VULNERABILITY SCAN */}
          {activeTab === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="section-panel" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <ScanIcon size={48} style={{ stroke: 'var(--accent-primary)', margin: '0 auto 16px auto', animation: isScanning ? 'spin 2s linear infinite' : 'none' }} />
                <h3 style={{ fontSize: '18px', color: '#fff', fontWeight: 700 }}>Security Health scan center</h3>
                <p style={{ color: 'var(--text-secondary)', opacity: 0.8, fontSize: '13px', maxWidth: '500px', margin: '8px auto 20px auto' }}>
                  Analyze server authorization trees, active webhooks, dangerous permission assignments, and backup versions.
                </p>
                <button 
                  onClick={handleRunScan} 
                  disabled={isScanning}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '8px', fontWeight: 700 }}
                >
                  <RefreshCw size={16} className={isScanning ? 'spin-icon' : ''} />
                  <span>{isScanning ? 'SCANNING THREAT VECTORS...' : 'RUN LIVE SECURITY SCAN'}</span>
                </button>
              </div>

              {scanResult && !isScanning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: scanResult.score > 80 ? '#10b981' : '#f59e0b' }}>
                      {scanResult.score}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Overall Security Score</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '2px' }}>
                        Your guild risk rating is marked as <strong style={{ color: scanResult.score > 80 ? '#10b981' : '#f59e0b' }}>{scanResult.riskRating}</strong>.
                      </div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '10px' }}>Telemetry Audit Findings</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {scanResult.issues.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                        🟢 No critical vulnerabilities found. Server is fully secured.
                      </div>
                    ) : (
                      scanResult.issues.map((issue: any, idx: number) => (
                        <div key={idx} style={{ padding: '16px', borderRadius: '8px', border: `1px solid ${issue.risk === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, background: issue.risk === 'danger' ? 'rgba(239, 68, 68, 0.04)' : 'rgba(245, 158, 11, 0.04)', display: 'flex', gap: '12px' }}>
                          <AlertTriangle size={20} color={issue.risk === 'danger' ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{issue.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '4px' }}>{issue.desc}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SECURITY TIMELINE LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Live SOC Operations Logs</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
                {historyList.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Listening to live Discord event stream...</div>
                ) : (
                  historyList.map((log: any, idx: number) => (
                    <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--accent-primary)' }}>[{new Date(log.date).toLocaleTimeString()}]</span>
                      <span style={{ color: '#fff' }}>({log.author})</span>
                      <span>{log.changes}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RULE EDITOR MODAL */}
      {editRuleData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="section-panel" style={{ width: '450px', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Configure {editRuleData.key.replace('anti_', '').replace('_', ' ').toUpperCase()}</h3>
              <button onClick={() => setEditRuleData(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Enable Rule</label>
                <input 
                  type="checkbox" 
                  checked={editRuleData.enabled}
                  onChange={e => setEditRuleData({ ...editRuleData, enabled: e.target.checked })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Action Limit (Threshold count)</label>
                <input 
                  type="number" 
                  className="form-input-text"
                  value={editRuleData.limit}
                  onChange={e => setEditRuleData({ ...editRuleData, limit: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time Window (Seconds)</label>
                <input 
                  type="number" 
                  className="form-input-text"
                  value={editRuleData.window}
                  onChange={e => setEditRuleData({ ...editRuleData, window: parseInt(e.target.value) || 10 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Violator Punishment Action</label>
                <select 
                  className="form-input-text"
                  value={editRuleData.action}
                  onChange={e => setEditRuleData({ ...editRuleData, action: e.target.value })}
                >
                  <option value="quarantine">Quarantine Account</option>
                  <option value="ban">Ban Member</option>
                  <option value="kick">Kick Member</option>
                  <option value="warn">Warn / Log Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Auto-Restore Reversion (Revert Deletions)</label>
                <input 
                  type="checkbox" 
                  checked={editRuleData.recovery}
                  onChange={e => setEditRuleData({ ...editRuleData, recovery: e.target.checked })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditRuleData(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRuleConfig}>Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* LOCKDOWN PIN MODAL */}
      {showLockdownModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="section-panel" style={{ width: '400px', padding: '24px', background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>🚨 Confirm Emergency Action</h3>
            <p style={{ color: 'var(--text-secondary)', opacity: 0.8, fontSize: '13px', marginBottom: '20px' }}>
              This is a highly destructive administrative action. Please enter your **Security PIN** to proceed.
            </p>

            <div className="form-group">
              <label className="form-label">Security 4-Digit PIN (Default: 1234)</label>
              <input 
                type="password" 
                className="form-input-text"
                placeholder="****"
                maxLength={4}
                value={securityPin}
                onChange={e => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '8px' }}
              />
              {pinError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', fontWeight: 600 }}>{pinError}</div>}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowLockdownModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmLockdown}>Execute Action</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
