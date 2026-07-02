import React, { useState } from 'react';
import { FileText, MessageSquare, ShieldAlert, Award, UserCheck, X, Check, ShieldCheck, Plus, Trash2, Send, Clock, Download } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { SetupWizard } from '../components/SetupWizard';
import { RoleSelect, ChannelSelect } from '../components/ResourceSelectors';
import type { ModuleState, DiscordRole, DiscordChannel } from '../hooks/useDiscordSync';

interface TicketsProps {
  onSaveConfig: (msg: string) => void;
  onManualTrigger: (msg: string, type: 'info' | 'success' | 'warning' | 'danger' | 'purple', cat: 'Security' | 'Moderation' | 'Community' | 'Backup' | 'System' | 'Ticket') => void;
  modules: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onUpdateConfig: (moduleId: string, config: Record<string, any>, enabledOverride?: boolean) => void;
}

interface TicketItem {
  id: string;
  user: string;
  dept: string;
  claimedBy: string | null;
  status: 'Open' | 'Claimed' | 'Closed';
  date: string;
  transcript: { sender: string; text: string; time: string }[];
}

export function Tickets({ 
  onSaveConfig, 
  onManualTrigger,
  modules,
  registry,
  onUpdateConfig
}: TicketsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [wizardStep, setWizardStep] = useState(0);
  const [replyText, setReplyText] = useState('');

  const ticketModule = (modules || []).find(m => m.id === 'tickets');
  const config = ticketModule?.config || {};

  const categoryId = config.categoryId || '';
  const staffRoleIds = config.staffRoleIds || [];

  // Ticket department customizer
  const [depts, setDepts] = useState<Array<{ name: string; icon: string; roleId: string }>>(
    config.depts || [
      { name: 'Support', icon: '🎫', roleId: '' },
      { name: 'Billing', icon: '💳', roleId: '' },
      { name: 'Bugs', icon: '🐛', roleId: '' }
    ]
  );

  const [activeTickets, setActiveTickets] = useState<TicketItem[]>([
    { 
      id: 'TICKET-1082', 
      user: 'gamer_42#1201', 
      dept: 'Billing', 
      claimedBy: null, 
      status: 'Open', 
      date: '5m ago',
      transcript: [
        { sender: 'gamer_42#1201', text: 'Hi, I purchased the server Nitro boost tier but did not receive my custom VIP profile badge.', time: '5m ago' }
      ]
    },
    { 
      id: 'TICKET-1081', 
      user: 'dev_guy#9931', 
      dept: 'Bugs', 
      claimedBy: 'staff_lisa', 
      status: 'Claimed', 
      date: '1h ago',
      transcript: [
        { sender: 'dev_guy#9931', text: 'Anti-Spam module is blocking code block formatting. Markdown text containing triple backticks triggers warning.', time: '1h ago' },
        { sender: 'staff_lisa', text: 'Looking into this. I will verify if code block signatures are whitelisted in your Anti-Spam config.', time: '45m ago' }
      ]
    }
  ]);

  const [viewTranscriptTicket, setViewTranscriptTicket] = useState<TicketItem | null>(null);

  const handleClaimTicket = (id: string) => {
    setActiveTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Claimed', claimedBy: 'admin_owner' } : t));
    onSaveConfig(`You claimed ticket ${id}.`);
    onManualTrigger(`Ticket Claimed: ${id} assigned to Administrator.`, 'info', 'Ticket');
  };

  const handleCloseTicket = (id: string) => {
    setActiveTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Closed' } : t));
    onSaveConfig(`Ticket ${id} closed. Transcript compiled.`);
    onManualTrigger(`Ticket Closed: ${id} archived. Transcript generated.`, 'success', 'Ticket');
  };

  const handleSendReply = (ticketId: string) => {
    if (!replyText.trim()) return;
    const newMsg = { sender: 'admin_owner (Staff)', text: replyText, time: 'Just now' };
    setActiveTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          transcript: [...t.transcript, newMsg]
        };
      }
      return t;
    }));
    // Also update current viewed transcript modal to keep it synced
    if (viewTranscriptTicket && viewTranscriptTicket.id === ticketId) {
      setViewTranscriptTicket(prev => prev ? { ...prev, transcript: [...prev.transcript, newMsg] } : null);
    }
    setReplyText('');
  };

  const handleAddDept = () => {
    setDepts([...depts, { name: 'New Dept', icon: '❓', roleId: '' }]);
  };

  const handleRemoveDept = (i: number) => {
    setDepts(depts.filter((_, idx) => idx !== i));
  };

  const handleUpdate = (fields: Record<string, any>) => {
    onUpdateConfig('tickets', fields);
  };

  const handleSave = () => {
    handleUpdate({ depts });
    onSaveConfig('Ticket categories and staff permissions updated.');
    onManualTrigger('Ticket: Active workspace directories set up on Discord server.', 'success', 'Ticket');
  };

  const handleToggleEnable = () => {
    if (!ticketModule) return;
    const nextEnabled = ticketModule.status !== 'enabled';
    onUpdateConfig('tickets', {}, nextEnabled);
    onSaveConfig(`Ticket module ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`);
    onManualTrigger(`Ticket: Module status toggled to ${nextEnabled ? 'ACTIVE' : 'INACTIVE'}.`, nextEnabled ? 'success' : 'warning', 'Ticket');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">Ticket & Support System</h1>
            <p className="page-subtitle">Configure interactive ticket departments, SLA targets, and claim live chat requests.</p>
          </div>
          <button 
            className={`btn ${ticketModule?.status === 'enabled' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handleToggleEnable}
            style={{ 
              minWidth: '130px',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: ticketModule?.status === 'enabled' ? 'var(--color-success)' : 'rgba(255,255,255,0.4)',
              display: 'inline-block'
            }} />
            {ticketModule?.status === 'enabled' ? 'Module Enabled' : 'Module Disabled'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="section-panel">
        <div className="tabs-nav">
          {[
            { id: 'overview', label: 'Setup & Category' },
            { id: 'depts', label: 'Ticket Departments' },
            { id: 'queue', label: 'Tickets Queue' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="panel-body">
          
          {/* TAB 1: SETUP */}
          {activeTab === 'overview' && (
            <SetupWizard
              steps={['Overview', 'Required Resources', 'Activation']}
              activeStep={wizardStep}
              onStepChange={setWizardStep}
              progress={ticketModule?.progress || 0}
              errors={ticketModule?.errors || []}
              status={ticketModule?.status || 'not_configured'}
              onToggleEnable={handleToggleEnable}
              onSave={handleSave}
            >
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Ticket Support Setup</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Configure the category where support tickets are created as temporary text channels.
                    Specify helper roles who are notified and allowed to claim incoming tickets.
                  </p>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <ChannelSelect 
                    label="Support Channel Category"
                    channels={registry.channels}
                    selectedChannelId={categoryId}
                    onChange={id => handleUpdate({ categoryId: id })}
                    typeFilter={['category']}
                    helpText="Select parent Discord category under which active tickets will be spawned."
                  />
                  <RoleSelect 
                    label="Support Claim Staff Roles"
                    roles={registry.roles}
                    selectedRoleIds={staffRoleIds}
                    onChange={ids => handleUpdate({ staffRoleIds: ids })}
                    isMulti={true}
                    helpText="Roles notified and permitted to claim new support requests."
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
                  <ShieldCheck size={48} color="var(--color-success)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Ticket Configurations Ready</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    All bindings are set. Staff members will receive ticket notifications upon activation.
                  </p>
                </div>
              )}
            </SetupWizard>
          )}

          {/* TAB 2: DEPARTMENTS */}
          {activeTab === 'depts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Ticket Routing Departments</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Configure specific departments users can select when creating a ticket.</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleAddDept} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> Add Dept
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {depts.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <input className="form-input-text" style={{ width: 44, textAlign: 'center', fontSize: 18 }} value={d.icon} onChange={e => setDepts(prev => prev.map((x, idx) => idx === i ? { ...x, icon: e.target.value } : x))} placeholder="🎫" />
                    <input className="form-input-text" style={{ flex: 1 }} value={d.name} onChange={e => setDepts(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Department Name" />
                    <div style={{ minWidth: 200 }}>
                      <select className="form-input-text" value={d.roleId} onChange={e => setDepts(prev => prev.map((x, idx) => idx === i ? { ...x, roleId: e.target.value } : x))}>
                        <option value="">Notify default staff...</option>
                        {registry.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                    </div>
                    <button onClick={() => handleRemoveDept(i)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
                Save Departments
              </button>
            </div>
          )}

          {/* TAB 3: QUEUE */}
          {activeTab === 'queue' && (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>User</th>
                    <th>Department</th>
                    <th>Claimed By</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ticket.id}</td>
                      <td style={{ fontWeight: 600 }}>{ticket.user}</td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                          {ticket.dept}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {ticket.claimedBy ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <UserCheck size={12} color="var(--color-success)" />
                            {ticket.claimedBy}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge 
                          status={ticket.status === 'Open' ? 'warning' : ticket.status === 'Claimed' ? 'success' : 'info'} 
                          label={ticket.status} 
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setViewTranscriptTicket(ticket)}>
                            <FileText size={12} />
                            <span>Chat / Transcript</span>
                          </button>
                          {ticket.status === 'Open' && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleClaimTicket(ticket.id)}>
                              Claim
                            </button>
                          )}
                          {ticket.status === 'Claimed' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                              onClick={() => handleCloseTicket(ticket.id)}
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* CHAT & TRANSCRIPT MODAL */}
      {viewTranscriptTicket && (
        <div className="modal-overlay" onClick={() => setViewTranscriptTicket(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '100%' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Ticket Chat: {viewTranscriptTicket.id}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>User: {viewTranscriptTicket.user} · Dept: {viewTranscriptTicket.dept}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="icon-btn btn-sm" onClick={() => {
                  const content = viewTranscriptTicket.transcript.map(m => `[${m.time}] ${m.sender}: ${m.text}`).join('\n');
                  const b = new Blob([content], { type: 'text/plain' });
                  const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${viewTranscriptTicket.id}-transcript.txt`; a.click();
                }} title="Download Plain Transcript">
                  <Download size={14} />
                </button>
                <button className="icon-btn btn-sm" onClick={() => setViewTranscriptTicket(null)}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '320px', overflowY: 'auto', backgroundColor: '#0f0f11' }}>
              {viewTranscriptTicket.transcript.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: msg.sender.includes('Staff') ? 'flex-end' : 'flex-start', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ fontWeight: 700, color: msg.sender.includes('Staff') ? 'var(--accent-purple)' : 'var(--accent-primary)' }}>{msg.sender}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{msg.time}</span>
                  </div>
                  <div style={{
                    fontSize: '13px', color: '#dbdee1',
                    backgroundColor: msg.sender.includes('Staff') ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.03)',
                    border: msg.sender.includes('Staff') ? '1px solid rgba(124,92,252,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px', borderRadius: '8px',
                    wordBreak: 'break-word'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Interactive Reply Form */}
            {viewTranscriptTicket.status === 'Claimed' && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, backgroundColor: 'rgba(0,0,0,0.15)' }}>
                <input
                  type="text"
                  placeholder="Type a response to send to the ticket channel..."
                  className="form-input-text"
                  style={{ flex: 1 }}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendReply(viewTranscriptTicket.id)}
                />
                <button className="btn btn-primary" onClick={() => handleSendReply(viewTranscriptTicket.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Send size={12} /> Send
                </button>
              </div>
            )}

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.1)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewTranscriptTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
