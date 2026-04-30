import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Copy, CheckCircle, ChevronDown, ChevronUp, Zap, Shield, HardDrive, Wifi, Download, Settings, Play } from 'lucide-react';
import api from '../../api/client';



function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <button onClick={copy}
      style={{ position: 'absolute', top: 10, right: 10, padding: '5px 10px', background: copied ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${copied ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 7, color: copied ? '#30d158' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600 }}>
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

  useEffect(() => {
    api.get('/providers/me').then((r) => setNode(r.data)).catch(() => setNode(null));
  }, []);

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Provider Setup Guide</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Run a storage node and earn SCT tokens by hosting encrypted file shards</p>
      </div>

      {/* Benefits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { icon: <HardDrive size={16} color="#2997ff" />, label: 'Share Disk Space', detail: 'Offer unused storage', ac: '#2997ff' },
          { icon: <Zap size={16} color="#ff9f0a" />, label: 'Earn SCT Tokens', detail: 'Paid daily for uptime', ac: '#ff9f0a' },
          { icon: <Shield size={16} color="#30d158" />, label: 'Zero Data Exposure', detail: 'Only encrypted shards', ac: '#30d158' },
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

      {/* Live Status */}
      <div style={{ marginBottom: 26, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Live Node Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>Registration: <span style={{ color: node ? '#30d158' : '#ff9f0a', fontWeight: 600 }}>{node ? '✓ Registered' : '✗ Not registered'}</span></div>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>Status: <span style={{ color: node?.isActive ? '#30d158' : '#ff9f0a', fontWeight: 600 }}>{node?.isActive ? 'Online' : 'Offline'}</span></div>
          <div style={{ fontSize: '0.82rem', color: '#fff' }}>Capacity: <span style={{ color: '#64d2ff', fontWeight: 600 }}>{node?.capacityGB ?? '—'} GB</span></div>
        </div>
      </div>

      {/* Automated Setup Box */}
      <div style={{ marginBottom: 32, padding: '18px 20px', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 16 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#30d158', marginBottom: 10 }}>⚡ Automated Setup (Linux / VPS)</div>
        <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.87rem' }}>
          Run this single command on your Ubuntu/Debian system. The installer will install Node.js, ask for your StoraChain login, configure everything, and run the agent in the background.
        </p>
        <div style={{ position: 'relative' }}>
          <pre style={{ margin: 0, padding: '14px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#30d158', fontSize: '0.82rem', fontFamily: 'monospace', overflowX: 'auto', lineHeight: 1.8 }}>
{`curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/StoraChain/main/provider-agent/scripts/vps-setup.sh | bash`}
          </pre>
          <CopyBtn text={`curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/StoraChain/main/provider-agent/scripts/vps-setup.sh | bash`} />
        </div>
      </div>

      <div style={{ marginBottom: 40, padding: '18px 20px', background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.2)', borderRadius: 16 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#2997ff', marginBottom: 10 }}>🖥️ Automated Setup (Windows)</div>
        <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.87rem' }}>
          Download and run the Windows setup batch script. It automatically installs Node.js if missing, sets up the files, and launches the interactive setup wizard.
        </p>
        <div style={{ position: 'relative' }}>
          <pre style={{ margin: 0, padding: '14px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#64d2ff', fontSize: '0.82rem', fontFamily: 'monospace', overflowX: 'auto', lineHeight: 1.8 }}>
{`1. Download windows-setup.bat
2. Double-click to run
3. Follow the on-screen prompts`}
          </pre>
        </div>
      </div>

      {/* CLI Flags Reference */}
      <div style={{ marginBottom: 32, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '22px 26px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>CLI Flags Reference</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: '0.8rem' }}>
          {[
            ['--space <GB>', 'Storage capacity to offer (default: 10)'],
            ['--port <num>', 'HTTP server port (default: 3001)'],
            ['--wallet <addr>', 'Your Ethereum wallet address'],
            ['--region <str>', 'Geographic region (e.g. EU, US)'],
            ['--dir <path>', 'Storage directory path'],
            ['--backend <url>', 'Backend URL (default: localhost:5000)'],
            ['--uninstall', 'Wipe chunks & deactivate node'],
          ].map(([flag, desc], i) => (
            <React.Fragment key={i}>
              <code style={{ color: '#2997ff', fontFamily: 'monospace', fontWeight: 600 }}>{flag}</code>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px 32px', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 18px', letterSpacing: '-0.02em' }}>Frequently Asked Questions</h2>
        <FAQ q="Can I run a provider node on Windows?" a="Yes. The agent is a Node.js application and runs on Windows, macOS, and Linux. Ensure Node.js 18+ is installed." />
        <FAQ q="How are payments calculated?" a="You earn SCT tokens per GB stored per day. The platform computes a fair price using capacity, uptime, and network demand. Payouts happen automatically via daily reward cycles." />
        <FAQ q="Is my data exposed?" a="No. Files are AES-256 encrypted and split into shards before distribution. Providers only hold encrypted fragments and cannot reconstruct the original file." />
        <FAQ q="What if my node goes offline?" a="Files are replicated across multiple nodes. If your node is offline, the network serves from other replicas. Your uptime score affects your reward rate." />
        <FAQ q="How do I stop and uninstall?" a="Press Ctrl+C to stop the agent. To fully uninstall and release space: node agent.js --uninstall" />
      </div>

      {/* Uninstall */}
      <div style={{ padding: '18px 20px', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.22)', borderRadius: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff9f0a', marginBottom: 8 }}>Uninstall</div>
        <div style={{ position: 'relative' }}>
          <pre style={{ margin: 0, padding: '14px 16px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: '0.82rem', overflowX: 'auto' }}>{`node agent.js --uninstall`}</pre>
          <CopyBtn text="node agent.js --uninstall" />
        </div>
        <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Deletes encrypted chunks, releases reserved disk space, and deactivates your node. Replication automatically redistributes data to remaining providers and backup tiers.
        </p>
      </div>
    </div>
  );
}
