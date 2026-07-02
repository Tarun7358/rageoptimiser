import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Hash, Plus, Trash2, Save, Eye,
  Image, Type, Link2, Smile, Palette, ChevronDown, Code,
  Upload, Download, Copy, Check, Settings2, AlignLeft,
  User, Clock, Star, Sparkles, RotateCcw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmbedField { name: string; value: string; inline: boolean; }
interface EmbedConfig {
  enabled: boolean;
  color: string;
  title: string;
  description: string;
  thumbnail: string;
  image: string;
  author: string;
  authorIcon: string;
  footer: string;
  footerIcon: string;
  timestamp: boolean;
  fields: EmbedField[];
}
interface WelcomeConfig {
  enabled: boolean;
  channelId: string;
  message: string;
  embed: EmbedConfig;
  leaveEnabled: boolean;
  leaveChannelId: string;
  leaveMessage: string;
}

const DEFAULT_CONFIG: WelcomeConfig = {
  enabled: true,
  channelId: '',
  message: 'Welcome {user} to **{server}**! You are member #{memberCount}. 🎉',
  embed: {
    enabled: true,
    color: '#7C5CFC',
    title: 'Welcome to {server}!',
    description: 'Hey {user}, we\'re so glad you\'re here! Please check out our rules and enjoy your stay.',
    thumbnail: '{user.avatar}',
    image: '',
    author: '{user.tag}',
    authorIcon: '{user.avatar}',
    footer: 'Member #{memberCount} • Joined {date}',
    footerIcon: '',
    timestamp: true,
    fields: [
      { name: '📋 Rules', value: '#rules', inline: true },
      { name: '👋 Introductions', value: '#introductions', inline: true },
    ]
  },
  leaveEnabled: true,
  leaveChannelId: '',
  leaveMessage: '**{user.tag}** has left the server. We now have {memberCount} members.'
};

const VARIABLES = [
  { var: '{user}', desc: 'Mentions the user (@User)' },
  { var: '{user.tag}', desc: 'Username#Discriminator' },
  { var: '{user.name}', desc: 'Username only' },
  { var: '{user.id}', desc: 'User snowflake ID' },
  { var: '{user.avatar}', desc: 'User avatar URL' },
  { var: '{server}', desc: 'Server name' },
  { var: '{server.id}', desc: 'Server ID' },
  { var: '{memberCount}', desc: 'Current member count' },
  { var: '{date}', desc: 'Current date (short)' },
  { var: '{time}', desc: 'Current time (UTC)' },
];

const TEMPLATES = [
  {
    name: 'Classic Welcome', color: '#7C5CFC',
    config: { ...DEFAULT_CONFIG }
  },
  {
    name: 'Minimal', color: '#22C55E',
    config: { ...DEFAULT_CONFIG, embed: { ...DEFAULT_CONFIG.embed, enabled: false }, message: '👋 Welcome {user} to **{server}**! You are member **#{memberCount}**.' }
  },
  {
    name: 'Gaming Clan', color: '#FACC15',
    config: { ...DEFAULT_CONFIG, embed: { ...DEFAULT_CONFIG.embed, color: '#FACC15', title: '⚔️ New Warrior Joins {server}!', description: 'Welcome {user}! Ready to dominate? Check the rules and gear up.' } }
  },
];

