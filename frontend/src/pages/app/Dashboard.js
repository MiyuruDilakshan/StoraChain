import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HardDrive, FolderOpen, ShoppingBag,
  Coins, Activity,
  TrendingUp, ArrowUpRight, Clock, Zap, CreditCard, DollarSign,
  AlertCircle, X, Terminal,
} from 'lucide-react';
import api from '../../api/client';

const PLAN_COLORS = { free: '#30d158', basic: '#2997ff', pro: '#bf5af2', premium: '#ff9f0a' };
const PLAN_LABELS = { free: 'Free', basic: 'Basic', pro: 'Pro', premium: 'Premium' };

/* ── Tiny animated star background ─────────────────────────────────── */
function Stars() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 0.8 + 0.1,
      s: Math.random() * 0.12 + 0.02,
      o: Math.random() * 0.4 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.o})`; ctx.fill();
        s.y -= s.s;
        if (s.y + s.r < 0) { s.y = canvas.height + s.r; s.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* ── Stat card ──────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ borderColor: accent + '40', boxShadow: `0 0 28px ${accent}12` }}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18, padding: '24px 26px', position: 'relative', overflow: 'hidden',
        transition: 'all 0.25s',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle,${accent}18 0%,transparent 70%)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.28)' }}>{sub}</div>
    </motion.div>
  );
}

/* ── Quick-action button ────────────────────────────────────────────── */
function ActionBtn({ label, color, bg, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: '100%', marginBottom: 8, padding: '13px 18px',
        background: bg, border: `1px solid ${color}30`,
        borderRadius: 12, color, fontSize: '0.87rem', fontWeight: 700,
        cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color + '70'}
      onMouseLeave={e => e.currentTarget.style.borderColor = color + '30'}
    >
      {label} <ArrowUpRight size={14} />
    </motion.button>
  );
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [providerNode, setProviderNode] = useState(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
  // Config modal states
  const [disks, setDisks] = useState([]);
  const [selectedDisk, setSelectedDisk] = useState('');
  const [configForm, setConfigForm] = useState({ capacityGB: '', walletAddress: '', diskPath: '' });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');

  const isProvider = user?.role === 'provider';
  const accent     = isProvider ? '#30d158' : '#2997ff';

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));

    if (isProvider) {
      // Silently handle 404 — provider simply has no node yet
      api.get('/providers/me')
        .then(r => setProviderNode(r.data))
        .catch(e => {
          if (e?.response?.status !== 404) console.warn('[Dashboard] Provider fetch:', e.message);
          setProviderNode(null);
        });
    }
  }, []);

  const refreshProviderState = async () => {
    try {
      const nodeRes = await api.get('/providers/me').catch(e => {
        if (e?.response?.status !== 404) console.warn('[Dashboard] Refresh:', e.message);
        return { data: null };
      });
      setProviderNode(nodeRes.data);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (providerNode && providerNode.capacityGB === 0 && disks.length === 0) {
      // Fetch disks
      api.get('/providers/disk-info').then(res => {
        setDisks(res.data.disks || []);
        if (res.data.disks?.length > 0) {
          const first = res.data.disks[0];
          setSelectedDisk(first.mountpoint);
          const suggested = Math.floor(first.freeGB * 0.8 * 10) / 10;
          setConfigForm({ diskPath: first.mountpoint, capacityGB: String(suggested > 1 ? suggested : 1), walletAddress: '' });
        }
      }).catch(e => {
        setConfigError(e.response?.data?.message || 'Failed to fetch disk info.');
      });
    }
  }, [providerNode, disks.length]);

  const handleDiskSelect = (e) => {
    const mountpoint = e.target.value;
    const disk = disks.find(d => d.mountpoint === mountpoint);
    setSelectedDisk(mountpoint);
    if (disk) {
      const suggested = Math.floor(disk.freeGB * 0.8 * 10) / 10;
      setConfigForm(f => ({ ...f, diskPath: mountpoint, capacityGB: String(suggested > 1 ? suggested : 1) }));
    }
  };

  const handleSaveConfig = async () => {
    const cap = parseFloat(configForm.capacityGB);
    if (!cap || cap <= 0) return setConfigError('Please enter a valid storage size.');
    
    const selDiskInfo = disks.find(d => d.mountpoint === selectedDisk);
    if (selDiskInfo && cap > selDiskInfo.freeGB) {
      return setConfigError(`Not enough free space. Only ${selDiskInfo.freeGB.toFixed(1)} GB available.`);
    }

    setConfigLoading(true);
    setConfigError('');
    try {
      await api.put('/providers/update', {
        capacityGB: cap,
        walletAddress: configForm.walletAddress.trim() || undefined,
        diskPath: configForm.diskPath || undefined,
      });
      // Start the node automatically after config
      await api.put('/providers/toggle-pause');
      await refreshProviderState();
    } catch (e) {
      setConfigError('Failed to save settings.');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleProviderToggle = async () => {
    if (!isProvider) return;
    // If node is not set up, show an informative modal instead of doing nothing
    if (!providerNode) {
      setShowSetupModal(true);
      return;
    }
    setOnlineBusy(true);
    try {
      await api.put('/providers/toggle-pause');
      await refreshProviderState();
    } catch (e) {
      console.warn('[Dashboard] Toggle failed:', e.message);
    } finally {
      setOnlineBusy(false);
    }
  };

  const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return gb.toFixed(2) + ' GB';
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return mb.toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  const planId    = stats?.plan    || user?.plan    || 'free';
  const planColor = PLAN_COLORS[planId] || '#30d158';
  const planLabel = PLAN_LABELS[planId] || 'Free';
  const quotaGB   = stats?.storageQuotaGB || user?.storageQuotaGB || 2;
  const usedGB    = stats?.usedStorageGB  || 0;
  const usedPct   = quotaGB > 0 ? ((usedGB / quotaGB) * 100).toFixed(0) : 0;

  /* ── Seeker stat cards ── */
  const seekerCards = [
    { icon: <FolderOpen size={20} color="#2997ff" />, label: 'Files Stored',   accent: '#2997ff', value: loading ? '…' : (stats?.totalFiles ?? 0),                sub: 'Across distributed nodes'       },
    { icon: <HardDrive  size={20} color="#bf5af2" />, label: 'Storage Used',   accent: '#bf5af2', value: loading ? '…' : `${usedGB.toFixed(2)} GB`,               sub: `of ${quotaGB} GB quota (${usedPct}%)`  },
    { icon: <Coins      size={20} color="#ff9f0a" />, label: 'SCT Balance',    accent: '#ff9f0a', value: loading ? '…' : `${stats?.sctBalance ?? 0} SCT`,          sub: `Spent: ${stats?.totalSpentSCT ?? 0} SCT`},
    { icon: <DollarSign size={20} color="#2997ff" />, label: 'Demo USD',       accent: '#2997ff', value: loading ? '…' : `$${(stats?.demoUSD ?? 50).toFixed(2)}`,  sub: 'Simulated USD wallet'            },
  ];

  /* ── Provider stat cards ── */
  const providerCards = [
    { icon: <HardDrive  size={20} color="#30d158" />, label: 'Storage Offered', accent: '#30d158', value: loading ? '…' : `${stats?.capacityGB ?? 0} GB`, sub: `${stats?.usedGB ?? 0} GB used`    },
    { icon: <Coins      size={20} color="#ff9f0a" />, label: 'Tokens Earned',   accent: '#ff9f0a', value: loading ? '…' : `${stats?.tokensEarned ?? 0} SCT`, sub: `Balance: ${stats?.pendingBalance ?? 0} SCT` },
    { icon: <TrendingUp size={20} color="#2997ff" />, label: 'Fiat Earned',     accent: '#2997ff', value: loading ? '…' : `$${stats?.fiatEarnedUSD ?? 0}`, sub: 'Via Stripe marketplace'         },
    { icon: <Activity   size={20} color="#bf5af2" />, label: 'Uptime',          accent: '#bf5af2', value: loading ? '…' : `${stats?.uptimePct ?? 100}%`,    sub: stats?.isOnline ? 'Node Online' : 'Node Offline' },
  ];

  const cards = isProvider ? providerCards : seekerCards;
  const providerIsOnline = providerNode && !providerNode.isPaused && providerNode.isActive;
  const providerStatusLabel = !providerNode
    ? 'Setup Required'
    : providerIsOnline
      ? 'Online'
      : 'Offline';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }}>
      <Stars />

      {/* ── Setup-Required Modal ───────────────────────────────────────── */}
      {showSetupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: 24 }}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3 }}
            style={{ background: 'linear-gradient(135deg,#0d1117,#111827)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 480, position: 'relative' }}>
            {/* Close */}
            <button onClick={() => setShowSetupModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>

            {/* Icon */}
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <AlertCircle size={30} color="#ff9f0a" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
              Node Not Set Up Yet
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 8px' }}>
              You haven't installed the StoraChain Provider Agent on this device yet.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 28px' }}>
              To go online and start earning SCT tokens, you need to:
            </p>

            <ol style={{ margin: '0 0 28px', paddingLeft: 22, color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 2 }}>
              <li>Download and run <strong style={{ color: '#fff' }}>windows-setup.bat</strong> (or <strong style={{ color: '#fff' }}>linux-setup.sh</strong>) from the Setup page.</li>
              <li>The installer will link this account to your node automatically.</li>
              <li>Once the agent is running, come back and press the toggle.</li>
            </ol>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setShowSetupModal(false); navigate('/app/setup'); }}
                style={{ flex: 1, padding: '13px 0', background: 'linear-gradient(135deg,rgba(255,159,10,0.25),rgba(255,159,10,0.1))', border: '1px solid rgba(255,159,10,0.5)', borderRadius: 12, color: '#ff9f0a', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Terminal size={16} /> View Setup Guide
              </button>
              <button onClick={() => setShowSetupModal(false)}
                style={{ padding: '13px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Dismiss
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Config-Required Modal (Blocking) ────────────────────────────── */}
      {providerNode && providerNode.capacityGB === 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: 24 }}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3 }}
            style={{ background: 'linear-gradient(135deg,#0d1117,#111827)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 500, position: 'relative' }}>
            
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <HardDrive size={30} color="#30d158" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              Agent Connected!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 24px' }}>
              Your node agent is running in the background. Please select a local disk and allocate storage space to complete setup.
            </p>

            {configError && (
              <div style={{ background: 'rgba(255,55,95,0.1)', color: '#ff375f', padding: '12px 16px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 20, border: '1px solid rgba(255,55,95,0.2)' }}>
                {configError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Select Storage Disk</label>
                <select value={selectedDisk} onChange={handleDiskSelect} style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: '0.9rem', outline: 'none' }}>
                  {disks.map(d => (
                    <option key={d.mountpoint} value={d.mountpoint}>{d.name} ({d.freeGB.toFixed(1)} GB free)</option>
                  ))}
                  {disks.length === 0 && <option value="">Scanning disks...</option>}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Storage to Contribute (GB)</label>
                <input type="number" value={configForm.capacityGB} onChange={e => setConfigForm(f => ({ ...f, capacityGB: e.target.value }))} style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Wallet Address (Optional)</label>
                <input type="text" placeholder="0x..." value={configForm.walletAddress} onChange={e => setConfigForm(f => ({ ...f, walletAddress: e.target.value }))} style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
              </div>
            </div>

            <button onClick={handleSaveConfig} disabled={configLoading || disks.length === 0}
              style={{ width: '100%', padding: '14px 0', background: 'linear-gradient(135deg,#30d158,#28a745)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: '0.95rem', cursor: (configLoading || disks.length === 0) ? 'not-allowed' : 'pointer', opacity: (configLoading || disks.length === 0) ? 0.7 : 1 }}>
              {configLoading ? 'Saving...' : 'Save & Go Online'}
            </button>
          </motion.div>
        </div>
      )}

      {/* VPN-Style Master Toggle for Providers */}
      {isProvider && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
          style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${providerIsOnline ? 'rgba(48,209,88,0.2)' : 'rgba(255,55,95,0.2)'}`,
            borderRadius: 24, padding: '32px 40px', marginBottom: 30, position: 'relative', zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
            overflow: 'hidden', backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(circle at 0% 0%, ${providerIsOnline ? '#30d15811' : '#ff375f11'} 0%, transparent 50%)`, pointerEvents: 'none' }} />
          
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: providerIsOnline ? '#30d158' : '#ff375f', boxShadow: `0 0 12px ${providerIsOnline ? '#30d158' : '#ff375f'}` }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: providerIsOnline ? '#30d158' : '#ff375f', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                System {providerIsOnline ? 'Active' : 'Paused'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.03em' }}>
              {providerIsOnline ? 'Earning tokens in background' : 'Node is currently dormant'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.9rem', maxWidth: 450 }}>
              {providerIsOnline 
                ? 'Your node is serving chunks and maintaining the decentralized storage layer.' 
                : 'Resume your node to start earning SCT tokens and contributing to the network.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <motion.div 
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleProviderToggle}
              style={{
                width: 100, height: 100, borderRadius: '50%', cursor: onlineBusy ? 'wait' : 'pointer',
                background: providerIsOnline ? 'rgba(48,209,88,0.1)' : 'rgba(255,55,95,0.1)',
                border: `3px solid ${providerIsOnline ? '#30d158' : '#ff375f'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 40px ${providerIsOnline ? '#30d15822' : '#ff375f22'}`,
                transition: 'all 0.3s ease'
              }}
            >
              {onlineBusy ? (
                <Zap size={32} color={accent} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Zap size={32} color={providerIsOnline ? '#30d158' : '#ff375f'} />
              )}
            </motion.div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              {onlineBusy ? 'Switching...' : `Turn ${providerIsOnline ? 'Off' : 'On'}`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: 40, position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '4px 14px',
          background: isProvider ? 'rgba(48,209,88,0.08)' : 'rgba(41,151,255,0.08)',
          border: `1px solid ${accent}30`, borderRadius: 100,
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: accent, marginBottom: 14,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'pulse 2s infinite' }} />
          {isProvider ? `Provider Profile — ${providerStatusLabel}` : 'Storage Seeker — Active'}
        </div>
        <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)', fontWeight: 900, letterSpacing: '-0.05em', color: '#fff', margin: 0, lineHeight: 1.1 }}>
          Welcome back,{' '}
          <span style={{ background: `linear-gradient(135deg,${accent},#bf5af2)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {user?.name?.split(' ')[0] || 'User'}
          </span>.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.97rem', marginTop: 10, letterSpacing: '-0.01em' }}>
          {isProvider ? 'Your storage node is earning tokens. Monitor performance below.' : 'Your files are securely distributed. Overview below.'}
        </p>
        {/* Plan badge for seekers */}
        {!isProvider && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div
              onClick={() => navigate('/app/plans')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '5px 12px',
                background: `${planColor}12`, border: `1px solid ${planColor}35`,
                borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, color: planColor,
              }}
            >
              <CreditCard size={12} /> {planLabel} Plan
            </div>
            {planId === 'free' && (
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
                Upgrade for more storage →
              </span>
            )}
          </div>
        )}
        <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
      </motion.div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14, marginBottom: 30, position: 'relative', zIndex: 2 }}>
        {cards.map((c, i) => <StatCard key={i} {...c} delay={i * 0.07} />)}
      </div>

      {/* Main content: recent activity + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, position: 'relative', zIndex: 2 }}>

        {/* Recent files / activity */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 30px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <Clock size={16} color={accent} />
            <h2 style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {isProvider ? 'Recent Earnings Activity' : 'Recent Files'}
            </h2>
          </div>

          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <>
              {/* Seeker: recent files */}
              {!isProvider && (stats?.recentFiles?.length > 0 ? (
                <div>
                  {stats.recentFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < stats.recentFiles.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      {/* Show thumbnail for image files, generic icon otherwise */}
                      {f.previewType === 'image-thumb' && f.previewCid ? (
                        <img
                          src={`https://gateway.pinata.cloud/ipfs/${f.previewCid}`}
                          alt={f.fileName}
                          style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover',
                                   flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(41,151,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FolderOpen size={16} color="#2997ff" />
                        </div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                          {fmt(f.fileSize)} · {new Date(f.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {f.txHash && (
                        <a href={`https://sepolia.etherscan.io/tx/${f.txHash}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: '0.7rem', color: '#2997ff', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          On-chain ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <FolderOpen size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}>No files yet.</div>
                  <button onClick={() => navigate('/app/upload')} style={{ marginTop: 14, padding: '8px 18px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 8, color: '#2997ff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Upload your first file →
                  </button>
                </div>
              ))}

              {/* Provider: monthly earnings chart */}
              {isProvider && (() => {
                const entries = Object.entries(stats?.monthlyEarnings || {});
                const max = Math.max(...entries.map(([, v]) => v), 1);
                return entries.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 8 }}>
                      {entries.slice(-6).map(([month, val], i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: '100%', borderRadius: '4px 4px 0 0',
                            height: `${(val / max) * 60}px`, background: `linear-gradient(180deg,#30d158,#30d15855)`,
                            minHeight: 4,
                          }} />
                          <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{month}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>SCT earned per month</div>
                  </div>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>No earnings yet. Register your node to start earning.</div>
                );
              })()}
            </>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.6 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
            {isProvider && (
              <div style={{ background: 'rgba(41,151,255,0.05)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: providerIsOnline || !isProvider ? '#30d158' : '#ff9f0a', display: 'inline-block', boxShadow: providerIsOnline || !isProvider ? '0 0 8px #30d158' : '0 0 8px #ff9f0a' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Node Link Status</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: providerIsOnline || !isProvider ? '#30d158' : '#ff9f0a', letterSpacing: '-0.03em' }}>
                  {providerIsOnline || !isProvider ? 'Operational' : 'Node Paused'}
                </div>
              </div>
            )}

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Zap size={15} color="#ff9f0a" />
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Quick Actions</h2>
            </div>
            {isProvider ? (
              <>
                <ActionBtn label="Manage Storage Node"  color="#30d158" bg="rgba(48,209,88,0.1)"    onClick={() => navigate('/app/node')}        />
                <ActionBtn label="Withdraw Earnings"    color="#ff9f0a" bg="rgba(255,159,10,0.1)"   onClick={() => navigate('/app/withdraw')}    />
                <ActionBtn label="Marketplace"          color="#bf5af2" bg="rgba(191,90,242,0.1)"   onClick={() => navigate('/app/marketplace')} />
                <ActionBtn label="Setup Guide"          color="#64d2ff" bg="rgba(100,210,255,0.1)"  onClick={() => navigate('/app/setup')}       />
              </>
            ) : (
              <>
                <ActionBtn label="Upload Files"         color="#2997ff" bg="rgba(41,151,255,0.1)"   onClick={() => navigate('/app/upload')}      />
                <ActionBtn label="Marketplace"          color="#bf5af2" bg="rgba(191,90,242,0.1)"   onClick={() => navigate('/app/marketplace')} />
                <ActionBtn label="My Files"             color="#ff9f0a" bg="rgba(255,159,10,0.1)"   onClick={() => navigate('/app/files')}       />
                <ActionBtn label="Manage Plan"          color={planColor} bg={`${planColor}10`}     onClick={() => navigate('/app/plans')}       />
              </>
            )}
          </div>

          {/* Storage usage bar (provider) */}
          {isProvider && stats && (
            <div style={{ background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Storage Usage</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 700 }}>{stats.usedGB} GB used</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>{stats.capacityGB} GB total</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${Math.min(stats.usedPct, 100)}%`, background: '#30d158', borderRadius: 4, transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(48,209,88,0.7)', marginTop: 6 }}>{stats.usedPct}% used</div>
            </div>
          )}

        </motion.div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 56, fontSize: '0.72rem', color: 'rgba(255,255,255,0.13)', letterSpacing: '0.03em', position: 'relative', zIndex: 2 }}>
        StoraChain · BSc (Hons) Software Engineering · Plymouth University · 10952709
      </div>
    </div>
  );
}
