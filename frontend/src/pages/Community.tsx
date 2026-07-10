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
      
      {/* Premium Page Header */}
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
        {/* Glow Background */}
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
            <Users size={28} />
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
            }}>Community Engagement Hub</h1>
            <p className="page-subtitle" style={{
              fontSize: '14px',
              color: '#94A3B8',
              margin: '4px 0 0 0',
              fontWeight: 500
            }}>
              Configure interactive welcomer modules, custom role assignments, and gamified chat leveling.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', position: 'relative', zIndex: 2 }}>
          <button 
            className={`btn ${commModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: commModule?.status === 'enabled' ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' : 'linear-gradient(135deg, #7C5CFC 0%, #5B21B6 100%)',
              border: 'none',
              color: '#FFF',
              boxShadow: commModule?.status === 'enabled' ? '0 4px 14px rgba(239, 68, 68, 0.25)' : '0 4px 14px rgba(124, 92, 252, 0.3)'
            }}
            onClick={handleToggleModuleEnable}
          >
            {commModule?.status === 'enabled' ? 'Disable Welcomer' : 'Enable Welcomer'}
          </button>
          
          {activeTab === 'welcome_builder' && (
            <button 
              className="btn btn-primary"
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                border: 'none',
                color: '#FFF',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={handleSaveWelcomeConfig}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="section-panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="tabs-nav" style={{
          display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', marginBottom: '24px'
        }}>
          {[
            { id: 'welcome_builder', label: '👋 Welcome Portal Designer' },
            { id: 'features', label: '🎭 Gamification & Interaction Features' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.15) 0%, rgba(79, 140, 255, 0.05) 100%)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(124, 92, 252, 0.3)' : '1px solid transparent',
                color: activeTab === tab.id ? '#FFF' : '#94A3B8',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === tab.id ? '0 4px 12px rgba(124, 92, 252, 0.1)' : 'none'
              }}
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
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tpl.color}33`,
                      color: tpl.color,
                      transition: 'all 0.2s',
                      boxShadow: `0 2px 8px ${tpl.color}11`
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${tpl.color}15`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
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
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    background: 'rgba(15, 23, 42, 0.3)',
                    padding: '5px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {[
                      { id: 'welcome', label: '👋 Greetings Config' },
                      { id: 'leave', label: '🚪 Farewells Config' },
                      { id: 'embed', label: '🎨 Embed Customizer' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setEditorSubTab(sub.id as any)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          background: editorSubTab === sub.id ? 'linear-gradient(135deg, rgba(124,92,252,0.18) 0%, rgba(79,140,255,0.08) 100%)' : 'transparent',
                          border: editorSubTab === sub.id ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
                          color: editorSubTab === sub.id ? '#FFF' : 'rgba(255, 255, 255, 0.6)'
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {/* SubTab 1: Welcome Settings */}
                  {editorSubTab === 'welcome' && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginTop: 0, marginBottom: '16px' }}>Welcome Message Settings</h2>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Welcome Log Destination Channel</label>
                          <select 
                            className="form-select" 
                            value={welcomeChannelId} 
                            onChange={e => setWelcomeChannelId(e.target.value)}
                            style={{ width: '100%', height: '42px' }}
                          >
                            <option value="">-- Choose Target Channel --</option>
                            {registry.channels.filter(c => c.type === 'text').map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                          <span className="form-help">Where greeting card embeds will be dispatched when a member joins.</span>
                        </div>

                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label className="form-label" style={{ margin: 0, fontWeight: 600, color: '#E2E8F0' }}>Plaintext Message Block (Above Embed)</label>
                            <button 
                              onClick={() => setVarOpen(!varOpen)}
                              style={{ fontSize: '11px', color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              {'{}'} Variable References
                            </button>
                          </div>
                          <textarea
                            className="form-input-text"
                            rows={3}
                            value={welcomeEmbed.content}
                            onChange={e => setWelcomeEmbed({ ...welcomeEmbed, content: e.target.value })}
                            placeholder="Welcome {user} to {server}!"
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

                        {/* Variables list */}
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
                    </div>
                  )}

                  {/* SubTab 2: Leave Message Settings */}
                  {editorSubTab === 'leave' && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginTop: 0, marginBottom: '16px' }}>Farewell Message Settings</h2>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Departure Channel Destination</label>
                          <select 
                            className="form-select" 
                            value={leaveEmbed.channelId} 
                            onChange={e => setLeaveEmbed({ ...leaveEmbed, channelId: e.target.value })}
                            style={{ width: '100%', height: '42px' }}
                          >
                            <option value="">-- Same as Welcome / Disabled --</option>
                            {registry.channels.filter(c => c.type === 'text').map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                          <span className="form-help">Where farewell events are announced. Leave blank to inherit Welcome settings.</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Goodbye Plaintext Message</label>
                          <textarea
                            className="form-input-text"
                            rows={3}
                            value={leaveEmbed.content}
                            onChange={e => setLeaveEmbed({ ...leaveEmbed, content: e.target.value })}
                            placeholder="**{userTag}** has left the server."
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
                    </div>
                  )}

                  {/* SubTab 3: Embed Customizer */}
                  {editorSubTab === 'embed' && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginTop: 0, marginBottom: '16px' }}>Interactive Embed Customizer</h2>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Embed Theme Color</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={welcomeEmbed.color} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, color: e.target.value })} 
                                style={{ width: '44px', height: '40px', borderRadius: '8px', border: 'none', padding: 2, cursor: 'pointer', background: 'rgba(255,255,255,0.04)' }} 
                              />
                              <input 
                                type="text" 
                                className="form-input-text" 
                                value={welcomeEmbed.color} 
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, color: e.target.value })} 
                                style={{ flex: 1, height: '40px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)' }} 
                              />
                            </div>
                          </div>

                          <div className="form-group-row" style={{ alignSelf: 'center', marginTop: '16px' }}>
                            <div>
                              <div className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>Embed Timestamp</div>
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Render date/time at footer</span>
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

                        {[
                          { key: 'title', label: 'Header Title' },
                          { key: 'description', label: 'Body Description Block', multiline: true },
                          { key: 'author', label: 'Author Header Name' },
                          { key: 'imageUrl', label: 'Embedded Banner Image URL' },
                          { key: 'footer', label: 'Footer Tagline Text' }
                        ].map(field => (
                          <div key={field.key} className="form-group">
                            <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>{field.label}</label>
                            {field.multiline ? (
                              <textarea
                                className="form-input-text"
                                rows={3}
                                value={(welcomeEmbed as any)[field.key]}
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, [field.key]: e.target.value })}
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
                                value={(welcomeEmbed as any)[field.key]}
                                onChange={e => setWelcomeEmbed({ ...welcomeEmbed, [field.key]: e.target.value })}
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

                        {/* Embed Fields (Advanced welcome builder items) */}
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0' }}>Structured Grid Fields</span>
                            <button
                              onClick={() => {
                                const fields = welcomeEmbed.fields || [];
                                setWelcomeEmbed({ ...welcomeEmbed, fields: [...fields, { name: '', value: '', inline: true }] });
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
                            >
                              <Plus size={12} /> Add Field
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(welcomeEmbed.fields || []).map((f, i) => (
                              <div key={i} style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
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
                                    style={{ flex: 1, background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)' }} 
                                  />
                                  <button 
                                    onClick={() => {
                                      const newFields = welcomeEmbed.fields.filter((_, idx) => idx !== i);
                                      setWelcomeEmbed({ ...welcomeEmbed, fields: newFields });
                                    }} 
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#EF4444', borderRadius: '6px', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                                  style={{ marginBottom: '8px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)' }} 
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
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#7C5CFC', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Simulated Discord Viewport</span>
                  </div>

                  <div style={{ background: '#1e1f22', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
                    {/* Channel header */}
                    <div style={{ background: '#2b2d31', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Hash size={18} color="#949ba4" />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#f2f3f5' }}>
                        {registry.channels.find(c => c.id === welcomeChannelId)?.name || 'welcome-log'}
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
                          <EmbedPreview 
                            embed={editorSubTab === 'leave' ? { ...leaveEmbed, content: leaveEmbed.content } as any : welcomeEmbed} 
                            message={editorSubTab === 'leave' ? leaveEmbed.content : welcomeEmbed.content} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(124, 92, 252, 0.05)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(124, 92, 252, 0.15)' }}>
                    <Info size={16} color="#A78BFA" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                      This sandbox emulates the rendering logic utilized inside client screens. Make sure to target the appropriate channel and save settings to propagate live updates.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}
          
          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Reaction Roles Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', margin: 0 }}>Self-Assign Reaction Roles</h3>
                  <button 
                    className={`btn btn-sm ${rrModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
                    style={{
                      background: rrModule?.status === 'enabled' ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' : 'linear-gradient(135deg, #7C5CFC 0%, #5B21B6 100%)',
                      border: 'none',
                      color: '#FFF',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={handleRRToggle}
                  >
                    {rrModule?.status === 'enabled' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Map customizable emoji reactions to automatic role provisioning. Users can self-assign roles via interactive button lists.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {['🎮', '🔔', '🎨'].map(emoji => (
                    <div key={emoji} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#E2E8F0' }}>
                        <span style={{ fontSize: '18px' }}>{emoji}</span> Role Reaction
                      </span>
                      <select 
                        className="form-select" 
                        style={{ width: '160px', height: '36px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                        value={rrModule?.config?.roleMap?.[emoji] || ''}
                        onChange={(e) => handleRRUpdate(emoji, e.target.value)}
                      >
                        <option value="">-- Bind Role --</option>
                        {registry.roles.filter((r: any) => r.name !== '@everyone').map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat XP Leveling Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', margin: 0 }}>Gamified XP Leveling</h3>
                  <button 
                    className={`btn btn-sm ${lvlModule?.status === 'enabled' ? 'btn-danger' : 'btn-primary'}`}
                    style={{
                      background: lvlModule?.status === 'enabled' ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' : 'linear-gradient(135deg, #7C5CFC 0%, #5B21B6 100%)',
                      border: 'none',
                      color: '#FFF',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={handleLvlToggle}
                  >
                    {lvlModule?.status === 'enabled' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Reward active chatters with leveling metrics. Users can query their tier status using <code>/rank</code> or review rank distribution on the server leaderboard.
                </p>
                
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#E2E8F0' }}>XP Progression Rate</label>
                  <select 
                    className="form-select" 
                    disabled={lvlModule?.status !== 'enabled'}
                    value={lvlModule?.config?.multiplier || '1.0'}
                    onChange={(e) => {
                      onUpdateConfig('leveling', { multiplier: e.target.value });
                      onSaveConfig('Leveling multiplier updated.');
                    }}
                    style={{ width: '100%', height: '42px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <option value="1.0">1.0x (Standard Progression Rate)</option>
                    <option value="1.5">1.5x (Double Weekend Multiplier)</option>
                    <option value="2.0">2.0x (Super Event Multiplier)</option>
                  </select>
                  <span className="form-help">Adjust the baseline XP rate awarded to active chat participants.</span>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}
