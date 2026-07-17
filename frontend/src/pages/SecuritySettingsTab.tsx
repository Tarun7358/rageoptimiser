import { API_BASE } from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export function SecuritySettingsTab({ onSaveConfig }: { onSaveConfig: (msg: string, type?: 'success' | 'danger' | 'warning' | 'info') => void }) {
  const { token, requireElevation } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Setup state
  const [setupData, setSetupData] = useState<{ secret: string, qrCodeUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/totp/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTotpEnabled(data.enabled);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const startSetup = async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/totp/setup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSetupData(data);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Failed to start TOTP setup.');
    }
  };

  const verifySetup = async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/totp/verify-setup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: verifyCode })
      });
      const data = await res.json();
      if (res.ok) {
        setRecoveryCodes(data.recoveryCodes);
        setTotpEnabled(true);
        setSetupData(null);
        onSaveConfig('Two-Factor Authentication successfully enabled!', 'success');
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Failed to verify code.');
    }
  };

  const disableTotp = () => {
    requireElevation(async () => {
      try {
        const elevatedToken = localStorage.getItem('cn_elevated_token');
        const res = await fetch(`${API_BASE}/api/auth/totp/disable`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Elevated-Token': elevatedToken || ''
          }
        });
        if (res.ok) {
          setTotpEnabled(false);
          setRecoveryCodes(null);
          onSaveConfig('Two-Factor Authentication has been disabled.', 'danger');
        } else {
          onSaveConfig('Failed to disable 2FA.', 'danger');
        }
      } catch (e) {
        onSaveConfig('API error while disabling 2FA.', 'danger');
      }
    });
  };

  if (loading) return <div>Loading security settings...</div>;

  return (
    <div className="form-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div className="form-group-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div>
          <div className="form-label" style={{ fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Two-Factor Authentication (TOTP)
            {totpEnabled ? (
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-success)' }}>🟢 Enabled</span>
            ) : (
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)' }}>🔴 Disabled</span>
            )}
          </div>
          <div className="form-help" style={{ marginTop: '4px' }}>Protect critical dashboard actions and owner permissions with Google Authenticator.</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '6px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {!totpEnabled && !setupData && (
        <div>
          <button className="btn btn-primary" onClick={startSetup}>Enable Two-Factor Authentication</button>
        </div>
      )}

      {setupData && !totpEnabled && (
        <div style={{ padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Scan QR Code</h3>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Scan this QR code with Google Authenticator, Authy, or any TOTP app.</p>
          <div style={{ marginBottom: '16px', backgroundColor: '#fff', padding: '16px', display: 'inline-block', borderRadius: '8px' }}>
            <img src={setupData.qrCodeUrl} alt="TOTP QR Code" style={{ width: '200px', height: '200px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div className="form-label">Or enter secret manually:</div>
            <code style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', color: 'var(--accent-primary)', fontSize: '14px', letterSpacing: '1px' }}>{setupData.secret}</code>
          </div>
          <div className="form-group">
            <label className="form-label">Enter 6-digit code to verify:</label>
            <input 
              type="text" 
              className="form-input-text" 
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ letterSpacing: '4px', fontSize: '18px', width: '200px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={verifySetup} disabled={verifyCode.length !== 6}>Verify & Enable</button>
            <button className="btn" onClick={() => setSetupData(null)}>Cancel</button>
          </div>
        </div>
      )}

      {recoveryCodes && (
        <div style={{ padding: '20px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-warning)', fontSize: '16px' }}>⚠️ Save Your Recovery Codes</h3>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>These codes will only be shown ONCE. Save them in a secure password manager. Each code can only be used once.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {recoveryCodes.map((code, i) => (
              <div key={i} style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontFamily: 'monospace', letterSpacing: '1px', textAlign: 'center' }}>
                {code}
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: '16px', width: '100%' }} onClick={() => setRecoveryCodes(null)}>I have saved my recovery codes</button>
        </div>
      )}

      {totpEnabled && !recoveryCodes && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn btn-danger" onClick={disableTotp}>Disable 2FA</button>
        </div>
      )}

    </div>
  );
}
