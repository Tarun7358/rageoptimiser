import React, { useState } from 'react';
import type { ModuleState, DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';
import { Bot, Plus, Trash2, Settings2, RefreshCw } from 'lucide-react';
import { RoleSelect } from '../../components/ResourceSelectors';

interface BotWhitelistProps {
  modules?: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onUpdateConfig?: (moduleId: string, newConfig: Record<string, any>, enabledOverride?: boolean) => void;
}

export function BotWhitelist({ modules, registry, onUpdateConfig }: BotWhitelistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBot, setEditingBot] = useState<any>(null);
  const [newBotId, setNewBotId] = useState('');
  const [newBotRole, setNewBotRole] = useState('');
  
  const mod = (modules || []).find(m => m.id === 'bot_whitelist');
  const bots = mod?.config?.bots || [];

  const handleToggleModule = async () => {
    if (!mod || !onUpdateConfig) return;
    const nextEnabled = mod.status !== 'enabled';
    await onUpdateConfig(mod.id, {}, nextEnabled);
  };

  const handleEdit = async (updatedBot: any) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/bot_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'edit',
          payload: updatedBot
        })
      });
      setEditingBot(null);
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!newBotId || !newBotRole) return;
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/bot_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'add',
          payload: {
            id: newBotId,
            userId: newBotId,
            tag: `Bot ${newBotId.substring(0,4)}`,
            managedRoleId: newBotRole,
            status: 'pending',
            autoConfigure: true,
            autoRestore: true
          }
        })
      });
      setShowAddForm(false);
      setNewBotId('');
      setNewBotRole('');
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (userId: string) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/bot_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'remove',
          payload: { userId }
        })
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="module-page" style={{ padding: '32px', paddingBottom: '300px' }}>
      <div className="module-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={28} color="var(--accent-primary)" />
            Bot Whitelist
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage trusted third-party bots and enforce strict single-role permissions.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={`btn ${mod?.status === 'enabled' ? 'btn-secondary' : 'btn-primary'}`} 
            onClick={handleToggleModule}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {mod?.status === 'enabled' ? 'Disable Whitelist' : 'Enable Whitelist'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Add Bot
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3>Register New Bot</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Bot User ID</label>
              <input type="text" className="text-input" placeholder="e.g., 235088799074488320" value={newBotId} onChange={e => setNewBotId(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <RoleSelect
                label="Managed Role"
                roles={registry.roles || []}
                selectedRoleId={newBotRole}
                onChange={(id) => setNewBotRole(id)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAdd}>Confirm & Sync</button>
            </div>
          </div>
        </div>
      )}

      {editingBot && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--accent-primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <Settings2 size={20} /> Configure Bot: {editingBot.tag}
          </h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <RoleSelect
                label="Managed Role"
                roles={registry.roles || []}
                selectedRoleId={editingBot.managedRoleId}
                onChange={(id) => setEditingBot({...editingBot, managedRoleId: id})}
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>Status</label>
              <select className="text-input" value={editingBot.status} onChange={e => setEditingBot({...editingBot, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={editingBot.autoConfigure} onChange={e => setEditingBot({...editingBot, autoConfigure: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                Auto-Configure on Join
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setEditingBot(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => handleEdit(editingBot)}>Save Configuration</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Bot</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Managed Role</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No bots whitelisted yet.</td>
              </tr>
            ) : bots.map((b: any) => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600 }}>{b.tag}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.userId}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px' }}>
                    {registry.roles?.find(r => r.id === b.managedRoleId)?.name || b.managedRoleId}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    fontWeight: 600,
                    background: b.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: b.status === 'active' ? '#10b981' : '#ef4444'
                  }}>
                    {b.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" title="Configure" onClick={() => setEditingBot({...b})}><Settings2 size={16} /></button>
                    <button className="icon-btn" title="Force Sync"><RefreshCw size={16} /></button>
                    <button className="icon-btn" title="Remove" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemove(b.userId)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
