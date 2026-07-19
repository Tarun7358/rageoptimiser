import React from 'react';

interface HealthCardProps {
  title: string;
  value: number; // Percentage 0 - 100
  label: string;
  detail?: string;
  color?: 'emerald' | 'amber' | 'red' | 'blue';
}

export const HealthCard: React.FC<HealthCardProps> = ({
  title,
  value,
  label,
  detail,
  color,
}) => {
  const getThemeColor = () => {
    if (color) return color;
    if (value > 85) return 'red';
    if (value > 70) return 'amber';
    return 'emerald';
  };

  const activeColor = getThemeColor();

  const progressColors = {
    emerald: 'bg-emerald-500 shadow-emerald-500/20',
    amber: 'bg-amber-500 shadow-amber-500/20',
    red: 'bg-red-500 shadow-red-500/20',
    blue: 'bg-blue-500 shadow-blue-500/20',
  };

  const textColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="panel-glass rounded-xl p-4 border border-slate-800/40">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <span className={`text-sm font-bold font-mono ${textColors[activeColor]}`}>{label}</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressColors[activeColor]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>

      {detail && (
        <div className="mt-2 text-right">
          <span className="text-[10px] text-slate-500 font-mono">{detail}</span>
        </div>
      )}
    </div>
  );
};
export default HealthCard;
