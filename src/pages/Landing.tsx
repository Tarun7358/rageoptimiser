import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Zap, Users, Music, FileText, BarChart2, Bot, Lock,
  Star, ChevronRight, ExternalLink, CheckCircle2, Server, Globe,
  Activity, MessageCircle, ArrowRight, Sparkles
} from 'lucide-react';

const FEATURES = [
  {
    icon: <Shield size={22} />, color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)',
    title: 'Enterprise Security', subtitle: 'Anti-Nuke & Anti-Raid',
    desc: 'Real-time threat detection, automatic lockdowns, progressive rate limiting, and full audit trails for every action.'
  },
  {
    icon: <Zap size={22} />, color: '#FACC15', bg: 'rgba(250,204,21,0.10)',
    title: 'Smart Automation', subtitle: 'Rules & Triggers',
    desc: 'Build powerful if-then workflows, auto-responses, scheduled tasks, and conditional moderation rules without any code.'
  },
  {
    icon: <Users size={22} />, color: '#22C55E', bg: 'rgba(34,197,94,0.10)',
    title: 'Community Tools', subtitle: 'Engagement Suite',
    desc: 'Leveling system, giveaways, polls, starboard, birthday announcements, and deep role reward customization.'
  },
  {
    icon: <Music size={22} />, color: '#F97316', bg: 'rgba(249,115,22,0.10)',
    title: 'Premium Music', subtitle: 'Clutch Music Bot',
    desc: 'Dedicated audio bot with Spotify, YouTube & SoundCloud support, queue management, and 24/7 voice presence.'
  },
  {
    icon: <FileText size={22} />, color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',
    title: 'Advanced Tickets', subtitle: 'Support System',
    desc: 'Multi-department ticket routing, custom forms, SLA timers, full transcript exports, and team analytics.'
  },
  {
    icon: <BarChart2 size={22} />, color: '#E879F9', bg: 'rgba(232,121,249,0.10)',
    title: 'Deep Analytics', subtitle: 'Real-Time Intelligence',
    desc: 'Member growth charts, command usage stats, voice activity heatmaps, and moderation performance metrics.'
  },
];

const PRICING = [
  {
    name: 'Free', price: '$0', period: '/mo', color: '#6B7280',
    desc: 'For small communities just getting started.',
    features: ['Up to 500 members', 'Basic moderation', 'Logging & tickets', '5 automation rules', 'Community tools'],
    cta: 'Get Started', ctaVariant: 'outline'
  },
  {
    name: 'Premium', price: '$9', period: '/mo', color: '#7C5CFC', badge: 'Most Popular',
    desc: 'For growing communities that need more power.',
    features: ['Unlimited members', 'Anti-Nuke + Anti-Raid', 'Clutch Music bot', 'Unlimited automations', 'Advanced analytics', 'Priority support'],
    cta: 'Start Free Trial', ctaVariant: 'primary'
  },
  {
    name: 'Enterprise', price: '$29', period: '/mo', color: '#FACC15',
    desc: 'For large servers requiring maximum control.',
    features: ['Everything in Premium', 'Dedicated bot shard', 'Custom branding', 'API access', 'SLA guarantee', 'Dedicated support'],
    cta: 'Contact Sales', ctaVariant: 'outline'
  }
];

const STATS = [
  { val: '12,000+', label: 'Servers Protected' },
  { val: '2.4M+', label: 'Members Managed' },
  { val: '99.98%', label: 'Bot Uptime' },
  { val: '650K+', label: 'Threats Blocked' },
];

