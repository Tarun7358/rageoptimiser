import { useState, useCallback, useRef, useEffect } from 'react';

export function useStateHistory<T>(initialState: T, onAutoSave?: (state: T) => void, autoSaveDelayMs: number = 3000) {
  const [history, setHistory] = useState<T[]>([JSON.parse(JSON.stringify(initialState))]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoSaveTimerRef = useRef<any | null>(null);

  const state = history[currentIndex];

  const pushState = useCallback((newState: T) => {
    // Deep copy to prevent mutating history states
    const copy = JSON.parse(JSON.stringify(newState));
    setHistory(prev => {
      const nextHistory = prev.slice(0, currentIndex + 1);
      return [...nextHistory, copy];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, history]);

  const reset = useCallback((newState: T) => {
    const copy = JSON.parse(JSON.stringify(newState));
    setHistory([copy]);
    setCurrentIndex(0);
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  // Auto-save debounced handler
  useEffect(() => {
    if (!onAutoSave) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      onAutoSave(state);
    }, autoSaveDelayMs);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [state, onAutoSave, autoSaveDelayMs]);

  return {
    state,
    pushState,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    history,
    currentIndex
  };
}
