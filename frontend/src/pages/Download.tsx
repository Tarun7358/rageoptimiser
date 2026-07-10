import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download as DownloadIcon, CheckCircle2, Monitor, Cpu, Layers, Lock,
  RefreshCw, Clock, ArrowRight, Info, ShieldCheck, Terminal, Smartphone, Apple
} from 'lucide-react';

export function Download() {
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable');
  const [activeTab, setActiveTab] = useState<'requirements' | 'changelog' | 'previous'>('requirements');

  const handleBackHome = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  const handleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', '/login');
    window.location.reload();
  };

  const handleDownload = () => {
    alert('Starting download for RageOptimiserSetup.exe (v1.0.0)...');
  };

  return (
    <div className="download-page" style={styles.container}>
      {/* Background Glows */}
      <div style={{ ...styles.bgGlow, ...styles.bgGlow1 }} />
      <div style={{ ...styles.bgGlow, ...styles.bgGlow2 }} />

      {/* Header / Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand} onClick={handleBackHome}>
          <div style={styles.brandBadgeIcon}>RO</div>
          <span style={styles.brandText}>RAGE OPTIMISER</span>
        </div>
        <div style={styles.navLinks}>
          <a href="/" onClick={handleBackHome} style={styles.navLink}>
            <ArrowLeft size={14} style={{ marginRight: 6 }} />
            Back to Website
          </a>
          <button onClick={handleLogin} style={styles.btnDashboard}>
            Control Panel
          </button>
        </div>
      </nav>

      {/* Main Grid Content */}
      <div style={styles.contentGrid}>
        {/* Left Column - Desktop app details & button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={styles.desktopCard}
        >
          <div style={styles.cardHeader}>
            <Monitor size={32} style={{ color: 'var(--accent-primary)', marginBottom: 12 }} />
            <h1 style={styles.mainTitle}>Rage Optimiser</h1>
            <p style={styles.subtitle}>Desktop Application</p>
          </div>

          <div style={styles.badgeRow}>
            <span style={styles.badgeStable}>Stable Channel</span>
            <span style={styles.badgeOS}>Windows 10/11 x64</span>
          </div>

          <ul style={styles.featureList}>
            {[
              'Native Windows Experience',
              'Faster than Browser',
              'Real-time Sync',
              'Auto Updates',
              'Secure Login',
              'Discord Rich Presence',
              'Native Notifications'
            ].map((feat) => (
              <li key={feat} style={styles.featureItem}>
                <CheckCircle2 size={16} style={styles.checkIcon} />
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          <div style={styles.downloadBox}>
            <button onClick={handleDownload} style={styles.btnDownload}>
              <DownloadIcon size={18} style={{ marginRight: 8 }} />
              Download for Windows
            </button>
            <p style={styles.downloadSub}>RageOptimiserSetup.exe (v1.0.0) | 120 MB</p>
          </div>

          <div style={styles.metaGrid}>
            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Version</span>
              <span style={styles.metaVal}>v1.0.0</span>
            </div>
            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Release Date</span>
              <span style={styles.metaVal}>July 2026</span>
            </div>
            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Size</span>
              <span style={styles.metaVal}>120 MB</span>
            </div>
          </div>

          <div style={styles.checksumBox}>
            <span style={styles.metaLabel}>SHA-256 Checksum</span>
            <code style={styles.checksumCode}>e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</code>
          </div>
        </motion.div>

        {/* Right Column - System details & flows */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={styles.detailsCol}
        >
          {/* Channel selector & stats */}
          <div style={styles.glassPanel}>
            <div style={styles.channelHeader}>
              <h3 style={styles.panelTitle}>Release Channels</h3>
              <div style={styles.selectorGroup}>
                <button
                  onClick={() => setChannel('stable')}
                  style={{ ...styles.selectorBtn, ...(channel === 'stable' ? styles.selectorBtnActive : {}) }}
                >
                  Stable
                </button>
                <button
                  onClick={() => setChannel('beta')}
                  style={{ ...styles.selectorBtn, ...(channel === 'beta' ? styles.selectorBtnActive : {}) }}
                >
                  Beta
                </button>
              </div>
            </div>
            <p style={styles.channelDesc}>
              {channel === 'stable'
                ? 'Our officially certified release, optimized for reliability and verified with anti-virus scans.'
                : 'Bleeding-edge build featuring pre-releases and anti-nuke analytics before final launch.'}
            </p>
          </div>

          {/* Download & Update Flows */}
          <div style={styles.glassPanel}>
            <h3 style={styles.panelTitle}>Download Pipeline</h3>
            <div style={styles.flowRow}>
              {[
                { title: 'User', desc: 'Requests download' },
                { title: 'Website', desc: 'Queries API' },
                { title: 'API Release', desc: 'Checks manifest' },
                { title: 'Setup.exe', desc: 'Delivers payload' }
              ].map((step, idx) => (
                <React.Fragment key={step.title}>
                  <div style={styles.flowNode}>
                    <span style={styles.flowTitle}>{step.title}</span>
                    <span style={styles.flowDesc}>{step.desc}</span>
                  </div>
                  {idx < 3 && <ArrowRight size={16} style={styles.flowArrow} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Auto Update System */}
          <div style={styles.glassPanel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <RefreshCw size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ ...styles.panelTitle, margin: 0 }}>Automatic Updates</h3>
            </div>
            <p style={{ ...styles.channelDesc, marginBottom: 16 }}>
              The Rage Optimiser desktop application features a silent background update supervisor. It polls our release endpoints on application boot and transitions automatically.
            </p>

            <div style={styles.updateTimeline}>
              {[
                { version: 'v1.0.0', desc: 'Launch App' },
                { version: 'Server Check', desc: 'Query Version' },
                { version: 'Installer', desc: 'Apply Patch' },
                { version: 'v1.0.1', desc: 'Restart Success' }
              ].map((t, idx) => (
                <div key={idx} style={styles.timelineItem}>
                  <div style={styles.timelinePoint}>
                    <div style={styles.timelineDot} />
                    {idx < 3 && <div style={styles.timelineLine} />}
                  </div>
                  <div style={styles.timelineContent}>
                    <span style={styles.timelineVer}>{t.version}</span>
                    <span style={styles.timelineDesc}>{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={styles.updateFooterNote}>Users won't need to manually download every update.</p>
          </div>
        </motion.div>
      </div>

      {/* Tabs Section - Specs, Changelog, Previous */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        style={styles.tabsContainer}
      >
        <div style={styles.tabsHeader}>
          {[
            { id: 'requirements', label: 'System Requirements' },
            { id: 'changelog', label: 'Changelog' },
            { id: 'previous', label: 'Previous Releases' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.tabContent}>
          {activeTab === 'requirements' && (
            <div style={styles.specsGrid}>
              <div style={styles.specCard}>
                <h4 style={styles.specTitle}>Windows Requirements</h4>
                <table style={styles.specTable}>
                  <tbody>
                    <tr>
                      <td style={styles.specLabel}>OS</td>
                      <td style={styles.specVal}>Windows 10 / 11 (64-bit)</td>
                    </tr>
                    <tr>
                      <td style={styles.specLabel}>Processor</td>
                      <td style={styles.specVal}>Intel Core i3 or AMD Ryzen 3 (Quad-Core)</td>
                    </tr>
                    <tr>
                      <td style={styles.specLabel}>Memory</td>
                      <td style={styles.specVal}>4 GB RAM minimum</td>
                    </tr>
                    <tr>
                      <td style={styles.specLabel}>Storage</td>
                      <td style={styles.specVal}>250 MB available SSD space</td>
                    </tr>
                    <tr>
                      <td style={styles.specLabel}>Network</td>
                      <td style={styles.specVal}>Broadband Internet Connection</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={styles.specCard}>
                <h4 style={styles.specTitle}>Features & Security Specs</h4>
                <ul style={styles.securityChecklist}>
                  {[
                    'Code-signed Windows executable to prevent malware alerts',
                    'All update bundles served strictly over secure HTTPS endpoints',
                    'SHA-256 checksums published for user verification',
                    'Automated release pipeline malware scanning via VirusTotal',
                    'Encrypted signature verification before local execution'
                  ].map((item, idx) => (
                    <li key={idx} style={styles.securityItem}>
                      <ShieldCheck size={16} style={{ color: '#34c759', flexShrink: 0 }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'changelog' && (
            <div style={styles.changelogContent}>
              <h4 style={styles.changelogVer}>v1.0.0 Release Notes — July 2026</h4>
              <p style={styles.changelogDesc}>
                This is the official initial release of the rebranded **Rage Optimiser** desktop client, bringing a native experience to Windows communities.
              </p>
              <ul style={styles.changelogList}>
                <li>Added full Discord OAuth2 secure single sign-on flows.</li>
                <li>Enabled live gateway telemetry reporting directly to taskbars.</li>
                <li>Configured automatic background updater service.</li>
                <li>Enabled Discord Rich Presence configuration.</li>
              </ul>
            </div>
          )}

          {activeTab === 'previous' && (
            <table style={styles.prevTable}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Release Date</th>
                  <th>Download</th>
                  <th>Changelog</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.prevVer}>v0.9.8-beta</td>
                  <td>June 2026</td>
                  <td>
                    <button style={styles.btnPrevDownload}>Download</button>
                  </td>
                  <td style={styles.prevDesc}>Initial Beta Test build</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Coming Soon Platforms */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        style={styles.comingSoonSection}
      >
        <h3 style={styles.comingSoonTitle}>Other Platforms</h3>
        <div style={styles.platformGrid}>
          {[
            { name: 'macOS', icon: <Apple size={24} /> },
            { name: 'Linux', icon: <Terminal size={24} /> },
            { name: 'Android', icon: <Smartphone size={24} /> },
            { name: 'iOS', icon: <Apple size={24} /> }
          ].map((plat) => (
            <div key={plat.name} style={styles.platformCard}>
              <div style={styles.platformIcon}>{plat.icon}</div>
              <span style={styles.platformName}>{plat.name}</span>
              <span style={styles.platformBadge}>Coming Soon</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0a0c12',
    color: '#f3f4f6',
    minHeight: '100vh',
    padding: '0 24px 80px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif"
  },
  bgGlow: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.15,
    pointerEvents: 'none',
    zIndex: 1
  },
  bgGlow1: {
    top: '-10%',
    left: '-10%',
    background: 'radial-gradient(circle, #ff5e3a 0%, transparent 70%)'
  },
  bgGlow2: {
    bottom: '10%',
    right: '-10%',
    background: 'radial-gradient(circle, #ff2a6d 0%, transparent 70%)'
  },
  navbar: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    position: 'relative',
    zIndex: 10
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  brandBadgeIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #ff5e3a 0%, #ff2a6d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: '14px',
    boxShadow: '0 0 12px rgba(255, 94, 58, 0.4)'
  },
  brandText: {
    fontWeight: 800,
    fontSize: '16px',
    letterSpacing: '0.05em',
    color: '#fff'
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px'
  },
  navLink: {
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s'
  },
  btnDashboard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    color: '#fff',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  contentGrid: {
    maxWidth: '1100px',
    margin: '60px auto 0',
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '40px',
    position: 'relative',
    zIndex: 10
  },
  desktopCard: {
    background: 'rgba(18, 22, 33, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '40px 32px',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column'
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  mainTitle: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#fff',
    margin: '0 0 4px 0',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--accent-primary)',
    margin: 0,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '32px'
  },
  badgeStable: {
    background: 'rgba(52, 199, 89, 0.12)',
    color: '#34c759',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: '6px',
    letterSpacing: '0.05em'
  },
  badgeOS: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#d1d5db',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '6px'
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 36px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: '#d1d5db'
  },
  checkIcon: {
    color: 'var(--accent-primary)'
  },
  downloadBox: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  btnDownload: {
    width: '100%',
    background: 'var(--accent-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(255, 59, 48, 0.25)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  downloadSub: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '10px',
    marginRight: 0,
    marginLeft: 0,
    marginBottom: 0
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '24px',
    marginBottom: '20px'
  },
  metaCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  metaLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: 700,
    letterSpacing: '0.05em'
  },
  metaVal: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f3f4f6'
  },
  checksumBox: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  checksumCode: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#9ca3af',
    wordBreak: 'break-all'
  },
  detailsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  glassPanel: {
    background: 'rgba(18, 22, 33, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(20px)'
  },
  channelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.2px',
    margin: 0
  },
  selectorGroup: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.2)',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  selectorBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 700,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  selectorBtnActive: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff'
  },
  channelDesc: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.5',
    margin: 0
  },
  flowRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginTop: '16px',
    flexWrap: 'wrap'
  },
  flowNode: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    padding: '10px 14px',
    flex: 1,
    minWidth: '90px',
    textAlign: 'center'
  },
  flowTitle: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '2px'
  },
  flowDesc: {
    display: 'block',
    fontSize: '10px',
    color: '#6b7280'
  },
  flowArrow: {
    color: 'rgba(255, 255, 255, 0.1)'
  },
  updateTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '16px',
    paddingLeft: '6px'
  },
  timelineItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start'
  },
  timelinePoint: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '4px'
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent-primary)',
    boxShadow: '0 0 8px rgba(255, 59, 48, 0.5)'
  },
  timelineLine: {
    width: '2px',
    height: '24px',
    background: 'rgba(255, 255, 255, 0.06)',
    position: 'absolute',
    top: '12px'
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  timelineVer: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#fff'
  },
  timelineDesc: {
    fontSize: '11px',
    color: '#6b7280'
  },
  updateFooterNote: {
    fontSize: '11px',
    color: 'var(--accent-primary)',
    margin: '16px 0 0 0',
    fontWeight: 600,
    letterSpacing: '0.02em'
  },
  tabsContainer: {
    maxWidth: '1100px',
    margin: '48px auto 0',
    background: 'rgba(18, 22, 33, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '16px',
    padding: '24px',
    position: 'relative',
    zIndex: 10
  },
  tabsHeader: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '12px',
    marginBottom: '20px'
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  tabBtnActive: {
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--accent-primary)'
  },
  tabContent: {},
  specsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '32px'
  },
  specCard: {},
  specTitle: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '16px',
    letterSpacing: '-0.2px'
  },
  specTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  specLabel: {
    color: '#6b7280',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    width: '100px'
  },
  specVal: {
    color: '#f3f4f6',
    fontWeight: 600,
    padding: '10px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
  },
  securityChecklist: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  securityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.4'
  },
  changelogContent: {},
  changelogVer: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '8px'
  },
  changelogDesc: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.5',
    margin: '0 0 16px 0'
  },
  changelogList: {
    paddingLeft: '20px',
    color: '#9ca3af',
    fontSize: '13px',
    lineHeight: '1.6'
  },
  prevTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  prevVer: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#fff'
  },
  btnPrevDownload: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    color: '#fff',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  prevDesc: {
    color: '#6b7280'
  },
  comingSoonSection: {
    maxWidth: '1100px',
    margin: '64px auto 0',
    position: 'relative',
    zIndex: 10
  },
  comingSoonTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '20px',
    textAlign: 'center'
  },
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px'
  },
  platformCard: {
    background: 'rgba(18, 22, 33, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  platformIcon: {
    color: '#4b5563',
    marginBottom: '4px'
  },
  platformName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#9ca3af'
  },
  platformBadge: {
    fontSize: '9px',
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: 800,
    letterSpacing: '0.05em'
  }
};
