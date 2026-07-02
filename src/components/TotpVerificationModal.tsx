import React, { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function TotpVerificationModal() {
  const { elevationCallback, cancelElevation, setElevatedToken, token, user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (elevationCallback) {
      setCode('');
      setError('');
    }
  }, [elevationCallback]);

  if (!elevationCallback) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/elevate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      
      if (res.ok && data.elevatedToken) {
        setElevatedToken(data.elevatedToken);
        elevationCallback();
        cancelElevation();
      } else {
        setError(data.error || data.message || 'Invalid Google Authenticator code.');
      }
    } catch (err) {
      setError('Failed to reach backend API.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '32px',
        width: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        position: 'relative'
      }}>
        <button 
          onClick={cancelElevation}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '64px', height: '64px', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
            color: 'var(--accent-primary)'
          }}>
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-main)' }}>Security Verification Required</h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            This action is protected. Please enter your 6-digit Google Authenticator code to continue.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{
              padding: '12px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-main)',
              fontSize: '24px',
              letterSpacing: '8px',
              textAlign: 'center',
              fontWeight: 'bold',
              outline: 'none'
            }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={cancelElevation}
              className="btn"
              style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={code.length !== 6 || loading}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
