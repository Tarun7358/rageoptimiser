/**
 * Social Updates — EmbedBuilder
 * Premium drag-and-configure embed editor with live preview.
 * Universal — works for YouTube, Instagram, and future providers.
 */
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { EmbedConfig } from './EmbedPreview';
import { EmbedPreview } from './EmbedPreview';
import { TemplateInput } from './TemplateInput';

const PRESET_COLORS = [
  '#FF0000', '#FF4500', '#FF5E3A', '#FF2A6D',
  '#7C5CFC', '#5865F2', '#4F8CFF', '#00B0F4',
  '#22C55E', '#FACC15', '#F97316', '#EC4899',
  '#0F0F0F', '#FFFFFF'
];

interface EmbedBuilderProps {
  config: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
  provider: 'youtube' | 'instagram';
  sampleData?: Record<string, string>;
}

interface SectionProps {
  title: string;
  enabled?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  badge?: string;
}

function Section({ title, enabled, onToggle, children, badge }: SectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'rgba(0,0,0,0.15)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.2)',
        cursor: 'pointer',
        userSelect: 'none'
      }} onClick={() => setOpen(!open)}>
        {onToggle && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          >
            <label className="switch" style={{ width: 36, height: 20 }}>
              <input type="checkbox" checked={!!enabled} onChange={onToggle} />
              <span className="slider" />
            </label>
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        {badge && (
          <span style={{ fontSize: 10, background: 'rgba(79,140,255,0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(79,140,255,0.2)', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
            {badge}
          </span>
        )}
        {open ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </div>
      {open && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function InputRow({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-input"
        style={{ fontSize: 13, padding: '8px 12px' }}
      />
    </div>
  );
}

export function EmbedBuilder({ config, onChange, provider, sampleData = {} }: EmbedBuilderProps) {
  const [showPreview, setShowPreview] = useState(true);

  const update = (patch: Partial<EmbedConfig>) => onChange({ ...config, ...patch });

  const addField = () => {
    update({ fields: [...(config.fields || []), { name: 'Field Name', value: 'Field Value', inline: false }] });
  };

  const removeField = (i: number) => {
    const fields = [...(config.fields || [])];
    fields.splice(i, 1);
    update({ fields });
  };

  const updateField = (i: number, patch: Partial<{ name: string; value: string; inline: boolean }>) => {
    const fields = [...(config.fields || [])];
    fields[i] = { ...fields[i], ...patch };
    update({ fields });
  };

  const moveField = (i: number, dir: -1 | 1) => {
    const fields = [...(config.fields || [])];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    update({ fields });
  };

  const addButton = () => {
    update({ buttons: [...(config.buttons || []), { label: 'Watch Now', url: '{video.url}' }] });
  };

  const removeButton = (i: number) => {
    const buttons = [...(config.buttons || [])];
    buttons.splice(i, 1);
    update({ buttons });
  };

  const updateButton = (i: number, patch: any) => {
    const buttons = [...(config.buttons || [])];
    buttons[i] = { ...buttons[i], ...patch };
    update({ buttons });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Embed Configuration</span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, padding: '5px 12px',
              background: 'rgba(79,140,255,0.1)', border: '1px solid rgba(79,140,255,0.25)',
              borderRadius: 8, color: 'var(--accent-primary)', cursor: 'pointer'
            }}
          >
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>

        {/* Color */}
        <Section title="Embed Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => update({ color: c })}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: c, cursor: 'pointer',
                  border: config.color === c ? '3px solid var(--accent-primary)' : '2px solid rgba(255,255,255,0.1)',
                  transition: 'transform 0.12s', transform: config.color === c ? 'scale(1.2)' : 'scale(1)'
                }}
              />
            ))}
            <input
              type="color"
              value={config.color || '#5865F2'}
              onChange={e => update({ color: e.target.value })}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
            />
            <input
              type="text"
              value={config.color || '#5865F2'}
              onChange={e => update({ color: e.target.value })}
              placeholder="#5865F2"
              style={{ width: 90, fontSize: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'monospace' }}
            />
          </div>
        </Section>

        {/* Message Content */}
        <Section title="Message Content" badge="Optional">
          <TemplateInput
            label="Text before the embed (supports mentions)"
            value={config.messageContent || ''}
            onChange={v => update({ messageContent: v })}
            placeholder="New video from {channel.name}! 🎬"
            provider={provider}
            multiline
            rows={2}
          />
        </Section>

        {/* Author */}
        <Section
          title="Author Row"
          enabled={config.authorEnabled}
          onToggle={() => update({ authorEnabled: !config.authorEnabled })}
        >
          {config.authorEnabled && (
            <>
              <TemplateInput label="Author Name" value={config.authorName || ''} onChange={v => update({ authorName: v })} placeholder="{channel.name}" provider={provider} />
              <InputRow label="Author Icon URL" value={config.authorIcon || ''} onChange={v => update({ authorIcon: v })} placeholder="{channel.avatar}" />
              <InputRow label="Author URL (hyperlink)" value={config.authorUrl || ''} onChange={v => update({ authorUrl: v })} placeholder="{channel.url}" />
            </>
          )}
        </Section>

        {/* Title */}
        <Section
          title="Title"
          enabled={config.titleEnabled}
          onToggle={() => update({ titleEnabled: !config.titleEnabled })}
        >
          {config.titleEnabled && (
            <>
              <TemplateInput label="Title Text" value={config.title || ''} onChange={v => update({ title: v })} placeholder="🎬 {video.title}" provider={provider} maxLength={256} />
              <InputRow label="Title URL (hyperlink)" value={config.titleUrl || ''} onChange={v => update({ titleUrl: v })} placeholder="{video.url}" />
            </>
          )}
        </Section>

        {/* Description */}
        <Section
          title="Description"
          enabled={config.descriptionEnabled}
          onToggle={() => update({ descriptionEnabled: !config.descriptionEnabled })}
        >
          {config.descriptionEnabled && (
            <TemplateInput
              label="Description (supports Markdown)"
              value={config.description || ''}
              onChange={v => update({ description: v })}
              placeholder="{video.description}"
              provider={provider}
              multiline rows={4}
              maxLength={4096}
            />
          )}
        </Section>

        {/* Thumbnail */}
        <Section
          title="Thumbnail (small, top-right)"
          enabled={config.thumbnailEnabled}
          onToggle={() => update({ thumbnailEnabled: !config.thumbnailEnabled })}
        >
          {config.thumbnailEnabled && (
            <TemplateInput label="Thumbnail URL" value={config.thumbnail || ''} onChange={v => update({ thumbnail: v })} placeholder="{video.thumbnail}" provider={provider} />
          )}
        </Section>

        {/* Image */}
        <Section
          title="Large Image"
          enabled={config.imageEnabled}
          onToggle={() => update({ imageEnabled: !config.imageEnabled })}
        >
          {config.imageEnabled && (
            <TemplateInput label="Image URL" value={config.image || ''} onChange={v => update({ image: v })} placeholder="{video.thumbnail}" provider={provider} />
          )}
        </Section>

        {/* Fields */}
        <Section title="Fields" badge={`${config.fields?.length || 0}`}>
          {(config.fields || []).map((field, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Field {i + 1}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveField(i, -1)} disabled={i === 0} style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveField(i, 1)} disabled={i === (config.fields?.length || 0) - 1} style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => removeField(i)} style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={field.name}
                onChange={e => updateField(i, { name: e.target.value })}
                placeholder="Field Name"
                className="text-input"
                style={{ fontSize: 12, padding: '6px 10px' }}
              />
              <textarea
                value={field.value}
                onChange={e => updateField(i, { value: e.target.value })}
                placeholder="Field Value"
                className="text-input"
                rows={2}
                style={{ fontSize: 12, padding: '6px 10px', resize: 'vertical' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!field.inline} onChange={e => updateField(i, { inline: e.target.checked })} />
                Inline (display side by side)
              </label>
            </div>
          ))}
          {(config.fields?.length || 0) < 25 && (
            <button
              onClick={addField}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                padding: '8px 12px', borderRadius: 8, border: '1px dashed rgba(79,140,255,0.4)',
                background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Field
            </button>
          )}
        </Section>

        {/* Footer */}
        <Section
          title="Footer"
          enabled={config.footerEnabled}
          onToggle={() => update({ footerEnabled: !config.footerEnabled })}
        >
          {config.footerEnabled && (
            <>
              <TemplateInput label="Footer Text" value={config.footerText || ''} onChange={v => update({ footerText: v })} placeholder="Posted by {channel.name}" provider={provider} maxLength={2048} />
              <InputRow label="Footer Icon URL" value={config.footerIcon || ''} onChange={v => update({ footerIcon: v })} placeholder="{channel.avatar}" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!config.timestampEnabled} onChange={e => update({ timestampEnabled: e.target.checked })} />
                Show Timestamp
              </label>
            </>
          )}
        </Section>

        {/* Buttons */}
        <Section title="Link Buttons" badge={`${config.buttons?.length || 0}`}>
          {(config.buttons || []).map((btn, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Button {i + 1}</span>
                <button onClick={() => removeButton(i)} style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="text" value={btn.label} onChange={e => updateButton(i, { label: e.target.value })} placeholder="Watch on YouTube" className="text-input" style={{ fontSize: 12, padding: '6px 10px' }} />
                <input type="text" value={btn.emoji || ''} onChange={e => updateButton(i, { emoji: e.target.value })} placeholder="▶️ emoji" className="text-input" style={{ fontSize: 12, padding: '6px 10px' }} />
              </div>
              <input type="text" value={btn.url} onChange={e => updateButton(i, { url: e.target.value })} placeholder="{video.url}" className="text-input" style={{ fontSize: 12, padding: '6px 10px' }} />
            </div>
          ))}
          {(config.buttons?.length || 0) < 5 && (
            <button
              onClick={addButton}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                padding: '8px 12px', borderRadius: 8, border: '1px dashed rgba(79,140,255,0.4)',
                background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Button
            </button>
          )}
        </Section>
      </div>

      {/* Right: Live Preview */}
      {showPreview && (
        <div style={{ position: 'sticky', top: 0 }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Live Preview</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '1px 8px' }}>Discord Dark Mode</span>
          </div>
          <EmbedPreview config={config} sampleData={sampleData} />
        </div>
      )}
    </div>
  );
}
