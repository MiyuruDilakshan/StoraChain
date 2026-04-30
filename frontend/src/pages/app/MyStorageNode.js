import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Coins, Users, Wifi, WifiOff, Edit2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../api/client';

// fmt helper reserved for future byte display
// function fmt(bytes) {...}

export default function MyStorageNode({ user }) {
  const [node,     setNode]     = useState(null);
  const [cliProvider, setCliProvider] = useState(null);
  const [analytics,setAnalytics]= useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState({ capacityGB: '', region: '' });
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [toastErr, setToastErr] = useState(false);

  const showMsg = (m, err = false) => { setToast(m); setToastErr(err); setTimeout(() => setToast(''), 4000); };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/providers/me').catch(() => ({ data: null })),
      api.get('/analytics').catch(() => ({ data: null })),
    ]).then(([nRes, aRes]) => {
      setNode(nRes.data);
      setAnalytics(aRes.data);
      const providerId = localStorage.getItem('providerId');
      if (providerId) {
        api.get(`/providers/cli/${providerId}/dashboard`)
          .then((r) => setCliProvider(r.data?.provider || null))
          .catch(() => setCliProvider(null));
      } else {
        setCliProvider(null);
      }
      if (nRes.data) {
        setForm({ capacityGB: nRes.data.capacityGB, region: nRes.data.region || '' });
      }
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/providers/update', {
        capacityGB: Number(form.capacityGB),
        region: form.region,
      });
      setNode(data);
      setEditing(false);
      showMsg('Node settings updated successfully');
    } catch (e) {
      showMsg(e.response?.data?.message || 'Update failed', true);
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    try {
      const providerId = localStorage.getItem('providerId');
      const isOnlineNow = cliProvider?.status === 'online' || node?.isActive;
      if (providerId) {
        if (isOnlineNow) {
          await api.post(`/providers/cli/${providerId}/go-offline`);
          showMsg('Provider service is now offline');
        } else {
          await api.post(`/providers/cli/${providerId}/go-online`, {
            hddTotalGB: node?.capacityGB || 0,
            walletAddress: user?.walletAddress,
          });
          showMsg('Provider service is now online');
        }
      } else {
        const endpoint = isOnlineNow ? '/providers/deactivate' : '/providers/activate';
        await api.post(endpoint);
        showMsg(`Node ${isOnlineNow ? 'deactivated' : 'activated'} successfully`);
      }
      fetchData();
    } catch (e) {
      showMsg('Status change failed', true);
    }
  };

  const S = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: '0.9rem',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <div>Loading node data…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!node) return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>My Storage Node</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>You have not registered a provider node yet</p>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20 }}>
        <HardDrive size={44} color="rgba(255,255,255,0.1)" style={{ marginBottom: 14 }} />
        <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>No Node Registered</h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.87rem', marginBottom: 24, lineHeight: 1.6 }}>
          Download and run the provider agent to register your node on the StoraChain network.
        </p>
        <a href="/app/setup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 12, color: '#2997ff', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
          View Setup Guide →
        </a>
      </motion.div>
    </div>
  );

  const usedPct = node.capacityGB > 0 ? ((node.usedGB / node.capacityGB) * 100).toFixed(1) : 0;
  const isOnline = cliProvider?.status === 'online' || node.isActive;

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>My Storage Node</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Manage your provider node settings and monitor earnings</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleToggle}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: isOnline ? 'rgba(255,55,95,0.1)' : 'rgba(48,209,88,0.1)', border: `1px solid ${isOnline ? 'rgba(255,55,95,0.3)' : 'rgba(48,209,88,0.3)'}`, borderRadius: 10, color: isOnline ? '#ff375f' : '#30d158', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem' }}>
            {isOnline ? <><WifiOff size={13} /> Go Offline</> : <><Wifi size={13} /> Go Online</>}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 16, padding: '11px 18px', background: toastErr ? 'rgba(255,55,95,0.08)' : 'rgba(48,209,88,0.08)', border: `1px solid ${toastErr ? 'rgba(255,55,95,0.3)' : 'rgba(48,209,88,0.3)'}`, borderRadius: 10, color: toastErr ? '#ff375f' : '#30d158', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {toastErr ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {toast}
        </motion.div>
      )}

      {/* Status + metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { icon: <Wifi size={16} color={isOnline ? '#30d158' : 'rgba(255,255,255,0.3)'} />, label: 'Status',     value: isOnline ? 'Online' : 'Offline', ac: isOnline ? '#30d158' : 'rgba(255,255,255,0.3)' },
          { icon: <HardDrive size={16} color="#2997ff" />,                                         label: 'Capacity',   value: `${node.capacityGB} GB`, ac: '#2997ff' },
          { icon: <Coins size={16} color="#ff9f0a" />,                                             label: 'Earned',     value: `${analytics?.totalEarned || 0} SCT`, ac: '#ff9f0a' },
          { icon: <Users size={16} color="#bf5af2" />,                                             label: 'Files Hosted', value: analytics?.filesHosted || 0, ac: '#bf5af2' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.45 }}
            style={{ padding: '18px 20px', background: `${s.ac}0a`, border: `1px solid ${s.ac}22`, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              {s.icon}
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: s.ac }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Capacity bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '22px 26px', marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Storage Usage</h3>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2997ff' }}>{node.usedGB} GB / {node.capacityGB} GB ({usedPct}%)</span>
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(usedPct, 100)}%` }} transition={{ duration: 0.8, delay: 0.3 }}
            style={{ height: '100%', background: usedPct > 85 ? 'linear-gradient(90deg,#ff9f0a,#ff375f)' : 'linear-gradient(90deg,#2997ff,#30d158)', borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Agent: {node.agentUrl}</span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Uptime: {node.uptimePct}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Wallet: {node.walletAddress || user?.walletAddress || 'Not set'}</span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>System Price: {node.systemPricePerGB ?? node.pricePerGB} SCT/GB</span>
        </div>
      </motion.div>

      {cliProvider && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.45 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 22px', marginBottom: 22 }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px' }}>Setup Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Service Status</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{cliProvider.status || 'unknown'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Device</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{cliProvider.device?.hostname || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Allocated HDD</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{cliProvider.hdd?.totalGB || 0} GB</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Online Since</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{cliProvider.onlineAt ? new Date(cliProvider.onlineAt).toLocaleString() : 'Not online'}</div>
            </div>
          </div>
        </motion.div>
      )}

      {node.hardware && Object.keys(node.hardware).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23, duration: 0.45 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 22px', marginBottom: 22 }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px' }}>Local Device Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>OS</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{node.hardware.os || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>CPU</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{node.hardware.cpu || 'N/A'} ({node.hardware.cores || 0} Cores)</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>RAM</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{node.hardware.ramTotalGB || 0} GB ({node.hardware.ramFreeGB || 0} GB Free)</div>
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>IP Address</div>
              <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{node.hardware.ip || 'Auto-detected'}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
               <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Storage Path</div>
               <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>{node.hardware.diskPath || 'N/A'}</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit settings */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '22px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 20 : 0 }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Node Settings</h3>
          {!editing && (
            <button onClick={() => setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>

        {!editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Capacity',     value: `${node.capacityGB} GB` },
              { label: 'Region',       value: node.region || 'Not set' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>{f.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{f.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Capacity (GB)</label>
                <input type="number" min="1" value={form.capacityGB} onChange={e => setForm(p => ({ ...p, capacityGB: e.target.value }))} style={S} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Region</label>
                <input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="e.g. EU, US-East" style={S} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditing(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.35)', borderRadius: 10, color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
