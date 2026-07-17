import { API_BASE } from './config';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Intercept HTTP fetches and WebSockets to redirect hardcoded localhost ports to environment-aware configurations
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && input.startsWith(`${API_BASE}`)) {
    const apiBase = (import.meta.env.VITE_API_URL as string) || (import.meta.env.PROD ? '' : `${API_BASE}`);
    input = input.replace(`${API_BASE}`, apiBase);
  }
  return originalFetch.call(this, input, init);
};

const OriginalWebSocket = window.WebSocket;
// @ts-ignore
window.WebSocket = function (url, protocols) {
  if (typeof url === 'string' && url.startsWith('ws://localhost:5001')) {
    const wsBase = (import.meta.env.VITE_WS_URL as string) || (import.meta.env.PROD 
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws` 
      : 'ws://localhost:5001');
    url = url.replace('ws://localhost:5001', wsBase);
  }
  return new OriginalWebSocket(url, protocols);
};
window.WebSocket.prototype = OriginalWebSocket.prototype;
// @ts-ignore
window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
// @ts-ignore
window.WebSocket.OPEN = OriginalWebSocket.OPEN;
// @ts-ignore
window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
// @ts-ignore
window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;


import React from 'react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <React.Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-[#0B0F19] text-[#94A3B8] font-sans">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
              <div className="text-sm font-medium tracking-wide">Loading Rage Optimiser...</div>
            </div>
          </div>
        }>
          <App />
        </React.Suspense>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
