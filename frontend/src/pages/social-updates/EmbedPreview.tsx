/**
 * Social Updates — EmbedPreview
 * Renders a Discord-faithful live preview of the embed configuration.
 */
import React from 'react';

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface EmbedButton {
  label: string;
  url: string;
  emoji?: string;
}

export interface EmbedConfig {
  color?: string;
  authorEnabled?: boolean;
  authorName?: string;
  authorIcon?: string;
  authorUrl?: string;
  titleEnabled?: boolean;
  title?: string;
  titleUrl?: string;
  descriptionEnabled?: boolean;
  description?: string;
  thumbnailEnabled?: boolean;
  thumbnail?: string;
  imageEnabled?: boolean;
  image?: string;
  fields?: EmbedField[];
  footerEnabled?: boolean;
  footerText?: string;
  footerIcon?: string;
  timestampEnabled?: boolean;
  buttons?: EmbedButton[];
  mentionRoles?: string[];
  messageContent?: string;
}

interface EmbedPreviewProps {
  config: EmbedConfig;
  sampleData?: Record<string, string>;
}

function resolveVars(template: string, data: Record<string, string>): string {
  if (!template) return '';
  // Conditional blocks
  let result = template.replace(
    /\{\{([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, varName, inner) => {
      const value = data[varName];
      return value && value !== 'false' && value !== '' ? inner.trim() : '';
    }
  );
  // Simple variables
  result = result.replace(/\{([\w.]+)\}/g, (_, varName) => {
    return data[varName] !== undefined ? data[varName] : `{${varName}}`;
  });
  return result;
}

function formatTimestamp(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Simple markdown-to-JSX renderer for embed description
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold
    let parts: React.ReactNode[] = [line
      .replace(/\*\*(.+?)\*\*/g, '§BOLD§$1§ENDBOLD§')
      .replace(/\*(.+?)\*/g, '§ITALIC§$1§ENDITALIC§')
      .replace(/`(.+?)`/g, '§CODE§$1§ENDCODE§')
    ].map((s, _) => {
      if (typeof s !== 'string') return s;
      const tokens = s.split(/(§BOLD§.*?§ENDBOLD§|§ITALIC§.*?§ENDITALIC§|§CODE§.*?§ENDCODE§)/);
      return tokens.map((tok, j) => {
        if (tok.startsWith('§BOLD§')) return <strong key={j}>{tok.slice(6, -10)}</strong>;
        if (tok.startsWith('§ITALIC§')) return <em key={j}>{tok.slice(8, -12)}</em>;
        if (tok.startsWith('§CODE§')) return <code key={j} style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: '12px' }}>{tok.slice(6, -10)}</code>;
        return tok;
      });
    });

    return (
      <React.Fragment key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export function EmbedPreview({ config, sampleData = {} }: EmbedPreviewProps) {
  const R = (s: string | undefined) => resolveVars(s || '', sampleData);

  const color = config.color || '#5865F2';
  const inlineFields = config.fields?.filter(f => f.inline) || [];
  const blockFields = config.fields?.filter(f => !f.inline) || [];
  const hasAnyField = config.fields && config.fields.length > 0;

  const messageContent = config.messageContent ? R(config.messageContent) : '';
  const mentionLine = (config.mentionRoles || [])
    .map(r => r === 'everyone' ? '@everyone' : r === 'here' ? '@here' : `@role`)
    .join(' ');

  const hasEmbed = config.authorEnabled || config.titleEnabled || config.descriptionEnabled ||
    config.thumbnailEnabled || config.imageEnabled || hasAnyField || config.footerEnabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Discord message container */}
      <div style={{
        background: '#313338',
        borderRadius: 8,
        padding: '12px 16px',
        fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: 14,
        color: '#dbdee1',
        maxWidth: 520,
        width: '100%'
      }}>
        {/* Bot avatar + name row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff5e3a 0%, #ff2a6d 100%)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, color: '#fff'
          }}>RO</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: '#f2f3f5', fontSize: 14 }}>Rage Optimiser</span>
              <span style={{ background: '#5865f2', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BOT</span>
              <span style={{ color: '#949ba4', fontSize: 12 }}>Today at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Message content */}
            {(messageContent || mentionLine) && (
              <div style={{ marginBottom: 8, color: '#dbdee1', lineHeight: 1.4 }}>
                {mentionLine && <span style={{ color: '#c9d9f5', background: 'rgba(88,101,242,0.3)', borderRadius: 3, padding: '0 2px' }}>{mentionLine} </span>}
                {messageContent}
              </div>
            )}

            {/* Embed */}
            {hasEmbed && (
              <div style={{
                borderLeft: `4px solid ${color}`,
                background: '#2b2d31',
                borderRadius: '0 4px 4px 0',
                padding: '12px 16px',
                maxWidth: 480,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Author */}
                    {config.authorEnabled && config.authorName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        {config.authorIcon && (
                          <img src={R(config.authorIcon)} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                            onError={e => { (e.target as any).style.display = 'none'; }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#dbdee1' }}>
                          {R(config.authorName)}
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    {config.titleEnabled && config.title && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: '#00aff4', fontSize: 15, cursor: config.titleUrl ? 'pointer' : 'default' }}>
                          {R(config.title)}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {config.descriptionEnabled && config.description && (
                      <div style={{ color: '#dbdee1', fontSize: 13, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                        {renderMarkdown(R(config.description))}
                      </div>
                    )}

                    {/* Inline fields */}
                    {config.fields && config.fields.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px 16px', marginBottom: 8 }}>
                        {config.fields.map((field, i) => (
                          <div key={i} style={{ gridColumn: field.inline ? undefined : '1 / -1' }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#dbdee1', marginBottom: 2 }}>{R(field.name) || '\u200b'}</div>
                            <div style={{ fontSize: 13, color: '#dbdee1' }}>{R(field.value) || '\u200b'}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Main Image (full width) */}
                    {config.imageEnabled && config.image && R(config.image) && (
                      <div style={{ marginTop: 8 }}>
                        <img
                          src={R(config.image)}
                          alt="embed"
                          style={{ width: '100%', maxWidth: 400, borderRadius: 4, display: 'block' }}
                          onError={e => { (e.target as any).style.display = 'none'; }}
                        />
                      </div>
                    )}

                    {/* Footer */}
                    {config.footerEnabled && (config.footerText || config.timestampEnabled) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {config.footerIcon && (
                          <img src={R(config.footerIcon)} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                            onError={e => { (e.target as any).style.display = 'none'; }} />
                        )}
                        <span style={{ fontSize: 11, color: '#949ba4' }}>
                          {config.footerText ? R(config.footerText) : ''}
                          {config.footerText && config.timestampEnabled ? ' • ' : ''}
                          {config.timestampEnabled ? formatTimestamp() : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {config.thumbnailEnabled && config.thumbnail && R(config.thumbnail) && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={R(config.thumbnail)}
                        alt="thumb"
                        style={{ width: 72, height: 72, borderRadius: 4, objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.target as any).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buttons row */}
            {config.buttons && config.buttons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {config.buttons.filter(b => b.label).map((btn, i) => (
                  <div key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#4e505a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    padding: '6px 14px',
                    fontSize: 13, fontWeight: 500,
                    color: '#dbdee1',
                    cursor: 'pointer'
                  }}>
                    {btn.emoji && <span>{btn.emoji}</span>}
                    {btn.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                      <path d="M21 3L15 3L18.29 6.29L13.41 11.17L12 9.76L10.59 11.17L5.71 6.29L9 3L3 3L3 9L6.29 5.71L11.17 10.59L9.76 12L11.17 13.41L6.29 18.29L3 15L3 21L9 21L5.71 17.71L10.59 12.83L12 14.24L13.41 12.83L18.29 17.71L15 21L21 21L21 15L17.71 18.29L12.83 13.41L14.24 12L12.83 10.59L17.71 5.71L21 9L21 3Z" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
