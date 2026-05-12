import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, TrendingUp, FolderOpen, Coins, HardDrive, Activity, Zap, Clock } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import api from '../../api/client';

const PIE_COLORS = ['#2997ff', '#bf5af2', '#30d158', '#ff9f0a', '#ff375f', '#64d2ff'];

const chartStyle = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px',
};

const axisStyle = { fill: 'rgba(255,255,255,0.25)', fontSize: 10 };

function ChartCard({ icon, color, title, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }} style={chartStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {icon}
        <h3 style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function EmptyChart({ msg = 'No data yet' }) {
  return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem', padding: '20px 0' }}>{msg}</div>;
}

/* Type breakdown (legacy, kept for file-type view) */
function TypeBreakdown({ data }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total === 0) return <EmptyChart />;
  const pieData = entries.map(([k, v]) => ({ name: `.${k}`, value: v }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
        <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, sub, icon, accent = '#2997ff' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle,${accent}18 0%,transparent 70%)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.28)' }}>{sub}</div>}
    </motion.div>
  );
}

export default function Analytics({ user }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const isProvider = user?.role === 'provider';
  // eslint-disable-next-line no-unused-vars
  const accent     = isProvider ? '#30d158' : '#2997ff';

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const fmt = bytes => {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return gb.toFixed(2) + ' GB';
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return mb.toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>
          {isProvider ? 'Provider Analytics' : 'Seeker Analytics'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>
          {isProvider ? 'Earnings, storage performance and node health' : 'Your storage usage, spending and file activity'}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 110, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {/* ── Seeker view ────────────────────────────────────── */}
          {!isProvider && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14, marginBottom: 24 }}>
                <StatCard label="Total Files"    value={stats?.totalFiles ?? 0}             icon={<FolderOpen size={18} color="#2997ff" />} accent="#2997ff" sub="Across all providers" />
                <StatCard label="Total Stored"   value={fmt(stats?.totalSizeBytes)}          icon={<HardDrive  size={18} color="#bf5af2" />} accent="#bf5af2" sub="Distributed storage" />
                <StatCard label="SCT Balance"    value={`${stats?.sctBalance ?? 0} SCT`}     icon={<Coins      size={18} color="#ff9f0a" />} accent="#ff9f0a" sub={`Spent: ${stats?.totalSpentSCT ?? 0} SCT`} />
                <StatCard label="Marketplace"    value={stats?.purchases ?? 0}               icon={<TrendingUp size={18} color="#30d158" />} accent="#30d158" sub="Items purchased" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {/* Uploads per day */}
                <ChartCard icon={<BarChart2 size={15} color="#2997ff" />} title="Uploads (last 30 days)">
                  {stats?.uploadsPerDay?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <AreaChart data={stats.uploadsPerDay} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                        <defs>
                          <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2997ff" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2997ff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={axisStyle} interval={6} />
                        <YAxis tick={axisStyle} allowDecimals={false} />
                        <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="count" stroke="#2997ff" strokeWidth={2} fill="url(#uploadGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>

                {/* Storage by MIME type */}
                <ChartCard icon={<FolderOpen size={15} color="#bf5af2" />} title="Storage by Type">
                  {stats?.storageByMime?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={stats.storageByMime} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value">
                          {stats.storageByMime.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                          formatter={(v) => `${(v / (1024 ** 2)).toFixed(1)} MB`} />
                        <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    /* Fallback: file types */
                    <TypeBreakdown data={stats?.filesByType} />
                  )}
                </ChartCard>

                {/* File types breakdown */}
                <ChartCard icon={<FolderOpen size={15} color="#2997ff" />} title="Files by Extension">
                  <TypeBreakdown data={stats?.filesByType} />
                </ChartCard>

                {/* Recent files */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.55 }}
                  style={chartStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <BarChart2 size={15} color="#bf5af2" />
                    <h3 style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Recent Files</h3>
                  </div>
                  {stats?.recentFiles?.length > 0 ? (
                    <div>
                      {stats.recentFiles.slice(0, 5).map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{f.fileName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', marginLeft: 8 }}>{fmt(f.fileSize)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>No files yet</div>
                  )}
                </motion.div>
              </div>
            </>
          )}

          {/* ── Provider view ───────────────────────────────────── */}
          {isProvider && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14, marginBottom: 24 }}>
                <StatCard label="Capacity"      value={`${stats?.capacityGB ?? 0} GB`}     icon={<HardDrive  size={18} color="#30d158" />} accent="#30d158" sub={`${stats?.usedPct ?? 0}% used`} />
                <StatCard label="Tokens Earned" value={`${stats?.tokensEarned ?? 0} SCT`}  icon={<Coins      size={18} color="#ff9f0a" />} accent="#ff9f0a" sub={`Balance: ${stats?.pendingBalance ?? 0} SCT`} />
                <StatCard label="Fiat Earned"   value={`$${stats?.fiatEarnedUSD ?? 0}`}    icon={<TrendingUp size={18} color="#2997ff" />} accent="#2997ff" sub="Via Stripe marketplace" />
                <StatCard label="Node Uptime"   value={`${stats?.uptimePct ?? 100}%`}      icon={<Activity   size={18} color="#bf5af2" />} accent="#bf5af2" sub={stats?.isOnline ? 'Currently online' : 'Offline'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {/* Earnings per day */}
                <ChartCard icon={<BarChart2 size={15} color="#30d158" />} title="Earnings per Day (SCT)">
                  {stats?.earningsPerDay?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={stats.earningsPerDay} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={axisStyle} interval={6} />
                        <YAxis tick={axisStyle} />
                        <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v} SCT`]} />
                        <Bar dataKey="sct" fill="#30d158" radius={[3, 3, 0, 0]} maxBarSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>

                {/* Utilisation history */}
                <ChartCard icon={<TrendingUp size={15} color="#2997ff" />} title="Storage Utilisation">
                  {stats?.utilisationHistory?.some(d => d.usedGB > 0) ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={stats.utilisationHistory} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                        <defs>
                          <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2997ff" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2997ff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={axisStyle} interval={6} />
                        <YAxis tick={axisStyle} />
                        <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v} GB`]} />
                        <Line type="monotone" dataKey="usedGB" stroke="#2997ff" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart msg="Utilisation history builds up over time" />}
                </ChartCard>

                {/* Storage + node health */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.55 }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <Zap size={15} color="#ff9f0a" />
                    <h3 style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Node Health</h3>
                  </div>

                  {[
                    { label: 'Storage Used',   val: stats?.usedPct    || 0,  color: '#30d158', fmt: v => `${v}%`    },
                    { label: 'Uptime',         val: stats?.uptimePct  || 100, color: '#2997ff', fmt: v => `${v}%`   },
                  ].map((m, i) => (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{m.label}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: m.color }}>{m.fmt(m.val)}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${Math.min(m.val, 100)}%`, background: m.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Latency</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#64d2ff' }}>{stats?.latencyMs ?? 20} ms</div>
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Price/GB</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ff9f0a' }}>{stats?.pricePerGB ?? 1} SCT</div>
                    </div>
                  </div>

                  {/* Recent withdrawals */}
                  {stats?.recentWithdrawals?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Clock size={13} color="rgba(255,255,255,0.3)" />
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Recent Withdrawals</span>
                      </div>
                      {stats.recentWithdrawals.slice(0, 3).map((w, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <span style={{ fontSize: '0.78rem', color: '#ff9f0a', fontWeight: 700 }}>{w.amountSCT} SCT</span>
                          <span style={{ fontSize: '0.72rem', color: w.status === 'completed' ? '#30d158' : 'rgba(255,255,255,0.3)' }}>{w.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
