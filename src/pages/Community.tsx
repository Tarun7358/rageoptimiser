import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Sparkles, MessageSquare, Award, ShieldCheck,
  Trash2, Plus, Download, Save, Check, Eye, Hash, ArrowRight,
  HelpCircle, Settings2, Info
} from 'lucide-react';
import type { ModuleState, DiscordChannel, DiscordRole } from '../hooks/useDiscordSync';

interface CommunityProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { channels: DiscordChannel[], roles: DiscordRole[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

const VARIABLES = [
  { var: '{user}', desc: 'Mentions the user (@User)' },
  { var: '{userTag}', desc: 'Username#Discriminator' },
  { var: '{user.tag}', desc: 'Username#Discriminator (Alternative)' },
  { var: '{server}', desc: 'Server name' },
  { var: '{memberCount}', desc: 'Current member count' },
  { var: '{userId}', desc: 'User ID' },
  { var: '{date}', desc: 'Current date' },
];

const TEMPLATES = [
  {
    name: 'Classic Welcome',
    color: '#7C5CFC',
    welcomeEmbed: {
      content: 'Welcome {user} to **{server}**! You are member #{memberCount}. 🎉',
      author: '{userTag}',
      title: '👋 Welcome to {server}!',
      description: 'Welcome {user}, hope you have a great time here in our community!\n\n👤 **User**: {userTag}\n🔢 **Member Count**: You are our **#{memberCount}** member!',
      color: '#7C5CFC',
      showAvatar: true,
      imageUrl: '',
      footer: 'User ID: {userId}',
      timestamp: true,
      fields: [
        { name: '📋 Rules', value: '#rules', inline: true },
        { name: '👋 Introductions', value: '#introductions', inline: true }
      ]
    },
    leaveEmbed: {
      channelId: '',
      content: '**{userTag}** has left the server.',
      author: '',
      title: '😢 Goodbye {user}!',
      description: '**{userTag}** has left the server. We will miss you!\n\n📉 **Remaining Members**: **{memberCount}**',
      color: '#ff4444',
      showAvatar: true,
      imageUrl: '',
      footer: 'User ID: {userId}',
      timestamp: true,
      fields: []
    }
  },
  {
    name: 'Minimal Text Only',
    color: '#22C55E',
    welcomeEmbed: {
      content: '👋 Welcome {user} to **{server}**! You are member **#{memberCount}**.',
      author: '',
      title: '',
      description: '',
      color: '#22C55E',
      showAvatar: false,
      imageUrl: '',
      footer: '',
      timestamp: false,
      fields: []
    },
    leaveEmbed: {
      channelId: '',
      content: '👋 **{userTag}** has left the server.',
      author: '',
      title: '',
      description: '',
      color: '#EF4444',
      showAvatar: false,
      imageUrl: '',
      footer: '',
      timestamp: false,
      fields: []
    }
  },
  {
    name: 'Gaming Clan Style',
    color: '#FACC15',
    welcomeEmbed: {
      content: '⚔️ **A new warrior approaches!** Welcome {user} to {server}!',
      author: '{userTag}',
      title: '🛡️ Member #{memberCount} has landed!',
      description: 'Prepare for battle! Check out our rules to join the matchmaking pool and request your starter roles.',
      color: '#FACC15',
      showAvatar: true,
      imageUrl: 'https://i.imgflip.com/1g8my4.jpg',
      footer: 'Server: {server}',
      timestamp: true,
      fields: [
        { name: '🎮 Matching Pool', value: '#lfg-general', inline: true },
        { name: '📣 Server Rules', value: '#announcements', inline: true }
      ]
    },
    leaveEmbed: {
      channelId: '',
      content: '💀 **{userTag}** has fallen in battle.',
      author: '',
      title: 'Fallen Hero',
      description: 'May their sword rest in peace. Remaining warriors: {memberCount}',
      color: '#DC2626',
      showAvatar: false,
      imageUrl: '',
      footer: '',
      timestamp: true,
      fields: []
    }
  }
];

export function Community({
  onSaveConfig,
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: CommunityProps) {
  const [activeTab, setActiveTab] = useState<'welcome_builder' | 'features'>('welcome_builder');
  const [editorSubTab, setEditorSubTab] = useState<'welcome' | 'leave' | 'embed'>('welcome');
  const [varOpen, setVarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const commModule = (modules || []).find(m => m.id === 'community');
  const config = commModule?.config || {};
  const rrModule = (modules || []).find(m => m.id === 'reaction_roles');
  const lvlModule = (modules || []).find(m => m.id === 'leveling');

  // Welcome Config local draft state
  const [welcomeChannelId, setWelcomeChannelId] = useState('');
  const [welcomeEmbed, setWelcomeEmbed] = useState({
    content: 'Welcome {user} to {server}!',
    author: '',
    title: '👋 Welcome to {server}!',
    description: 'Welcome {user}, hope you have a great time here in our community!\n\n👤 **User**: {userTag}\n🔢 **Member Count**: You are our **#{memberCount}** member!',
    color: '#4f8cff',
    showAvatar: true,
    imageUrl: '',
    footer: 'User ID: {userId}',
    timestamp: true,
    fields: [] as { name: string; value: string; inline: boolean; }[]
  });
  const [leaveEmbed, setLeaveEmbed] = useState({
    channelId: '',
    content: '**{userTag}** has left the server.',
    author: '',
    title: '😢 Goodbye {user}!',
    description: '**{userTag}** has left the server. We will miss you!\n\n📉 **Remaining Members**: **{memberCount}**',
    color: '#ff4444',
    showAvatar: true,
    imageUrl: '',
    footer: 'User ID: {userId}',
    timestamp: true,
    fields: [] as { name: string; value: string; inline: boolean; }[]
  });

  // Sync state when config updates
  useEffect(() => {
    if (config) {
      setWelcomeChannelId(config.welcomeChannelId || '');
      setWelcomeEmbed({
        content: config.welcomeEmbed?.content ?? 'Welcome {user} to {server}!',
        author: config.welcomeEmbed?.author ?? '',
        title: config.welcomeEmbed?.title ?? '👋 Welcome to {server}!',
        description: config.welcomeEmbed?.description ?? 'Welcome {user}, hope you have a great time here in our community!\n\n👤 **User**: {userTag}\n🔢 **Member Count**: You are our **#{memberCount}** member!',
        color: config.welcomeEmbed?.color ?? '#4f8cff',
        showAvatar: config.welcomeEmbed?.showAvatar !== false,
        imageUrl: config.welcomeEmbed?.imageUrl ?? '',
        footer: config.welcomeEmbed?.footer ?? 'User ID: {userId}',
        timestamp: config.welcomeEmbed?.timestamp !== false,
        fields: config.welcomeEmbed?.fields ?? []
      });
      setLeaveEmbed({
        channelId: config.leaveEmbed?.channelId ?? '',
        content: config.leaveEmbed?.content ?? '**{userTag}** has left the server.',
        author: config.leaveEmbed?.author ?? '',
        title: config.leaveEmbed?.title ?? '😢 Goodbye {user}!',
        description: config.leaveEmbed?.description ?? '**{userTag}** has left the server. We will miss you!\n\n📉 **Remaining Members**: **{memberCount}**',
        color: config.leaveEmbed?.color ?? '#ff4444',
        showAvatar: config.leaveEmbed?.showAvatar !== false,
        imageUrl: config.leaveEmbed?.imageUrl ?? '',
        footer: config.leaveEmbed?.footer ?? 'User ID: {userId}',
        timestamp: config.leaveEmbed?.timestamp !== false,
        fields: config.leaveEmbed?.fields ?? []
      });
    }
  }, [config]);

  // Reaction Roles & Leveling Controls
  const handleRRUpdate = (emoji: string, roleId: string) => {
    const currentMap = rrModule?.config?.roleMap || {};
    const newMap = { ...currentMap, [emoji]: roleId };
    if (!roleId) delete newMap[emoji];
    onUpdateConfig('reaction_roles', { roleMap: newMap });
    onSaveConfig('Reaction roles updated.');
  };

  const handleLvlToggle = () => {
    const nextEnabled = lvlModule?.status !== 'enabled';
    onUpdateConfig('leveling', {}, nextEnabled);
    onSaveConfig(`Leveling system ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleRRToggle = () => {
    const nextEnabled = rrModule?.status !== 'enabled';
    onUpdateConfig('reaction_roles', {}, nextEnabled);
    onSaveConfig(`Reaction roles ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleSaveWelcomeConfig = () => {
    setSaving(true);
    onUpdateConfig('community', {
      welcomeChannelId,
      welcomeEmbed,
      leaveEmbed
    });
    onSaveConfig('Welcome & Leave configurations saved.');
    onManualTrigger('Community: Interactive greeting layouts updated.', 'success', 'Community');
    setTimeout(() => setSaving(false), 800);
  };

  const handleToggleModuleEnable = () => {
    if (!commModule) return;
    const nextEnabled = commModule.status !== 'enabled';
    onUpdateConfig('community', {}, nextEnabled);
    onSaveConfig(`Community Welcomer ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Community: Welcomer modules set to ${nextEnabled ? 'ACTIVE' : 'OFF'}.`, nextEnabled ? 'success' : 'warning', 'Community');
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setWelcomeEmbed({
      ...tpl.welcomeEmbed,
      fields: tpl.welcomeEmbed.fields
    });
    setLeaveEmbed({
      ...tpl.leaveEmbed,
      channelId: leaveEmbed.channelId, // preserve leave channel select
      fields: tpl.leaveEmbed.fields
    });
    onSaveConfig(`Applied template: ${tpl.name}`);
  };

  // Embed Preview Helper
  function EmbedPreview({ embed, message }: { embed: typeof welcomeEmbed; message: string }) {
    const mockReplace = (str: string) =>
      (str || '')
        .replace(/{user}/g, '@NewMember')
        .replace(/{userTag}/g, 'NewMember#0001')
        .replace(/{user\.tag}/g, 'NewMember#0001')
        .replace(/{server}/g, 'My Server')
        .replace(/{memberCount}/g, '142')
        .replace(/{userId}/g, '123456789012345678')
        .replace(/{date}/g, new Date().toLocaleDateString());

    return (
      <div style={{
        background: '#313338', borderRadius: 8, padding: '16px',
        fontFamily: "'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        maxWidth: 520, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        {/* Message text */}
        {message && (
          <div style={{ fontSize: 15, color: '#dbdee1', marginBottom: 8, lineHeight: 1.375, whiteSpace: 'pre-wrap' }}>
            {mockReplace(message)}
          </div>
        )}

        {/* Embed Card */}
        <div style={{
          borderLeft: `4px solid ${embed.color || '#7C5CFC'}`,
          background: '#2b2d31', borderRadius: 4,
          padding: '12px 16px', position: 'relative'
        }}>
          {/* Author */}
          {embed.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {embed.showAvatar && <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 600 }}>CN</div>}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#dbdee1' }}>{mockReplace(embed.author)}</span>
            </div>
          )}
          {/* Title */}
          {embed.title && <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{mockReplace(embed.title)}</div>}
          {/* Description */}
          {embed.description && <div style={{ fontSize: 14, color: '#dbdee1', marginBottom: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mockReplace(embed.description)}</div>}
          {/* Fields */}
          {embed.fields && embed.fields.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: 10 }}>
              {embed.fields.map((f, i) => (
                <div key={i} style={{ gridColumn: f.inline ? 'span 1' : 'span 3' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{mockReplace(f.name) || 'Field Name'}</div>
                  <div style={{ fontSize: 13, color: '#dbdee1' }}>{mockReplace(f.value) || 'Field value'}</div>
                </div>
              ))}
            </div>
          )}
          {/* Image */}
          {embed.imageUrl && (
            <img src={embed.imageUrl} style={{ width: '100%', borderRadius: 4, marginTop: 8, maxHeight: '200px', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="" />
          )}
          {/* Footer */}
          {(embed.footer || embed.timestamp) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8 }}>
              <span style={{ fontSize: 11, color: '#949ba4' }}>
                {embed.footer ? mockReplace(embed.footer) : ''}
                {embed.footer && embed.timestamp ? ' • ' : ''}
                {embed.timestamp ? new Date().toLocaleString() : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Community & Engagement Modules</h1>
          <p className="page-subtitle">Configure welcome banners, leveling mechanics, suggestions, and reaction role grids.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${commModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleToggleModuleEnable}
          >
            {commModule?.status === 'enabled' ? 'Disable Welcomer' : 'Enable Welcomer'}
          </button>
          {activeTab === 'welcome_builder' && (
            <button 
              className="btn btn-primary"
              style={{ background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={handleSaveWelcomeConfig}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Setter'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="section-panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="tabs-nav" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          {[
            { id: 'welcome_builder', label: '👋 Welcome Page Setter' },
            { id: 'features', label: '🎭 Reaction & Leveling Features' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          
          {/* TAB 1: WELCOME PAGE SETTER */}
          {activeTab === 'welcome_builder' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Template selector */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>QUICK TEMPLATES:</span>
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', color: tpl.color, border: `1px solid ${tpl.color}22` }}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>

              {/* Grid: Editor Left, Live Preview Right */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Editor Left */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Editor Sub Tabs */}
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    {[
                      { id: 'welcome', label: 'Welcome Page Configuration' },
                      { id: 'leave', label: 'Leave Message Setter' },
                      { id: 'embed', label: 'Embed Builder Options' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setEditorSubTab(sub.id as any)}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                          background: editorSubTab === sub.id ? 'rgba(124,92,252,0.15)' : 'transparent',
                          color: editorSubTab === sub.id ? '#A78BFA' : 'var(--text-muted)'
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {/* SubTab 1: Welcome Settings */}
                  {editorSubTab === 'welcome' && (
                    <div className="section-panel">
                      <div className="panel-header">
                        <span className="panel-title">Welcome Page Settings</span>
                      </div>
                      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                          <label className="form-label">Welcome Channel Destination</label>
                          <select 
                            className="form-select" 
                            value={welcomeChannelId} 
                            onChange={e => setWelcomeChannelId(e.target.value)}
                          >
                            <option value="">-- Select Channel --</option>
                            {registry.channels.filter(c => c.type === 'text').map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                          <span className="form-help">Where welcome embeds will be dispatched when a member joins.</span>
                        </div>

                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Message Plaintext (Above Embed)</label>
                            <button 
                              onClick={() => setVarOpen(!varOpen)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '10px', height: '24px', padding: '0 8px' }}
                            >
                              {'{}'} Variables Helper
                            </button>
                          </div>
                          <textarea
                            className="form-input-text"
                            rows={3}
                            value={welcomeEmbed.content}
                            onChange={e => setWelcomeEmbed({ ...welcomeEmbed, content: e.target.value })}
                            placeholder="Welcome {user} to {server}!"
                          />
                        </div>

                        {/* Variables list */}
                        <AnimatePresence>
                          {varOpen && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                              <div style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7C5CFC', marginBottom: '8px', textTransform: 'uppercase' }}>Text Replacements</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  {VARIABLES.map(v => (
                                    <div key={v.var} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <code style={{ background: 'rgba(124,92,252,0.12)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#A78BFA' }}>{v.var}</code>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{v.desc}</span>
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

                  {/* SubTab 2: Leave Message Settings */}
                  {editorSubTab === 'leave' && (
                    <div className="section-panel">
                      <div className="panel-header">
                        <span className="panel-title">Leave Message Settings</span>
                      </div>
                      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                          <label className="form-label">Leave Channel Destination</label>
                          <select 
                            className="form-select" 
                            value={leaveEmbed.channelId} 
                            onChange={e => setLeaveEmbed({ ...leaveEmbed, channelId: e.target.value })}
                          >
                            <option value="">-- Same as Welcome / Disabled --</option>
                            {registry.channels.filter(c => c.type === 'text').map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                          <span className="form-help">Where goodbye messages are broadcast. Leave blank to disable leave messages.</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Goodbye Plaintext Message</label>
                          <textarea
                            className="form-input-text"
                            rows={3}
                            value={leaveEmbed.content}
                            onChange={e => setLeaveEmbed({ ...leaveEmbed, content: e.target.value })}
                            placeholder="**{userTag}** has left the server."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SubTab 3: Embed Customizer */}
                  {editorSubTab === 'embed' && (
                    <div className="section-panel">
                      <div className="panel-header">
                        <span className="panel-title">Interactive Embed Customizer</span>
                      </div>
                      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label className="form-label">Border Accent Color</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={welcomeEmbed.color} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, color: e.target.value })} 
                                style={{ width: '40px', height: '36px', borderRadius: '6px', border: 'none', padding: 2, cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }} 
                              />
                              <input 
                                type="text" 
                                className="form-input-text" 
                                value={welcomeEmbed.color} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, color: e.target.value })} 
                                style={{ flex: 1 }} 
                              />
                            </div>
                          </div>

                          <div className="form-group-row" style={{ alignSelf: 'center', marginTop: '16px' }}>
                            <div>
                              <div className="form-label">Show Avatar Thumbnail</div>
                            </div>
                            <label className="switch">
                              <input 
                                type="checkbox" 
                                checked={welcomeEmbed.showAvatar} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, showAvatar: e.target.checked })} 
                              />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Embed Header Title</label>
                          <input 
                            type="text" 
                            className="form-input-text" 
                            value={welcomeEmbed.title} 
                            onChange={e => setWelcomeEmbed({ ...welcomeEmbed, title: e.target.value })} 
                            placeholder="e.g. Welcome to {server}!" 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Embed Description Block</label>
                          <textarea 
                            className="form-input-text" 
                            rows={4} 
                            value={welcomeEmbed.description} 
                            onChange={e => setWelcomeEmbed({ ...welcomeEmbed, description: e.target.value })} 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Banner Image URL (Bottom Image)</label>
                          <input 
                            type="text" 
                            className="form-input-text" 
                            value={welcomeEmbed.imageUrl} 
                            onChange={e => setWelcomeEmbed({ ...welcomeEmbed, imageUrl: e.target.value })} 
                            placeholder="https://example.com/banner.png" 
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label className="form-label">Footer Title Text</label>
                            <input 
                              type="text" 
                              className="form-input-text" 
                              value={welcomeEmbed.footer} 
                              onChange={e => setWelcomeEmbed({ ...welcomeEmbed, footer: e.target.value })} 
                              placeholder="User ID: {userId}" 
                            />
                          </div>

                          <div className="form-group-row" style={{ alignSelf: 'center', marginTop: '16px' }}>
                            <div>
                              <div className="form-label">Enable Timestamp</div>
                            </div>
                            <label className="switch">
                              <input 
                                type="checkbox" 
                                checked={welcomeEmbed.timestamp} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, timestamp: e.target.checked })} 
                              />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </div>

                        {/* Embed Fields (Advanced welcome builder items) */}
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Embed Sub-fields</span>
                            <button
                              onClick={() => {
                                const fields = welcomeEmbed.fields || [];
                                setWelcomeEmbed({ ...welcomeEmbed, fields: [...fields, { name: '', value: '', inline: true }] });
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Plus size={12} /> Add Field
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(welcomeEmbed.fields || []).map((f, i) => (
                              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  <input 
                                    className="form-input-text" 
                                    value={f.name} 
                                    onChange={e => {
                                      const newFields = [...welcomeEmbed.fields];
                                      newFields[i].name = e.target.value;
                                      setWelcomeEmbed({ ...welcomeEmbed, fields: newFields });
                                    }} 
                                    placeholder="Title (e.g. 📋 Rules)" 
                                    style={{ flex: 1 }} 
                                  />
                                  <button 
                                    onClick={() => {
                                      const newFields = welcomeEmbed.fields.filter((_, idx) => idx !== i);
                                      setWelcomeEmbed({ ...welcomeEmbed, fields: newFields });
                                    }} 
                                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 4px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <input 
                                  className="form-input-text" 
                                  value={f.value} 
                                  onChange={e => {
                                    const newFields = [...welcomeEmbed.fields];
                                    newFields[i].value = e.target.value;
                                    setWelcomeEmbed({ ...welcomeEmbed, fields: newFields });
                                  }} 
                                  placeholder="Value (e.g. Read #rules-and-info)" 
                                  style={{ marginBottom: '8px' }} 
                                />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={f.inline} 
                                    onChange={e => {
                                      const newFields = [...welcomeEmbed.fields];
                                      newFields[i].inline = e.target.checked;
                                      setWelcomeEmbed({ ...welcomeEmbed, fields: newFields });
                                    }} 
                                  />
                                  Inline (fits side-by-side with other fields)
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </div>

                {/* Live Preview Right */}
                <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={14} color="#7C5CFC" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#7C5CFC', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Discord Mockup</span>
                  </div>

                  <EmbedPreview 
                    embed={editorSubTab === 'leave' ? { ...leaveEmbed, content: leaveEmbed.content } as any : welcomeEmbed} 
                    message={editorSubTab === 'leave' ? leaveEmbed.content : welcomeEmbed.content} 
                  />

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                      The mockup reflects changes instantly. Click the <strong>Save Setter</strong> button at the top to commit configurations to the Discord bot.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}
          
          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="section-panel" style={{ border: 'none', padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="panel-title" style={{ fontSize: '14px', fontWeight: 600 }}>Active Reaction Roles</span>
                  <button 
                    className={`btn btn-sm ${rrModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={handleRRToggle}
                  >
                    {rrModule?.status === 'enabled' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Map emoji reactions to Discord roles. Spawn panels using <code>/reactionrole</code>.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['🎮', '🔔', '🎨'].map(emoji => (
                    <div key={emoji} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                      <span>{emoji} Emoji</span>
                      <select 
                        className="form-select" 
                        style={{ width: '150px' }}
                        value={rrModule?.config?.roleMap?.[emoji] || ''}
                        onChange={(e) => handleRRUpdate(emoji, e.target.value)}
                      >
                        <option value="">-- No Role --</option>
                        {registry.roles.filter((r: any) => r.name !== '@everyone').map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-panel" style={{ border: 'none', padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="panel-title" style={{ fontSize: '14px', fontWeight: 600 }}>Chat XP Leveling</span>
                  <button 
                    className={`btn btn-sm ${lvlModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={handleLvlToggle}
                  >
                    {lvlModule?.status === 'enabled' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Tracks user XP automatically. Users can check <code>/rank</code> or view the <code>/leaderboard</code>.</p>
                
                <div className="form-group">
                  <label className="form-label">XP Rate Multiplier</label>
                  <select 
                    className="form-select" 
                    disabled={lvlModule?.status !== 'enabled'}
                    value={lvlModule?.config?.multiplier || '1.0'}
                    onChange={(e) => {
                      onUpdateConfig('leveling', { multiplier: e.target.value });
                      onSaveConfig('Leveling multiplier updated.');
                    }}
                  >
                    <option value="1.0">1.0x (Standard Rate)</option>
                    <option value="1.5">1.5x (Double Weekend rate)</option>
                    <option value="2.0">2.0x (Event Mode)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
