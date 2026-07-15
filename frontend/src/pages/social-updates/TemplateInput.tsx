/**
 * Social Updates — TemplateInput
 * Variable-aware text input with clickable chip palette.
 */
import React, { useRef } from 'react';

interface TemplateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  provider: 'youtube' | 'instagram';
  helpText?: string;
  maxLength?: number;
}

const YOUTUBE_VARS = [
  { key: '{channel.name}', label: 'Channel Name' },
  { key: '{channel.url}', label: 'Channel URL' },
  { key: '{video.title}', label: 'Video Title' },
  { key: '{video.url}', label: 'Video URL' },
  { key: '{video.thumbnail}', label: 'Thumbnail' },
  { key: '{video.description}', label: 'Description' },
  { key: '{video.duration}', label: 'Duration' },
  { key: '{video.views}', label: 'View Count' },
  { key: '{video.publish_date}', label: 'Published At' },
  { key: '{video.live}', label: 'Is Live?' },
  { key: '{video.short}', label: 'Is Short?' },
  { key: '{discord.channel}', label: '#Channel' },
  { key: '{server.name}', label: 'Server Name' },
  { key: '{role.mention}', label: 'Role Mention' },
];

const INSTAGRAM_VARS = [
  { key: '{profile.name}', label: 'Profile Name' },
  { key: '{profile.username}', label: 'Username' },
  { key: '{profile.url}', label: 'Profile URL' },
  { key: '{post.caption}', label: 'Caption' },
  { key: '{post.image}', label: 'Image URL' },
  { key: '{post.url}', label: 'Post URL' },
  { key: '{post.publish_date}', label: 'Published At' },
  { key: '{discord.channel}', label: '#Channel' },
  { key: '{server.name}', label: 'Server Name' },
  { key: '{role.mention}', label: 'Role Mention' },
];

export function TemplateInput({
  label, value, onChange, placeholder, multiline, rows = 3,
  provider, helpText, maxLength
}: TemplateInputProps) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const vars = provider === 'youtube' ? YOUTUBE_VARS : INSTAGRAM_VARS;

  const insertVariable = (varKey: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(value + varKey);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + varKey + value.slice(end);
    onChange(next);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = start + varKey.length;
        inputRef.current.setSelectionRange(pos, pos);
        inputRef.current.focus();
      }
    });
  };

  const commonStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(15,17,21,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
    resize: multiline ? 'vertical' : 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</label>
        {maxLength && (
          <span style={{ fontSize: 11, color: value.length > maxLength * 0.9 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          ref={inputRef as any}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          style={{ ...commonStyle }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
      ) : (
        <input
          ref={inputRef as any}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{ ...commonStyle }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
      )}

      {/* Variable chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {vars.map(v => (
          <button
            key={v.key}
            onClick={() => insertVariable(v.key)}
            title={`Insert ${v.key}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 12,
              background: 'rgba(79,140,255,0.1)',
              border: '1px solid rgba(79,140,255,0.25)',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontFamily: 'monospace',
              transition: 'all 0.12s'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(79,140,255,0.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(79,140,255,0.1)';
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {helpText && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{helpText}</p>
      )}
    </div>
  );
}
