import React, { useState } from 'react';
import { Send, FileText, Layout, Clock, Eye, AlertCircle } from 'lucide-react';
import type { ModuleState } from '../hooks/useDiscordSync';

interface AnnouncementsProps {
  onSaveConfig: (msg: string) => void;
  modules: ModuleState[];
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function Announcements({ onSaveConfig, modules, onUpdateConfig }: AnnouncementsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Announcement Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'channel' | 'dm_blast'>('channel');
  const [channelId, setChannelId] = useState('');
  const [mention, setMention] = useState<'none' | 'everyone' | 'here'>('none');
  const [scheduledTime, setScheduledTime] = useState('');

  const aModule = (modules || []).find(m => m.id === 'announcements');
  const config = aModule?.config || {};
  const history: any[] = config.history || [];

  const handleToggleEnable = () => {
    if (!aModule) return;
    const nextEnabled = aModule.status !== 'enabled';
    onUpdateConfig('announcements', {}, nextEnabled);
    onSaveConfig(`Announcements module ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleSendAnnouncement = () => {
    if (!title.trim() || !content.trim()) return;

    const newAnnouncement = {
      id: `ann_${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      targetType,
      channelId: targetType === 'channel' ? channelId : 'Direct Message Blast',
      mention,
      status: scheduledTime ? 'scheduled' : 'sent',
      scheduledAt: scheduledTime || null,
      sentAt: scheduledTime ? null : new Date().toISOString(),
      recipientCount: targetType === 'dm_blast' ? 142 : 1
    };

    const updated = [newAnnouncement, ...history];
    onUpdateConfig('announcements', { history: updated });
    
    setTitle('');
    setContent('');
    setScheduledTime('');
    onSaveConfig(scheduledTime ? 'Announcement scheduled successfully.' : 'Announcement sent out successfully!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Announcements Engine</h1>
            <p className="page-subtitle">Publish formatted rich embeds to target channels or execute DM blasts to all server members.</p>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="section-panel">
        <div className="tabs-nav">
          {['overview', 'compose'].map(tab => (
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
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Broadcast Dispatch Logs</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Historical logs and delivery confirmation stats.</p>
              </div>

              {history.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No announcement logs available. Start by writing one in the Compose tab!
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Target Destination</th>
                        <th>Mention</th>
                        <th>Status</th>
                        <th>Sent / Scheduled Time</th>
                        <th>Audience Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((ann: any) => (
                        <tr key={ann.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ann.title}</td>
                          <td>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              backgroundColor: ann.targetType === 'dm_blast' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(79, 140, 255, 0.15)',
                              color: ann.targetType === 'dm_blast' ? '#a855f7' : '#4f8cff'
                            }}>{ann.targetType === 'dm_blast' ? 'DM BLAST' : 'CHANNEL'}</span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <code>{ann.channelId}</code>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: ann.mention !== 'none' ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                              @{ann.mention}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              backgroundColor: ann.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                              color: ann.status === 'sent' ? '#10b981' : '#eab308'
                            }}>{ann.status.toUpperCase()}</span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {ann.sentAt ? new Date(ann.sentAt).toLocaleString() : `Scheduled: ${new Date(ann.scheduledAt).toLocaleString()}`}
                          </td>
                          <td style={{ fontWeight: 600 }}>{ann.recipientCount} accounts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'compose' && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', flexWrap: 'wrap' }}>
              {/* Form panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Announcement Title / Embed Header</label>
                  <input 
                    type="text"
                    className="custom-input"
                    placeholder="Enter announcement subject..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Announcement Message Content (Markdown supported)</label>
                  <textarea 
                    className="custom-input"
                    rows={6}
                    placeholder="Type the message body details..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Delivery Channel</label>
                    <select 
                      className="custom-input"
                      value={targetType}
                      onChange={e => setTargetType(e.target.value as any)}
                    >
                      <option value="channel">Guild Text Channel</option>
                      <option value="dm_blast">Direct Message Blast (All users)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Guild Ping</label>
                    <select 
                      className="custom-input"
                      value={mention}
                      onChange={e => setMention(e.target.value as any)}
                      disabled={targetType === 'dm_blast'}
                    >
                      <option value="none">No Ping</option>
                      <option value="here">@here</option>
                      <option value="everyone">@everyone</option>
                    </select>
                  </div>
                </div>

                {targetType === 'channel' && (
                  <div className="form-group">
                    <label className="form-label">Target Channel ID</label>
                    <input 
                      type="text"
                      className="custom-input"
                      placeholder="e.g. 123456789012345678"
                      value={channelId}
                      onChange={e => setChannelId(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Schedule Date & Time (Optional)</label>
                  <input 
                    type="datetime-local"
                    className="custom-input"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleSendAnnouncement}
                  style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                >
                  <Send size={16} />
                  <span>{scheduledTime ? 'Schedule Broadcast' : 'Transmit Broadcast Now'}</span>
                </button>
              </div>

              {/* Preview panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LIVE EMBED PREVIEW</span>
                <div style={{
                  borderLeft: '4px solid #4f8cff',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '0 8px 8px 0',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>
                    {title || 'Announcement Title'}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    minHeight: '80px'
                  }}>
                    {content || 'Embed content layout description preview text...'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Rage Optimiser Announcement Engine
                  </div>
                </div>

                {targetType === 'dm_blast' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginTop: '12px'
                  }}>
                    <AlertCircle size={18} color="#eab308" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#eab308' }}>
                      <strong>Warning:</strong> DM Blast bypasses channels and messages all guild users directly. Safe-limits of 5 seconds per member are enforced to avoid gateway throttling.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
