import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Intercept HTTP fetches and WebSockets in production to redirect localhost ports to relative/proxied server paths
if (import.meta.env.PROD) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('http://localhost:5000')) {
      input = input.replace('http://localhost:5000', '');
    }
    return originalFetch.call(this, input, init);
  };

  const OriginalWebSocket = window.WebSocket;
  // @ts-ignore
  window.WebSocket = function (url, protocols) {
    if (typeof url === 'string' && url.startsWith('ws://localhost:5001')) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      url = url.replace('ws://localhost:5001', `${wsProtocol}//${wsHost}/ws`);
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
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
