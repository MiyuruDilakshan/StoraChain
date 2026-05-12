import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Zap, Coins, HardDrive, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Lock } from 'lucide-react';

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12, textAlign: 'left' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 8 }}>Q.</span>{q}
        </span>
        {open ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ paddingBottom: 14, paddingLeft: 24, fontSize: '0.85rem', color: 'rgba(255,255,255,0.48)', lineHeight: 1.65 }}>{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Help() {
  const sections = [
    {
      title: 'Getting Started',
      icon: <Zap size={20} color="#ff9f0a" />,
      items: [
        { q: 'How do I become a provider?', a: 'Download the provider agent for your OS (Windows .bat or Linux .sh), run it, and follow the terminal instructions. It only asks for your email and password. You then configure storage allocation through your dashboard.' },
        { q: 'What is a Storage Seeker?', a: 'Seekers are users who pay SCT tokens to store their files securely across our decentralized network of provider nodes. Files are encrypted and split into redundant chunks.' },
        { q: 'Is my data safe?', a: 'Yes. Every file is encrypted locally before upload and split into 3+ redundant chunks across different global providers. If any provider goes offline, chunks are automatically re-replicated.' }
      ]
    },
    {
      title: 'Earnings & Rewards',
      icon: <Coins size={20} color="#30d158" />,
      items: [
        { q: 'When do I get paid?', a: 'Reward cycles run daily at midnight UTC. Tokens are distributed based on your storage contributed, uptime percentage, and reputation score.' },
        { q: 'How can I withdraw?', a: 'Go to the "Withdraw" page in your dashboard. You can bridge your SCT tokens to Sepolia ETH or withdraw via supported marketplace partners.' },
        { q: 'Does low reputation affect earnings?', a: 'Yes. Your reputation score (0–100) is a direct multiplier on your reward eligibility. Providers with score below 50 earn significantly less, and suspended providers earn nothing until reinstated.' }
      ]
    },
    {
      title: 'Node Management',
      icon: <HardDrive size={20} color="#2997ff" />,
      items: [
        { q: 'How do I go offline?', a: 'Use the master toggle on your Node Setup page. This gracefully pauses your node without penalizing your reputation. Just don\'t stay offline for extended periods.' },
        { q: 'Can I change my disk?', a: 'Yes. First uninstall the agent (which releases reserved space from your current disk), then re-run the setup script and configure the new disk via your dashboard.' },
        { q: 'Agent says "Wallet missing"?', a: 'You can start the agent without a wallet. Simply update your wallet address in the Node Setup page. The agent will pick it up on the next heartbeat.' }
      ]
    },
    {
      title: 'Integrity & Anti-Cheat System',
      icon: <ShieldAlert size={20} color="#bf5af2" />,
      accent: '#bf5af2',
      items: [
        { q: 'What is the physical storage reservation?', a: 'When you allocate storage, the system creates a binary file (StoraChain_Reserved_Space.bin) on your selected disk that physically occupies the allocated space. This prevents you from using that space for other purposes while you\'re a provider. The OS reports this as used space on your drive.' },
        { q: 'What happens if I delete the reservation file?', a: 'The integrity monitor detects the missing file within 30 seconds (on the next heartbeat) and automatically tries to recreate it. The incident is logged as a RESERVATION_MISSING violation and 15 penalty points are applied to your reputation. Persistent deletion leads to automatic suspension.' },
        { q: 'What are penalty points?', a: 'Penalty points accumulate when integrity violations are detected. Each violation type has a severity: Chunk Tampered = 20 pts, Reservation Missing = 15 pts, Reservation Shrunk = 10 pts, Chunk Missing = 5 pts, Offline without notice = 3 pts per missed heartbeat. At 50+ points your node is automatically suspended.' },
        { q: 'How is my reputation score calculated?', a: 'Reputation starts at 100. Each violation deducts points proportional to severity (violation_points × 0.3). Clean heartbeats recover +0.5 points each (max 100). Providers with high reputation get priority in the AI-based provider matching algorithm.' },
        { q: 'What is a "heartbeat" and why does it matter?', a: 'Every 30 seconds your provider agent sends a heartbeat to the backend with your usage stats and a live integrity report. If 3+ consecutive heartbeats are missed (90 seconds), the backend marks your node as offline and starts applying offline penalty points.' },
        { q: 'Can I appeal a suspension?', a: 'Yes. Contact your administrator with your provider email and a description of what happened. Admins can clear suspensions and reset penalty points from the Admin Dashboard under "Provider Integrity".' },
        { q: 'Are stored chunks also checked?', a: 'Yes. The integrity monitor randomly samples up to 10 stored chunks per heartbeat cycle and verifies each one using a CRC32 checksum recorded at write time. If a chunk is found tampered or missing, a violation is recorded immediately.' },
        { q: 'Why are two processes running silently?', a: 'The StoraChain agent runs as a background PM2 service — no visible windows. All disk checks and integrity monitoring happen silently using hidden subprocess calls. You should not see any CMD windows pop up.' }
      ]
    },
  ];

  return (
    <div style={{ paddingBottom: 60 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(191,90,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={22} color="#bf5af2" />
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Help & Documentation</h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.05rem', margin: 0 }}>Everything you need to know about StoraChain network, node operations, and the anti-cheat system.</p>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map((sec, i) => (
          <motion.div
            key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${sec.accent ? sec.accent + '22' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              {sec.icon}
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>{sec.title}</h2>
              {sec.accent && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, color: sec.accent, background: sec.accent + '18', border: `1px solid ${sec.accent}33`, padding: '2px 10px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>FAQ</span>}
            </div>
            <div>
              {sec.items.map((item, j) => <FAQItem key={j} q={item.q} a={item.a} />)}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Penalty reference card */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ marginTop: 24, padding: '24px 28px', background: 'rgba(191,90,242,0.05)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Lock size={18} color="#bf5af2" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#bf5af2', margin: 0 }}>Penalty Reference Table</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {[
            { type: 'CHUNK_TAMPERED', pts: 20, color: '#ff375f', desc: 'Chunk data modified after storage' },
            { type: 'RESERVATION_MISSING', pts: 15, color: '#ff375f', desc: 'Physical reserve file deleted' },
            { type: 'RESERVATION_SHRUNK', pts: 10, color: '#ff9f0a', desc: 'Reserve file reduced in size' },
            { type: 'CHUNK_MISSING', pts: 5, color: '#ff9f0a', desc: 'Stored chunk file not found' },
            { type: 'NODE_OFFLINE_MISS', pts: 3, color: '#ff9f0a', desc: 'Per missed heartbeat (max 10)' },
          ].map((p, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px', border: `1px solid ${p.color}22` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: p.color, letterSpacing: '0.06em', marginBottom: 6 }}>{p.type}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: p.color, marginBottom: 4 }}>+{p.pts} pts</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.2)', borderRadius: 10, fontSize: '0.8rem', color: '#ff375f', fontWeight: 600 }}>
          ⚠ Automatic suspension threshold: 50 penalty points
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        style={{ marginTop: 16, padding: 28, background: 'rgba(255,55,95,0.05)', border: '1px solid rgba(255,55,95,0.15)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,55,95,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={24} color="#ff375f" />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ff375f', margin: '0 0 4px' }}>Technical Support</h3>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Running into issues? Check our <a href="https://discord.gg/storachain" rel="noopener noreferrer" style={{ color: '#ff375f', textDecoration: 'none', fontWeight: 700 }}>Discord community</a> or contact <strong>support@storachain.io</strong> with your provider email and node region.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
