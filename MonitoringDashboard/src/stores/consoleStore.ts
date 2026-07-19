import { create } from 'zustand';
import type { TelemetryEvent, EventCategory, SeverityLevel } from '../types/protocol.js';

interface ConsoleState {
  events: TelemetryEvent[];
  pinnedEvents: TelemetryEvent[];
  searchQuery: string;
  selectedCategories: Set<EventCategory>;
  selectedSeverities: Set<SeverityLevel>;
  isPaused: boolean;
  addEvent: (event: TelemetryEvent) => void;
  togglePin: (eventId: string) => void;
  setPaused: (paused: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleCategory: (category: EventCategory) => void;
  toggleSeverity: (severity: SeverityLevel) => void;
  clearConsole: () => void;
  clearFilters: () => void;
  getFilteredEvents: () => TelemetryEvent[];
}

const MAX_EVENTS_BUFFER = 10000;

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  events: [],
  pinnedEvents: [],
  searchQuery: '',
  selectedCategories: new Set<EventCategory>(),
  selectedSeverities: new Set<SeverityLevel>(),
  isPaused: false,
  addEvent: (event) => {
    const { isPaused } = get();
    if (isPaused) return;

    set((state) => {
      const updatedEvents = [event, ...state.events];
      if (updatedEvents.length > MAX_EVENTS_BUFFER) {
        updatedEvents.pop(); // Bounded buffer
      }
      return { events: updatedEvents };
    });
  },
  togglePin: (eventId) => {
    set((state) => {
      const isPinned = state.pinnedEvents.some((e) => e.eventId === eventId);
      if (isPinned) {
        return {
          pinnedEvents: state.pinnedEvents.filter((e) => e.eventId !== eventId),
          events: state.events.map((e) => (e.eventId === eventId ? { ...e, isPinned: false } : e)),
        };
      } else {
        const eventToPin = state.events.find((e) => e.eventId === eventId);
        if (!eventToPin) return {};
        const pinned = { ...eventToPin, isPinned: true };
        return {
          pinnedEvents: [...state.pinnedEvents, pinned],
          events: state.events.map((e) => (e.eventId === eventId ? { ...e, isPinned: true } : e)),
        };
      }
    });
  },
  setPaused: (paused) => set({ isPaused: paused }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleCategory: (category) => {
    set((state) => {
      const categories = new Set(state.selectedCategories);
      if (categories.has(category)) {
        categories.delete(category);
      } else {
        categories.add(category);
      }
      return { selectedCategories: categories };
    });
  },
  toggleSeverity: (severity) => {
    set((state) => {
      const severities = new Set(state.selectedSeverities);
      if (severities.has(severity)) {
        severities.delete(severity);
      } else {
        severities.add(severity);
      }
      return { selectedSeverities: severities };
    });
  },
  clearConsole: () => set({ events: [], pinnedEvents: [] }),
  clearFilters: () => set({ selectedCategories: new Set(), selectedSeverities: new Set(), searchQuery: '' }),
  getFilteredEvents: () => {
    const { events, searchQuery, selectedCategories, selectedSeverities } = get();
    return events.filter((e) => {
      // Category filter
      if (selectedCategories.size > 0 && !selectedCategories.has(e.category)) {
        return false;
      }
      // Severity filter
      if (selectedSeverities.size > 0 && !selectedSeverities.has(e.severity)) {
        return false;
      }
      // Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          e.description.toLowerCase().includes(query) ||
          e.action.toLowerCase().includes(query) ||
          e.sourceModule.toLowerCase().includes(query) ||
          (e.guildName && e.guildName.toLowerCase().includes(query)) ||
          e.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  },
}));
