import React, { useState } from 'react';
import { Key, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/authStore.js';

export const LoginView: React.FC = () => {
  const [inputToken, setInputToken] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setError('An Authentication Token is required.');
      return;
    }
    
    // BUG FIX: Save token to store FIRST. The App.tsx useEffect on isAuthenticated
    // will call telemetryWS.connect() once the store update propagates, ensuring
    // the WS manager reads the token from the store (not null) when it connects.
    login(inputToken);
    // Do NOT call telemetryWS.connect() here — it would read a null token from the
    // store since Zustand state updates are async from this call frame.
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 bg-grid-cyber">
      {/* Visual background glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md panel-glass border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden p-8 z-10 relative">
        {/* Brand Banner */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-400/20 rounded-xl glow-blue">
            <Key className="w-6 h-6 text-slate-100" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-slate-100 uppercase tracking-wider">
              Rage Optimiser Telemetry
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Enter credentials to establish full-duplex session
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">
              Access Token:
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              placeholder="MONITORING_AUTH_TOKEN"
              value={inputToken}
              onChange={(e) => {
                setInputToken(e.target.value);
                setError('');
              }}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-[10px] font-mono text-red-400 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 hover:glow-blue border border-blue-400/20 text-slate-100 text-xs font-mono font-bold rounded-xl transition-all shadow-lg"
          >
            Authenticate Gateway
          </button>
        </form>
      </div>

      <div className="mt-8 text-[10px] text-slate-600 font-mono">
        Rage Optimiser Telemetry Protocol v1.0.0 Stable
      </div>
    </div>
  );
};
export default LoginView;
