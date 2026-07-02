import React from 'react';
import { ArrowLeft, ArrowRight, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface SetupWizardProps {
  steps: string[];
  activeStep: number;
  onStepChange: (idx: number) => void;
  progress: number;
  errors: string[];
  status: string;
  onToggleEnable?: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export function SetupWizard({
  steps,
  activeStep,
  onStepChange,
  progress = 0,
  errors = [],
  status,
  onToggleEnable,
  onSave,
  children
}: SetupWizardProps) {
  
  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      onStepChange(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      onStepChange(activeStep - 1);
    }
  };

  return (
    <div className="section-panel" style={{ width: '100%' }}>
      {/* Wizard Header with Progress bar */}
      <div 
        style={{ 
          padding: '20px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          backgroundColor: 'rgba(0,0,0,0.1)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Setup progression</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{progress}% Completed</span>
              <StatusBadge 
                status={status === 'enabled' ? 'success' : status === 'ready' ? 'info' : status === 'validation_failed' ? 'danger' : 'warning'} 
                label={status === 'enabled' ? 'Monitoring' : status === 'ready' ? 'Ready to Enable' : status === 'validation_failed' ? 'Validation Failed' : 'Config Required'} 
              />
            </div>
          </div>
          {status === 'ready' && onToggleEnable && (
            <button className="btn btn-primary" onClick={onToggleEnable}>
              Enable Module
            </button>
          )}
          {status === 'enabled' && onToggleEnable && (
            <button 
              className="btn btn-secondary" 
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} 
              onClick={onToggleEnable}
            >
              Disable Module
            </button>
          )}
        </div>

        {/* Horizontal steps tracker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStep || progress === 100;
            const isActive = idx === activeStep;
            return (
              <div 
                key={step} 
                onClick={() => onStepChange(idx)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  opacity: isActive || isCompleted ? 1 : 0.4,
                  transition: 'opacity var(--transition-fast)'
                }}
              >
                <div 
                  style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    backgroundColor: isCompleted ? 'var(--color-success)' : isActive ? 'var(--accent-primary)' : 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                </div>
                <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {step}
                </span>
                {idx < steps.length - 1 && (
                  <div style={{ width: '20px', height: '1px', backgroundColor: 'var(--border-color)', marginLeft: '8px' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active step contents wrapper */}
      <div className="panel-body" style={{ padding: '24px', minHeight: '260px' }}>
        {children}
      </div>

      {/* Validation banner & actions footer */}
      <div 
        style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)' 
        }}
      >
        <div>
          {errors.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
              <AlertTriangle size={14} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{errors.length} active validation error(s) block activation</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
              <ShieldCheck size={14} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Module bindings verified & healthy</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleBack} disabled={activeStep === 0}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          {activeStep < steps.length - 1 ? (
            <button className="btn btn-secondary" onClick={handleNext}>
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onSave} disabled={errors.length > 0}>
              Save Config
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
