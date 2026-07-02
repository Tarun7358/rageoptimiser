import React from 'react';
import { Music as MusicIcon, Save, Settings, Hash, Terminal, Sliders } from 'lucide-react';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';

interface MusicProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabled?: boolean) => void;
}

export function Music({ onSaveConfig, modules, registry, onUpdateConfig }: MusicProps) {
  const musicModule = (modules || []).find(m => m.id === 'music') || { status: 'disabled', config: {} as any };
  const config = musicModule.config || {};
  const isEnabled = musicModule.status === 'enabled';

  // Apply default fallbacks
  const musicPrefix = config.musicPrefix ?? 'c!';
  const prefixEnabled = config.prefixEnabled ?? true;
  const slashEnabled = config.slashEnabled ?? true;
  const defaultVolume = config.defaultVolume ?? 100;
  const voteSkipPercentage = config.voteSkipPercentage ?? 50;

  const handleToggleEnable = () => {
    onUpdateConfig('music', {}, !isEnabled);
    onSaveConfig(`Music module ${!isEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleUpdate = (field: string, value: any) => {
    onUpdateConfig('music', { [field]: value });
  };

  const textChannels = (registry.channels || []).filter(c => c.type === 'text');
  const voiceChannels = (registry.channels || []).filter(c => c.type === 'voice');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Music Module Configuration</h1>
            <p className="page-subtitle">Manage high-fidelity audio playback, DJ permissions, and prefix settings.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => onSaveConfig('Music settings saved successfully.')}
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
            <button 
              className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
              onClick={handleToggleEnable}
            >
              <MusicIcon size={14} />
              <span>{isEnabled ? 'Disable Module' : 'Enable Module'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-layout-grid">
        
        {/* Left Column: Command Interfaces & Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Command Interfaces</span>
              <Terminal size={16} color="var(--text-muted)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">Enable Prefix Commands</div>
                  <div className="setting-desc">Allow users to execute music commands via a text prefix (e.g. c!play).</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={prefixEnabled} onChange={(e) => handleUpdate('prefixEnabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {prefixEnabled && (
                <div className="form-group" style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)' }}>
                  <label className="form-label">Custom Music Prefix</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={musicPrefix} 
                    maxLength={5}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\s/g, ''); // no spaces allowed
                      handleUpdate('musicPrefix', val);
                    }}
                    placeholder="e.g. c!"
                  />
                  <div className="form-help">Maximum 5 characters. Must not contain spaces. Applies to Music Module only.</div>
                </div>
              )}

              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">Enable Slash Commands</div>
                  <div className="setting-desc">Allow users to execute music commands via Discord slash commands (/play).</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={slashEnabled} onChange={(e) => handleUpdate('slashEnabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

            </div>
          </div>

          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Playback Settings</span>
              <Sliders size={16} color="var(--text-muted)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Default Volume
                  <span style={{ color: 'var(--accent-primary)' }}>{defaultVolume}%</span>
                </label>
                <input 
                  type="range" 
                  min="1" max="200" 
                  value={defaultVolume}
                  onChange={(e) => handleUpdate('defaultVolume', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Queue Size</label>
                <input type="number" className="form-input" value={config.maxQueueSize || 500} onChange={(e) => handleUpdate('maxQueueSize', parseInt(e.target.value))} />
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Song Length (Minutes)</label>
                <input type="number" className="form-input" value={config.maxSongLength || 60} onChange={(e) => handleUpdate('maxSongLength', parseInt(e.target.value))} />
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Disconnect Timer (Minutes)</label>
                <input type="number" className="form-input" value={config.autoDisconnectTimer || 5} onChange={(e) => handleUpdate('autoDisconnectTimer', parseInt(e.target.value))} />
                <div className="form-help">Time to wait alone in voice channel before leaving.</div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Roles, Channels & Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Channels & Roles</span>
              <Hash size={16} color="var(--text-muted)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">DJ Role</label>
                <select className="form-select" value={config.djRoleId || ''} onChange={(e) => handleUpdate('djRoleId', e.target.value)}>
                  <option value="">Select DJ Role...</option>
                  {registry.roles ? registry.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>) : null}
                </select>
                <div className="form-help">Users with this role bypass all restrictions (vote skips, filters, etc).</div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Voice Channel</label>
                <select className="form-select" value={config.defaultMusicChannelId || ''} onChange={(e) => handleUpdate('defaultMusicChannelId', e.target.value)}>
                  <option value="">None (Allow anywhere / No 24/7 Channel)</option>
                  {voiceChannels.map(c => <option key={c.id} value={c.id}>🔊 {c.name}</option>)}
                </select>
                <div className="form-help">The default Voice Channel the bot joins for 24/7 mode.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Music Log Channel</label>
                <select className="form-select" value={config.musicLogChannelId || ''} onChange={(e) => handleUpdate('musicLogChannelId', e.target.value)}>
                  <option value="">None</option>
                  {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>

            </div>
          </div>

          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Feature Toggles</span>
              <Settings size={16} color="var(--text-muted)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">24/7 Mode</div>
                  <div className="setting-desc">Bot stays in VC permanently.</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config.twentyFourSevenMode || false} onChange={(e) => handleUpdate('twentyFourSevenMode', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">Autoplay</div>
                  <div className="setting-desc">Auto-queue recommended songs.</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config.autoplay || false} onChange={(e) => handleUpdate('autoplay', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">Enable Vote Skip</div>
                  <div className="setting-desc">Require a majority vote to skip.</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config.enableVoteSkip || false} onChange={(e) => handleUpdate('enableVoteSkip', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {config.enableVoteSkip && (
                <div className="form-group" style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Vote Skip Percentage
                    <span style={{ color: 'var(--accent-primary)' }}>{voteSkipPercentage}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="100" 
                    value={voteSkipPercentage}
                    onChange={(e) => handleUpdate('voteSkipPercentage', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-title">Restrict to Voice Members Only</div>
                  <div className="setting-desc">Only users in the bot's VC can use commands.</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config.restrictToVoiceMembers || false} onChange={(e) => handleUpdate('restrictToVoiceMembers', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
