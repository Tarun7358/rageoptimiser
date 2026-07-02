import React, { useState } from 'react';
import type { ModuleState, DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';
import { Settings, ShieldAlert, Key, MessageSquare, Save } from 'lucide-react';
import { ChannelSelect } from '../../components/ResourceSelectors';

interface WhitelistSettingsProps {
  modules?: ModuleState[];
  registry?: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onSave?: () => void;
}

export function WhitelistSettings({ modules, registry, onSave }: WhitelistSettingsProps) {
  const [strictMode, setStrictMode] = useState(true);
  const [auditLogging, setAuditLogging] = useState(true);
  const [auditChannel, setAuditChannel] = useState('');
  const [notifyOnViolation, setNotifyOnViolation] = useState(true);
  
  const handleSave = () => {
    // Fire save toast
    if (onSave) onSave();
  };

  return (
    <div className="module-page" style={{ padding: '32px', paddingBottom: '300px' }}>
      <div className="module-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={28} color="var(--accent-primary)" />
            Whitelist Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Global settings and configuration for the Whitelist ecosystem.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={18} /> Save Changes
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Core Protection Rules */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', marginBottom: '16px' }}>
            <ShieldAlert size={20} /> Core Protection Rules
          </h3>
          <div className="form-group-row">
            <div>
              <div className="form-label">Strict Enforcement Mode</div>
              <div className="form-help">Automatically kick unwhitelisted bots upon joining and strip roles from non-bypassed members attempting to use managed roles.</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={strictMode} onChange={e => setStrictMode(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="form-group-row" style={{ borderTop: 'none' }}>
            <div>
              <div className="form-label">Active Violation Alerts</div>
              <div className="form-help">Ping the server owner and operations team immediately when a high-risk entity breaches whitelist restrictions.</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={notifyOnViolation} onChange={e => setNotifyOnViolation(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Audit & Logging */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', marginBottom: '16px' }}>
            <MessageSquare size={20} /> Audit & Logging
          </h3>
          <div className="form-group-row">
            <div>
              <div className="form-label">Immutable Audit Log</div>
              <div className="form-help">Record every addition, removal, and modification of whitelist entries across all domains (Bots, Members, Roles).</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={auditLogging} onChange={e => setAuditLogging(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          
          {auditLogging && (
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginTop: '16px' }}>
              <div className="form-group">
                <ChannelSelect 
                  label="Log Output Channel"
                  channels={registry?.channels || []}
                  selectedChannelId={auditChannel}
                  onChange={(id) => setAuditChannel(id)}
                  typeFilter={['text']}
                  helpText="Select a secure channel to pipe raw JSON and embed alerts for the WTPS audit trail."
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
