import React, { useState } from 'react';
import { Plus, Trash2, Eye, X } from 'lucide-react';

export interface ModalField {
  id: string;
  label: string;
  placeholder?: string;
  style: 'short' | 'paragraph';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

interface ModalBuilderProps {
  value: ModalField[];
  onChange: (val: ModalField[]) => void;
}

export function ModalBuilder({ value = [], onChange }: ModalBuilderProps) {
  const [showPreview, setShowPreview] = useState(false);

  const addField = () => {
    if (value.length >= 5) return; // Discord limit is 5 inputs per modal
    const fields = [...value];
    fields.push({
      id: `field_${Date.now()}`,
      label: 'Field Label',
      placeholder: 'Enter response here...',
      style: 'short',
      required: true
    });
    onChange(fields);
  };

  const removeField = (index: number) => {
    const fields = [...value];
    fields.splice(index, 1);
    onChange(fields);
  };

  const updateField = (index: number, key: keyof ModalField, val: any) => {
    const fields = [...value];
    fields[index] = { ...fields[index], [key]: val };
    onChange(fields);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Questionnaire Modal Form</h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ask users to fill out details before creating their ticket. Max 5 fields.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
            >
              <Eye size={12} /> Preview Modal
            </button>
          )}
          <button
            type="button"
            onClick={addField}
            className="btn btn-primary"
            disabled={value.length >= 5}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
          >
            <Plus size={12} /> Add Input ({value.length}/5)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {value.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No inputs configured. Ticket will spawn immediately upon button click without prompting questions.
          </div>
        ) : (
          value.map((f, idx) => (
            <div key={f.id} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 2fr 1fr 1fr auto',
              gap: '12px',
              alignItems: 'center',
              padding: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.01)'
            }}>
              <div>
                <label className="form-label" style={{ fontSize: '10px', marginBottom: '4px' }}>Field Label</label>
                <input
                  type="text"
                  value={f.label}
                  onChange={e => updateField(idx, 'label', e.target.value)}
                  className="form-control"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                  placeholder="e.g. Account Name"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '10px', marginBottom: '4px' }}>Placeholder Help Text</label>
                <input
                  type="text"
                  value={f.placeholder || ''}
                  onChange={e => updateField(idx, 'placeholder', e.target.value)}
                  className="form-control"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                  placeholder="e.g. Enter your account name..."
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '10px', marginBottom: '4px' }}>Input Size</label>
                <select
                  value={f.style}
                  onChange={e => updateField(idx, 'style', e.target.value)}
                  className="form-control"
                  style={{ fontSize: '12px', padding: '4px 8px', height: '31px' }}
                >
                  <option value="short">Short (1 line)</option>
                  <option value="paragraph">Paragraph (Multi-line)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <label className="form-label" style={{ fontSize: '10px', marginBottom: '4px' }}>Required</label>
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={e => updateField(idx, 'required', e.target.checked)}
                  style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                />
              </div>

              <button
                type="button"
                onClick={() => removeField(idx)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  marginTop: '16px'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4d4d'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Simulator Overlay Pop-up Modal */}
      {showPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          {/* Modal Container */}
          <div style={{
            backgroundColor: '#313338',
            width: '440px',
            borderRadius: '4px',
            boxShadow: '0 24px 36px rgba(0,0,0,0.5)',
            color: '#dbdee1',
            fontFamily: "'GG Sans', 'Helvetica Neue', Arial, sans-serif",
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.03)'
            }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Submit Support Request</span>
              <X size={16} style={{ cursor: 'pointer', color: '#949ba4' }} onClick={() => setShowPreview(false)} />
            </div>

            {/* Inputs List */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {value.map(f => (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#f2f3f5', textTransform: 'uppercase', display: 'flex', gap: '4px' }}>
                    {f.label}
                    {f.required && <span style={{ color: '#f23f43' }}>*</span>}
                  </label>

                  {f.style === 'paragraph' ? (
                    <textarea
                      placeholder={f.placeholder}
                      readOnly
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #1e1f22',
                        borderRadius: '3px',
                        padding: '10px',
                        fontSize: '14px',
                        color: '#dbdee1',
                        resize: 'none',
                        height: '80px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      readOnly
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #1e1f22',
                        borderRadius: '3px',
                        padding: '10px',
                        fontSize: '14px',
                        color: '#dbdee1',
                        height: '40px',
                        outline: 'none'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Footer buttons */}
            <div style={{
              backgroundColor: '#2b2d31',
              padding: '16px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  backgroundColor: '#5865f2',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '3px',
                  padding: '8px 24px',
                  cursor: 'pointer'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
