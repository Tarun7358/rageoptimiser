import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  loading = false,
}) => {
  return (
    <div className="panel-glass rounded-xl p-5 border border-slate-800/40 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          {loading ? (
            <div className="h-8 w-24 bg-slate-800/50 animate-pulse rounded mt-1" />
          ) : (
            <h3 className="text-2xl font-bold mt-1 text-slate-100 font-mono tracking-tight">{value}</h3>
          )}
        </div>
        <div className="p-2.5 bg-slate-800/50 rounded-lg text-blue-400 border border-slate-700/30 group-hover:text-blue-300 group-hover:border-blue-500/20 transition-all duration-200">
          {icon}
        </div>
      </div>
      {(description || trend) && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/60 text-xs">
          {description && <span className="text-slate-500 font-medium">{description}</span>}
          {trend && (
            <span
              className={`font-mono font-semibold flex items-center ${
                trend.isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend.isPositive ? '▲' : '▼'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
export default MetricCard;
