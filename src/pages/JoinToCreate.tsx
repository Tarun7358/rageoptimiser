import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, Settings, Users, Shield, Lock, Eye, 
  Sparkles, Radio, HelpCircle, Save, Layers, ArrowRight,
  ShieldCheck, EyeOff, UserCheck, Trash2, RefreshCw
} from 'lucide-react';
import type { ModuleState } from '../hooks/useDiscordSync';

interface JoinToCreateProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
  registry?: {
    channels: Array<{
      id: string;
      name: string;
      type: string;
      category?: string;
    }>;
  };
}

export function JoinToCreate({ onSaveConfig, modules, onUpdateConfig, registry }: JoinToCreateProps) {
  const [activeTab, setActiveTab] = useState('settings');
  const [isSaving, setIsSaving] = useState(false);

  const jtcModule = (modules || []).find(m => m.id === 'join_to_create');
  const config = jtcModule?.config || {};
  const activeChannels: any[] = config.activeChannels || [];

  // Config States
  const triggerChannelId = config.triggerChannelId || '';
  const categoryId = config.categoryId || '';
  const defaultName = config.defaultName || "{user}'s Lounge";
  const defaultLimit = config.defaultLimit || 0;
  const privacy = config.privacy || 'public';

  const handleToggleEnable = () => {
    if (!jtcModule) return;
    const nextEnabled = jtcModule.status !== 'enabled';
    onUpdateConfig('join_to_create', {}, nextEnabled);
    onSaveConfig(`Join to Create ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSaveConfig('Join to Create configuration saved.');
      setIsSaving(false);
    }, 800);
  };

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('join_to_create', fields);
  };

  // Filter channels safely
  const voiceChannels = (registry?.channels || []).filter(c => c.type === 'voice');
  const categories = (registry?.channels || []).filter(c => c.type === 'category');

  // Privacy options meta helper
  const privacyOptions = [
    {
      id: 'public',
      label: 'Public Access',
      desc: 'Anyone can view and join the room instantly.',
      icon: Eye,
      color: '#10B981',
      bgGlow: 'rgba(16, 185, 129, 0.15)'
    },
    {
      id: 'private',
      label: 'Request to Join',
      desc: 'Invisible/hidden room, users must ask to connect.',
      icon: EyeOff,
      color: '#F59E0B',
      bgGlow: 'rgba(245, 158, 11, 0.15)'
    },
    {
      id: 'locked',
      label: 'Locked Room',
      desc: 'Visible to everyone, but new members cannot join.',
      icon: Lock,
      color: '#EF4444',
      bgGlow: 'rgba(239, 68, 68, 0.15)'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      
      {/* Premium Page Header */}
      <div className="page-header" style={{ position: 'relative', overflow: 'hidden', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge badge-purple" style={{ padding: '6px 12px', fontSize: '10px', borderRadius: '20px', letterSpacing: '0.05em' }}>
                <Sparkles size={11} style={{ marginRight: '4px' }} /> Dynamic Voice Systems
              </span>
            </div>
            <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(to right, #FFF, #9CA3AF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '6px' }}>
              Join-to-Create Hub
            </h1>
            <p className="page-subtitle" style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: '1.5' }}>
              Create a seamless voice lounge experience. When users join a trigger channel, the bot instantly provisions a private, customizable voice room and migrates them automatically.
            </p>
          </div>

          <motion.button 
            whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(124, 92, 252, 0.3)' }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleEnable}
            style={{ 
              minWidth: '160px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: jtcModule?.status === 'enabled' 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.1))'
                : 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(79, 140, 255, 0.05))',
              border: jtcModule?.status === 'enabled' 
                ? '1px solid rgba(34, 197, 94, 0.4)' 
                : '1px solid rgba(124, 92, 252, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontWeight: 700,
              fontSize: '13px',
              color: jtcModule?.status === 'enabled' ? '#10B981' : 'var(--text-primary)',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(8px)'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: jtcModule?.status === 'enabled' ? '#10B981' : '#6B7280',
              boxShadow: jtcModule?.status === 'enabled' ? '0 0 10px #10B981' : 'none',
              display: 'inline-block'
            }} />
            {jtcModule?.status === 'enabled' ? 'SYSTEM ACTIVE' : 'SYSTEM INACTIVE'}
          </motion.button>
        </div>
      </div>

      {/* Main Grid Wrapper */}
      <div className="section-panel" style={{
        background: 'rgba(23, 26, 33, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '18px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden'
      }}>
        
        {/* Navigation Tabs */}
        <div className="tabs-nav" style={{
          display: 'flex',
          gap: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0 28px',
          background: 'rgba(0, 0, 0, 0.15)'
        }}>
          {[
            { id: 'settings', label: 'Trigger Blueprints', icon: Settings },
            { id: 'active', label: `Active Temporary Rooms (${activeChannels.length})`, icon: Radio }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '18px 8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'all 0.2s ease',
                  background: 'none'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="panel-body" style={{ padding: '32px' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '36px', alignItems: 'start' }}
              >
                {/* Left Side: Setup Forms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  
                  {/* Section Title */}
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} color="var(--accent-primary)" /> Voice Generator Blueprint
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Customize how dynamic rooms are constructed and managed by the bot.
                    </p>
                  </div>

                  {/* Form Blocks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Trigger Channel Dropdown */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                        Voice Trigger Channel
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          className="form-select"
                          value={triggerChannelId}
                          onChange={e => handleUpdate({ triggerChannelId: e.target.value })}
                          style={{
                            width: '100%',
                            background: 'rgba(15, 17, 21, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            color: '#FFF',
                            fontSize: '14px',
                            appearance: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Select voice channel trigger...</option>
                          {voiceChannels.map(ch => (
                            <option key={ch.id} value={ch.id}>
                              🔊 {ch.name} {ch.category ? `[${ch.category}]` : ''}
                            </option>
                          ))}
                        </select>
                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                          ▼
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                        When a member joins this channel, the bot immediately spawns a new temporary room and moves them to it.
                      </p>
                    </div>

                    {/* Fallback Category Dropdown */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                        Spawn Category
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          className="form-select"
                          value={categoryId}
                          onChange={e => handleUpdate({ categoryId: e.target.value || null })}
                          style={{
                            width: '100%',
                            background: 'rgba(15, 17, 21, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            color: '#FFF',
                            fontSize: '14px',
                            appearance: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Same Category as Trigger (Auto-Resolve)</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              📁 {cat.name}
                            </option>
                          ))}
                        </select>
                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                          ▼
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                        Specifies which Discord category the new channel should be created inside.
                      </p>
                    </div>

                    {/* Room Naming Template */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                        Channel Name Template
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. {user}'s Lounge"
                        value={defaultName}
                        onChange={e => handleUpdate({ defaultName: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 17, 21, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          color: '#FFF',
                          fontSize: '14px'
                        }}
                      />
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                        Placeholders: <code>{`{user}`}</code> (server nickname), <code>{`{username}`}</code> (discord ID name), or <code>{`{count}`}</code> (global counter index).
                      </p>
                    </div>

                    {/* Privacy Selector Cards */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '12px' }}>
                        Default Privacy Mode
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {privacyOptions.map(opt => {
                          const Icon = opt.icon;
                          const isSelected = privacy === opt.id;
                          return (
                            <motion.div
                              key={opt.id}
                              whileHover={{ scale: 1.02, y: -2 }}
                              onClick={() => handleUpdate({ privacy: opt.id })}
                              style={{
                                background: isSelected ? 'rgba(29, 33, 43, 0.9)' : 'rgba(15, 17, 21, 0.5)',
                                border: isSelected ? `1.5px solid ${opt.color}` : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                transition: 'border-color 0.2s ease, background 0.2s ease',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              {isSelected && (
                                <div style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: '40px',
                                  height: '40px',
                                  background: `radial-gradient(circle at 100% 0%, ${opt.color} 0%, transparent 70%)`,
                                  opacity: 0.4
                                }} />
                              )}
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: isSelected ? opt.bgGlow : 'rgba(255,255,255,0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isSelected ? opt.color : 'var(--text-secondary)',
                                transition: 'all 0.2s ease'
                              }}>
                                <Icon size={16} />
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#FFF' : 'var(--text-secondary)' }}>
                                {opt.label}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                                {opt.desc}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Room Capacity/User Limit */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                        Default User Limit
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <input 
                          type="range"
                          min={0}
                          max={99}
                          value={defaultLimit}
                          onChange={e => handleUpdate({ defaultLimit: parseInt(e.target.value) || 0 })}
                          style={{
                            flex: 1,
                            accentColor: 'var(--accent-primary)',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{
                          minWidth: '70px',
                          textAlign: 'center',
                          padding: '10px 14px',
                          background: 'rgba(15, 17, 21, 0.8)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#FFF'
                        }}>
                          {defaultLimit === 0 ? '∞ slots' : `${defaultLimit} max`}
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Limit the number of members allowed in the voice room simultaneously.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ marginTop: '12px' }}>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        style={{ 
                          padding: '14px 28px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                          border: 'none',
                          color: '#FFF',
                          fontWeight: 700,
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          boxShadow: '0 10px 20px rgba(124, 92, 252, 0.2)'
                        }}
                      >
                        {isSaving ? (
                          <RefreshCw size={16} className="spin" />
                        ) : (
                          <Save size={16} />
                        )}
                        <span>{isSaving ? 'Saving Blueprint...' : 'Save Blueprint'}</span>
                      </motion.button>
                    </div>

                  </div>
                </div>

                {/* Right Side: Quick Info Panel */}
                <div style={{
                  background: 'rgba(15, 17, 21, 0.4)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    💡 How it Works
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(124,92,252,0.1)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                        1
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', display: 'block' }}>User Joins Generator</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>
                          A member joins your voice trigger channel (e.g. 🔊 "Join to Create").
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(124,92,252,0.1)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                        2
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', display: 'block' }}>Room Creation</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>
                          The bot instantly spawns a new temporary voice channel using your config blueprint.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(124,92,252,0.1)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                        3
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', display: 'block' }}>Auto Transfer</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>
                          The user is automatically migrated to their new lounge room.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(124,92,252,0.1)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                        4
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', display: 'block' }}>Zero-Clutter Clean</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>
                          When the last member leaves the spawned channel, it is instantly deleted.
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                {/* Header Copy */}
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={18} color="var(--accent-primary)" className="pulse" /> Live Temp Rooms
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    List of dynamically managed voice rooms currently active on the Discord server.
                  </p>
                </div>

                {activeChannels.length === 0 ? (
                  <div style={{ 
                    padding: '80px 40px', 
                    textAlign: 'center', 
                    background: 'rgba(15, 17, 21, 0.3)', 
                    border: '1px dashed rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <Volume2 size={48} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                    <div>
                      <h4 style={{ color: '#FFF', fontSize: '15px', fontWeight: 600 }}>No Active Channels</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', maxWidth: '380px' }}>
                        No members are currently using the Join-to-Create generator voice room. Spawning details appear here in real time.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {activeChannels.map((room: any) => (
                      <motion.div
                        key={room.channelId}
                        whileHover={{ y: -4, border: '1px solid rgba(124, 92, 252, 0.4)', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
                        style={{
                          background: 'rgba(15, 17, 21, 0.7)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '14px',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Room Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge badge-success" style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '12px' }}>
                            🟢 LIVE
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ID: <code>{room.channelId}</code>
                          </span>
                        </div>

                        {/* Room Title */}
                        <div>
                          <h4 style={{ color: '#FFF', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Volume2 size={16} color="var(--accent-primary)" />
                            {room.name}
                          </h4>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                            Created by: <strong>@{room.ownerTag}</strong>
                          </span>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                        {/* Room Stats */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                            <Users size={14} />
                            <span>{room.userCount || 1} connected</span>
                          </div>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {room.limit === 0 ? 'Unlimited' : `${room.limit} slots max`}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
