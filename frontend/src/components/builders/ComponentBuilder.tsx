import React, { useState } from 'react';
import { Plus, Trash2, Settings, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { RoleSelect, ChannelSelect } from '../ResourceSelectors';
import { ModalBuilder, type ModalField } from './ModalBuilder';
import type { DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';

export interface PanelOption {
  id: string;
  label: string;
  description?: string;
  emoji?: string;
  style?: 'primary' | 'secondary' | 'success' | 'danger';
  categoryId?: string;
  staffRoleIds?: string[];
  forms?: ModalField[];
}

interface ComponentBuilderProps {
  layoutType: 'buttons' | 'dropdown';
  onLayoutTypeChange: (type: 'buttons' | 'dropdown') => void;
  options: PanelOption[];
  onChange: (options: PanelOption[]) => void;
  roles: DiscordRole[];
  channels: DiscordChannel[];
}

export function ComponentBuilder({
  layoutType,
  onLayoutTypeChange,
  options = [],
  onChange,
  roles = [],
  channels = []
}: ComponentBuilderProps) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  const categories = channels.filter(c => c.type === 'category');

  const addOption = () => {
    const nextOpts = [...options];
    const newId = `opt_${Date.now()}`;
    nextOpts.push({
      id: newId,
      label: `Category #${options.length + 1}`,
      description: 'Support category description',
      emoji: '✉️',
      style: 'primary',
      categoryId: '',
      staffRoleIds: [],
      forms: []
    });
    onChange(nextOpts);
    setExpandedOptionId(newId);
  };

  const removeOption = (index: number) => {
    const nextOpts = [...options];
    const idToRemove = nextOpts[index].id;
    nextOpts.splice(index, 1);
    onChange(nextOpts);
    if (expandedOptionId === idToRemove) {
      setExpandedOptionId(null);
    }
  };

  const updateOption = (index: number, key: keyof PanelOption, val: any) => {
    const nextOpts = [...options];
    nextOpts[index] = {
      ...nextOpts[index],
      [key]: val
    };
    onChange(nextOpts);
  };

  const toggleExpand = (id: string) => {
    setExpandedOptionId(expandedOptionId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Layout Selection */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        backgroundColor: 'rgba(255,255,255,0.01)'
      }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Component Layout Style</h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Choose whether categories display as interactive buttons or a select menu.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onLayoutTypeChange('buttons')}
            className={`btn ${layoutType === 'buttons' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Button Grid
          </button>
          <button
            type="button"
            onClick={() => onLayoutTypeChange('dropdown')}
            className={`btn ${layoutType === 'dropdown' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Select Dropdown
          </button>
        </div>
      </div>

      {/* Options List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Support Categories / Departments</h4>
          <button
            type="button"
            onClick={addOption}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
          >
            <Plus size={12} /> Add Category
          </button>
        </div>

        {options.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No categories configured. Please add at least one category for users to interact with.
          </div>
        ) : (
          options.map((opt, idx) => {
            const isExpanded = expandedOptionId === opt.id;
            return (
              <div key={opt.id} style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                overflow: 'hidden',
                transition: 'background-color 0.15s ease'
              }}>
                {/* Header (Summary) */}
                <div 
                  onClick={() => toggleExpand(opt.id)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>{opt.emoji || '✉️'}</span>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</span>
                      {layoutType === 'dropdown' && opt.description && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>{opt.description}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {layoutType === 'buttons' && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: opt.style === 'danger' ? 'rgba(237, 66, 69, 0.15)' : opt.style === 'success' ? 'rgba(87, 242, 135, 0.15)' : 'rgba(88, 101, 242, 0.15)',
                        color: opt.style === 'danger' ? '#ed4245' : opt.style === 'success' ? '#57f287' : '#5865f2',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {opt.style || 'primary'}
                      </span>
                    )}

                    {opt.categoryId ? (
                      <span style={{ fontSize: '10px', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                        Routed
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>
                        Default Category
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeOption(idx); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff4d4d'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={13} />
                    </button>

                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {/* Basic properties */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Label Text</label>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => updateOption(idx, 'label', e.target.value)}
                          className="form-control"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Emoji</label>
                        <input
                          type="text"
                          value={opt.emoji || ''}
                          onChange={e => updateOption(idx, 'emoji', e.target.value)}
                          className="form-control"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          placeholder="e.g. ✉️"
                        />
                      </div>

                      {layoutType === 'buttons' ? (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Button Theme Style</label>
                          <select
                            value={opt.style || 'primary'}
                            onChange={e => updateOption(idx, 'style', e.target.value)}
                            className="form-control"
                            style={{ fontSize: '12px', padding: '4px 8px', height: '31px' }}
                          >
                            <option value="primary">Blurple (Primary)</option>
                            <option value="secondary">Grey (Secondary)</option>
                            <option value="success">Green (Success)</option>
                            <option value="danger">Red (Danger)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Description Subtext</label>
                          <input
                            type="text"
                            value={opt.description || ''}
                            onChange={e => updateOption(idx, 'description', e.target.value)}
                            className="form-control"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            placeholder="e.g. For billing and store issues"
                          />
                        </div>
                      )}
                    </div>

                    {/* Routing and permissions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <ChannelSelect
                        label="Spawn in Category"
                        channels={categories}
                        selectedChannelId={opt.categoryId}
                        onChange={val => updateOption(idx, 'categoryId', val)}
                        helpText="Select a category channel where tickets of this type will open."
                      />

                      <RoleSelect
                        label="Assigned Support Staff Roles"
                        roles={roles}
                        selectedRoleIds={opt.staffRoleIds}
                        isMulti={true}
                        onChange={val => updateOption(idx, 'staffRoleIds', val)}
                        helpText="Support agents with these roles can view and claim these tickets."
                      />
                    </div>

                    {/* Nested Modal Form Builder */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
                      <ModalBuilder
                        value={opt.forms || []}
                        onChange={val => updateOption(idx, 'forms', val)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