function AnimatedNumber({ value }: { value: string }) {
  return <span>{value}</span>;
}

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  const [liveStatus, setLiveStatus] = useState<{ latency?: number; online?: boolean } | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/status')
      .then(r => r.json())
      .then(d => setLiveStatus({ latency: d.latency, online: true }))
      .catch(() => setLiveStatus({ online: false }));
  }, []);

  const BOT_INVITE = `https://discord.com/api/oauth2/authorize?client_id=1519626369594818560&permissions=8&scope=bot%20applications.commands`;

  return (
    <div style={{ background: '#0B0F19', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#F3F4F6', overflowX: 'hidden' }}>
      {/* === NAVBAR === */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        background: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, color: '#fff'
          }}>CN</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>CLUTCH NATION</span>
          {liveStatus?.online && (
            <span style={{
              marginLeft: 8, display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              fontSize: 11, color: '#22C55E', fontWeight: 600
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              {liveStatus.latency}ms
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="#features" style={{ color: '#9CA3AF', textDecoration: 'none', fontSize: 14, padding: '6px 14px' }}>Features</a>
          <a href="#pricing" style={{ color: '#9CA3AF', textDecoration: 'none', fontSize: 14, padding: '6px 14px' }}>Pricing</a>
          <a href={BOT_INVITE} target="_blank" rel="noopener noreferrer" style={{ color: '#9CA3AF', textDecoration: 'none', fontSize: 14, padding: '6px 14px' }}>Add Bot</a>
          <button onClick={onGetStarted} style={{
            background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)',
            border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>
            Dashboard →
          </button>
        </div>
      </nav>

      {/* === HERO === */}
      <section style={{
        paddingTop: 160, paddingBottom: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        position: 'relative', overflow: 'hidden', paddingLeft: 24, paddingRight: 24
      }}>
        {/* Background glows */}
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,140,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 20, marginBottom: 24,
            background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.3)',
            fontSize: 13, color: '#A78BFA', fontWeight: 600
          }}>
            <Sparkles size={14} /> Enterprise Discord Management — Update 1
          </div>

          <h1 style={{
            fontSize: 'clamp(42px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.1,
            maxWidth: 900, margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #fff 30%, #A78BFA 70%, #60A5FA 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>
            The Most Advanced Discord Management Platform
          </h1>

          <p style={{ fontSize: 18, color: '#9CA3AF', maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Enterprise-grade security, moderation, music, analytics and automation — all managed from one stunning dashboard.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={BOT_INVITE} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)',
              color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 8px 30px rgba(124,92,252,0.35)'
            }}>
              <Bot size={18} /> Add to Discord
            </a>
            <button onClick={onGetStarted} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer'
            }}>
              Open Dashboard <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* === STATS BAR === */}
      <section style={{
        padding: '32px 48px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24,
        maxWidth: 1100, margin: '0 auto'
      }}>
        {STATS.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg, #7C5CFC, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.val}</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>{s.label}</div>
          </motion.div>
        ))}
      </section>

      {/* === FEATURES === */}
      <section id="features" style={{ padding: '100px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: '#7C5CFC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Everything You Need</div>
          <h2 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 16px', background: 'linear-gradient(135deg, #fff, #9CA3AF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Built for Serious Communities
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 560, margin: '0 auto' }}>
            Every feature you need to run a professional Discord server, connected in one unified platform.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
          {FEATURES.map((f, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              style={{
                background: '#151923', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: 28, cursor: 'default',
                transition: 'all 0.25s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F3F4F6' }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: f.color, fontWeight: 600 }}>{f.subtitle}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* === PRICING === */}
      <section id="pricing" style={{ padding: '100px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: '#7C5CFC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Pricing</div>
          <h2 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 16px' }}>Simple, Transparent Pricing</h2>
          <p style={{ fontSize: 16, color: '#6B7280' }}>No hidden fees. Cancel anytime.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {PRICING.map((plan, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{
                background: i === 1 ? 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(79,140,255,0.08))' : '#151923',
                border: `1px solid ${i === 1 ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 20, padding: 32, position: 'relative',
                boxShadow: i === 1 ? '0 0 40px rgba(124,92,252,0.15)' : 'none'
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)',
                  padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap'
                }}>{plan.badge}</div>
              )}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 48, fontWeight: 900, color: '#F3F4F6' }}>{plan.price}</span>
                  <span style={{ fontSize: 15, color: '#6B7280' }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>{plan.desc}</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#D1D5DB' }}>
                    <CheckCircle2 size={15} color={plan.color} style={{ flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={i < 2 ? onGetStarted : undefined}
                style={{
                  width: '100%', padding: '13px', borderRadius: 10,
                  background: plan.ctaVariant === 'primary' ? 'linear-gradient(135deg, #7C5CFC, #4F8CFF)' : 'rgba(255,255,255,0.06)',
                  border: plan.ctaVariant === 'primary' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* === CTA BANNER === */}
      <section style={{ padding: '80px 48px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{
            background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(79,140,255,0.08))',
            border: '1px solid rgba(124,92,252,0.3)', borderRadius: 24, padding: '60px 48px'
          }}
        >
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 16px' }}>Ready to Level Up Your Server?</h2>
          <p style={{ fontSize: 16, color: '#9CA3AF', margin: '0 0 32px' }}>Join 12,000+ communities already using Clutch Nation.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <a href={BOT_INVITE} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)',
              color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none'
            }}>
              <Bot size={16} /> Add Bot Free
            </a>
            <button onClick={onGetStarted} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer'
            }}>
              Dashboard Login <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* === FOOTER === */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '40px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7C5CFC, #4F8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>CN</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Clutch Nation</span>
          <span style={{ fontSize: 12, color: '#4B5563', marginLeft: 8 }}>© 2025 All rights reserved</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#6B7280' }}>
          <a href="#" style={{ color: '#6B7280', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" style={{ color: '#6B7280', textDecoration: 'none' }}>Terms of Service</a>
          <a href={BOT_INVITE} target="_blank" rel="noopener noreferrer" style={{ color: '#7C5CFC', textDecoration: 'none' }}>Invite Bot</a>
        </div>
      </footer>
    </div>
  );
}
