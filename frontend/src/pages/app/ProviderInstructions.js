import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Copy, CheckCircle, ChevronDown, ChevronUp, Zap, Shield, HardDrive, ExternalLink, Download, Trash2 } from 'lucide-react';
import api from '../../api/client';

const STEPS = [
  {
    n:    1,
    icon: <Terminal size={18} color="#bf5af2" />,
    ac:   '#bf5af2',
    title: 'Install the StoraChain Agent',
    desc:  'Download the installer for your operating system from the section below. It automatically sets up the background service and links your account.',
    code:  null,
    note:  'The installer only asks for your StoraChain email and password — everything else is automatic.',
  },
  {
    n:    2,
    icon: <Shield size={18} color="#ff9f0a" />,
    ac:   '#ff9f0a',
    title: 'Open Node Setup Page',
    desc:  'Once the agent is running and logged in, navigate to the "Node Setup" tab in this dashboard.',
    code:  null,
    note:  'Your agent will auto-detect your local hardware and report it to the network.',
  },
  {
    n:    3,
    icon: <HardDrive size={18} color="#2997ff" />,
    ac:   '#2997ff',
    title: 'Select Disk & Storage Amount',
    desc:  'Choose the physical disk you want to use. We recommend using a dedicated partition or an external drive with at least 50GB free.',
    code:  null,
    note:  'Set the "Storage to Contribute" (GB). We will create a physical file to reserve this space (Anti-Cheat).',
  },
  {
    n:    4,
    icon: <Zap size={18} color="#30d158" />,
    ac:   '#30d158',
    title: 'Save & Go Online',
    desc:  'Click "Save Node Settings" then use the master toggle to go ONLINE.',
    code:  null,
    note:  'Your node is now active! You will start receiving storage chunks and earning SCT tokens.',
  }
];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy}
      style={{ position: 'absolute', top: 10, right: 10, padding: '5px 10px', background: copied ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${copied ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 7, color: copied ? '#30d158' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, transition: 'all 0.2s' }}>
      {copied ? <CheckCircle size={11} /> : <Copy size={11} />} {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, textAlign: 'left' }}>
        {q}
        {open ? <ChevronUp size={16} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.4)" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ paddingBottom: 16, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.65 }}>{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProviderInstructions() {
  const [active, setActive] = useState(null);
  const [node, setNode] = useState(null);
  const [osTab, setOsTab] = useState('windows');

  useEffect(() => {
    api.get('/providers/me').then((r) => setNode(r.data)).catch(() => setNode(null));
  }, []);

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Provider Setup Guide</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Run a storage node and earn SCT tokens by hosting files for seekers</p>
      </div>

      {/* Benefits strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { icon: <HardDrive size={16} color="#2997ff" />, label: 'Share Disk Space',  detail: 'Earn per GB stored',       ac: '#2997ff' },
          { icon: <Zap       size={16} color="#ff9f0a" />, label: 'Earn SCT Tokens',   detail: 'Paid per request served',  ac: '#ff9f0a' },
          { icon: <Shield    size={16} color="#30d158" />, label: 'System Fair Pricing', detail: 'AI computes market price', ac: '#30d158' },
        ].map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: `${b.ac}0a`, border: `1px solid ${b.ac}20`, borderRadius: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: b.ac + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{b.icon}</div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{b.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{b.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 26, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
          Live Setup Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>Provider Listing: <span style={{ color: node ? '#30d158' : '#ff9f0a' }}>{node ? 'Registered' : 'Not registered'}</span></div>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>Service: <span style={{ color: node?.isActive ? '#30d158' : '#ff9f0a' }}>{node ? (node.isActive ? 'Online' : 'Offline') : 'Checking…'}</span></div>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>System Price: <span style={{ color: '#64d2ff' }}>{node?.systemPricePerGB ?? '—'} SCT/GB</span></div>
        </div>
      </div>

      {/* ── OS Download Tabs ─────────────────────────────────────────────── */}
      {(() => {
        const BASE = 'https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/scripts';
        const DL   = 'https://github.com/MiyuruDilakshan/StoraChain/raw/main/provider-agent/scripts';
        const tabs = [
          {
            id: 'windows', label: 'Windows', emoji: '🪟',
            dlUrl:  `${DL}/windows-setup.bat`,
            dlName: 'windows-setup.bat',
            cmd:    null,
            steps:  [
              'Click "Download Installer" below',
              'Right-click the downloaded file → Run as Administrator',
              'Enter your StoraChain email & password when prompted',
              'Agent installs and starts automatically in the background',
            ],
            note: 'Node.js 20 will be silently auto-installed if not already present.',
          },
          {
            id: 'linux', label: 'Linux', emoji: '🐧',
            dlUrl:  `${DL}/linux-setup.sh`,
            dlName: 'linux-setup.sh',
            cmd:    `curl -fsSL ${BASE}/linux-setup.sh | sudo bash`,
            steps:  [
              'Open a terminal and run the one-liner below',
              'Enter your StoraChain email & password when prompted',
              'Agent starts as a PM2 background service',
            ],
            note: 'Requires Ubuntu 20+, Debian 11+, or CentOS 7+. Run as root / sudo.',
          },
          {
            id: 'vps', label: 'VPS / Server', emoji: '🖥️',
            dlUrl:  `${DL}/vps-setup.sh`,
            dlName: 'vps-setup.sh',
            cmd:    `curl -fsSL ${BASE}/vps-setup.sh | sudo bash`,
            steps:  [
              'SSH into your VPS as root',
              'Run the one-liner below',
              'Enter your StoraChain email & password when prompted',
              'Agent auto-starts via PM2 and survives reboots',
            ],
            note: 'Make sure TCP port 3001 is open on your VPS firewall for chunk requests.',
          },
        ];
        const t = tabs.find(x => x.id === osTab);
        return (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setOsTab(tab.id)}
                  style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${osTab === tab.id ? 'rgba(41,151,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: osTab === tab.id ? 'rgba(41,151,255,0.15)' : 'transparent', color: osTab === tab.id ? '#2997ff' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {tab.emoji} {tab.label}
                </button>
              ))}
            </div>
            <div style={{ background: 'rgba(41,151,255,0.04)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 16, padding: '22px 24px' }}>
              <ol style={{ margin: '0 0 16px', paddingLeft: 20, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', lineHeight: 2.1 }}>
                {t.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              {t.cmd && (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <pre style={{ margin: 0, padding: '13px 16px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#30d158', fontSize: '0.78rem', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre' }}>{t.cmd}</pre>
                  <CopyBtn text={t.cmd} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href={t.dlUrl} download={t.dlName} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 11, color: '#2997ff', textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem' }}>
                  <Download size={14} /> Download {t.dlName}
                </a>
                <a href="https://sepolia.etherscan.io/address/0x11473Ca21047272a008f27E73161b258C8b62F45" target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' }}>
                  Smart Contract <ExternalLink size={11} />
                </a>
                <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9 }}>
                  💡 {t.note}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Steps */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800, marginBottom: 18, letterSpacing: '-0.02em' }}>Setup Steps</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((step, i) => {
            const isOpen = active === step.n;
            return (
              <motion.div key={step.n}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}
                style={{ background: isOpen ? `${step.ac}08` : 'rgba(255,255,255,0.02)', border: isOpen ? `1px solid ${step.ac}30` : '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s' }}>
                <button onClick={() => setActive(isOpen ? null : step.n)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${step.ac}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Step {step.n}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{step.title}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div style={{ padding: '0 22px 20px', paddingTop: 4 }}>
                        {step.desc && <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.5)', fontSize: '0.87rem', lineHeight: 1.6 }}>{step.desc}</p>}
                        {step.code && (
                          <div style={{ position: 'relative' }}>
                            <pre style={{ margin: '0 0 12px', padding: '16px 18px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#30d158', fontSize: '0.82rem', fontFamily: 'monospace', overflowX: 'auto', lineHeight: 1.8, whiteSpace: 'pre' }}>
                              {step.code}
                            </pre>
                            <CopyBtn text={step.code} />
                          </div>
                        )}
                        {step.note && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', background: `${step.ac}08`, border: `1px solid ${step.ac}20`, borderRadius: 9 }}>
                            <span style={{ fontSize: '0.75rem', color: step.ac }}>💡</span>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{step.note}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px 32px' }}>
        <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 18px', letterSpacing: '-0.02em' }}>Frequently Asked Questions</h2>
        <FAQ q="Can I run a provider node on Windows?" a="Yes. The agent is a Node.js application and runs on Windows, macOS, and Linux. Ensure Node.js 18+ is installed." />
        <FAQ q="How are payments calculated?" a="You earn SCT tokens per GB stored per day. The platform computes a system price using capacity, uptime, and network demand. Payouts happen automatically when seekers' contracts settle." />
        <FAQ q="Is my data exposed to providers?" a="No. Files are encrypted and split into shards before distribution. Providers only hold encrypted fragments and cannot reconstruct the original file." />
        <FAQ q="What happens if my node goes offline?" a="Files are replicated across multiple nodes. If your node is offline, the network automatically serves from other replicas. Your uptime affects your reputation score." />
        <FAQ q="How do I uninstall the agent and release space?" a="Stop the service and run: node agent.js --uninstall --dir <your-storage-path>. That deletes local encrypted chunks, removes the reserve file, and deactivates the provider listing. Replication then reorganizes from surviving replicas and backups." />
        <FAQ q="How do I upgrade the agent?" a="Pull the latest release from GitHub and restart: git pull && npm install && node agent.js restart" />
      </div>

      <div style={{ marginTop: 22, padding: '24px 28px', background: 'rgba(255,55,95,0.05)', border: '1px solid rgba(255,55,95,0.15)', borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Trash2 size={20} color="#ff375f" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ff375f', margin: 0 }}>Uninstallation Process</h2>
        </div>
        <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          To gracefully remove your node from the StoraChain network and reclaim your disk space, follow these steps:
        </p>
        <ol style={{ margin: '0 0 20px', paddingLeft: 20, color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', lineHeight: 1.8 }}>
          <li>Go to the <strong style={{ color: '#fff' }}>My Storage Node</strong> page.</li>
          <li>Scroll down to the <strong style={{ color: '#ff375f' }}>Danger Zone</strong> section.</li>
          <li>Click <strong style={{ color: '#fff' }}>Uninstall Node</strong> and confirm.</li>
          <li>The agent will automatically wipe stored chunks and delete the reserved space file.</li>
        </ol>
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>Manual CLI Uninstall</div>
          <code style={{ fontSize: '0.8rem', color: '#fff' }}>node agent.js --uninstall --dir ./storachain-storage</code>
        </div>
      </div>
    </div>
  );
}
