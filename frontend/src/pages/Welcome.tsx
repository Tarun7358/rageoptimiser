import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Hash, Plus, Trash2, Save, Eye,
  Image, Type, Link2, Smile, Palette, ChevronDown, Code,
  Download, Check, Settings2, Sparkles, AlertCircle, Info, ExternalLink
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
      { name: '📋 Rules & Info', value: '#rules', inline: true },
      { name: '👋 Get Started', value: '#introductions', inline: true },
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
    name: 'Classic Premium', color: '#7C5CFC',
    config: { ...DEFAULT_CONFIG }
  },
  {
    name: 'Cyberpunk Red', color: '#EF4444',
    config: {
      ...DEFAULT_CONFIG,
      embed: {
        ...DEFAULT_CONFIG.embed,
        color: '#EF4444',
        title: '⚡ SYSTEM INTRUSION: {user.tag}',
        description: 'New node connected to **{server}**.\nInitializing welcome protocols for User #{memberCount}. Prepare interface.',
      }
    }
  },
  {
    name: 'Futuristic Gold', color: '#F59E0B',
    config: {
      ...DEFAULT_CONFIG,
      embed: {
        ...DEFAULT_CONFIG.embed,
        color: '#F59E0B',
        title: '✨ Welcoming VIP {user.name}',
        description: 'Welcome to the inner sanctum of **{server}**!\n\n👑 You are our **#{memberCount}** elite member. Enjoy the luxury.'
      }
    }
  },
];

