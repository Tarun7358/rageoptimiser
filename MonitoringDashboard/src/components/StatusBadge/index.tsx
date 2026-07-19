import React from 'react';

interface StatusBadgeProps {
  status: 'healthy' | 'warning' | 'degraded' | 'error' | 'connected' | 'disconnected' | 'online' | 'offline' | 'unconfigured' | 'active' | 'acknowledged' | 'resolved' | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStyles = () => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'online':
      case 'resolved':
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 glow-green';
      case 'warning':
      case 'acknowledged':
      case 'notice':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20 glow-yellow';
      case 'degraded':
      case 'offline':
      case 'error':
      case 'disconnected':
      case 'active':
      case 'critical':
      case 'emergency':
        return 'bg-red-500/10 text-red-400 border-red-500/20 glow-red';
      case 'unconfigured':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${getStyles()} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      {label}
    </span>
  );
};
export default StatusBadge;
