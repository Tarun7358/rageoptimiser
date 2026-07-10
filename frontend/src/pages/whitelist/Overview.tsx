import React from 'react';
import type { ModuleState, DiscordRole, DiscordChannel } from '../../hooks/useDiscordSync';
import { ShieldCheck, Zap, Users, Shield, ArrowRight } from 'lucide-react';

interface OverviewProps {
  modules?: ModuleState[];
  registry: { roles: DiscordRole[]; channels: DiscordChannel[] };
  onNavigate: (page: string) => void;
}

export function WhitelistOverview({ modules, registry, onNavigate }: OverviewProps) {
  const botMod = (modules || []).find(m => m.id === 'bot_whitelist');
  const memberMod = (modules || []).find(m => m.id === 'member_whitelist');
  const roleMod = (modules || []).find(m => m.id === 'role_whitelist');

  const bots = botMod?.config?.bots || [];
  const members = memberMod?.config?.members || [];
  const roles = roleMod?.config?.roles || [];

  const activeBots = bots.filter((b: any) => b.status === 'active').length;
  const activeMembers = members.filter((m: any) => m.status === 'active').length;
  const activeRoles = roles.filter((r: any) => r.status === 'active').length;

  return (
    <div className="module-page" style={{ padding: '32px' }}>
      <div className="module-header" style={{ marginBottom: '32px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--accent-primary)" />
            Whitelist & Trust Overview
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>High-level statistics and management for trusted entities across the server.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* Bot Whitelist Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#3b82f6' }}>
              <Zap size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Bot Whitelist</h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{bots.length} Total Bots Tracked</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{activeBots}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-warning)' }}>{bots.length - activeBots}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inactive/Pending</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('whitelist-bots')} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', marginTop: 'auto' }}>
            Manage Bots <ArrowRight size={16} />
          </button>
        </div>

        {/* Member Whitelist Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981' }}>
              <Users size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Member Whitelist</h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{members.length} Total Members Tracked</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{activeMembers}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('whitelist-members')} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', marginTop: 'auto' }}>
            Manage Members <ArrowRight size={16} />
          </button>
        </div>

        {/* Role Whitelist Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
              <Shield size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Role Whitelist</h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{roles.length} Total Roles Tracked</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{activeRoles}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('whitelist-roles')} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', marginTop: 'auto' }}>
            Manage Roles <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
