import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Check, RefreshCw, Smile, ChevronDown, Users, Shield, Zap, Star, Award } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../config';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';

interface RolesProps {
  modules?: ModuleState[];
  registry?: DiscordResourceRegistry;
  onUpdateConfig?: (moduleId: string, config: Record<string, any>, enabled?: boolean) => void;
}

interface ReactionRole { messageId: string; channelId: string; emoji: string; roleId: string; description: string; }
interface ButtonRole { label: string; emoji: string; roleId: string; style: 'primary' | 'secondary' | 'success' | 'danger'; }
interface AutoRole { roleId: string; trigger: 'join' | 'boost' | 'verify'; delay: number; }
interface RoleReward { roleId: string; xpThreshold: number; description: string; }

const TABS = [
  { id: 'reaction', label: '😀 Reaction Roles', icon: <Smile size={14} /> },
  { id: 'button', label: '🔘 Button Roles', icon: <Zap size={14} /> },
  { id: 'auto', label: '⚡ Auto Roles', icon: <Users size={14} /> },
  { id: 'rewards', label: '🏆 Role Rewards', icon: <Award size={14} /> },
] as const;

const BTN_STYLES = { primary: '#5865F2', secondary: '#4f545c', success: '#3ba55d', danger: '#ed4245' };

export function Roles({ registry }: RolesProps) {
  const { token } = useAuth();
  const [tab, setTab] = useState<'reaction'|'button'|'auto'|'rewards'>('reaction');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Use real registry roles if available, otherwise fall back to placeholder list
  const [roles] = useState<{id:string;name:string;color:string}[]>(
    (registry?.roles || []).length > 0
      ? registry!.roles.map(r => ({ id: r.id, name: r.name, color: r.color || '#6B7280' }))
      : [
          {id:'1',name:'Member',color:'#6B7280'},{id:'2',name:'Verified',color:'#22C55E'},
          {id:'3',name:'Booster',color:'#F472B6'},{id:'4',name:'VIP',color:'#FACC15'},
          {id:'5',name:'Moderator',color:'#60A5FA'},{id:'6',name:'DJ',color:'#F97316'},
        ]
  );
  const [channels] = useState(
    (registry?.channels || []).filter(c => c.type === 'text').length > 0
      ? registry!.channels.filter(c => c.type === 'text').map(c => ({ id: c.id, name: c.name }))
      : [{id:'1',name:'roles'},{id:'2',name:'general'},{id:'3',name:'welcome'}]
  );
  const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([
    { messageId: '', channelId: '1', emoji: '✅', roleId: '2', description: 'Get the Verified role' }
  ]);
  const [buttonRoles, setButtonRoles] = useState<ButtonRole[]>([
    { label: 'Get VIP', emoji: '⭐', roleId: '4', style: 'primary' }
  ]);
  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([
    { roleId: '1', trigger: 'join', delay: 0 }
  ]);
  const [roleRewards, setRoleRewards] = useState<RoleReward[]>([
    { roleId: '4', xpThreshold: 1000, description: 'VIP at 1000 XP' }
  ]);

  const save = async () => {
    setSaving(true);
    try {
      // M-1: Use VITE_API_URL env var instead of hardcoded localhost
      await fetch(`${API_BASE}/api/modules/roles/config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reactionRoles, buttonRoles, autoRoles, roleRewards })
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const RoleSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="form-input-text" style={{ minWidth: 160 }}>
      <option value="">Select role...</option>
      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );

  const ChannelSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="form-input-text">
      <option value="">Select channel...</option>
      {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Roles Manager</h1>
          <p className="page-subtitle">Configure reaction roles, button roles, auto-roles and XP rewards.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saved ? <Check size={14} /> : <Save size={14} />} {saved ? 'Saved!' : 'Save All'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.id ? 'rgba(124,92,252,0.2)' : 'transparent', color: tab === t.id ? '#A78BFA' : 'var(--text-muted)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Reaction Roles */}
      {tab === 'reaction' && (
        <div className="section-panel">
          <div className="panel-header">
            <div className="panel-title"><Smile size={16} /><span>Reaction Roles</span></div>
            <button onClick={() => setReactionRoles(r => [...r, { messageId: '', channelId: '', emoji: '⭐', roleId: '', description: '' }])} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Users react to a message with an emoji to get a role. Use the bot command <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>/reaction-role setup</code> to link to a specific message.
            </p>
            {reactionRoles.map((rr, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input className="form-input-text" style={{ width: 60, textAlign: 'center', fontSize: 20 }} value={rr.emoji} onChange={e => setReactionRoles(arr => arr.map((x,j) => j===i ? {...x,emoji:e.target.value} : x))} placeholder="😀" />
                  <RoleSelect value={rr.roleId} onChange={v => setReactionRoles(arr => arr.map((x,j) => j===i ? {...x,roleId:v} : x))} />
                  <ChannelSelect value={rr.channelId} onChange={v => setReactionRoles(arr => arr.map((x,j) => j===i ? {...x,channelId:v} : x))} />
                  <input className="form-input-text" style={{ flex: 1, minWidth: 120 }} value={rr.messageId} onChange={e => setReactionRoles(arr => arr.map((x,j) => j===i ? {...x,messageId:e.target.value} : x))} placeholder="Message ID (optional)" />
                  <button onClick={() => setReactionRoles(arr => arr.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
                <input className="form-input-text" value={rr.description} onChange={e => setReactionRoles(arr => arr.map((x,j) => j===i ? {...x,description:e.target.value} : x))} placeholder="Description (shown to users)" />
              </div>
            ))}
            {reactionRoles.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: 13 }}>No reaction roles yet. Click Add to create one.</div>}
          </div>
        </div>
      )}

      {/* Button Roles */}
      {tab === 'button' && (
        <div className="section-panel">
          <div className="panel-header">
            <div className="panel-title"><Zap size={16} /><span>Button Roles</span></div>
            <button onClick={() => setButtonRoles(b => [...b, { label: '', emoji: '', roleId: '', style: 'primary' }])} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add Button
            </button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Post an interactive message with buttons — users click to toggle their roles. Use <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>/button-roles post #channel</code> to deploy.
            </p>
            {/* Preview */}
            {buttonRoles.length > 0 && (
              <div style={{ background: '#2b2d31', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, color: '#949ba4', marginBottom: 10 }}>Discord Preview:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {buttonRoles.map((b, i) => (
                    <div key={i} style={{ padding: '8px 16px', borderRadius: 4, background: BTN_STYLES[b.style], fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {b.emoji} {b.label || 'Button'}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {buttonRoles.map((b, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="form-input-text" style={{ width: 50, textAlign: 'center' }} value={b.emoji} onChange={e => setButtonRoles(arr => arr.map((x,j) => j===i ? {...x,emoji:e.target.value} : x))} placeholder="😀" />
                <input className="form-input-text" style={{ flex: 1, minWidth: 100 }} value={b.label} onChange={e => setButtonRoles(arr => arr.map((x,j) => j===i ? {...x,label:e.target.value} : x))} placeholder="Button Label" />
                <RoleSelect value={b.roleId} onChange={v => setButtonRoles(arr => arr.map((x,j) => j===i ? {...x,roleId:v} : x))} />
                <select value={b.style} onChange={e => setButtonRoles(arr => arr.map((x,j) => j===i ? {...x,style:e.target.value as any} : x))} className="form-input-text">
                  {Object.keys(BTN_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setButtonRoles(arr => arr.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto Roles */}
      {tab === 'auto' && (
        <div className="section-panel">
          <div className="panel-header">
            <div className="panel-title"><Users size={16} /><span>Auto Roles</span></div>
            <button onClick={() => setAutoRoles(a => [...a, { roleId: '', trigger: 'join', delay: 0 }])} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {autoRoles.map((ar, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <RoleSelect value={ar.roleId} onChange={v => setAutoRoles(arr => arr.map((x,j) => j===i ? {...x,roleId:v} : x))} />
                <select value={ar.trigger} onChange={e => setAutoRoles(arr => arr.map((x,j) => j===i ? {...x,trigger:e.target.value as any} : x))} className="form-input-text">
                  <option value="join">On Join</option>
                  <option value="boost">On Server Boost</option>
                  <option value="verify">On Verification</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delay:</span>
                  <input type="number" className="form-input-text" style={{ width: 70 }} value={ar.delay} min={0} onChange={e => setAutoRoles(arr => arr.map((x,j) => j===i ? {...x,delay:Number(e.target.value)} : x))} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>sec</span>
                </div>
                <button onClick={() => setAutoRoles(arr => arr.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            ))}
            {autoRoles.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: 13 }}>No auto roles configured.</div>}
          </div>
        </div>
      )}

      {/* Role Rewards */}
      {tab === 'rewards' && (
        <div className="section-panel">
          <div className="panel-header">
            <div className="panel-title"><Award size={16} /><span>Role Rewards</span></div>
            <button onClick={() => setRoleRewards(r => [...r, { roleId: '', xpThreshold: 500, description: '' }])} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add Reward
            </button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Automatically assign roles when members reach XP milestones via the leveling system.
            </p>
            {roleRewards.map((rr, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <RoleSelect value={rr.roleId} onChange={v => setRoleRewards(arr => arr.map((x,j) => j===i ? {...x,roleId:v} : x))} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={14} color="#FACC15" />
                  <input type="number" className="form-input-text" style={{ width: 90 }} value={rr.xpThreshold} min={0} step={100} onChange={e => setRoleRewards(arr => arr.map((x,j) => j===i ? {...x,xpThreshold:Number(e.target.value)} : x))} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>XP</span>
                </div>
                <input className="form-input-text" style={{ flex: 1, minWidth: 140 }} value={rr.description} onChange={e => setRoleRewards(arr => arr.map((x,j) => j===i ? {...x,description:e.target.value} : x))} placeholder="Description" />
                <button onClick={() => setRoleRewards(arr => arr.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
