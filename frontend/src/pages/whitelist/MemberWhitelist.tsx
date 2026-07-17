import { API_BASE } from '../../config';
import React, { useState } from 'react';
import type { ModuleState, DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';
import { Users, Plus, Trash2, Settings2 } from 'lucide-react';

interface MemberWhitelistProps {
  modules?: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onUpdateConfig?: (moduleId: string, newConfig: Record<string, any>, enabledOverride?: boolean) => void;
}

export function MemberWhitelist({ modules, registry, onUpdateConfig }: MemberWhitelistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newMemberId, setNewMemberId] = useState('');
  
  const mod = (modules || []).find(m => m.id === 'member_whitelist');
  const members = (mod?.config?.members || [])
    .filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      // Must not be a role or bot type
      if (m.type && m.type !== 'member') return false;
      // Must have a valid primary ID
      const primaryId = m.userId || m.id;
      if (!primaryId || primaryId === 'undefined' || primaryId === 'null') return false;
      // Must have a valid tag or name
      const displayName = m.tag || m.username || m.name;
      if (!displayName || displayName === 'undefined' || displayName === 'null') return false;
      return true;
    });

  const handleToggleModule = async () => {
    if (!mod || !onUpdateConfig) return;
    const nextEnabled = mod.status !== 'enabled';
    await onUpdateConfig(mod.id, {}, nextEnabled);
  };

  const handleEdit = async (updatedMember: any) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch(`${API_BASE}/api/modules/member_whitelist/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'edit',
          payload: updatedMember
        })
      });
      setEditingMember(null);
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!newMemberId) return;
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch(`${API_BASE}/api/modules/member_whitelist/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'add',
          payload: {
            id: newMemberId,
            userId: newMemberId,
            tag: `User ${newMemberId.substring(0,4)}`,
            status: 'active',
            enabledModules: [],
            addedBy: 'Admin',
            createdDate: new Date().toISOString()
          }
        })
      });
      setShowAddForm(false);
      setNewMemberId('');
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (userId: string) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch(`${API_BASE}/api/modules/member_whitelist/action`, {
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
            <Users size={28} color="var(--accent-primary)" />
            Member Whitelist
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage trusted members who can bypass specific protection modules.</p>
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
            <Plus size={18} /> Add Member
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3>Whitelist New Member</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Member User ID</label>
              <input type="text" className="text-input" placeholder="e.g., 235088799074488320" value={newMemberId} onChange={e => setNewMemberId(e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAdd}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--accent-primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <Settings2 size={20} /> Configure Member: {editingMember.tag}
          </h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>Status</label>
              <select className="text-input" value={editingMember.status} onChange={e => setEditingMember({...editingMember, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Enabled Modules (Bypass)</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['Anti-Nuke', 'Anti-Spam', 'Automod', 'Reaction-Roles', 'Verification'].map(modName => (
                  <label key={modName} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={editingMember.enabledModules?.includes(modName)} 
                      onChange={e => {
                        const current = editingMember.enabledModules || [];
                        const newModules = e.target.checked 
                          ? [...current, modName]
                          : current.filter((m: string) => m !== modName);
                        setEditingMember({...editingMember, enabledModules: newModules});
                      }} 
                    />
                    {modName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setEditingMember(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => handleEdit(editingMember)}>Save Configuration</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Member</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Bypass Permissions</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No members whitelisted yet.</td>
              </tr>
            ) : members.map((m: any) => {
              const primaryId = m.userId || m.id;
              const displayTag = m.tag || m.username || m.name || `User-${primaryId}`;
              return (
              <tr key={primaryId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600 }}>{displayTag}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.userId || m.id}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {m.enabledModules?.length > 0 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {m.enabledModules.map((em: string) => (
                        <span key={em} style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '11px' }}>{em}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None Configured</span>
                  )}
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    fontWeight: 600,
                    background: m.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: m.status === 'active' ? '#10b981' : '#ef4444'
                  }}>
                    {m.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" title="Configure" onClick={() => setEditingMember({...m})}><Settings2 size={16} /></button>
                    <button className="icon-btn" title="Remove" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemove(m.userId || m.id)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
