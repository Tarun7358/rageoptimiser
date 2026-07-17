import React, { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  { token: '{user}', label: 'User Mention', desc: 'Mentions the member, e.g. @username' },
  { token: '{username}', label: 'Username', desc: 'Member\'s plain username' },
  { token: '{userTag}', label: 'User Tag/Display', desc: 'Global name or username' },
  { token: '{userId}', label: 'User ID', desc: 'Discord unique ID of the member' },
  { token: '{server}', label: 'Server Name', desc: 'The name of the Discord Server' },
  { token: '{memberCount}', label: 'Member Count', desc: 'Total members in the server' },
  { token: '{date}', label: 'Current Date', desc: 'Day and date, e.g. Friday, July 17' },
  { token: '{boosts}', label: 'Boost Count', desc: 'Total active server boosts' },
  { token: '{boostTier}', label: 'Boost Tier', desc: 'Current server level (0-3)' }
];

interface VariableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (val: string) => void;
}

export function VariableInput({ value, onValueChange, ...props }: VariableInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = SUGGESTIONS.filter(s => 
    s.token.toLowerCase().includes(filter.toLowerCase()) ||
    s.label.toLowerCase().includes(filter.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          insertToken(filtered[activeIndex].token);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onValueChange(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');

    if (lastOpenBrace !== -1 && lastOpenBrace >= textBeforeCursor.lastIndexOf('}')) {
      setShowDropdown(true);
      setFilter(textBeforeCursor.slice(lastOpenBrace));
      setActiveIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const insertToken = (token: string) => {
    const el = inputRef.current;
    if (!el) return;

    const selectionStart = el.selectionStart || 0;
    const selectionEnd = el.selectionEnd || 0;
    const val = el.value;

    const textBeforeCursor = val.slice(0, selectionStart);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');

    let newVal = '';
    let newCursorPos = 0;

    if (lastOpenBrace !== -1 && lastOpenBrace >= textBeforeCursor.lastIndexOf('}')) {
      newVal = val.slice(0, lastOpenBrace) + token + val.slice(selectionEnd);
      newCursorPos = lastOpenBrace + token.length;
    } else {
      newVal = val.slice(0, selectionStart) + token + val.slice(selectionEnd);
      newCursorPos = selectionStart + token.length;
    }

    onValueChange(newVal);
    setShowDropdown(false);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="form-control"
        style={{ width: '100%' }}
        {...props}
      />
      {showDropdown && filtered.length > 0 && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
            onClick={() => setShowDropdown(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1001,
            width: '100%',
            backgroundColor: '#16161f',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '180px',
            overflowY: 'auto',
            marginTop: '4px'
          }}>
            {filtered.map((s, idx) => (
              <div
                key={s.token}
                onClick={() => insertToken(s.token)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: idx === activeIndex ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                  borderLeft: idx === activeIndex ? '3px solid #d4af37' : '3px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d4af37' }}>{s.token}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface VariableTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
}

export function VariableTextArea({ value, onValueChange, ...props }: VariableTextAreaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = SUGGESTIONS.filter(s => 
    s.token.toLowerCase().includes(filter.toLowerCase()) ||
    s.label.toLowerCase().includes(filter.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          insertToken(filtered[activeIndex].token);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onValueChange(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');

    if (lastOpenBrace !== -1 && lastOpenBrace >= textBeforeCursor.lastIndexOf('}')) {
      setShowDropdown(true);
      setFilter(textBeforeCursor.slice(lastOpenBrace));
      setActiveIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const insertToken = (token: string) => {
    const el = textAreaRef.current;
    if (!el) return;

    const selectionStart = el.selectionStart || 0;
    const selectionEnd = el.selectionEnd || 0;
    const val = el.value;

    const textBeforeCursor = val.slice(0, selectionStart);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');

    let newVal = '';
    let newCursorPos = 0;

    if (lastOpenBrace !== -1 && lastOpenBrace >= textBeforeCursor.lastIndexOf('}')) {
      newVal = val.slice(0, lastOpenBrace) + token + val.slice(selectionEnd);
      newCursorPos = lastOpenBrace + token.length;
    } else {
      newVal = val.slice(0, selectionStart) + token + val.slice(selectionEnd);
      newCursorPos = selectionStart + token.length;
    }

    onValueChange(newVal);
    setShowDropdown(false);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="form-control"
        style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
        {...props}
      />
      {showDropdown && filtered.length > 0 && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
            onClick={() => setShowDropdown(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1001,
            width: '100%',
            backgroundColor: '#16161f',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '180px',
            overflowY: 'auto',
            marginTop: '4px'
          }}>
            {filtered.map((s, idx) => (
              <div
                key={s.token}
                onClick={() => insertToken(s.token)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: idx === activeIndex ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                  borderLeft: idx === activeIndex ? '3px solid #d4af37' : '3px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d4af37' }}>{s.token}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
