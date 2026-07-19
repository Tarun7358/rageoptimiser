import React, { useState } from 'react';
import { ShieldAlert, Check, BookOpen, AlertTriangle } from 'lucide-react';
import { useAlertStore } from '../stores/alertStore.js';
import { StatusBadge } from '../components/StatusBadge/index.js';

export const AlertsView: React.FC = () => {
  const { alerts, acknowledgeAlert, resolveAlert } = useAlertStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            OPERATIONAL ALERTS CONTROL ({alerts.length})
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Manage and acknowledge system resource, gateway disconnect, or anti-nuke triggers
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-900/60 border border-slate-800 p-1 rounded-lg">
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
                filter === tab
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20 font-semibold'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl">
            No incidents reported.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.alertId}
              className={`p-4 rounded-xl border font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                alert.status === 'resolved'
                  ? 'bg-slate-900/10 border-slate-900/40 text-slate-400'
                  : alert.status === 'acknowledged'
                  ? 'bg-amber-950/5 border-amber-900/20 text-slate-300'
                  : 'bg-red-950/5 border-red-900/20 text-slate-200'
              }`}
            >
              {/* Alert Left Details */}
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg border flex-shrink-0 mt-0.5 ${
                    alert.severity === 'EMERGENCY'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200">{alert.title}</span>
                    <StatusBadge status={alert.status} />
                    <span className="text-[9px] text-slate-500">ID: {alert.alertId}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{alert.description}</p>
                  <div className="text-[9px] text-slate-500 flex gap-4 pt-1 flex-wrap">
                    <span>Severity: {alert.severity}</span>
                    <span>Module: {alert.sourceModule}</span>
                    <span>Received: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {alert.resolvedAt && (
                      <span>Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Right Buttons */}
              <div className="flex items-center space-x-2 self-end md:self-auto flex-shrink-0">
                {alert.status === 'active' && (
                  <button
                    onClick={() => acknowledgeAlert(alert.alertId)}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-mono font-semibold transition-all flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    ACKNOWLEDGE
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button
                    onClick={() => resolveAlert(alert.alertId)}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-mono font-semibold transition-all flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    RESOLVE
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default AlertsView;