// ─── Discord Embed Preview ─────────────────────────────────────────────────────
function EmbedPreview({ embed, message }: { embed: EmbedConfig; message: string }) {
  const mockReplace = (str: string) =>
    (str || '')
      .replace(/{user}/g, '@NewMember')
      .replace(/{user\.tag}/g, 'NewMember#0001')
      .replace(/{user\.name}/g, 'NewMember')
      .replace(/{user\.id}/g, '123456789012345678')
      .replace(/{user\.avatar}/g, 'https://cdn.discordapp.com/embed/avatars/0.png')
      .replace(/{server}/g, 'Clutch Nation')
      .replace(/{memberCount}/g, '1,482')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{time}/g, new Date().toLocaleTimeString());

  const leftBorderColor = embed.color || '#7C5CFC';

  return (
    <div style={{
      background: '#2b2d31',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: "'gg sans', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      maxWidth: '520px',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.04)'
    }}>
      {/* Message text */}
      {message && (
        <div style={{
          fontSize: '15px',
          color: '#dbdee1',
          marginBottom: embed.enabled ? '12px' : '0px',
          lineHeight: '1.375',
          whiteSpace: 'pre-wrap'
        }}>
          {mockReplace(message)}
        </div>
      )}

      {/* Embed */}
      {embed.enabled && (
        <div style={{
          borderLeft: `4px solid ${leftBorderColor}`,
          background: '#1e1f22',
          borderRadius: '4px',
          padding: '12px 16px',
          position: 'relative'
        }}>
          {/* Author */}
          {embed.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img
                src="https://cdn.discordapp.com/embed/avatars/1.png"
                style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                alt=""
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f2f3f5' }}>
                {mockReplace(embed.author)}
              </span>
            </div>
          )}
          {/* Title */}
          {embed.title && (
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              {mockReplace(embed.title)}
            </div>
          )}
          {/* Description */}
          {embed.description && (
            <div style={{
              fontSize: '14px',
              color: '#dbdee1',
              marginBottom: '10px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {mockReplace(embed.description)}
            </div>
          )}
          {/* Fields */}
          {embed.fields && embed.fields.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '10px',
              marginTop: '8px'
            }}>
              {embed.fields.map((f, i) => (
                <div key={i} style={{ gridColumn: f.inline ? 'span 1' : 'span 3' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>
                    {mockReplace(f.name || 'Field Name')}
                  </div>
                  <div style={{ fontSize: '13px', color: '#dbdee1' }}>
                    {mockReplace(f.value || 'Field value')}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Image */}
          {embed.image && (
            <img
              src={mockReplace(embed.image)}
              style={{ width: '100%', borderRadius: '4px', marginTop: '8px', maxHeight: '200px', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt=""
            />
          )}
          {/* Footer */}
          {(embed.footer || embed.timestamp) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '8px'
            }}>
              {embed.footerIcon && (
                <img
                  src={mockReplace(embed.footerIcon)}
                  style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span style={{ fontSize: '11px', color: '#949ba4' }}>
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
  const [channels] = useState<{ id: string; name: string }[]>([
    { id: '1', name: 'welcome-log' }, { id: '2', name: 'chat-general' }, { id: '3', name: 'arrivals' }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08) 0%, rgba(79, 140, 255, 0.03) 100%)',
        padding: '24px 32px',
        borderRadius: '16px',
        border: '1px solid rgba(124, 92, 252, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px',
          background: 'radial-gradient(circle, rgba(124, 92, 252, 0.25) 0%, transparent 70%)',
          filter: 'blur(20px)', pointerEvents: 'none'
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #7C5CFC 0%, #4F8CFF 100%)',
            padding: '12px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(124, 92, 252, 0.4)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="page-title" style={{
              fontSize: '28px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #FFF 30%, #A78BFA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.5px'
            }}>Dynamic Welcomer Gateway</h1>
            <p className="page-subtitle" style={{
              fontSize: '14px',
              color: '#94A3B8',
              margin: '4px 0 0 0',
              fontWeight: 500
            }}>
              Configure beautiful rich welcome banners, farewell messages, and custom status logs.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 2 }}>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{
            background: 'linear-gradient(135deg, #7C5CFC 0%, #5B21B6 100%)',
            border: 'none',
            boxShadow: '0 4px 14px rgba(124, 92, 252, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: '8px',
            color: '#FFF',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Settings Saved!' : saving ? 'Persisting...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(167, 139, 250, 0.8)', letterSpacing: '0.05em' }}>PRESET TEMPLATES:</span>
        {TEMPLATES.map((t, i) => (
          <button key={i} onClick={() => setConfig(t.config as WelcomeConfig)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${t.color}33`,
              color: t.color,
              transition: 'all 0.2s',
              boxShadow: `0 2px 8px ${t.color}11`
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${t.color}15`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Editor Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Navigation Bar */}
          <div style={{
            display: 'flex',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.3)',
            padding: 5,
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            {[
              { id: 'welcome', label: '👋 Welcome Message' },
              { id: 'leave', label: '🚪 Departure Message' },
              { id: 'embed', label: '🎨 Rich Embed Architect' }
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  background: activeTab === t.id ? 'linear-gradient(135deg, rgba(124,92,252,0.18) 0%, rgba(79,140,255,0.08) 100%)' : 'transparent',
                  border: activeTab === t.id ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
                  color: activeTab === t.id ? '#FFF' : 'rgba(255, 255, 255, 0.6)'
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Pages */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
          }}>
            {activeTab === 'welcome' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#FFF', margin: 0 }}>Enable Greetings</h3>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>Trigger message dispatch on guild join events.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Welcome Log Channel</label>
                  <select className="form-select" value={config.channelId} onChange={e => setConfig(c => ({ ...c, channelId: e.target.value }))} style={{ width: '100%', height: '42px' }}>
                    <option value="">-- Choose Target Channel --</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                  </select>
                  <span className="form-help">Channel where standard greeting logs will be routed.</span>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 600, color: '#E2E8F0' }}>Plaintext Message Block</label>
                    <button onClick={() => setVarOpen(!varOpen)} style={{ fontSize: '11px', color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Settings2 size={12} /> Variable References
                    </button>
                  </div>
                  <textarea
                    value={config.message}
                    onChange={e => setConfig(c => ({ ...c, message: e.target.value }))}
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      padding: '12px',
                      fontSize: '13px',
                      resize: 'vertical',
                      lineHeight: '1.6',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Welcome {user} to {server}!"
                  />
                </div>

                <AnimatePresence>
                  {varOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(124, 92, 252, 0.05)', border: '1px solid rgba(124, 92, 252, 0.15)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#A78BFA', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Interpolation Tokens</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {VARIABLES.map(v => (
                            <div key={v.var} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <code style={{ background: 'rgba(124, 92, 252, 0.12)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#C084FC', width: 'fit-content', fontFamily: 'monospace' }}>{v.var}</code>
                              <span style={{ fontSize: '10px', color: '#94A3B8' }}>{v.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 'leave' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#FFF', margin: 0 }}>Enable Departures</h3>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>Trigger message dispatch on guild leave events.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.leaveEnabled} onChange={e => setConfig(c => ({ ...c, leaveEnabled: e.target.checked }))} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Departure Channel</label>
                  <select className="form-select" value={config.leaveChannelId} onChange={e => setConfig(c => ({ ...c, leaveChannelId: e.target.value }))} style={{ width: '100%', height: '42px' }}>
                    <option value="">-- Same as Welcome --</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                  </select>
                  <span className="form-help">Where farewell events are announced.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Plaintext Message Block</label>
                  <textarea
                    value={config.leaveMessage}
                    onChange={e => setConfig(c => ({ ...c, leaveMessage: e.target.value }))}
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      padding: '12px',
                      fontSize: '13px',
                      resize: 'vertical',
                      lineHeight: '1.6',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'embed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#FFF', margin: 0 }}>Enable Rich Embed Card</h3>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>Attach a highly premium structured card to greeting logs.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.embed.enabled} onChange={e => updateEmbed('enabled', e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                {config.embed.enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Embed Theme Color</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="color" value={config.embed.color} onChange={e => updateEmbed('color', e.target.value)} style={{ width: 44, height: 40, borderRadius: 8, border: 'none', padding: 2, cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }} />
                          <input type="text" value={config.embed.color} onChange={e => updateEmbed('color', e.target.value)} className="form-input-text" style={{ flex: 1, height: '40px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)' }} />
                        </div>
                      </div>
                      <div className="form-group-row" style={{ alignSelf: 'center', marginTop: '16px' }}>
                        <div>
                          <div className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Embed Timestamp</div>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Render date/time at footer</span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={config.embed.timestamp} onChange={e => updateEmbed('timestamp', e.target.checked)} />
                          <span className="slider" />
                        </label>
                      </div>
                    </div>

                    {[
                      { key: 'title', label: 'Header Title' },
                      { key: 'description', label: 'Body Description Block', multiline: true },
                      { key: 'author', label: 'Author Header Name' },
                      { key: 'image', label: 'Embedded Banner Image URL' },
                      { key: 'footer', label: 'Footer Tagline Text' }
                    ].map(field => (
                      <div key={field.key} className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>{field.label}</label>
                        {field.multiline ? (
                          <textarea
                            value={(config.embed as any)[field.key]}
                            onChange={e => updateEmbed(field.key as any, e.target.value)}
                            rows={3}
                            style={{
                              width: '100%',
                              background: 'rgba(15, 23, 42, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              color: '#F1F5F9',
                              padding: '10px 12px',
                              fontSize: '13px',
                              resize: 'vertical',
                              lineHeight: '1.5',
                              boxSizing: 'border-box'
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            className="form-input-text"
                            value={(config.embed as any)[field.key]}
                            onChange={e => updateEmbed(field.key as any, e.target.value)}
                            placeholder="Supports {variables}"
                            style={{
                              height: '40px',
                              background: 'rgba(15, 23, 42, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px'
                            }}
                          />
                        )}
                      </div>
                    ))}

                    {/* Fields List */}
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#E2E8F0' }}>Structured Grid Fields</div>
                        <button onClick={addField} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, height: '28px' }}>
                          <Plus size={14} /> Add Column
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {config.embed.fields.map((f, i) => (
                          <div key={i} style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <input className="form-input-text" value={f.name} onChange={e => updateField(i, 'name', e.target.value)} placeholder="Field Header Label (e.g. Rules)" style={{ flex: 1, background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)' }} />
                              <button onClick={() => removeField(i)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#EF4444', borderRadius: '6px', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input className="form-input-text" value={f.value} onChange={e => updateField(i, 'value', e.target.value)} placeholder="Field Body Content (e.g. Read channel #rules)" style={{ marginBottom: 10, background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)' }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94A3B8', cursor: 'pointer' }}>
                              <input type="checkbox" checked={f.inline} onChange={e => updateField(i, 'inline', e.target.checked)} />
                              <span>Display Inline (align horizontal side-by-side)</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Right */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} color="#7C5CFC" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#7C5CFC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Simulated Discord Viewport</span>
          </div>

          <div style={{ background: '#1e1f22', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
            {/* Channel header */}
            <div style={{ background: '#2b2d31', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={18} color="#949ba4" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f2f3f5' }}>
                {channels.find(c => c.id === config.channelId)?.name || 'welcome-log'}
              </span>
            </div>
            {/* Messages */}
            <div style={{ padding: '20px', minHeight: '220px' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                {/* Avatar */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C5CFC 0%, #4F8CFF 100%)',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(124, 92, 252, 0.3)'
                }}>
                  CN
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Clutch Nation System</span>
                    <span style={{ background: '#5865F2', fontSize: '9px', fontWeight: 700, color: '#fff', padding: '2px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>BOT</span>
                    <span style={{ fontSize: '12px', color: '#72767d' }}>Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <EmbedPreview embed={config.embed} message={activeTab === 'leave' ? config.leaveMessage : config.message} />
                </div>
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(124, 92, 252, 0.05)',
            border: '1px solid rgba(124, 92, 252, 0.15)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Info size={18} color="#A78BFA" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              This sandbox emulates the rendering logic utilized inside client screens. Make sure to target the appropriate channel and save settings to propagate live updates.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
