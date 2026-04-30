import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Globe, Zap, Coins, RefreshCw, Wifi, WifiOff, Search } from 'lucide-react';
import api from '../../api/client';

function fmt(gb) {
  if (gb >= 1000) return (gb / 1024).toFixed(1) + ' TB';
  return gb + ' GB';
}

function ProviderCard({ listing, onSelect, selected }) {
  const freeGB = Math.max(0, listing.capacityGB - listing.usedGB);
  const usedPct = listing.capacityGB > 0 ? ((listing.usedGB / listing.capacityGB) * 100).toFixed(0) : 0;
  const isSelected = selected?._id === listing._id;

  return (
    <motion.div
      whileHover={{ borderColor: isSelected ? 'rgba(48,209,88,0.5)' : 'rgba(255,255,255,0.18)', boxShadow: '0 0 24px rgba(48,209,88,0.08)' }}
      transition={{ duration: 0.2 }}
      style={{
        background: isSelected ? 'rgba(48,209,88,0.06)' : 'rgba(255,255,255,0.03)',
        border: isSelected ? '1px solid rgba(48,209,88,0.4)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18, padding: '24px 26px', cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => onSelect(isSelected ? null : listing)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(48,209,88,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={18} color="#30d158" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
              Node {listing.agentUrl?.replace('http://', '').slice(0, 18)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {listing.isActive
                ? <><Wifi size={11} color="#30d158" /><span style={{ fontSize: '0.68rem', color: '#30d158', fontWeight: 700 }}>ONLINE</span></>
                : <><WifiOff size={11} color="rgba(255,255,255,0.3)" /><span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>OFFLINE</span></>
              }
            </div>
          </div>
        </div>
        {isSelected && (
          <div style={{ padding: '3px 10px', background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.4)', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, color: '#30d158', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Selected
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { icon: <Coins size={13} color="#ff9f0a" />, label: 'Price/GB', value: `${listing.pricePerGB} SCT`, ac: '#ff9f0a' },
          { icon: <Zap   size={13} color="#64d2ff" />, label: 'Latency',  value: `${listing.latencyMs}ms`,   ac: '#64d2ff' },
          { icon: <Globe size={13} color="#bf5af2" />, label: 'Region',   value: listing.region || 'Local',  ac: '#bf5af2' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '10px 12px', background: `${s.ac}0a`, border: `1px solid ${s.ac}18`, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>{s.icon}<span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span></div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Capacity bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{fmt(listing.usedGB)} used</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: freeGB > 0 ? '#30d158' : '#ff375f' }}>
            {fmt(freeGB)} free / {fmt(listing.capacityGB)} total
          </span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? '#ff9f0a' : '#30d158', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
          {usedPct}% used · Uptime {listing.uptimePct}%
        </div>
      </div>

      {/* Wallet */}
      <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Provider wallet</div>
        <div style={{ fontSize: '0.75rem', color: '#2997ff', fontWeight: 600, wordBreak: 'break-all' }}>
          {listing.walletAddress?.slice(0, 14)}…{listing.walletAddress?.slice(-6)}
        </div>
      </div>
    </motion.div>
  );
}

export default function Providers() {
  const [providers, setProviders]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [selected,  setSelected]    = useState(null);
  const [search,    setSearch]      = useState('');

  const fetch = () => {
    setLoading(true);
    api.get('/providers')
      .then(r => setProviders(r.data))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const filtered = providers.filter(p =>
    p.agentUrl?.includes(search) ||
    p.region?.toLowerCase().includes(search.toLowerCase()) ||
    p.walletAddress?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCapacity = providers.reduce((a, p) => a + p.capacityGB, 0);
  const activeCount   = providers.filter(p => p.isActive).length;
  const avgPrice      = providers.length ? (providers.reduce((a, p) => a + p.pricePerGB, 0) / providers.length).toFixed(1) : 0;

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Storage Providers</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Browse available storage nodes on the StoraChain network</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
            <Search size={14} color="rgba(255,255,255,0.3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by region, wallet..."
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', width: 170 }} />
          </div>
          <button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Network summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Nodes',     value: activeCount,        accent: '#30d158' },
          { label: 'Total Capacity',   value: `${totalCapacity} GB`, accent: '#2997ff' },
          { label: 'Avg Price / GB',   value: `${avgPrice} SCT`,  accent: '#ff9f0a' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.5 }}
            style={{ padding: '18px 20px', background: `${s.accent}0a`, border: `1px solid ${s.accent}20`, borderRadius: 14 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.accent, letterSpacing: '-0.03em' }}>{loading ? '…' : s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Provider Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 260, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <HardDrive size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
            {providers.length === 0 ? 'No provider nodes registered yet. Start a provider agent to appear here.' : `No providers matching "${search}"`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {filtered.map((p, i) => (
            <motion.div key={p._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.45 }}>
              <ProviderCard listing={p} selected={selected} onSelect={setSelected} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected provider action */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 24, padding: '22px 28px', background: 'rgba(48,209,88,0.07)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#30d158', marginBottom: 4 }}>Provider selected</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              {selected.agentUrl} · {selected.pricePerGB} SCT/GB · {Math.max(0, selected.capacityGB - selected.usedGB)} GB free
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSelected(null)} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem' }}>Deselect</button>
            <button style={{ padding: '9px 22px', background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.4)', borderRadius: 9, color: '#30d158', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem' }}>
              Store Files Here →
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
