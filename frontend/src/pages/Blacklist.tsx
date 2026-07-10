import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Plus, RefreshCw, Eye } from 'lucide-react';
import type { ModuleState } from '../hooks/useDiscordSync';

interface BlacklistProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Blacklist({ onSaveConfig, modules, onUpdateConfig }: BlacklistProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState('word');
  const [banReason, setBanReason] = useState('Violation of Blacklist rules');

  const bModule = (modules || []).find(m => m.id === 'blacklist');
  const config = bModule?.config || {};
  const entries: any[] = config.entries || [];

  const handleToggleEnable = () => {
    if (!bModule) return;
    const nextEnabled = bModule.status !== 'enabled';
    onUpdateConfig('blacklist', {}, nextEnabled);
    onSaveConfig(`Blacklist module ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleAddEntry = () => {
    if (!newEntry.trim()) return;
    const updatedEntries = [...entries, {
      id: `bl_${Date.now()}`,
      value: newEntry.trim(),
      type: entryType,
      action: 'ban',
      reason: banReason,
      createdAt: new Date().toISOString()
    }];
    onUpdateConfig('blacklist', { entries: updatedEntries });
    setNewEntry('');
    onSaveConfig(`Added blacklisted ${entryType}: "${newEntry}"`);
  };

  const handleRemoveEntry = (id: string) => {
    const updatedEntries = entries.filter((e: any) => e.id !== id);
    onUpdateConfig('blacklist', { entries: updatedEntries });
    onSaveConfig('Blacklist entry removed.');
  };

  const counts = {
    word: entries.filter((e: any) => e.type === 'word').length,
    regex: entries.filter((e: any) => e.type === 'regex').length,
    domain: entries.filter((e: any) => e.type === 'domain').length,
    user: entries.filter((e: any) => e.type === 'user').length,
    invite: entries.filter((e: any) => e.type === 'invite').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Blacklist Manager</h1>
            <p className="page-subtitle">Configure filter rules and strict auto-ban triggers for words, regexes, domains, and invites.</p>
          </div>
          <button 
            className={`btn ${bModule?.status === 'enabled' ? 'btn-secondary' : 'btn-primary'}`}
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
              backgroundColor: bModule?.status === 'enabled' ? 'var(--color-success)' : 'rgba(255,255,255,0.4)',
              display: 'inline-block'
            }} />
            {bModule?.status === 'enabled' ? 'Module Enabled' : 'Module Disabled'}
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Words / Phrasing', val: counts.word, color: '#4f8cff' },
          { label: 'Regex Filters', val: counts.regex, color: '#a855f7' },
          { label: 'Banned Domains', val: counts.domain, color: '#f43f5e' },
          { label: 'Targeted Users', val: counts.user, color: '#eab308' },
          { label: 'Server Invites', val: counts.invite, color: '#10b981' }
        ].map((stat, i) => (
          <div key={i} className="section-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label.toUpperCase()}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.val}</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stat.color }}></span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Panel */}
      <div className="section-panel">
        <div className="tabs-nav">
          {['overview', 'add-rule'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Active Enforcements</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rules that will trigger auto-punishment on match.</p>
              </div>

              {entries.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No blacklisted items configured yet.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Target Rule Value</th>
                        <th>Action</th>
                        <th>Auto-Reason</th>
                        <th style={{ textAlign: 'right' }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry: any) => (
                        <tr key={entry.id}>
                          <td>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-secondary)'
                            }}>{entry.type.toUpperCase()}</span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            <code>{entry.value}</code>
                          </td>
                          <td>
                            <span style={{ color: '#f43f5e', fontWeight: 600 }}>{entry.action.toUpperCase()}</span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{entry.reason}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRemoveEntry(entry.id)}
                              style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add-rule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Create Blacklist Rule</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Define a new string or pattern to automatically block.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Filter Type</label>
                  <select 
                    className="custom-input"
                    value={entryType}
                    onChange={e => setEntryType(e.target.value)}
                  >
                    <option value="word">Keyword / Phrasing</option>
                    <option value="regex">Regex Expression</option>
                    <option value="domain">Banned Domain Link</option>
                    <option value="invite">Discord Server Invite link</option>
                    <option value="user">User ID (Auto-ban on join)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Rule Target / Expression</label>
                  <input 
                    type="text"
                    className="custom-input"
                    placeholder={entryType === 'regex' ? 'e.g. \\b[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}\\b' : 'Type keyword or ID to filter...'}
                    value={newEntry}
                    onChange={e => setNewEntry(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Banishment Audit Log Reason</label>
                  <input 
                    type="text"
                    className="custom-input"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleAddEntry}
                  style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                >
                  <Plus size={16} />
                  <span>Create Enforcement</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
