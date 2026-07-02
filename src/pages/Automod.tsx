import React, { useState } from 'react';
import { Bot, Shield, Plus, X, Link, Type, Save } from 'lucide-react';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';

interface AutomodProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabled?: boolean) => void;
}

export function Automod({ onSaveConfig, modules, registry, onUpdateConfig }: AutomodProps) {
  const amModule = (modules || []).find(m => m.id === 'automod') || { status: 'disabled', config: {} as any };
  const config: Record<string, any> = amModule.config || {};
  const isEnabled = amModule.status === 'enabled';

  const [newWord, setNewWord] = useState('');

  const handleToggleEnable = () => {
    onUpdateConfig('automod', {}, !isEnabled);
    onSaveConfig(`AI Automod module ${!isEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleUpdate = (field: string, value: any) => {
    onUpdateConfig('automod', { [field]: value });
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    const currentWords = config.badWords || [];
    if (!currentWords.includes(newWord.trim().toLowerCase())) {
      handleUpdate('badWords', [...currentWords, newWord.trim().toLowerCase()]);
    }
    setNewWord('');
  };

  const handleRemoveWord = (word: string) => {
    const currentWords = config.badWords || [];
    handleUpdate('badWords', currentWords.filter((w: string) => w !== word));
  };

  const textChannels = registry.channels.filter(c => c.type === 'text'); // Guild Text

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">AI Automod Settings</h1>
            <p className="page-subtitle">Configure intelligent chat filters, spam protection, and automated punishments.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => onSaveConfig('Automod settings saved successfully.')}
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
            <button 
              className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
              onClick={handleToggleEnable}
            >
              <Bot size={14} />
              <span>{isEnabled ? 'Disable Module' : 'Enable Module'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-layout-grid">
        
        {/* Left Column: General & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* General Settings */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">General Settings</span>
              <Shield size={16} color="var(--text-muted)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">Intervention Log Channel</label>
                <select 
                  className="form-select"
                  value={config.logChannelId || ''}
                  onChange={(e) => handleUpdate('logChannelId', e.target.value)}
                >
                  <option value="">Select a channel...</option>
                  {textChannels.map(c => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
                <div className="form-help">Where Automod sends reports when it deletes messages or punishes users.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Automated Punishment</label>
                <select 
                  className="form-select"
                  value={config.punishment || 'warn'}
                  onChange={(e) => handleUpdate('punishment', e.target.value)}
                >
                  <option value="warn">Warn User (Delete Message)</option>
                  <option value="timeout">Timeout (5 Minutes)</option>
                  <option value="kick">Kick User</option>
                </select>
                <div className="form-help">The action taken when a user triggers any enabled filter.</div>
              </div>
            </div>
          </div>

          {/* Filter Toggles */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Protection Filters</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">
                    <Link size={16} color="var(--accent-primary)" />
                    Block Unauthorized Links
                  </div>
                  <div className="setting-desc">Auto-deletes messages containing `http://` or `https://` (Admins and Mods bypass this).</div>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={config.blockLinks || false}
                    onChange={(e) => handleUpdate('blockLinks', e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">
                    <Type size={16} color="var(--accent-primary)" />
                    Prevent CAPS Spam
                  </div>
                  <div className="setting-desc">Deletes messages that consist of more than 70% capital letters (ignores short messages).</div>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={config.preventCapsSpam || false}
                    onChange={(e) => handleUpdate('preventCapsSpam', e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Bad Words Blacklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="section-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <span className="panel-title">Custom Word Filter</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Add specific words or phrases you want Automod to instantly delete.
              </div>

              <form onSubmit={handleAddWord} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Type a word and press Enter..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={!newWord.trim()}>
                  <Plus size={16} />
                </button>
              </form>

              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px', 
                marginTop: '8px',
                alignItems: 'flex-start',
                alignContent: 'flex-start',
                flex: 1
              }}>
                {(config.badWords || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No words added to the blacklist yet.
                  </div>
                ) : (
                  (config.badWords || []).map((word: string) => (
                    <div 
                      key={word} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '13px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span>{word}</span>
                      <button 
                        onClick={() => handleRemoveWord(word)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-muted)', 
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
