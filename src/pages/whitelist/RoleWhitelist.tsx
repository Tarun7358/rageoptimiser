import React, { useState } from 'react';
import type { ModuleState, DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';
import { Shield, Plus, Trash2, Settings2 } from 'lucide-react';
import { RoleSelect } from '../../components/ResourceSelectors';

interface RoleWhitelistProps {
  modules?: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
}

export function RoleWhitelist({ modules, registry }: RoleWhitelistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [newRoleId, setNewRoleId] = useState('');
  
  const mod = (modules || []).find(m => m.id === 'role_whitelist');
  const roles = mod?.config?.roles || [];

  const handleEdit = async (updatedRole: any) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/role_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'edit',
          payload: updatedRole
        })
      });
      setEditingRole(null);
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!newRoleId) return;
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/role_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'add',
          payload: {
            id: newRoleId,
            roleId: newRoleId,
            name: registry.roles?.find(r => r.id === newRoleId)?.name || newRoleId,
            status: 'active',
            enabledModules: [],
            createdDate: new Date().toISOString()
          }
        })
      });
      setShowAddForm(false);
      setNewRoleId('');
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (roleId: string) => {
    try {
      const token = localStorage.getItem('cn_token');
      const guildId = localStorage.getItem('cn_active_guild') || '';
      await fetch('http://localhost:5000/api/modules/role_whitelist/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          action: 'remove',
          payload: { roleId }
        })
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="module-page" style={{ padding: '32px', paddingBottom: '300px' }}>
      <div className="module-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} color="var(--accent-primary)" />
            Role Whitelist
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage trusted roles whose members automatically inherit bypass permissions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Role
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3>Whitelist New Role</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <RoleSelect
                label="Select Role"
                roles={registry.roles || []}
                selectedRoleId={newRoleId}
                onChange={(id) => setNewRoleId(id)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAdd}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {editingRole && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--accent-primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <Settings2 size={20} /> Configure Role: {registry.roles?.find(r => r.id === editingRole.roleId)?.name || editingRole.name}
          </h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>Status</label>
              <select className="text-input" value={editingRole.status} onChange={e => setEditingRole({...editingRole, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Enabled Modules (Inheritable Bypass)</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['Anti-Nuke', 'Anti-Spam', 'Automod', 'Reaction-Roles', 'Verification'].map(modName => (
                  <label key={modName} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={editingRole.enabledModules?.includes(modName)} 
                      onChange={e => {
                        const current = editingRole.enabledModules || [];
                        const newModules = e.target.checked 
                          ? [...current, modName]
                          : current.filter((m: string) => m !== modName);
                        setEditingRole({...editingRole, enabledModules: newModules});
                      }} 
                    />
                    {modName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setEditingRole(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => handleEdit(editingRole)}>Save Configuration</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Role</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Bypass Permissions</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No roles whitelisted yet.</td>
              </tr>
            ) : roles.map((r: any) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600 }}>{registry.roles?.find(ro => ro.id === r.roleId)?.name || r.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.roleId}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {r.enabledModules?.length > 0 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {r.enabledModules.map((em: string) => (
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
                    background: r.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: r.status === 'active' ? '#10b981' : '#ef4444'
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" title="Configure" onClick={() => setEditingRole({...r})}><Settings2 size={16} /></button>
                    <button className="icon-btn" title="Remove" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemove(r.roleId)}><Trash2 size={16} /></button>
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
