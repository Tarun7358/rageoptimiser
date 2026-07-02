import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, HelpCircle, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import type { ModuleState, DiscordResourceRegistry } from '../hooks/useDiscordSync';
import { StatusBadge } from '../components/StatusBadge';

interface ConfigHealthProps {
  modules: ModuleState[];
  registry: DiscordResourceRegistry;
  syncLogs: { time: string; msg: string; type: 'info' | 'warn' | 'success' }[];
  onRefreshSync: () => void;
  onNavigate: (page: string, tab?: string) => void;
  onSimulateAction: (actionType: 'delete_role' | 'delete_channel' | 'rename_channel' | 'create_role') => void;
}

export function ConfigHealth({
  modules,
  registry,
  syncLogs,
  onRefreshSync,
  onNavigate,
  onSimulateAction
}: ConfigHealthProps) {
  
  // Calculate average completion
  const totalProgress = (modules || []).reduce((acc, m) => acc + (m?.progress || 0), 0);
  const averageProgress = modules?.length ? Math.round(totalProgress / modules.length) : 0;

  // Compile active validation errors
  const activeErrors = (modules || []).reduce<{ moduleName: string; moduleId: string; error: string }[]>((acc, m) => {
    (m.errors || []).forEach(err => acc.push({ moduleName: m.name, moduleId: m.id, error: err }));
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Configuration & Health</h1>
            <p className="page-subtitle">Inspect dynamic bindings, resolve validation conflicts, and monitor live Discord sync feeds.</p>
          </div>
          <button className="btn btn-secondary" onClick={onRefreshSync}>
            <RefreshCw size={14} />
            <span>Force Sync Query</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="stats-grid">
        
        {/* Completion Card */}
        <div className="stat-card">
          <div className="stat-header">
            <span>Global Setup Status</span>
            <ShieldCheck size={18} color="var(--accent-primary)" />
          </div>
          <span className="stat-value">{averageProgress}%</span>
          <div className="stat-footer">
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ width: `${averageProgress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Modules Configured vs Awaiting */}
        <div className="stat-card">
          <div className="stat-header">
            <span>Configured Modules</span>
            <CheckCircle size={18} color="var(--color-success)" />
          </div>
          <span className="stat-value">
            {modules.filter(m => m.status === 'enabled' || m.status === 'ready').length} / {modules.length}
          </span>
          <div className="stat-footer">
            <span style={{ color: 'var(--text-muted)' }}>
              {modules.filter(m => m.status === 'config_required' || m.status === 'validation_failed').length} awaiting settings
            </span>
          </div>
        </div>

        {/* Validation Errors Count */}
        <div className="stat-card">
          <div className="stat-header">
            <span>Active Warnings</span>
            <AlertTriangle size={18} color={activeErrors.length > 0 ? 'var(--color-danger)' : 'var(--text-muted)'} />
          </div>
          <span className="stat-value" style={{ color: activeErrors.length > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
            {activeErrors.length}
          </span>
          <div className="stat-footer">
            <span style={{ color: 'var(--text-muted)' }}>
              {activeErrors.length > 0 ? 'Requires immediate action' : 'All bindings healthy'}
            </span>
          </div>
        </div>

      </div>

      {/* Split layout */}
      <div className="dashboard-layout-grid">
        
        {/* Left column: Modules setup lists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Operational Module Matrix</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Module Name</th>
                      <th>Setup Progress</th>
                      <th>Lifecycle Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(mod => (
                      <tr key={mod.id}>
                        <td style={{ fontWeight: 600 }}>{mod.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, width: '32px' }}>{mod.progress}%</span>
                            <div style={{ width: '80px', height: '4px', backgroundColor: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${mod.progress}%`, height: '100%', backgroundColor: mod.progress === 100 ? 'var(--color-success)' : 'var(--accent-primary)' }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge 
                            status={
                              mod.status === 'enabled' ? 'success' : 
                              mod.status === 'ready' ? 'info' : 
                              mod.status === 'validation_failed' ? 'danger' : 'warning'
                            } 
                            label={
                              mod.status === 'enabled' ? 'Active & Monitoring' :
                              mod.status === 'ready' ? 'Ready to Enable' :
                              mod.status === 'validation_failed' ? 'Validation Failed' : 'Config Required'
                            }
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(mod.id)}>
                            <span>Configure</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Conflict resolver logs */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Validation Warning Logs</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeErrors.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No validation logs generated. Server mappings are fully verified.
                </div>
              ) : (
                activeErrors.map((err, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      justifyContent: 'space-between', 
                      padding: '12px 16px', 
                      border: '1px solid rgba(239, 68, 68, 0.15)', 
                      backgroundColor: 'rgba(239, 68, 68, 0.03)', 
                      borderRadius: '8px' 
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} color="var(--color-danger)" style={{ marginTop: '2px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{err.moduleName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{err.error}</div>
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(err.moduleId)}>
                      Resolve
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right column: Live Discord synchronization monitor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          


          {/* Sync logs feed */}
          <div className="section-panel">
            <div className="panel-header">
              <span className="panel-title">Live Sync Logs</span>
              <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>GATEWAY ACTIVE</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
              {syncLogs.map((log, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: log.type === 'warn' ? 'var(--color-danger)' : log.type === 'success' ? 'var(--color-success)' : 'var(--text-primary)', flex: 1, marginRight: '10px' }}>
                    {log.msg}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
