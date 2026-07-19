import React from 'react';
import { Filter, X, Search } from 'lucide-react';
import { useConsoleStore } from '../../stores/consoleStore.js';
import type { EventCategory, SeverityLevel } from '../../types/protocol.js';

const SEVERITIES: SeverityLevel[] = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL', 'EMERGENCY'];
const CATEGORIES: EventCategory[] = ['SYSTEM', 'DISCORD', 'GATEWAY', 'DATABASE', 'COMMAND', 'MUSIC', 'SECURITY', 'TICKETS'];

export const ConsoleFilters: React.FC = () => {
  const {
    searchQuery,
    selectedCategories,
    selectedSeverities,
    setSearchQuery,
    toggleCategory,
    toggleSeverity,
    clearFilters,
  } = useConsoleStore();

  const activeFiltersCount = selectedCategories.size + selectedSeverities.size + (searchQuery ? 1 : 0);

  return (
    <div className="space-y-4 p-4 border-b border-slate-800/80 bg-slate-900/10">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            placeholder="Search operational events (e.g. anti-nuke)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clear Filters Button */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <Filter className="w-3.5 h-3.5" />
            Clear ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Severity Badges Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase font-semibold text-slate-500 mr-2 tracking-wider">Severity:</span>
        {SEVERITIES.map((sev) => {
          const isActive = selectedSeverities.has(sev);
          return (
            <button
              key={sev}
              onClick={() => toggleSeverity(sev)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all duration-150 ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-semibold'
                  : 'bg-slate-950/20 text-slate-500 border-slate-800/50 hover:border-slate-700/50 hover:text-slate-400'
              }`}
            >
              {sev}
            </button>
          );
        })}
      </div>

      {/* Category Badges Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase font-semibold text-slate-500 mr-2 tracking-wider">Category:</span>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all duration-150 ${
                isActive
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-semibold'
                  : 'bg-slate-950/20 text-slate-500 border-slate-800/50 hover:border-slate-700/50 hover:text-slate-400'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default ConsoleFilters;
