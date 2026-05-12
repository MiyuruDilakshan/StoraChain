import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, CheckCircle, AlertCircle, RefreshCw, Wifi, Save, Info, Trash2, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Clock, Terminal, Copy, BookOpen } from 'lucide-react';
import api from '../../api/client';

/* ── VPS Setup Guide Modal ──────────────────────────────────────────────── */
function VpsSetupGuide({ onClose }) {
  const INSTALL_CMD = 'bash <(curl -fsSL https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/scripts/linux-setup.sh)';
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(INSTALL_CMD); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const steps = [
    {
      num: '1', title: 'Create a StoraChain provider account',
      body: 'Register at storachain.miyuru.dev — use a unique email per VPS (e.g. provider1@yourdomain.com). The role must be provider.',
    },
    {
      num: '2', title: 'Open port 3001 on your VPS firewall',
      body: null,
      sub: [
        { label: 'UFW (Ubuntu/Debian)',      code: 'sudo ufw allow 3001/tcp && sudo ufw reload' },
        { label: 'iptables',                  code: 'sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT' },
        { label: 'Hetzner / DigitalOcean',   code: 'Add TCP 3001 inbound rule in the cloud console firewall.' },
        { label: 'AWS EC2',                  code: 'EC2 → Security Groups → Inbound → Add Rule: TCP 3001 0.0.0.0/0' },
      ],
    },
    {
      num: '3', title: 'Run the one-line installer on your VPS',
      body: 'SSH into your VPS and run the command below. It will install Node.js, download the agent, and start it with PM2.',
    },
    {
      num: '4', title: 'Set storage allocation',
      body: 'After install, the agent registers with 0 GB. Return to this page and set the space you want to offer (e.g. 50 GB). Or edit ~/storachain-agent/.env → SPACE_GB=50 then pm2 restart storachain-provider.',
    },
    {
      num: '5', title: 'Set region for AI matchmaking',
      body: 'Edit ~/storachain-agent/.env on each VPS:\n  REGION=eu-west  (or us-east, ap-south, etc.)\nThen: pm2 restart storachain-provider',
    },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', padding: '32px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Terminal size={16} color="#2997ff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>VPS Provider Setup Guide</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>One-command install — Linux / Ubuntu / Debian</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Install command box */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Install command — run on VPS</span>
            <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 7, padding: '4px 10px', color: copied ? '#30d158' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}>
              <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code style={{ fontSize: '0.77rem', color: '#2997ff', fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', lineHeight: 1.6 }}>{INSTALL_CMD}</code>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map(s => (
            <div key={s.num} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#2997ff', flexShrink: 0, marginTop: 2 }}>{s.num}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.title}</div>
                {s.body && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{s.body}</div>}
                {s.sub && s.sub.map((sub, i) => (
                  <div key={i} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{sub.label}:</div>
                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 12px' }}>
                      <code style={{ fontSize: '0.74rem', color: '#e5e5e5', fontFamily: 'monospace', wordBreak: 'break-all' }}>{sub.code}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* PM2 commands reference */}
        <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>Useful PM2 Commands</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['View logs',    'pm2 logs storachain-provider'],
              ['Status',       'pm2 status'],
              ['Restart',      'pm2 restart storachain-provider'],
              ['Stop',         'pm2 stop storachain-provider'],
              ['Auto-startup', 'pm2 startup && pm2 save'],
              ['Update agent', 'cd ~/storachain-agent && curl -fsSL https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/agent.js -o agent.js && curl -fsSL https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/src/registry.js -o src/registry.js && pm2 restart storachain-provider'],
            ].map(([label, cmd], i) => (
              <div key={i}>
                <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>{label}</div>
                <code style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{cmd}</code>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const FV = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.5}} };

function Toast({ msg, err }) {
  if (!msg) return null;
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', background: err?'rgba(255,55,95,0.15)':'rgba(48,209,88,0.12)', border:`1px solid ${err?'rgba(255,55,95,0.4)':'rgba(48,209,88,0.35)'}`, borderRadius:12, color: err?'#ff375f':'#30d158', fontSize:'0.88rem', fontWeight:700, backdropFilter:'blur(12px)', boxShadow:'0 8px 32px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:8 }}>
      {err ? <AlertCircle size={15}/> : <CheckCircle size={15}/>} {msg}
    </div>
  );
}


export default function MyStorageNode({ user }) {
  const [node,    setNode]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const [toastErr,setToastErr]= useState(false);

  // Disk info
  const [disks,        setDisks]        = useState([]);
  const [diskLoading,  setDiskLoading]  = useState(false);
  const [diskError,    setDiskError]    = useState('');
  const [selectedDisk, setSelectedDisk] = useState('');

  // Form
  const [form, setForm] = useState({ capacityGB:'', walletAddress:'', region:'local', diskPath:'' });

  // Integrity / Anti-cheat
  const [integrity,        setIntegrity]        = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  // Uninstall logic
  const [uninstallStage, setUninstallStage] = useState(0); // 0=none, 1=confirm, 2=progress
  const [uninstallLogs, setUninstallLogs] = useState([]);

  // VPS Setup Guide
  const [showGuide, setShowGuide] = useState(false);

  const showMsg = (m, err=false) => { setToast(m); setToastErr(err); setTimeout(()=>setToast(''), 4000); };
  const fmtGB = v => v >= 1 ? `${Number(v).toFixed(1)} GB` : `${(v*1024).toFixed(0)} MB`;
  const usedPct = node ? Math.min((node.usedGB||0)/(node.capacityGB||1)*100, 100) : 0;
  const barColor = usedPct > 80 ? '#ff375f' : usedPct > 60 ? '#ff9f0a' : '#30d158';

  const fetchNode = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/providers/me');
      setNode(data);
      if (data) {
        setForm({
          capacityGB:    data.capacityGB || '',
          walletAddress: data.walletAddress || '',
          region:        data.region || 'local',
          diskPath:      data.hardware?.diskPath || '',
        });
        if (data.hardware?.diskPath) setSelectedDisk(data.hardware.diskPath);
      }
    } catch (e) {
      if (e?.response?.status !== 404) {
        console.warn('[MyStorageNode] fetchNode:', e.message);
      }
      setNode(null);
    }
    finally { setLoading(false); }
  };

  const fetchIntegrity = async () => {
    setIntegrityLoading(true);
    try {
      const { data } = await api.get('/providers/integrity-report');
      setIntegrity(data);
    } catch { /* non-critical */ }
    setIntegrityLoading(false);
  };

  const fetchDisks = async () => {
    setDiskLoading(true); setDiskError('');
    try {
      // Try calling the local agent directly first (avoids VPS→local NAT/firewall issues)
      let disks = null;
      try {
        const agentPort = node?.agentUrl?.match(/:(\d+)$/)?.[1] || '3001';
        const directRes = await fetch(`http://localhost:${agentPort}/disk-info`);
        if (directRes.ok) {
          const json = await directRes.json();
          disks = json.disks;
        }
      } catch { /* agent not reachable directly, fall back to backend proxy */ }

      if (!disks) {
        const { data } = await api.get('/providers/disk-info');
        disks = data.disks || [];
      }

      setDisks(disks || []);
      if (!selectedDisk && disks?.length > 0) {
        setSelectedDisk(disks[0].mountpoint);
        setForm(f=>({...f, diskPath: disks[0].mountpoint}));
      }
    } catch (e) {
      setDiskError(e.response?.data?.message || 'Agent not running. Start the StoraChain agent first.');
    }
    setDiskLoading(false);
  };

  useEffect(() => { fetchNode(); }, []);
  useEffect(() => { if (node) { fetchDisks(); fetchIntegrity(); } }, [node?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-poll integrity every 60 seconds
  useEffect(() => {
    if (!node) return;
    const timer = setInterval(fetchIntegrity, 60000);
    return () => clearInterval(timer);
  }, [node?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDiskSelect = (disk) => {
    setSelectedDisk(disk.mountpoint);
    setForm(f=>({...f, diskPath: disk.mountpoint}));
    // Auto-suggest max 80% of free space
    const suggested = Math.floor(disk.freeGB * 0.8 * 10) / 10;
    setForm(f=>({...f, diskPath: disk.mountpoint, capacityGB: String(suggested > 1 ? suggested : 1)}));
  };

  const handleSave = async () => {
    const cap = parseFloat(form.capacityGB);
    if (!cap || cap <= 0) { showMsg('Please enter a valid storage size', true); return; }

    // Validate against actual free disk space
    const selDiskInfo = disks.find(d => d.mountpoint === selectedDisk);
    if (selDiskInfo && cap > selDiskInfo.freeGB) {
      showMsg(`Not enough free space on ${selDiskInfo.name}. Only ${selDiskInfo.freeGB.toFixed(1)} GB available.`, true);
      return;
    }
    if (selDiskInfo && cap > selDiskInfo.freeGB * 0.95) {
      showMsg('Warning: leaving less than 5% free space may cause system issues.', true);
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/providers/update', {
        capacityGB:    cap,
        region:        form.region,
        walletAddress: form.walletAddress.trim() || undefined,
        diskPath:      form.diskPath || undefined,
      });
      setNode(data);
      showMsg('Node settings saved successfully!');
    } catch (e) {
      showMsg('Failed to save settings', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      setLoading(true);
      const { data } = await api.put('/providers/toggle-pause');
      setNode(data.listing);
      showMsg(data.message, false);
      if (data.listing.isPaused) {
        showMsg('Node paused. You will not receive new storage chunks.', false);
      } else {
        showMsg('Node online! Ensure the background agent is running.', false);
      }
    } catch (e) {
      showMsg('Failed to toggle status', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    setUninstallStage(2);
    setUninstallLogs([]);
    const addLog = (msg) => setUninstallLogs(prev => [...prev, msg]);
    try {
      addLog('Initiating uninstall process...');
      await new Promise(r => setTimeout(r, 800));
      addLog('Contacting background agent...');
      const { data } = await api.post('/providers/uninstall');
      addLog('Agent stopped and chunks deleted.');
      await new Promise(r => setTimeout(r, 800));
      const freedGB = ((data.agentData?.releasedBytes || 0) / (1024 ** 3)).toFixed(2);
      addLog(`Freed ${freedGB} GB of reserved disk storage.`);
      await new Promise(r => setTimeout(r, 800));
      addLog('PM2 background process terminated.');
      addLog('Provider successfully uninstalled.');
      await new Promise(r => setTimeout(r, 1500));
      setNode(null);
      setUninstallStage(0);
    } catch (e) {
      addLog('Error: ' + (e.response?.data?.message || e.message));
      setTimeout(() => setUninstallStage(0), 3000);
    }
  };

  if (loading && !node) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300, flexDirection:'column', gap:16 }}>
      <RefreshCw size={28} color="rgba(255,255,255,0.2)" style={{ animation:'spin 1s linear infinite' }}/>
      <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.88rem' }}>Loading node status...</p>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  if (!node) return (
    <motion.div variants={FV} initial="hidden" animate="show" style={{ maxWidth: 680 }}>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      {showGuide && <VpsSetupGuide onClose={() => setShowGuide(false)} />}

      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg,rgba(191,90,242,0.08),rgba(41,151,255,0.06))', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 20, padding: '32px 32px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(191,90,242,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={26} color="#ff9f0a" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>Provider Node Not Installed</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', fontSize: '0.85rem' }}>Your node agent is not running on this device</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { n: '1', label: 'Run Installer', desc: 'windows-setup.bat or linux-setup.sh', color: '#bf5af2' },
            { n: '2', label: 'Select Disk', desc: 'Choose storage & set GB amount', color: '#2997ff' },
            { n: '3', label: 'Go Online', desc: 'Toggle node ON to start earning', color: '#30d158' },
          ].map(s => (
            <div key={s.n} style={{ background: `${s.color}0a`, border: `1px solid ${s.color}22`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Step {s.n}</div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/app/setup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.4)', borderRadius: 11, color: '#bf5af2', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
            View Full Setup Guide →
          </a>
          <button onClick={() => setShowGuide(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 22px', background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.35)', borderRadius: 11, color: '#2997ff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Terminal size={14}/> VPS Setup Guide
          </button>
          <button onClick={fetchNode} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} /> Check Again
          </button>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <CheckCircle size={16} color="#30d158" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>
          Once you run the installer and the agent is active, this page will automatically show your node configuration, disk usage, and earnings. No page refresh needed — just run the bat/sh script and come back.
        </p>
      </div>
    </motion.div>
  );

  return (
    <motion.div variants={FV} initial="hidden" animate="show" style={{ maxWidth:900 }}>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      <Toast msg={toast} err={toastErr}/>
      {showGuide && <VpsSetupGuide onClose={() => setShowGuide(false)} />}

      {/* VPN-Style Master Toggle */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
        style={{
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${!node.isPaused ? 'rgba(48,209,88,0.2)' : 'rgba(255,55,95,0.2)'}`,
          borderRadius: 24, padding: '28px 34px', marginBottom: 24, position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
          overflow: 'hidden', backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(circle at 0% 0%, ${!node.isPaused ? '#30d15811' : '#ff375f11'} 0%, transparent 50%)`, pointerEvents: 'none' }} />
        
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: !node.isPaused ? '#30d158' : '#ff375f', boxShadow: `0 0 12px ${!node.isPaused ? '#30d158' : '#ff375f'}` }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: !node.isPaused ? '#30d158' : '#ff375f', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Node {!node.isPaused ? 'Active' : 'Paused'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            {!node.isPaused ? 'Accepting new storage chunks' : 'Maintenance mode active'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.86rem', maxWidth: 450 }}>
            {!node.isPaused 
              ? 'Your node is reachable and serving files to the network.' 
              : 'Pause your node before performing disk maintenance or system updates.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <motion.div 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleTogglePause}
            style={{
              width: 80, height: 80, borderRadius: '50%', cursor: loading ? 'wait' : 'pointer',
              background: !node.isPaused ? 'rgba(48,209,88,0.1)' : 'rgba(255,55,95,0.1)',
              border: `3px solid ${!node.isPaused ? '#30d158' : '#ff375f'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 30px ${!node.isPaused ? '#30d15818' : '#ff375f18'}`,
              transition: 'all 0.3s ease'
            }}
          >
            {loading ? (
              <RefreshCw size={24} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Wifi size={24} color={!node.isPaused ? '#30d158' : '#ff375f'} />
            )}
          </motion.div>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            {loading ? '...' : `Go ${!node.isPaused ? 'Offline' : 'Online'}`}
          </span>
        </div>
      </motion.div>

      {/* Usage bar */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'20px 22px', marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.6)' }}>Storage Usage</span>
          <span style={{ fontSize:'0.82rem', fontWeight:700, color:barColor }}>{usedPct.toFixed(1)}%</span>
        </div>
        <div style={{ height:10, background:'rgba(255,255,255,0.06)', borderRadius:6 }}>
          <div style={{ height:'100%', width:`${usedPct}%`, background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`, borderRadius:6, transition:'width 0.6s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>
          <span>{fmtGB(node.usedGB||0)} used</span>
          <span>{fmtGB((node.capacityGB||0)-(node.usedGB||0))} free</span>
        </div>
      </div>

      {/* Settings form */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:'28px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ fontSize:'1rem', fontWeight:800, color:'#fff', margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <HardDrive size={16} color="#bf5af2"/> Node Configuration
          </h3>
          <button onClick={() => setShowGuide(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', background:'rgba(41,151,255,0.08)', border:'1px solid rgba(41,151,255,0.25)', borderRadius:9, color:'#2997ff', cursor:'pointer', fontFamily:'inherit', fontSize:'0.76rem', fontWeight:700 }}>
            <BookOpen size={12}/> VPS Setup Guide
          </button>
        </div>

        {/* Disk selector */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <label style={{ fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.7)' }}>Select Storage Disk</label>
            <button onClick={fetchDisks} disabled={diskLoading} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:'0.72rem', fontFamily:'inherit', fontWeight:600 }}>
              <RefreshCw size={11} style={{ animation:diskLoading?'spin 1s linear infinite':'none' }}/> Refresh
            </button>
          </div>

          {diskError && (
            <div style={{ padding:'12px 16px', background:'rgba(255,55,95,0.06)', border:'1px solid rgba(255,55,95,0.2)', borderRadius:10, color:'#ff375f', fontSize:'0.82rem', marginBottom:12, display:'flex', alignItems:'flex-start', gap:8 }}>
              <AlertCircle size={14} style={{ flexShrink:0, marginTop:2 }}/> {diskError}
            </div>
          )}

          {diskLoading && !diskError && (
            <div style={{ padding:'16px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'0.82rem' }}>
              <RefreshCw size={16} style={{ animation:'spin 1s linear infinite', marginRight:8 }}/>Scanning disks...
            </div>
          )}

          {disks.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {disks.map((d,i) => {
                const isSelected = selectedDisk === d.mountpoint;
                const usePct = ((d.totalGB - d.freeGB) / d.totalGB) * 100;
                const dColor = d.freeGB < 5 ? '#ff375f' : d.freeGB < 20 ? '#ff9f0a' : '#30d158';
                return (
                  <div key={i} onClick={() => handleDiskSelect(d)}
                    style={{ padding:'14px', background: isSelected?'rgba(191,90,242,0.1)':'rgba(255,255,255,0.03)', border:`1px solid ${isSelected?'rgba(191,90,242,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:12, cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ fontSize:'1.1rem', fontWeight:900, color: isSelected?'#bf5af2':'#fff', marginBottom:4 }}>{d.name}</div>
                    <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', marginBottom:8 }}>{d.totalGB.toFixed(1)} GB total</div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:3, marginBottom:6 }}>
                      <div style={{ height:'100%', width:`${Math.min(usePct,100)}%`, background:dColor, borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:dColor }}>{d.freeGB.toFixed(1)} GB free</div>
                  </div>
                );
              })}
            </div>
          )}

          {!diskLoading && disks.length === 0 && !diskError && (
            <div style={{ padding:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, color:'rgba(255,255,255,0.3)', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:8 }}>
              <Info size={14}/> No disks detected. Ensure the provider agent is running.
            </div>
          )}
        </div>

        {/* Storage size input */}
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>
            Storage to Contribute (GB)
            {selectedDisk && disks.find(d=>d.mountpoint===selectedDisk) && (
              <span style={{ marginLeft:8, fontSize:'0.72rem', fontWeight:600, color:'rgba(255,255,255,0.35)' }}>
                Max available: {disks.find(d=>d.mountpoint===selectedDisk)?.freeGB.toFixed(1)} GB
              </span>
            )}
          </label>
          <input type="number" min="1" step="0.5"
            max={disks.find(d=>d.mountpoint===selectedDisk)?.freeGB || 10000}
            value={form.capacityGB}
            onChange={e => setForm(f=>({...f, capacityGB:e.target.value}))}
            placeholder="e.g. 50"
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:'0.9rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
          />
          {(() => {
            const cap = parseFloat(form.capacityGB);
            const selDisk = disks.find(d=>d.mountpoint===selectedDisk);
            if (selDisk && cap > selDisk.freeGB) return <div style={{ marginTop:6, fontSize:'0.75rem', color:'#ff375f', display:'flex', alignItems:'center', gap:4 }}><AlertCircle size={12}/> Exceeds available disk space ({selDisk.freeGB.toFixed(1)} GB)</div>;
            if (selDisk && cap > 0) return <div style={{ marginTop:6, fontSize:'0.75rem', color:'#30d158', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {((selDisk.freeGB - cap)).toFixed(1)} GB will remain free</div>;
            return null;
          })()}
        </div>

        {/* Wallet address */}
        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>
            Ethereum Wallet Address <span style={{ color:'rgba(255,255,255,0.35)', fontWeight:500 }}>(for SCT rewards)</span>
          </label>
          <input type="text"
            value={form.walletAddress}
            onChange={e => setForm(f=>({...f, walletAddress:e.target.value}))}
            placeholder="0x..."
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:'0.88rem', fontFamily:'monospace', outline:'none', boxSizing:'border-box' }}
          />
        </div>

        {/* Region */}
        <div style={{ marginBottom:28 }}>
          <label style={{ display:'block', fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>Region</label>
          <select value={form.region} onChange={e=>setForm(f=>({...f, region:e.target.value}))}
            style={{ width:'100%', padding:'11px 14px', background:'#111', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'rgba(255,255,255,0.8)', fontSize:'0.88rem', fontFamily:'inherit', outline:'none' }}>
            {['local','AS','EU','NA','SA','AF','OC'].map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
          onClick={handleSave} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 28px', background:'linear-gradient(135deg,#bf5af2,#2997ff)', border:'none', borderRadius:12, color:'#fff', fontSize:'0.92rem', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
          {saving ? <RefreshCw size={16} style={{animation:'spin 1s linear infinite'}}/> : <Save size={16}/>}
          {saving ? 'Saving...' : 'Save Node Settings'}
        </motion.button>
      </div>

      {/* Hardware info */}
      {node.hardware && (
        <div style={{ marginTop:16, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'18px 22px' }}>
          <h4 style={{ fontSize:'0.8rem', fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 14px' }}>Hardware Info</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            {[
              ['OS', node.hardware.os], ['CPU', node.hardware.cpu],
              ['Cores', node.hardware.cores], ['RAM', `${node.hardware.ramFreeGB?.toFixed(1)||'?'} / ${node.hardware.ramTotalGB?.toFixed(1)||'?'} GB`],
              ['Agent URL', node.agentUrl], ['Region', node.region], ['Public IP', node.hardware.ip || 'Unknown']
            ].filter(([,v])=>v).map(([l,v],i)=>(
              <div key={i}>
                <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.25)', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.6)', wordBreak:'break-all' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Integrity & Anti-Cheat Panel ──────────────────────────────── */}
      <div style={{ marginTop:16, background:'rgba(255,255,255,0.02)', border:`1px solid ${integrity?.integrityHealthy === false ? 'rgba(255,55,95,0.25)' : 'rgba(48,209,88,0.15)'}`, borderRadius:14, padding:'20px 22px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h4 style={{ fontSize:'0.8rem', fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0, display:'flex', alignItems:'center', gap:6 }}>
            {integrity?.integrityHealthy === false ? <ShieldAlert size={14} color="#ff375f"/> : <ShieldCheck size={14} color="#30d158"/>}
            Node Integrity &amp; Anti-Cheat
          </h4>
          <div style={{ display:'flex', gap:6 }}>
            <a href="/app/help" style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:'rgba(191,90,242,0.08)', border:'1px solid rgba(191,90,242,0.2)', borderRadius:7, color:'#bf5af2', fontSize:'0.72rem', fontWeight:700, textDecoration:'none' }}>
              ? FAQ
            </a>
            <button onClick={fetchIntegrity} disabled={integrityLoading}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:'0.72rem', fontFamily:'inherit', fontWeight:600 }}>
              <RefreshCw size={11} style={{ animation:integrityLoading?'spin 1s linear infinite':'none' }}/> Refresh
            </button>
          </div>
        </div>

        {integrity?.isSuspended && (
          <div style={{ background:'rgba(255,55,95,0.1)', border:'1px solid rgba(255,55,95,0.3)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'#ff375f', fontWeight:800, fontSize:'0.88rem', marginBottom:6 }}>
              <ShieldAlert size={16}/> Node Suspended
            </div>
            <p style={{ margin:0, color:'rgba(255,255,255,0.5)', fontSize:'0.8rem', lineHeight:1.5 }}>
              {integrity.suspensionReason || 'This node has been automatically suspended due to integrity violations.'}
            </p>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:16 }}>
          {[
            {
              label: 'Reputation Score',
              value: integrity ? `${Math.round(integrity.reputationScore || 0)}/100` : '—',
              color: integrity ? (integrity.reputationScore >= 80 ? '#30d158' : integrity.reputationScore >= 50 ? '#ff9f0a' : '#ff375f') : 'rgba(255,255,255,0.4)',
              icon: <Shield size={14}/>,
            },
            {
              label: 'Penalty Points',
              value: integrity ? `${integrity.penaltyPoints || 0}` : '—',
              color: integrity ? (integrity.penaltyPoints === 0 ? '#30d158' : integrity.penaltyPoints < 25 ? '#ff9f0a' : '#ff375f') : 'rgba(255,255,255,0.4)',
              icon: <AlertTriangle size={14}/>,
            },
            {
              label: 'Storage Reservation',
              value: integrity ? (integrity.integrityHealthy !== false ? 'Intact' : 'Compromised') : '—',
              color: integrity ? (integrity.integrityHealthy !== false ? '#30d158' : '#ff375f') : 'rgba(255,255,255,0.4)',
              icon: <HardDrive size={14}/>,
            },
            {
              label: 'Total Violations',
              value: integrity ? `${integrity.totalViolations || 0}` : '—',
              color: integrity ? (integrity.totalViolations === 0 ? '#30d158' : '#ff9f0a') : 'rgba(255,255,255,0.4)',
              icon: <AlertCircle size={14}/>,
            },
            {
              label: 'Last Check',
              value: integrity?.lastIntegrityCheck ? new Date(integrity.lastIntegrityCheck).toLocaleTimeString() : 'Pending…',
              color: 'rgba(255,255,255,0.5)',
              icon: <Clock size={14}/>,
            },
          ].map((item, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,0.3)', fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontSize:'1rem', fontWeight:800, color:item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Recent violations */}
        {integrity?.recentViolations?.length > 0 && (
          <div style={{ background:'rgba(255,55,95,0.05)', border:'1px solid rgba(255,55,95,0.15)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ff375f', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
              Recent Violations
            </div>
            {integrity.recentViolations.slice().reverse().map((v, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6, fontSize:'0.78rem', color:'rgba(255,255,255,0.5)' }}>
                <AlertCircle size={11} color="#ff375f" style={{ flexShrink:0, marginTop:2 }}/>
                <span><strong style={{ color:'rgba(255,255,255,0.7)' }}>{v.type}</strong> — {v.detail}</span>
              </div>
            ))}
          </div>
        )}

        {integrity && !integrity.isSuspended && integrity.integrityHealthy !== false && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, color:'#30d158', fontSize:'0.8rem', fontWeight:600 }}>
            <CheckCircle size={14}/> All integrity checks passing. No violations detected.
          </div>
        )}
      </div>

      {/* Danger Zone */}

      <div style={{ marginTop:40, paddingTop:24, borderTop:'1px solid rgba(255,55,95,0.2)' }}>
        <h4 style={{ fontSize:'0.9rem', fontWeight:800, color:'#ff375f', margin:'0 0 12px' }}>Danger Zone</h4>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.82rem', marginBottom:16, lineHeight:1.5 }}>
          Uninstalling your node will delete all stored chunks, release your physically reserved disk space, and automatically kill the background PM2 agent.
        </p>
        <button onClick={() => setUninstallStage(1)}
          style={{ padding:'12px 24px', background:'rgba(255,55,95,0.1)', border:'1px solid rgba(255,55,95,0.3)', borderRadius:10, color:'#ff375f', fontSize:'0.85rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
          <Trash2 size={16}/> Uninstall Node
        </button>
      </div>

      {/* Uninstall Modal */}
      {uninstallStage > 0 && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)', padding:24 }}>
          <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
            style={{ background:'#0d1117', border:'1px solid rgba(255,55,95,0.3)', borderRadius:20, padding:32, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,55,95,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'#ff375f' }}>
                <AlertCircle size={24}/>
              </div>
              <h2 style={{ fontSize:'1.25rem', fontWeight:800, color:'#fff', margin:0 }}>Uninstall Provider</h2>
            </div>
            
            {uninstallStage === 1 ? (
              <>
                <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.6, marginBottom:24 }}>
                  Are you absolutely sure you want to uninstall your StoraChain node? This action is <strong>irreversible</strong> and will immediately delete all local storage chunks.
                </p>
                <div style={{ display:'flex', gap:12 }}>
                  <button onClick={handleUninstall} style={{ flex:1, padding:'12px', background:'#ff375f', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Yes, Uninstall Node</button>
                  <button onClick={() => setUninstallStage(0)} style={{ flex:1, padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#fff', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.95rem', marginBottom:20, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
                  <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/> Uninstalling...
                </p>
                <div style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:16, fontFamily:'monospace', fontSize:'0.8rem', color:'#30d158', display:'flex', flexDirection:'column', gap:8, height:150, overflowY:'auto' }}>
                  {uninstallLogs.map((l,i) => <div key={i}>{'>'} {l}</div>)}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
