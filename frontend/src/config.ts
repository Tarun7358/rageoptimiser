/**
 * M-1 FIX: Centralised API URL configuration.
 * Use VITE_API_URL / VITE_WS_URL env vars so the app works in any environment.
 * Falls back to localhost for local development.
 */
export const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000';
export const WS_BASE  = (import.meta.env.VITE_WS_URL  as string) || 'ws://localhost:5001';

/** Build an API endpoint URL */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
