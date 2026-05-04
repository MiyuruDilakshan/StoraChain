const fs = require('fs');
const path = require('path');

// Write MyStorageNode.js
const nodePageCode = `import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, CheckCircle, AlertCircle, RefreshCw, Wifi, WifiOff, Coins, Save, Disc, Info } from 'lucide-react';
import api from '../../api/client';

const FV = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.5}} };

function Toast({ msg, err }) {
  if (!msg) return null;
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', background: err?'rgba(255,55,95,0.15)':'rgba(48,209,88,0.12)', border:\`1px solid \${err?'rgba(255,55,95,0.4)':'rgba(48,209,88,0.35)'}\`, borderRadius:12, color: err?'#ff375f':'#30d158', fontSize:'0.88rem', fontWeight:700, backdropFilter:'blur(12px)', boxShadow:'0 8px 32px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:8 }}>
      {err ? <AlertCircle size={15}/> : <CheckCircle size={15}/>} {msg}
    </div>
  );
}

function StatCard({ label, value, accent, icon }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:\`1px solid \${accent}22\`, borderRadius:14, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:40, height:40, borderRadius:10, background:accent+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize:'1.35rem', fontWeight:900, color:accent, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</div>
      </div>
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

  const showMsg = (m, err=false) => { setToast(m); setToastErr(err); setTimeout(()=>setToast(''), 4000); };
  const fmtGB = v => v >= 1 ? \`\${Number(v).toFixed(1)} GB\` : \`\${(v*1024).toFixed(0)} MB\`;
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
    } catch (e) { setNode(null); }
    finally { setLoading(false); }
  };

  const fetchDisks = async () => {
    setDiskLoading(true); setDiskError('');
    try {
      const { data } = await api.get('/providers/disk-info');
      setDisks(data.disks || []);
      if (!selectedDisk && data.disks?.length > 0) {
        setSelectedDisk(data.disks[0].mountpoint);
        setForm(f=>({...f, diskPath: data.disks[0].mountpoint}));
      }
    } catch (e) {
      setDiskError(e.response?.data?.message || 'Agent not running. Start the StoraChain agent first.');
    }
    setDiskLoading(false);
  };

  useEffect(() => { fetchNode(); }, []);
  useEffect(() => { if (node) fetchDisks(); }, [node?._id]);

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
      showMsg(\`Not enough free space on \${selDiskInfo.name}. Only \${selDiskInfo.freeGB.toFixed(1)} GB available.\`, true);
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
      showMsg(e.response?.data?.message || 'Save failed', true);
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300, flexDirection:'column', gap:16 }}>
      <RefreshCw size={28} color="rgba(255,255,255,0.2)" style={{ animation:'spin 1s linear infinite' }}/>
      <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.88rem' }}>Loading node status...</p>
      <style>{\`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }\`}</style>
    </div>
  );

  if (!node) return (
    <motion.div variants={FV} initial="hidden" animate="show" style={{ maxWidth:700 }}>
      <style>{\`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }\`}</style>
      <div style={{ background:'rgba(255,159,10,0.06)', border:'1px solid rgba(255,159,10,0.2)', borderRadius:18, padding:'32px', textAlign:'center' }}>
        <AlertCircle size={48} color="#ff9f0a" style={{ marginBottom:16 }}/>
        <h2 style={{ fontSize:'1.2rem', fontWeight:800, color:'#fff', margin:'0 0 12px' }}>No Provider Node Found</h2>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.9rem', lineHeight:1.7, margin:'0 0 24px' }}>
          Your provider agent is not registered yet.<br/>
          Please run the StoraChain installer (<strong>windows-setup.bat</strong> or <strong>linux-setup.sh</strong>) as Administrator, then come back here.
        </p>
        <a href="/app/setup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 24px', background:'rgba(255,159,10,0.12)', border:'1px solid rgba(255,159,10,0.3)', borderRadius:10, color:'#ff9f0a', fontFamily:'inherit', fontWeight:700, fontSize:'0.88rem', textDecoration:'none' }}>
          View Setup Guide →
        </a>
      </div>
    </motion.div>
  );

  return (
    <motion.div variants={FV} initial="hidden" animate="show" style={{ maxWidth:900 }}>
      <style>{\`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }\`}</style>
      <Toast msg={toast} err={toastErr}/>

      {/* Header */}
      <div style={{ marginBottom:28, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'2rem', fontWeight:900, letterSpacing:'-0.04em', color:'#fff', margin:0 }}>My Storage Node</h1>
          <p style={{ color:'rgba(255,255,255,0.35)', margin:'6px 0 0', fontSize:'0.9rem' }}>Configure your storage contribution and earn SCT rewards</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background: node.isActive ? 'rgba(48,209,88,0.1)' : 'rgba(255,55,95,0.1)', border:\`1px solid \${node.isActive?'rgba(48,209,88,0.3)':'rgba(255,55,95,0.3)'}\`, borderRadius:10 }}>
          {node.isActive ? <Wifi size={14} color="#30d158"/> : <WifiOff size={14} color="#ff375f"/>}
          <span style={{ fontSize:'0.8rem', fontWeight:700, color: node.isActive?'#30d158':'#ff375f' }}>
            {node.isActive ? 'Agent Active' : 'Agent Inactive'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:24 }}>
        <StatCard label="Storage Used" value={fmtGB(node.usedGB||0)} accent="#2997ff" icon={<HardDrive size={18} color="#2997ff"/>}/>
        <StatCard label="Total Capacity" value={fmtGB(node.capacityGB||0)} accent="#bf5af2" icon={<Disc size={18} color="#bf5af2"/>}/>
        <StatCard label="Total Earnings" value={\`\${(node.totalEarnings||0).toFixed(2)} SCT\`} accent="#ff9f0a" icon={<Coins size={18} color="#ff9f0a"/>}/>
        <StatCard label="Uptime" value={\`\${node.uptimePct??0}%\`} accent="#30d158" icon={<CheckCircle size={18} color="#30d158"/>}/>
      </div>

      {/* Usage bar */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'20px 22px', marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.6)' }}>Storage Usage</span>
          <span style={{ fontSize:'0.82rem', fontWeight:700, color:barColor }}>{usedPct.toFixed(1)}%</span>
        </div>
        <div style={{ height:10, background:'rgba(255,255,255,0.06)', borderRadius:6 }}>
          <div style={{ height:'100%', width:\`\${usedPct}%\`, background: \`linear-gradient(90deg, \${barColor}aa, \${barColor})\`, borderRadius:6, transition:'width 0.6s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>
          <span>{fmtGB(node.usedGB||0)} used</span>
          <span>{fmtGB((node.capacityGB||0)-(node.usedGB||0))} free</span>
        </div>
      </div>

      {/* Settings form */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:'28px' }}>
        <h3 style={{ fontSize:'1rem', fontWeight:800, color:'#fff', margin:'0 0 24px', display:'flex', alignItems:'center', gap:8 }}>
          <HardDrive size={16} color="#bf5af2"/> Node Configuration
        </h3>

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
                    style={{ padding:'14px', background: isSelected?'rgba(191,90,242,0.1)':'rgba(255,255,255,0.03)', border:\`1px solid \${isSelected?'rgba(191,90,242,0.4)':'rgba(255,255,255,0.08)'}\`, borderRadius:12, cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ fontSize:'1.1rem', fontWeight:900, color: isSelected?'#bf5af2':'#fff', marginBottom:4 }}>{d.name}</div>
                    <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', marginBottom:8 }}>{d.totalGB.toFixed(1)} GB total</div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:3, marginBottom:6 }}>
                      <div style={{ height:'100%', width:\`\${Math.min(usePct,100)}%\`, background:dColor, borderRadius:3 }}/>
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
              ['Cores', node.hardware.cores], ['RAM', \`\${node.hardware.ramFreeGB?.toFixed(1)||'?'} / \${node.hardware.ramTotalGB?.toFixed(1)||'?'} GB\`],
              ['Agent URL', node.agentUrl], ['Region', node.region],
            ].filter(([,v])=>v).map(([l,v],i)=>(
              <div key={i}>
                <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.25)', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.6)', wordBreak:'break-all' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../frontend/src/pages/app/MyStorageNode.js'), nodePageCode, 'utf8');
console.log('✓ MyStorageNode.js written');
