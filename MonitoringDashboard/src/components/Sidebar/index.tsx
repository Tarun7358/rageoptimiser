import React, { useState } from 'react';
import { LayoutDashboard, Server, AlertTriangle, BarChart3, ScrollText, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

export type DashboardTab = 'dashboard' | 'servers' | 'alerts' | 'analytics' | 'logs' | 'settings';

interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

interface SidebarItem {
  id: DashboardTab;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'servers', label: 'Servers', icon: <Server className="w-4 h-4" /> },
    { id: 'alerts', label: 'Active Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'analytics', label: 'Realtime charts', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'logs', label: 'Historical logs', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'settings', label: 'Console Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside
      className={`border-r border-slate-800/80 bg-slate-950/40 backdrop-blur-md flex flex-col transition-all duration-300 relative select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Collapse button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-4 -right-3.5 w-7 h-7 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-lg"
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center p-3 rounded-lg text-xs font-mono transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 font-semibold shadow-inner'
                  : 'border border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-300'
              } ${isCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-900 flex flex-col items-center justify-center font-mono text-[9px] text-slate-600">
        {!isCollapsed && (
          <>
            <span>AGENT INTEGRATION: v1.0.0</span>
            <span className="mt-0.5">CLI: STABLE</span>
          </>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
