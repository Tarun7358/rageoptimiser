import React from 'react';
import { 
  Volume2, ShieldAlert, Award, Clock, ArrowUpRight, 
  Settings2, CheckCircle2, AlertTriangle, Radio, RefreshCw, Zap
} from 'lucide-react';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';
import { StatusBadge } from '../components/StatusBadge';

interface VoicePresenceProps {
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
  syncLogs: Array<{ time: string; msg: string; type: 'info' | 'warn' | 'success' }>;
  onNavigate: (page: string, tab?: string) => void;
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

export function VoicePresence({ modules, registry, syncLogs, onNavigate, onUpdateConfig }: VoicePresenceProps) {
  const voiceModule = (modules || []).find(m => m.id === 'voice') || { status: 'disabled', config: {} } as any;
  const voiceConfig = voiceModule.config || {};
  
  const connectionStatus = (voiceModule as any).connectionStatus || 'disconnected';
  const connectedChannelId = (voiceModule as any).connectedChannelId || null;
  const connectionDuration = (voiceModule as any).connectionDuration || '0s';
  const reconnectAttempts = (voiceModule as any).reconnectAttempts || 0;
  const voiceGatewayStatus = (voiceModule as any).voiceGatewayStatus || 'healthy';

  const targetChannelName = connectedChannelId
    ? (registry.channels?.find((c: any) => c.id === connectedChannelId)?.name || 'Unknown Channel')
    : 'None';

  // Filter logs relating to voice presence connection
  const voiceLogs = syncLogs.filter(log => 
    log.msg.toLowerCase().includes('voice') || 
    log.msg.toLowerCase().includes('disconnect') ||
    log.msg.toLowerCase().includes('reconnect')
  );

  const handleToggleEnable = () => {
    if (!voiceModule) return;
    const nextEnabled = voiceModule.status !== 'enabled';
    onUpdateConfig('voice', {}, nextEnabled);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Voice Presence Monitor</h1>
            <p className="page-subtitle">Real-time persistent voice connection stream, active gateway status, and channel heartbeat telemetry.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('settings', 'voice_presence')} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings2 size={14} />
              <span>Configure Presence</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: `4px solid ${connectionStatus === 'connected' ? 'var(--color-success)' : 'var(--border-color)'}` }}>
          <div className="stat-header">
            <span>Connection State</span>
            <Radio size={18} color={connectionStatus === 'connected' ? 'var(--color-success)' : 'var(--text-muted)'} />
          </div>
          <span className="stat-value">{connectionStatus.toUpperCase()}</span>
          <div className="stat-footer">
            <span className="stat-trend up">{voiceModule.status === 'enabled' ? 'Active Policy' : 'Disabled'}</span>
            <span style={{ color: 'var(--text-muted)' }}>• presence service status</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Active Voice Channel</span>
            <Volume2 size={18} color="var(--accent-primary)" />
          </div>
          <span className="stat-value" style={{ fontSize: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {targetChannelName !== 'None' ? `🔊 ${targetChannelName}` : 'None'}
          </span>
          <div className="stat-footer">
            <span className="stat-trend neutral">Configured Target</span>
            <span style={{ color: 'var(--text-muted)' }}>• live channel binding</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Session Duration</span>
            <Clock size={18} color="var(--accent-purple)" />
          </div>
          <span className="stat-value">{connectionDuration}</span>
          <div className="stat-footer">
            <span className="stat-trend up">24/7 Presence</span>
            <span style={{ color: 'var(--text-muted)' }}>• continuous connected time</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Gateway Health</span>
            <CheckCircle2 size={18} color={voiceGatewayStatus === 'healthy' ? 'var(--color-success)' : 'var(--color-danger)'} />
          </div>
          <span className="stat-value" style={{ color: voiceGatewayStatus === 'healthy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {voiceGatewayStatus.toUpperCase()}
          </span>
          <div className="stat-footer">
            <span className="stat-trend neutral">Retries: {reconnectAttempts}</span>
            <span style={{ color: 'var(--text-muted)' }}>• gateway server shards</span>
          </div>
        </div>
      </div>

      {/* Main content split */}
      <div className="dashboard-layout-grid">
        
        {/* Left Side: Voice Connection Event Timeline */}
        <div className="section-panel">
          <div className="panel-header">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--accent-primary)" />
              <span>Voice Gateway Heartbeat Logs</span>
            </span>
          </div>
          <div className="panel-body" style={{ padding: '0', maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Time</th>
                    <th>Log Description</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {voiceLogs.length > 0 ? (
                    voiceLogs.map((log, index) => (
                      <tr key={index}>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.time}</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{log.msg}</td>
                        <td style={{ textAlign: 'right' }}>
                          <StatusBadge status={log.type} label={log.type} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No voice presence logs recorded yet. Tweak settings to activate connection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Telemetry details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Settings Parameters checklist */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Active Settings Shards</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Auto-Join on Boot</span>
                <span style={{ fontWeight: 600, color: voiceConfig.autoJoin !== false ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {voiceConfig.autoJoin !== false ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Auto-Reconnect policy</span>
                <span style={{ fontWeight: 600, color: voiceConfig.autoReconnect !== false ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {voiceConfig.autoReconnect !== false ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Reconnect Delay interval</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {voiceConfig.reconnectDelay || 5000} ms
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Maximum Retry Attempts</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {voiceConfig.maxRetries || 5}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Presence Activity status</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {voiceConfig.activityStatus || 'Not Configured'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick instructions alert block */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(79, 140, 255, 0.03)',
            border: '1px dashed rgba(79, 140, 255, 0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>💡 Persistent Voice Info</p>
            Make sure RAGE OPTIMISER has <strong>View Channel</strong> and <strong>Connect</strong> permissions inside the target voice channel. Disconnection heartbeats are self-healing.
          </div>

        </div>

      </div>

    </div>
  );
}
