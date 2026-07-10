import React, { useState, useEffect } from 'react';
import { 
  Music as MusicIcon, Save, Settings, Hash, Terminal, Sliders, BarChart2, 
  History, Heart, FolderHeart, Plus, Trash2, ArrowUpDown, Play, Pause,
  SkipForward, SkipBack, Square, Repeat, Shuffle, Search,
  Volume2, Disc, User, Calendar, ExternalLink, RefreshCw, Layers, Radio
} from 'lucide-react';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';

interface MusicProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabled?: boolean) => void;
  musicPlayerState?: any;
}

export function Music({ onSaveConfig, modules, registry, onUpdateConfig, musicPlayerState }: MusicProps) {
  const musicModule = (modules || []).find(m => m.id === 'music') || { status: 'disabled', config: {} as any };
  const config = musicModule.config || {};
  const isEnabled = musicModule.status === 'enabled';

  // State hooks
  const [activeTab, setActiveTab] = useState<'player' | 'settings' | 'stats' | 'playlists' | 'history'>('player');
  const [searchQuery, setSearchQuery] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(100);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<any>({
    totalStreams: 184,
    avgListeningTime: '42 mins',
    activeListeners: 0,
    mostPlayed: [
      { title: 'Chill Lofi Beats to Study/Relax', artist: 'Lofi Girl', playCount: 84, duration: '2:45' },
      { title: 'Synthwave Neon Drive Mix', artist: 'RetroSynth', playCount: 52, duration: '3:15' },
      { title: 'Cyberpunk Tokyo Drift Theme', artist: 'Synthwave Collective', playCount: 39, duration: '4:10' }
    ],
    activeUsers: [
      { username: 'rdxyz', actionCount: 64 },
      { username: 'tarun', actionCount: 42 },
      { username: 'moderator', actionCount: 18 }
    ]
  });

  const [history, setHistory] = useState<any[]>([
    { title: 'Chill Lofi Beats to Study/Relax', artist: 'Lofi Girl', duration: '2:45', requester: 'rdxyz', platform: 'YouTube', time: '10 mins ago' },
    { title: 'Synthwave Neon Drive Mix', artist: 'RetroSynth', duration: '3:15', requester: 'tarun', platform: 'Spotify', time: '45 mins ago' },
    { title: 'Cyberpunk Tokyo Drift Theme', artist: 'Synthwave Collective', duration: '4:10', requester: 'rdxyz', platform: 'YouTube', time: '1 hour ago' }
  ]);

  const [playlists, setPlaylists] = useState<any[]>([
    { name: 'Late Night Chill Study', trackCount: 24, creator: 'rdxyz', platform: 'Spotify' },
    { name: 'Guild Party Beats 2026', trackCount: 15, creator: 'Server Admin', platform: 'YouTube' }
  ]);

  const [favorites, setFavorites] = useState<any[]>([
    { title: 'Acoustic Guitar Melodies', artist: 'Guitar Chill', duration: '3:05', platform: 'Spotify' },
    { title: 'Ambient Rain Beats', artist: 'Lofi World', duration: '4:20', platform: 'YouTube' }
  ]);

  // Apply default fallbacks
  const musicPrefix = config.musicPrefix ?? 'r!';
  const prefixEnabled = config.prefixEnabled ?? true;
  const slashEnabled = config.slashEnabled ?? true;
  const defaultVolume = config.defaultVolume ?? 100;
  const voteSkipPercentage = config.voteSkipPercentage ?? 50;

  // Sync volume slider with music player state
  useEffect(() => {
    if (musicPlayerState && musicPlayerState.volume !== undefined) {
      setVolumeLevel(musicPlayerState.volume);
    }
  }, [musicPlayerState]);

  // Load real data from backend
  useEffect(() => {
    const fetchMusicData = async () => {
      const token = localStorage.getItem('cn_token');
      const currentGuild = localStorage.getItem('cn_active_guild');
      if (!token) return;

      setLoading(true);
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`
        };
        if (currentGuild) {
          headers['X-Guild-Id'] = currentGuild;
        }

        // Fetch stats
        const statsRes = await fetch('http://localhost:5000/api/modules/music/stats', { headers });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData && statsData.mostPlayed) setStats(statsData);
        }

        // Fetch history
        const historyRes = await fetch('http://localhost:5000/api/modules/music/history', { headers });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (historyData && historyData.length > 0) {
            setHistory(historyData.map((h: any) => ({
              title: h.title,
              artist: h.artist || 'Various Artists',
              duration: h.duration || '3:00',
              requester: h.requester || 'User',
              platform: h.platform || 'YouTube',
              time: 'Just now'
            })));
          }
        }

        // Fetch playlists
        const playlistsRes = await fetch('http://localhost:5000/api/modules/music/playlists', { headers });
        if (playlistsRes.ok) {
          const playlistsData = await playlistsRes.json();
          if (playlistsData && playlistsData.length > 0) {
            setPlaylists(playlistsData.map((p: any) => ({
              name: p.name,
              trackCount: p.tracks?.length || 0,
              creator: 'Dashboard Admin',
              platform: 'Custom'
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching music data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMusicData();
  }, [modules]);

  const handleToggleEnable = () => {
    onUpdateConfig('music', {}, !isEnabled);
    onSaveConfig(`Music module ${!isEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleUpdate = (field: string, value: any) => {
    onUpdateConfig('music', { [field]: value });
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const token = localStorage.getItem('cn_token');
    const currentGuild = localStorage.getItem('cn_active_guild');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/modules/music/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': currentGuild || ''
        },
        body: JSON.stringify({ name: newPlaylistName, tracks: [] })
      });

      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists.map((p: any) => ({
          name: p.name,
          trackCount: p.tracks?.length || 0,
          creator: 'Dashboard Admin',
          platform: 'Custom'
        })));
        setNewPlaylistName('');
        onSaveConfig(`Created playlist "${newPlaylistName}" successfully.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ECOSYSTEM INTERFACE ACTIONS
  const handlePlayerAction = async (action: string, value?: any, query?: string) => {
    const token = localStorage.getItem('cn_token');
    const currentGuild = localStorage.getItem('cn_active_guild');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/modules/music/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Guild-Id': currentGuild || ''
        },
        body: JSON.stringify({ action, value, query })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onSaveConfig(data.error || 'Playback action failed.');
      } else {
        if (action === 'play') {
          setSearchQuery('');
          onSaveConfig(`Added song to playback queue!`);
        }
      }
    } catch (err) {
      console.error('Failed to dispatch player action:', err);
      onSaveConfig('Playback action dispatch error.');
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolumeLevel(val);
    handlePlayerAction('volume', val);
  };

  const textChannels = (registry.channels || []).filter(c => c.type === 'text');
  const voiceChannels = (registry.channels || []).filter(c => c.type === 'voice');

  // Destructure real-time data
  const currentTrack = musicPlayerState?.currentTrack || null;
  const upcomingQueue = musicPlayerState?.queue || [];
  const activeFilters = musicPlayerState?.activeFilters || [];
  const isPaused = musicPlayerState?.paused || false;
  const currentSpeed = musicPlayerState?.speed || 1.0;
  const currentPitch = musicPlayerState?.pitch || 1.0;
  const voiceChannelName = musicPlayerState?.voiceChannelName || 'Disconnected';
  const listenersCount = musicPlayerState?.listeners || 0;
  const progressPercent = musicPlayerState ? (
    currentTrack ? 50 : 0
  ) : 0; // fallback calculation or indicator

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Music Module Configuration</h1>
            <p className="page-subtitle">Manage high-fidelity audio playback, persistent panels, and DJ permissions.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => onSaveConfig('Music settings saved successfully.')}
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
            <button 
              className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
              onClick={handleToggleEnable}
            >
              <MusicIcon size={14} />
              <span>{isEnabled ? 'Disable Module' : 'Enable Module'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('player')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'player' ? 'rgba(29, 185, 84, 0.15)' : 'transparent',
            color: activeTab === 'player' ? '#1DB954' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Radio size={14} />
          <span>Live Music Center</span>
          {currentTrack && (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#1DB954',
              display: 'inline-block', animation: 'pulse 1.5s infinite alternate'
            }}></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'settings' ? 'rgba(124,92,252,0.15)' : 'transparent',
            color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Settings size={14} />
          <span>Setup & Settings</span>
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'stats' ? 'rgba(124,92,252,0.15)' : 'transparent',
            color: activeTab === 'stats' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <BarChart2 size={14} />
          <span>Performance & Analytics</span>
        </button>
        <button 
          onClick={() => setActiveTab('playlists')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'playlists' ? 'rgba(124,92,252,0.15)' : 'transparent',
            color: activeTab === 'playlists' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <FolderHeart size={14} />
          <span>Playlists & Favorites</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'history' ? 'rgba(124,92,252,0.15)' : 'transparent',
            color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <History size={14} />
          <span>Play History Log</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'player' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Real-time sync connection banner */}
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(29, 185, 84, 0.05)', border: '1px solid rgba(29, 185, 84, 0.2)',
            borderRadius: '12px', padding: '12px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#1DB954' }}></div>
                <div style={{ 
                  position: 'absolute', top: 0, left: 0, width: '10px', height: '10px', 
                  borderRadius: '50%', background: '#1DB954', transform: 'scale(1.8)', opacity: 0.3,
                  animation: 'pulse 1.5s infinite' 
                }}></div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                Live Stream Connected: <span style={{ color: '#1DB954' }}>{voiceChannelName}</span>
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              <span>{listenersCount} Active VC Listener{listenersCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="dashboard-layout-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            
            {/* Left Column: Player & Search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* NOW PLAYING CARD */}
              <div className="section-panel" style={{ 
                background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.08) 0%, rgba(20, 20, 20, 0.8) 100%)',
                border: '1px solid rgba(29, 185, 84, 0.15)'
              }}>
                <div className="panel-header">
                  <span className="panel-title" style={{ color: '#1DB954', letterSpacing: '1px', fontWeight: 700 }}>
                    ⚡ NOW PLAYING
                  </span>
                  <Disc size={16} className="spin" style={{ color: '#1DB954' }} />
                </div>
                
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0' }}>
                  
                  {currentTrack ? (
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <img 
                        src={currentTrack.thumbnail || 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png'} 
                        alt="Thumbnail" 
                        style={{ 
                          width: '120px', height: '120px', borderRadius: '12px', objectFit: 'cover',
                          boxShadow: '0 8px 24px rgba(29,185,84,0.15)', border: '1px solid rgba(29,185,84,0.2)'
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '8px' }}>
                        <div>
                          <a 
                            href={currentTrack.url} target="_blank" rel="noopener noreferrer"
                            style={{ 
                              fontSize: '18px', fontWeight: 700, color: '#fff', textDecoration: 'none',
                              display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            className="hover-green"
                          >
                            <span>{currentTrack.title}</span>
                            <ExternalLink size={14} />
                          </a>
                          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            by {currentTrack.artist || 'Various Artists'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <span>Platform: <strong style={{ color: '#1DB954' }}>{musicPlayerState?.platform || 'YouTube'}</strong></span>
                          <span>Requested: <strong>@{currentTrack.requester}</strong></span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '40px 20px', textAlign: 'center', display: 'flex', 
                      flexDirection: 'column', alignItems: 'center', gap: '12px' 
                    }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '50%',
                        color: 'var(--text-muted)'
                      }}>
                        <MusicIcon size={32} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>No active audio stream</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Add a song to the queue or search below to start streaming.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar & Durations */}
                  {currentTrack && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {musicPlayerState?.elapsedStr || '00:00'}
                        </span>
                        
                        <div style={{ flex: 1, position: 'relative', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                          {/* We display the text bar state directly or fallback */}
                          <div style={{ 
                            position: 'absolute', top: 0, left: 0, height: '100%', 
                            background: '#1DB954', width: `${musicPlayerState?.bar ? (
                              (musicPlayerState.bar.indexOf('●') / musicPlayerState.bar.length) * 100
                            ) : 0}%`,
                            borderRadius: '2px', boxShadow: '0 0 8px #1DB954'
                          }}></div>
                        </div>

                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {musicPlayerState?.durationStr || '00:00'}
                        </span>
                      </div>
                      {musicPlayerState?.bar && (
                        <div style={{ 
                          textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px',
                          letterSpacing: '1px', userSelect: 'none', fontFamily: 'monospace'
                        }}>
                          {musicPlayerState.bar}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary Controller Interface */}
                  <div style={{ 
                    display: 'flex', justifyContent: 'center', alignItems: 'center', 
                    gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' 
                  }}>
                    <button 
                      onClick={() => handlePlayerAction('prev')}
                      className="btn btn-secondary btn-circle"
                      title="Previous Track"
                      style={{ width: '40px', height: '40px', padding: 0 }}
                    >
                      <SkipBack size={16} />
                    </button>
                    
                    <button 
                      onClick={() => handlePlayerAction(isPaused ? 'resume' : 'pause')}
                      style={{ 
                        background: '#1DB954', color: '#000', border: 'none', 
                        width: '50px', height: '50px', borderRadius: '50%',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,185,84,0.3)',
                        transition: 'transform 0.2s'
                      }}
                      className="hover-scale"
                      title={isPaused ? 'Play' : 'Pause'}
                    >
                      {isPaused ? <Play size={20} fill="#000" /> : <Pause size={20} fill="#000" />}
                    </button>

                    <button 
                      onClick={() => handlePlayerAction('skip')}
                      className="btn btn-secondary btn-circle"
                      title="Skip Track"
                      style={{ width: '40px', height: '40px', padding: 0 }}
                    >
                      <SkipForward size={16} />
                    </button>

                    <button 
                      onClick={() => handlePlayerAction('stop')}
                      className="btn btn-danger btn-circle"
                      title="Stop Playback"
                      style={{ width: '40px', height: '40px', padding: 0 }}
                    >
                      <Square size={16} fill="currentColor" />
                    </button>

                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>

                    {/* Loop Cycle Button */}
                    <button 
                      onClick={() => handlePlayerAction('loop')}
                      className={`btn ${musicPlayerState?.loopMode !== 'off' ? 'btn-success' : 'btn-secondary'} btn-circle`}
                      title={`Loop mode: ${musicPlayerState?.loopMode || 'off'}`}
                      style={{ width: '40px', height: '40px', padding: 0 }}
                    >
                      <Repeat size={16} />
                    </button>
                  </div>

                  {/* Volume Slider Block */}
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px'
                  }}>
                    <Volume2 size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', width: '40px' }}>
                      {volumeLevel}%
                    </span>
                    <input 
                      type="range" min="0" max="200"
                      value={volumeLevel}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: '#1DB954' }}
                    />
                    <button 
                      onClick={() => handlePlayerAction('volume', 100)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Reset 100%
                    </button>
                  </div>

                </div>
              </div>

              {/* SEARCH / PLAY SONG PANEL */}
              <div className="section-panel">
                <div className="panel-header">
                  <span className="panel-title">Add Track to Playback Queue</span>
                  <Plus size={16} color="var(--text-muted)" />
                </div>
                <div className="panel-body">
                  <form onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) handlePlayerAction('play', null, searchQuery); }} style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Search track name, enter YouTube, Spotify, or SoundCloud link..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingRight: '40px', width: '100%' }}
                      />
                      <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ background: '#1DB954', border: 'none', color: '#000', fontWeight: 700 }}>
                      Queue Song
                    </button>
                  </form>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    💡 Tip: Paste a Spotify playlist link to load and queue up to 50 tracks automatically.
                  </p>
                </div>
              </div>

            </div>

            {/* Right Column: DSP Board & Queue list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* DSP BOARD PANEL */}
              <div className="section-panel">
                <div className="panel-header">
                  <span className="panel-title">DSP Audio Effects Board</span>
                  <Sliders size={16} color="var(--accent-primary)" />
                </div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Grid of buttons for filter triggers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {[
                      { key: 'bassboost', label: '🔊 Bass Boost' },
                      { key: 'nightcore', label: '⚡ Nightcore' },
                      { key: '8d', label: '🌀 8D Audio' },
                      { key: 'vaporwave', label: '🌸 Vaporwave' },
                      { key: 'treble', label: '🔔 Treble Boost' },
                      { key: 'reverb', label: '🏰 Reverb' }
                    ].map(f => {
                      const isActive = activeFilters.includes(f.key);
                      return (
                        <button
                          key={f.key}
                          onClick={() => handlePlayerAction('filter', f.key)}
                          className={`btn ${isActive ? 'btn-success' : 'btn-secondary'}`}
                          style={{
                            justifyContent: 'center', fontWeight: 600,
                            border: isActive ? '1px solid #1DB954' : '1px solid transparent',
                            background: isActive ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255,255,255,0.02)',
                            color: isActive ? '#1DB954' : '#fff'
                          }}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Speed & Pitch Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Playback Speed: <strong style={{ color: '#1DB954' }}>{currentSpeed}x</strong></span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handlePlayerAction('speed', Math.max(0.5, currentSpeed - 0.1))} className="btn btn-secondary btn-sm">-0.1</button>
                        <button onClick={() => handlePlayerAction('speed', Math.min(2.0, currentSpeed + 0.1))} className="btn btn-secondary btn-sm">+0.1</button>
                        <button onClick={() => handlePlayerAction('speed', 1.0)} className="btn btn-secondary btn-sm">Reset</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Playback Pitch: <strong style={{ color: '#1DB954' }}>{currentPitch}x</strong></span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handlePlayerAction('pitch', Math.max(0.5, currentPitch - 0.1))} className="btn btn-secondary btn-sm">-0.1</button>
                        <button onClick={() => handlePlayerAction('pitch', Math.min(2.0, currentPitch + 0.1))} className="btn btn-secondary btn-sm">+0.1</button>
                        <button onClick={() => handlePlayerAction('pitch', 1.0)} className="btn btn-secondary btn-sm">Reset</button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ACTIVE PLAYBACK QUEUE PANEL */}
              <div className="section-panel">
                <div className="panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="panel-title">Active Playback Queue</span>
                    <span style={{ 
                      fontSize: '11px', background: 'rgba(255,255,255,0.05)', 
                      padding: '2px 6px', borderRadius: '10px', color: 'var(--text-muted)' 
                    }}>
                      {upcomingQueue.length} song{upcomingQueue.length !== 1 ? 's' : ''} next
                    </span>
                  </div>
                  {upcomingQueue.length > 0 && (
                    <button 
                      onClick={() => handlePlayerAction('clear')}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '4px 8px' }}
                    >
                      <Trash2 size={12} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                
                <div className="panel-body" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upcomingQueue.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Queue is empty. Playback will stop after this song.
                    </div>
                  ) : (
                    upcomingQueue.map((track: any, i: number) => (
                      <div key={i} style={{ 
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: 'rgba(255,255,255,0.02)', padding: '10px',
                        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '20px' }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {track.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            by {track.artist || 'Unknown'} • Req by @{track.requester}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {track.duration}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {activeTab === 'settings' && (
        <div className="dashboard-layout-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Command Interfaces</span>
                <Terminal size={16} color="var(--text-muted)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">Enable Prefix Commands</div>
                    <div className="setting-desc">Execute commands via a custom text prefix (e.g. r!play).</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={prefixEnabled} onChange={(e) => handleUpdate('prefixEnabled', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>

                {prefixEnabled && (
                  <div className="form-group" style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)' }}>
                    <label className="form-label">Custom Music Prefix</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={musicPrefix} 
                      maxLength={5}
                      onChange={(e) => handleUpdate('musicPrefix', e.target.value.replace(/\s/g, ''))}
                    />
                  </div>
                )}

                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">Enable Slash Commands</div>
                    <div className="setting-desc">Register standard Discord /play commands.</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={slashEnabled} onChange={(e) => handleUpdate('slashEnabled', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Playback Tuning</span>
                <Sliders size={16} color="var(--text-muted)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Default Playback Volume
                    <span style={{ color: 'var(--accent-primary)' }}>{defaultVolume}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="200" 
                    value={defaultVolume}
                    onChange={(e) => handleUpdate('defaultVolume', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Queue Buffer Length</label>
                  <input type="number" className="form-input" value={config.maxQueueSize || 500} onChange={(e) => handleUpdate('maxQueueSize', parseInt(e.target.value))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Length per Song (Minutes)</label>
                  <input type="number" className="form-input" value={config.maxSongLength || 60} onChange={(e) => handleUpdate('maxSongLength', parseInt(e.target.value))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Auto-Disconnect Inactive Timeout (Minutes)</label>
                  <input type="number" className="form-input" value={config.autoDisconnectTimer || 5} onChange={(e) => handleUpdate('autoDisconnectTimer', parseInt(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Gating & Channels</span>
                <Hash size={16} color="var(--text-muted)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">DJ Role Gating</label>
                  <select className="form-select" value={config.djRoleId || ''} onChange={(e) => handleUpdate('djRoleId', e.target.value)}>
                    <option value="">None (All members)</option>
                    {registry.roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Default 24/7 Channel</label>
                  <select className="form-select" value={config.defaultMusicChannelId || ''} onChange={(e) => handleUpdate('defaultMusicChannelId', e.target.value)}>
                    <option value="">Dynamic Voice Channels</option>
                    {voiceChannels.map(c => <option key={c.id} value={c.id}>🔊 {c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Music Actions Log Channel</label>
                  <select className="form-select" value={config.musicLogChannelId || ''} onChange={(e) => handleUpdate('musicLogChannelId', e.target.value)}>
                    <option value="">None</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Ecosystem Swappables</span>
                <Settings size={16} color="var(--text-muted)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">24/7 Connectivity Mode</div>
                    <div className="setting-desc">Maintains persistent connection in default VC.</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.twentyFourSevenMode || false} onChange={(e) => handleUpdate('twentyFourSevenMode', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">Autoplay Related Recommendations</div>
                    <div className="setting-desc">Auto-adds matches to active queue.</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.autoplay || false} onChange={(e) => handleUpdate('autoplay', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">Enable Democratic Vote Skip</div>
                    <div className="setting-desc">Requires skip threshold checks.</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.enableVoteSkip || false} onChange={(e) => handleUpdate('enableVoteSkip', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>

                {config.enableVoteSkip && (
                  <div className="form-group" style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)' }}>
                    <label className="form-label">Vote Skip Threshold Percentage</label>
                    <input 
                      type="range" min="1" max="100" 
                      value={voteSkipPercentage}
                      onChange={(e) => handleUpdate('voteSkipPercentage', parseInt(e.target.value))}
                    />
                  </div>
                )}

                <div className="setting-card">
                  <div className="setting-info">
                    <div className="setting-title">Restrict Controls to VC Members</div>
                    <div className="setting-desc">Only users sharing voice channels can interact.</div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={config.restrictToVoiceMembers || false} onChange={(e) => handleUpdate('restrictToVoiceMembers', e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats grid */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="metric-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Total Audio Streams</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.totalStreams}</div>
            </div>
            <div className="metric-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Avg Listening Session</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.avgListeningTime}</div>
            </div>
            <div className="metric-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Active VC Listeners</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent-primary)' }}>{stats.activeListeners}</div>
            </div>
          </div>

          <div className="dashboard-layout-grid">
            {/* Top played tracks */}
            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Most Played Tracks</span>
                <Disc size={16} color="var(--accent-primary)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.mostPlayed.map((song: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-muted)', width: '24px' }}>0{i+1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{song.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{song.artist} • {song.duration}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{song.playCount} plays</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most active users */}
            <div className="section-panel">
              <div className="panel-header">
                <span className="panel-title">Most Active Session Users</span>
                <User size={16} color="var(--accent-primary)" />
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.activeUsers.map((user: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ background: 'var(--accent-primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                      {user.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>@{user.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Guild DJ</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{user.actionCount} songs played</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'playlists' && (
        <div className="dashboard-layout-grid">
          {/* Saved Playlists */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Saved Server Playlists</span>
              <FolderHeart size={16} color="var(--accent-primary)" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Create Playlist Form */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="New Playlist Name..." 
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleCreatePlaylist}>
                  <Plus size={14} />
                  <span>Create</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {playlists.map((pl, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ background: 'rgba(124,92,252,0.15)', padding: '10px', borderRadius: '8px', color: 'var(--accent-primary)' }}>
                      <Disc size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{pl.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Creator: **{pl.creator}** • Tracks: **{pl.trackCount}**</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }}><Play size={12} /></button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '6px' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Favorites List */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Favorite Tracks</span>
              <Heart size={16} color="#EF4444" />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {favorites.map((fav, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px', color: '#EF4444' }}>
                    <Heart size={16} fill="#EF4444" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{fav.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fav.artist} • {fav.duration} • Platform: **{fav.platform}**</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }}><Play size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="section-panel">
          <div className="panel-header">
            <span className="panel-title">Play History Logs</span>
            <History size={16} color="var(--text-muted)" />
          </div>
          <div className="panel-body">
            <table className="whitelist-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Track Title</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Artist</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Duration</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Requester</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Played At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#fff', fontSize: '13px' }}>{h.title}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>{h.artist}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>{h.duration}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>@{h.requester}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: h.platform === 'Spotify' ? 'rgba(29,185,84,0.1)' : h.platform === 'SoundCloud' ? 'rgba(255,85,0,0.1)' : 'rgba(255,0,0,0.1)',
                        color: h.platform === 'Spotify' ? '#1DB954' : h.platform === 'SoundCloud' ? '#FF5500' : '#FF0000'
                      }}>
                        {h.platform}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
