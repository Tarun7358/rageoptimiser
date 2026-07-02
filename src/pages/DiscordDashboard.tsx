import React, { useState } from 'react';
import { LayoutDashboard, Save, CheckCircle, RefreshCcw, LayoutTemplate } from 'lucide-react';
import { SetupWizard } from '../components/SetupWizard';
import { ChannelSelect } from '../components/ResourceSelectors';

interface DiscordDashboardProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'System') => void;
  modules: any[];
  registry: any;
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function DiscordDashboard({
  onSaveConfig,
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: DiscordDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);

  const dashModule = (modules || []).find(m => m.id === 'discord-dashboard') || { config: {}, status: 'disabled', errors: [], progress: 0 };
  const config = dashModule.config || {};

  const channelId = config.channelId || '';
  const refreshInterval = config.refreshInterval || 30000; // default 30s
  
  const [enabledPages, setEnabledPages] = useState({
    home: config.enabledPages?.home ?? true,
    members: config.enabledPages?.members ?? true,
    messages: config.enabledPages?.messages ?? true,
    voice: config.enabledPages?.voice ?? true,
    tickets: config.enabledPages?.tickets ?? true,
    events: config.enabledPages?.events ?? true,
    stats: config.enabledPages?.stats ?? true,
    more: config.enabledPages?.more ?? true,
  });

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('discord-dashboard', fields);
  };

  const handleTogglePage = (page: string, value: boolean) => {
    const newPages = { ...enabledPages, [page]: value };
    setEnabledPages(newPages);
    handleUpdate({ enabledPages: newPages });
  };

  const handleSave = () => {
    onSaveConfig('Discord Dashboard layout and configuration saved.');
    onManualTrigger('Discord Dashboard: Configuration persisted to local state.', 'success', 'System');
  };

  const handleToggleEnable = () => {
    const nextEnabled = dashModule.status !== 'enabled';
    onUpdateConfig('discord-dashboard', {}, nextEnabled);
    onSaveConfig(`Discord Dashboard ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Discord Dashboard: Module status set to ${nextEnabled ? 'ACTIVE' : 'INACTIVE'}.`, nextEnabled ? 'success' : 'warning', 'System');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Interactive Discord Dashboard</h1>
        <p className="page-subtitle">Configure the live, single-message dashboard pinned in your server.</p>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview & Setup</button>
          <button className={`tab-btn ${activeTab === 'pages' ? 'active' : ''}`} onClick={() => setActiveTab('pages')}>Pages & Navigation</button>
          <button className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>Appearance & Intervals</button>
        </div>

        <div className="panel-body">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <SetupWizard
              steps={['Introduction', 'Channel Binding', 'Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={dashModule.progress}
              errors={dashModule.errors}
              status={dashModule.status}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}><LayoutDashboard size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/>Single-Message Architecture</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Instead of flooding your channels with log messages, the bot will maintain a single pinned dashboard message.
                    Users can click buttons to navigate pages seamlessly without triggering new messages.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <ChannelSelect 
                    label="Dashboard Target Channel"
                    channels={registry.channels.filter((c: any) => c.type === 'text')}
                    selectedChannelId={channelId}
                    onChange={id => handleUpdate({ channelId: id })}
                    helpText="The channel where the dashboard will be pinned."
                  />
                  {channelId && (
                    <div style={{ padding: '12px', background: 'rgba(79, 140, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(79, 140, 255, 0.2)' }}>
                      <p style={{ fontSize: '13px', color: 'var(--accent-primary)', margin: 0 }}>
                        <RefreshCcw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                        To spawn the dashboard in Discord, use the <code>/setup-discord-dashboard</code> slash command in the targeted channel.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <CheckCircle size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Dashboard Ready</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Configuration is valid. You can now enable the module and run the command in Discord.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB 2: PAGES */}
          {activeTab === 'pages' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Dashboard Pages</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Enable or disable specific sections on the dashboard.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {Object.entries(enabledPages).map(([key, value]) => (
                  <div key={key} className="form-group-row" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px' }}>
                    <div>
                      <div className="form-label" style={{ textTransform: 'capitalize' }}>{key} Page</div>
                      <div className="form-help">Enable the "{key}" button navigation.</div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={value as boolean} 
                        onChange={e => handleTogglePage(key, e.target.checked)} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>Save Configuration</button>
            </div>
          )}

          {/* TAB 3: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Refresh Interval & Preferences</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configure how often the bot auto-updates the embed.</p>
              </div>

              <div className="form-group" style={{ maxWidth: '400px' }}>
                <label className="form-label">Auto Refresh Rate (ms)</label>
                <select className="form-select" value={refreshInterval} onChange={e => handleUpdate({ refreshInterval: parseInt(e.target.value) })}>
                  <option value={10000}>10 Seconds (Fast)</option>
                  <option value={30000}>30 Seconds (Recommended)</option>
                  <option value={60000}>1 Minute</option>
                  <option value={300000}>5 Minutes</option>
                  <option value={600000}>10 Minutes</option>
                </select>
                <span className="form-help">Lower intervals may trigger Discord API rate limits on large servers.</span>
              </div>
              
              <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>Save Settings</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