// ─── Discord Embed Preview ─────────────────────────────────────────────────────
function EmbedPreview({ embed, message }: { embed: EmbedConfig; message: string }) {
  const mockReplace = (str: string) =>
    str.replace(/{user}/g, '@NewMember').replace(/{user\.tag}/g, 'NewMember#0001')
      .replace(/{user\.name}/g, 'NewMember').replace(/{user\.id}/g, '123456789012345678')
      .replace(/{user\.avatar}/g, 'https://cdn.discordapp.com/embed/avatars/0.png')
      .replace(/{server}/g, 'My Server').replace(/{memberCount}/g, '142')
      .replace(/{date}/g, new Date().toLocaleDateString()).replace(/{time}/g, new Date().toLocaleTimeString());

  const leftBorderColor = embed.color || '#7C5CFC';

  return (
    <div style={{
      background: '#313338', borderRadius: 8, padding: '16px',
      fontFamily: "'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      maxWidth: 520
    }}>
      {/* Message text */}
      {message && (
        <div style={{ fontSize: 15, color: '#dbdee1', marginBottom: embed.enabled ? 8 : 0, lineHeight: 1.375, whiteSpace: 'pre-wrap' }}>
          {mockReplace(message)}
        </div>
      )}

      {/* Embed */}
      {embed.enabled && (
        <div style={{
          borderLeft: `4px solid ${leftBorderColor}`,
          background: '#2b2d31', borderRadius: 4,
          padding: '12px 16px', maxWidth: 520
        }}>
          {/* Author */}
          {embed.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {embed.authorIcon && <img src={mockReplace(embed.authorIcon)} style={{ width: 24, height: 24, borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="" />}
              <span style={{ fontSize: 14, fontWeight: 600, color: '#dbdee1' }}>{mockReplace(embed.author)}</span>
            </div>
          )}
          {/* Title */}
          {embed.title && <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{mockReplace(embed.title)}</div>}
          {/* Description */}
          {embed.description && <div style={{ fontSize: 14, color: '#dbdee1', marginBottom: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mockReplace(embed.description)}</div>}
          {/* Fields */}
          {embed.fields.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: 10 }}>
              {embed.fields.map((f, i) => (
                <div key={i} style={{ gridColumn: f.inline ? 'span 1' : 'span 3' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.name || 'Field Name'}</div>
                  <div style={{ fontSize: 13, color: '#dbdee1' }}>{f.value || 'Field value'}</div>
                </div>
              ))}
            </div>
          )}
          {/* Thumbnail */}
          {embed.thumbnail && (
            <img src={mockReplace(embed.thumbnail)} style={{ position: 'absolute', right: 16, top: 12, width: 80, height: 80, borderRadius: 4, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="" />
          )}
          {/* Footer */}
          {(embed.footer || embed.timestamp) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {embed.footerIcon && <img src={mockReplace(embed.footerIcon)} style={{ width: 16, height: 16, borderRadius: '50%' }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              <span style={{ fontSize: 12, color: '#949ba4' }}>
                {embed.footer ? mockReplace(embed.footer) : ''}
                {embed.footer && embed.timestamp ? ' • ' : ''}
                {embed.timestamp ? new Date().toLocaleString() : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function Welcome() {
  const { token } = useAuth();
  const [config, setConfig] = useState<WelcomeConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'welcome' | 'leave' | 'embed'>('welcome');
  const [varOpen, setVarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([
    { id: '1', name: 'welcome' }, { id: '2', name: 'general' }, { id: '3', name: 'arrivals' }
  ]);

  const updateEmbed = (key: keyof EmbedConfig, value: any) =>
    setConfig(c => ({ ...c, embed: { ...c.embed, [key]: value } }));

  const addField = () =>
    setConfig(c => ({ ...c, embed: { ...c.embed, fields: [...c.embed.fields, { name: '', value: '', inline: false }] } }));

  const removeField = (i: number) =>
    setConfig(c => ({ ...c, embed: { ...c.embed, fields: c.embed.fields.filter((_, idx) => idx !== i) } }));

  const updateField = (i: number, key: keyof EmbedField, val: any) =>
    setConfig(c => ({
      ...c, embed: {
        ...c.embed,
        fields: c.embed.fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f)
      }
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:5000/api/modules/welcome/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { }
    setSaving(false);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'welcome-config.json'; a.click();
  };

  const TABS = [
    { id: 'welcome', label: '👋 Welcome Message' },
    { id: 'leave', label: '👋 Leave Message' },
    { id: 'embed', label: '📋 Embed Builder' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Welcome & Leave Builder</h1>
          <p className="page-subtitle">Design your welcome and leave messages with a live Discord preview.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportConfig} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {saved ? <Check size={14} /> : saving ? '...' : <Save size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Templates */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>TEMPLATES:</span>
        {TEMPLATES.map((t, i) => (
          <button key={i} onClick={() => setConfig(t.config as WelcomeConfig)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.1)`,
              color: t.color
            }}>
            {t.name}
          </button>
        ))}
      </div>

      {/* Main Layout: Editor + Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  background: activeTab === t.id ? 'rgba(124,92,252,0.2)' : 'transparent',
                  color: activeTab === t.id ? '#A78BFA' : 'var(--text-muted)'
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Welcome Tab */}
          {activeTab === 'welcome' && (
            <div className="section-panel">
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group-row">
                  <div><div className="form-label">Enable Welcome Messages</div></div>
                  <label className="switch"><input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} /><span className="slider" /></label>
                </div>
                <div className="form-group">
                  <label className="form-label">Welcome Channel</label>
                  <select className="form-input-text" value={config.channelId} onChange={e => setConfig(c => ({ ...c, channelId: e.target.value }))}>
                    <option value="">Select channel...</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Message Text</label>
                    <button onClick={() => setVarOpen(v => !v)} style={{ fontSize: 11, color: '#7C5CFC', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      {'{}'} Variables
                    </button>
                  </div>
                  <textarea
                    value={config.message}
                    onChange={e => setConfig(c => ({ ...c, message: e.target.value }))}
                    rows={4}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F3F4F6', padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                    placeholder="Welcome {user} to {server}!"
                  />
                </div>

                {/* Variables panel */}
                <AnimatePresence>
                  {varOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#7C5CFC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Available Variables</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {VARIABLES.map(v => (
                            <div key={v.var} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <code style={{ background: 'rgba(124,92,252,0.15)', padding: '2px 7px', borderRadius: 5, fontSize: 11, color: '#A78BFA', flexShrink: 0 }}>{v.var}</code>
                              <span style={{ fontSize: 11, color: '#6B7280' }}>{v.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Leave Tab */}
          {activeTab === 'leave' && (
            <div className="section-panel">
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group-row">
                  <div><div className="form-label">Enable Leave Messages</div></div>
                  <label className="switch"><input type="checkbox" checked={config.leaveEnabled} onChange={e => setConfig(c => ({ ...c, leaveEnabled: e.target.checked }))} /><span className="slider" /></label>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Channel</label>
                  <select className="form-input-text" value={config.leaveChannelId} onChange={e => setConfig(c => ({ ...c, leaveChannelId: e.target.value }))}>
                    <option value="">Select channel...</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Message</label>
                  <textarea value={config.leaveMessage} onChange={e => setConfig(c => ({ ...c, leaveMessage: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F3F4F6', padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Embed Tab */}
          {activeTab === 'embed' && (
            <div className="section-panel">
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group-row">
                  <div><div className="form-label">Send as Embed</div></div>
                  <label className="switch"><input type="checkbox" checked={config.embed.enabled} onChange={e => updateEmbed('enabled', e.target.checked)} /><span className="slider" /></label>
                </div>
                {config.embed.enabled && (<>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Embed Color</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={config.embed.color} onChange={e => updateEmbed('color', e.target.value)} style={{ width: 36, height: 32, borderRadius: 6, border: 'none', padding: 2, cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }} />
                        <input type="text" value={config.embed.color} onChange={e => updateEmbed('color', e.target.value)} className="form-input-text" style={{ flex: 1 }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Timestamp</label>
                      <label className="switch" style={{ marginTop: 8 }}><input type="checkbox" checked={config.embed.timestamp} onChange={e => updateEmbed('timestamp', e.target.checked)} /><span className="slider" /></label>
                    </div>
                  </div>
                  {[
                    { key: 'title', label: 'Title' }, { key: 'description', label: 'Description', multiline: true },
                    { key: 'author', label: 'Author Name' }, { key: 'authorIcon', label: 'Author Icon URL' },
                    { key: 'thumbnail', label: 'Thumbnail URL' }, { key: 'image', label: 'Image URL' },
                    { key: 'footer', label: 'Footer Text' }, { key: 'footerIcon', label: 'Footer Icon URL' },
                  ].map(field => (
                    <div key={field.key} className="form-group">
                      <label className="form-label">{field.label}</label>
                      {field.multiline ? (
                        <textarea value={(config.embed as any)[field.key]} onChange={e => updateEmbed(field.key as any, e.target.value)} rows={3}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F3F4F6', padding: '8px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      ) : (
                        <input type="text" className="form-input-text" value={(config.embed as any)[field.key]} onChange={e => updateEmbed(field.key as any, e.target.value)} placeholder={`Use {variables} here`} />
                      )}
                    </div>
                  ))}

                  {/* Fields */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div className="form-label" style={{ margin: 0 }}>Embed Fields</div>
                      <button onClick={addField} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={12} /> Add Field
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {config.embed.fields.map((f, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input className="form-input-text" value={f.name} onChange={e => updateField(i, 'name', e.target.value)} placeholder="Field name" style={{ flex: 1 }} />
                            <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 4px' }}><Trash2 size={14} /></button>
                          </div>
                          <input className="form-input-text" value={f.value} onChange={e => updateField(i, 'value', e.target.value)} placeholder="Field value" style={{ marginBottom: 8 }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={f.inline} onChange={e => updateField(i, 'inline', e.target.checked)} /> Inline
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Live Preview */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={14} color="#7C5CFC" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C5CFC', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Discord Preview</span>
          </div>
          {/* Discord UI mockup */}
          <div style={{ background: '#1e1f22', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Channel header */}
            <div style={{ background: '#2b2d31', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={16} color="#949ba4" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f2f3f5' }}>
                {channels.find(c => c.id === config.channelId)?.name || 'welcome'}
              </span>
            </div>
            {/* Messages */}
            <div style={{ padding: '16px', minHeight: 200 }}>
              {/* Bot message */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #ff3b30, #ff9500)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff' }}>RO</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Rage Optimiser</span>
                    <span style={{ fontSize: 11, color: '#72767d' }}>Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <EmbedPreview embed={config.embed} message={activeTab === 'leave' ? config.leaveMessage : config.message} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
