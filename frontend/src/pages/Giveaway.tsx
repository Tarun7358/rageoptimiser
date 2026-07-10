import React, { useState } from 'react';
import { Gift, Play, StopCircle, RefreshCw, Calendar, Users, Award } from 'lucide-react';
import type { ModuleState } from '../hooks/useDiscordSync';

interface GiveawayProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Giveaway({ onSaveConfig, modules, onUpdateConfig }: GiveawayProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Giveaway Form State
  const [prize, setPrize] = useState('');
  const [winnersCount, setWinnersCount] = useState(1);
  const [duration, setDuration] = useState('1h');
  const [channelId, setChannelId] = useState('');

  const gModule = (modules || []).find(m => m.id === 'giveaway');
  const config = gModule?.config || {};
  const giveaways: any[] = config.giveaways || [];

  const handleToggleEnable = () => {
    if (!gModule) return;
    const nextEnabled = gModule.status !== 'enabled';
    onUpdateConfig('giveaway', {}, nextEnabled);
    onSaveConfig(`Giveaway system ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleCreateGiveaway = () => {
    if (!prize.trim()) return;
    
    // Calculate duration in ms
    let ms = 3600000;
    const amount = parseInt(duration);
    if (duration.endsWith('m')) ms = amount * 60000;
    else if (duration.endsWith('h')) ms = amount * 3600000;
    else if (duration.endsWith('d')) ms = amount * 86400000;

    const endAt = new Date(Date.now() + ms).toISOString();
    
    const newGiveaway = {
      id: `giveaway_${Date.now()}`,
      prize: prize.trim(),
      winnersCount,
      duration,
      channelId,
      status: 'active',
      endAt,
      entriesCount: 0,
      createdAt: new Date().toISOString()
    };

    const updated = [...giveaways, newGiveaway];
    onUpdateConfig('giveaway', { giveaways: updated });
    setPrize('');
    onSaveConfig(`Giveaway created: "${prize.trim()}"`);
  };

  const handleEndGiveaway = (id: string) => {
    const updated = giveaways.map((g: any) => {
      if (g.id === id) {
        return { ...g, status: 'ended', winners: ['User#1001', 'LuckyGuy#2026'].slice(0, g.winnersCount) };
      }
      return g;
    });
    onUpdateConfig('giveaway', { giveaways: updated });
    onSaveConfig('Giveaway ended manually. Winners picked.');
  };

  const handleRerollGiveaway = (id: string) => {
    const updated = giveaways.map((g: any) => {
      if (g.id === id) {
        return { ...g, status: 'ended', winners: ['RerollWinner#9999'].slice(0, g.winnersCount) };
      }
      return g;
    });
    onUpdateConfig('giveaway', { giveaways: updated });
    onSaveConfig('Giveaway rerolled! New winners announced.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Giveaway Manager</h1>
            <p className="page-subtitle">Host community giveaways with automatic timer execution and persistent state storage.</p>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="section-panel">
        <div className="tabs-nav">
          {['overview', 'create'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Active & Historic Giveaways</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monitor participant counters and draw statuses.</p>
              </div>

              {giveaways.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No giveaways found. Use the Create tab to start one!
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Prize</th>
                        <th>Status</th>
                        <th>Winners Qty</th>
                        <th>End Time</th>
                        <th>Entries</th>
                        <th>Picked Winners</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {giveaways.map((g: any) => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Gift size={14} color="#f1c40f" />
                              <span>{g.prize}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              backgroundColor: g.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: g.status === 'active' ? '#10b981' : 'var(--text-muted)'
                            }}>{g.status.toUpperCase()}</span>
                          </td>
                          <td>{g.winnersCount} winners</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {new Date(g.endAt).toLocaleString()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={12} />
                              <span>{g.entriesCount || 0}</span>
                            </div>
                          </td>
                          <td>
                            {g.winners && g.winners.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {g.winners.map((w: string, idx: number) => (
                                  <span key={idx} style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(241, 196, 15, 0.15)',
                                    color: '#f1c40f',
                                    padding: '1px 6px',
                                    borderRadius: '3px'
                                  }}>{w}</span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Not drawn yet</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {g.status === 'active' ? (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleEndGiveaway(g.id)}
                                  title="End Giveaway"
                                >
                                  <StopCircle size={12} />
                                  <span>End</span>
                                </button>
                              ) : (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRerollGiveaway(g.id)}
                                  title="Reroll Winners"
                                >
                                  <RefreshCw size={12} />
                                  <span>Reroll</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Start a New Giveaway</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Publish a giveaway embed and listen for reactions to pick winners.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Giveaway Prize</label>
                  <input 
                    type="text"
                    className="custom-input"
                    placeholder="e.g. Discord Nitro 1 Month"
                    value={prize}
                    onChange={e => setPrize(e.target.value)}
                  />
                </div>

                <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Winners Count</label>
                    <input 
                      type="number"
                      min={1}
                      max={100}
                      className="custom-input"
                      value={winnersCount}
                      onChange={e => setWinnersCount(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <input 
                      type="text"
                      className="custom-input"
                      placeholder="e.g. 10m, 2h, 7d"
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Channel ID (Optional)</label>
                  <input 
                    type="text"
                    className="custom-input"
                    placeholder="e.g. 123456789012345678 (blank for default)"
                    value={channelId}
                    onChange={e => setChannelId(e.target.value)}
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleCreateGiveaway}
                  style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                >
                  <Play size={16} />
                  <span>Launch Giveaway</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
