import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Server, HardDrive, Coins, Activity, Calendar,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Shield,
  FileText, ShoppingBag, Settings, Trash2, Edit3,
  Search, Filter, Eye, BarChart2, Wifi, WifiOff, Zap,
} from 'lucide-react';
import api from '../../api/client';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const short = (h, n = 8) => h ? `${h.slice(0, n)}…${h.slice(-6)}` : '—';
const fmtGB = v => v >= 1 ? `${Number(v).toFixed(2)} GB` : `${(v * 1024).toFixed(0)} MB`;
const fmtBytes = b => { if (!b) return '—'; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; if (b < 1073741824) return `${(b/1048576).toFixed(1)} MB`; return `${(b/1073741824).toFixed(2)} GB`; };

const TABS = ['Overview', 'Users', 'Providers', 'Provider Monitor', 'Files', 'Marketplace', 'Transactions', 'Reward Cycles', 'Risk Posture', 'Abuse Reports', 'Settings'];

/* ── shared Badge component ──────────────────────────────────────────────── */
function Badge({ v, map }) {
  const cfg = map[v] || map['_'] || { c: '#888', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: v || '—' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, color: cfg.c, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {cfg.label}
    </span>
  );
}

const STATUS_MAP = {
  active:    { c: '#30d158', bg: 'rgba(48,209,88,0.1)',  border: 'rgba(48,209,88,0.3)',  label: 'Active' },
  suspended: { c: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.3)', label: 'Suspended' },
  banned:    { c: '#ff375f', bg: 'rgba(255,55,95,0.1)',  border: 'rgba(255,55,95,0.3)',  label: 'Banned' },
  _:         { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: 'Unknown' },
};
const HEALTH_MAP = {
  healthy:  { c: '#30d158', bg: 'rgba(48,209,88,0.1)',  border: 'rgba(48,209,88,0.3)',  label: 'Healthy' },
  degraded: { c: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.3)', label: 'Degraded' },
  critical: { c: '#ff375f', bg: 'rgba(255,55,95,0.1)',  border: 'rgba(255,55,95,0.3)',  label: 'Critical' },
  _:        { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: 'Unknown' },
};
const ROLE_MAP = {
  admin:    { c: '#bf5af2', bg: 'rgba(191,90,242,0.1)', border: 'rgba(191,90,242,0.3)', label: 'Admin' },
  provider: { c: '#2997ff', bg: 'rgba(41,151,255,0.1)', border: 'rgba(41,151,255,0.3)', label: 'Provider' },
  seeker:   { c: '#30d158', bg: 'rgba(48,209,88,0.1)',  border: 'rgba(48,209,88,0.3)',  label: 'Seeker' },
  _:        { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: '—' },
};
const PLAN_MAP = {
  premium: { c: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.3)', label: 'Premium' },
  pro:     { c: '#2997ff', bg: 'rgba(41,151,255,0.1)', border: 'rgba(41,151,255,0.3)', label: 'Pro' },
  basic:   { c: '#64d2ff', bg: 'rgba(100,210,255,0.1)', border: 'rgba(100,210,255,0.3)', label: 'Basic' },
  free:    { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: 'Free' },
  _:       { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: 'Free' },
};
const TX_TYPE_COLORS = { reward: '#30d158', purchase: '#2997ff', withdrawal: '#ff9f0a', _: 'rgba(255,255,255,0.4)' };

/* ── StatCard ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon, accent, sub }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -18, right: -18, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${accent}1a 0%,transparent 70%)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>{sub}</div>}
    </motion.div>
  );
}

/* ── OverviewTab ──────────────────────────────────────────────────────────── */
function OverviewTab({ onRunCycle, cycleRunning, cycleDone, onRunReplication, replicationRunning, files, stats }) {
  const healthy  = files.filter(f => f.chunkHealth === 'healthy').length;
  const degraded = files.filter(f => f.chunkHealth === 'degraded').length;
  const critical = files.filter(f => f.chunkHealth === 'critical').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Coins size={15} color="#ff9f0a" />
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Reward Controls</h3>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Automated: midnight UTC daily</div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', marginBottom: 22 }}>Manually trigger a reward cycle to distribute SCT for all active providers now.</div>
        {cycleDone && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: 10, fontSize: '0.78rem', color: '#30d158', display: 'flex', alignItems: 'center', gap: 7 }}>
            <CheckCircle size={13} /> Reward cycle complete — see Reward Cycles tab for details.
          </div>
        )}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
          onClick={onRunCycle} disabled={cycleRunning}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: cycleRunning ? 'rgba(255,255,255,0.04)' : 'rgba(255,159,10,0.12)', border: `1px solid ${cycleRunning ? 'rgba(255,255,255,0.1)' : 'rgba(255,159,10,0.35)'}`, borderRadius: 10, color: cycleRunning ? 'rgba(255,255,255,0.3)' : '#ff9f0a', cursor: cycleRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem' }}>
          <RefreshCw size={14} style={{ animation: cycleRunning ? 'spin 1s linear infinite' : 'none' }} />
          {cycleRunning ? 'Running…' : 'Run Reward Cycle Now'}
        </motion.button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
          onClick={onRunReplication} disabled={replicationRunning}
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: replicationRunning ? 'rgba(255,255,255,0.04)' : 'rgba(41,151,255,0.12)', border: `1px solid ${replicationRunning ? 'rgba(255,255,255,0.1)' : 'rgba(41,151,255,0.35)'}`, borderRadius: 10, color: replicationRunning ? 'rgba(255,255,255,0.3)' : '#2997ff', cursor: replicationRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem' }}>
          <RefreshCw size={14} style={{ animation: replicationRunning ? 'spin 1s linear infinite' : 'none' }} />
          {replicationRunning ? 'Checking…' : 'Run Replication Check'}
        </motion.button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Activity size={15} color="#2997ff" />
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Replication Health</h3>
        </div>
        {[
          { label: 'Healthy', count: healthy, color: '#30d158' },
          { label: 'Degraded', count: degraded, color: '#ff9f0a' },
          { label: 'Critical', count: critical, color: '#ff375f' },
        ].map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>{m.label} files</span>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.count}</span>
          </div>
        ))}

        {stats && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Suspended Users', v: stats.suspendedUsers ?? 0, c: '#ff9f0a' },
                { label: 'Marketplace Listings', v: stats.totalMarketplaceListings ?? 0, c: '#bf5af2' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── UserEditModal ─────────────────────────────────────────────────────────── */
function UserEditModal({ user, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    role:           user.role || 'seeker',
    plan:           user.plan || 'free',
    status:         user.status || 'active',
    sctBalance:     user.sctBalance ?? 0,
    demoUSD:        user.demoUSD ?? 0,
    storageQuotaGB: user.storageQuotaGB ?? 2,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user._id, form);
      onClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await onDelete(user._id);
      onClose();
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {(user.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>{user.email}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[
            { label: 'Role', key: 'role', opts: ['seeker', 'provider', 'admin'] },
            { label: 'Plan', key: 'plan', opts: ['free', 'basic', 'pro', 'premium'] },
            { label: 'Status', key: 'status', opts: ['active', 'suspended', 'banned'] },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
              <select value={form[key]} onChange={e => set(key, e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', padding: '8px 10px', fontFamily: 'inherit' }}>
                {opts.map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
          ))}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Storage Quota (GB)</div>
            <input type="number" min="0" value={form.storageQuotaGB} onChange={e => set('storageQuotaGB', Number(e.target.value))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', padding: '8px 10px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>SCT Balance</div>
            <input type="number" min="0" value={form.sctBalance} onChange={e => set('sctBalance', Number(e.target.value))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', padding: '8px 10px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Demo USD ($)</div>
            <input type="number" min="0" step="0.01" value={form.demoUSD} onChange={e => set('demoUSD', Number(e.target.value))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', padding: '8px 10px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '11px 0', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, color: '#818cf8', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose}
            style={{ padding: '11px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ padding: '11px 14px', background: confirmDelete ? 'rgba(255,55,95,0.2)' : 'rgba(255,55,95,0.08)', border: `1px solid ${confirmDelete ? 'rgba(255,55,95,0.5)' : 'rgba(255,55,95,0.2)'}`, borderRadius: 10, color: '#ff375f', cursor: 'pointer', fontFamily: 'inherit' }}>
            {deleting ? '…' : confirmDelete ? '⚠ Confirm Delete' : <Trash2 size={14} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── UsersTab ──────────────────────────────────────────────────────────────── */
function UsersTab({ users, onUpdateUser, onDeleteUser }) {
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [page, setPage]         = useState(0);
  const PER_PAGE = 20;

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (planFilter !== 'all' && (u.plan || 'free') !== planFilter) return false;
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const slice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const selStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' };
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', padding: '7px 12px', outline: 'none', width: 220, fontFamily: 'inherit' };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>

      {/* Filter bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px' }}>
          <Search size={13} color="rgba(255,255,255,0.35)" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search name or email…"
            style={{ ...inputStyle, border: 'none', background: 'transparent', padding: 0, width: 180 }} />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option value="all">All Roles</option>
          <option value="seeker">Seeker</option>
          <option value="provider">Provider</option>
          <option value="admin">Admin</option>
        </select>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginLeft: 'auto' }}>{filtered.length} users</span>
      </div>

      {/* Table header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 8, alignItems: 'center' }}>
        {['User', 'Role', 'Plan', 'SCT', 'USD', 'Status', 'Actions'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>

      {/* Table rows */}
      {slice.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No users match the current filter</div>
      )}
      {slice.map((u, i) => (
        <div key={u._id}
          style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 8, padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.012)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: u.avatarColor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(u.name || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{u.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{u.email}</div>
              <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>Joined {fmtDate(u.createdAt)}</div>
            </div>
          </div>
          <Badge v={u.role || 'seeker'} map={ROLE_MAP} />
          <Badge v={u.plan || 'free'} map={PLAN_MAP} />
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff9f0a' }}>{(u.sctBalance ?? 0).toFixed(0)}</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#30d158' }}>${(u.demoUSD ?? 0).toFixed(0)}</div>
          <Badge v={u.status || 'active'} map={STATUS_MAP} />
          <button onClick={() => setEditUser(u)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7, color: '#818cf8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700 }}>
            <Edit3 size={11} /> Edit
          </button>
        </div>
      ))}

      {/* Pagination */}
      {filtered.length > PER_PAGE && (
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ label: 'Prev', fn: () => setPage(p => Math.max(0, p - 1)), dis: page === 0 },
              { label: 'Next', fn: () => setPage(p => Math.min(Math.ceil(filtered.length / PER_PAGE) - 1, p + 1)), dis: (page + 1) * PER_PAGE >= filtered.length }
            ].map(({ label, fn, dis }) => (
              <button key={label} onClick={fn} disabled={dis}
                style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: dis ? 'rgba(255,255,255,0.2)' : '#fff', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <UserEditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={onUpdateUser}
          onDelete={onDeleteUser}
        />
      )}
    </motion.div>
  );
}

/* ── ProvidersTab ─────────────────────────────────────────────────────────── */
function ProvidersTab({ providers, onStatusChange }) {
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);

  const handleStatus = async (id, status) => {
    setUpdating(id);
    try { await onStatusChange(id, status); } finally { setUpdating(null); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr 1fr 1fr 100px', gap: 8 }}>
        {['Provider', 'Region', 'Storage', 'Uptime', 'Total SCT', 'Status', 'Actions'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {providers.length === 0 && <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No providers</div>}
      {providers.map((p, i) => {
        const isExp = expanded === (p._id || i);
        const usedPct = p.capacityGB > 0 ? (p.usedGB / p.capacityGB) * 100 : 0;
        const barColor = usedPct > 80 ? '#ff375f' : usedPct > 60 ? '#ff9f0a' : '#30d158';
        const statusKey = p.isActive ? 'active' : 'suspended';
        return (
          <React.Fragment key={p._id || i}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr 1fr 1fr 100px', gap: 8, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isExp ? null : (p._id || i))}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{p.providerId?.name || 'Unknown'}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{p.providerId?.email || '—'}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{p.region || 'local'}</div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>{fmtGB(p.usedGB || 0)} / {fmtGB(p.capacityGB || 0)}</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${Math.min(usedPct, 100)}%`, background: barColor, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2997ff' }}>{p.uptimePct ?? 0}%</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ff9f0a' }}>{(p.totalEarnings || 0).toFixed(2)}</div>
              <Badge v={statusKey} map={STATUS_MAP} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={statusKey} onChange={e => { e.stopPropagation(); handleStatus(p._id, e.target.value); }} disabled={updating === p._id}
                  onClick={e => e.stopPropagation()}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspend</option>
                  <option value="banned">Ban</option>
                </select>
                {isExp ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}
              </div>
            </div>
            <AnimatePresence>
              {isExp && (
                <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.015)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    {[
                      { label: 'Agent URL', value: p.agentUrl || '—' },
                      { label: 'Price / GB', value: `${p.pricePerGB || 0} SCT` },
                      { label: 'Latency', value: `${p.latencyMs || 0} ms` },
                      { label: 'Reputation', value: `${p.reputationScore ?? 100}/100` },
                      { label: 'Last Rewarded', value: p.lastRewardedAt ? fmt(p.lastRewardedAt) : 'Never' },
                      { label: 'Listed Since', value: p.createdAt ? fmt(p.createdAt) : '—' },
                      { label: 'Wallet', value: p.walletAddress ? short(p.walletAddress) : '—' },
                    ].map((d, k) => (
                      <div key={k}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>{d.label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', wordBreak: 'break-all' }}>{d.value}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}

/* ── ProviderMonitorTab ─────────────────────────────────────────────────── */
function ProviderMonitorTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchOnline = async () => {
    setLoading(true); setError('');
    try {
      const { data: d } = await api.get('/admin/providers/online');
      setData(d);
    } catch (e) { setError(e.response?.data?.message || 'Failed to fetch provider status'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOnline(); }, []);

  const onlineColor  = '#30d158';
  const offlineColor = '#ff375f';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Online Now',   value: data?.onlineCount  ?? '—', color: onlineColor,  icon: <Wifi    size={16} color={onlineColor}/>  },
          { label: 'Offline',      value: data?.offlineCount ?? '—', color: offlineColor, icon: <WifiOff size={16} color={offlineColor}/> },
          { label: 'Total Nodes',  value: data?.total        ?? '—', color: '#2997ff',    icon: <Server  size={16} color="#2997ff"/>      },
        ].map((s,i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={fetchOnline} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Refresh
        </motion.button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(255,55,95,0.07)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 10, color: '#ff375f', fontSize: '0.84rem', marginBottom: 12 }}>{error}</div>}

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '28px 2fr 1.2fr 1.4fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
          {['', 'Provider', 'Region', 'Storage', 'Latency', 'Uptime', 'Status'].map((h,i) => (
            <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
          ))}
        </div>

        {loading && !data && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
            Pinging provider agents…
          </div>
        )}

        {(data?.providers || []).map((p, i) => {
          const usedPct = p.capacityGB > 0 ? Math.min((p.usedGB / p.capacityGB) * 100, 100) : 0;
          const barC = usedPct > 80 ? '#ff375f' : usedPct > 60 ? '#ff9f0a' : '#30d158';
          return (
            <div key={p._id || i}
              style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1.2fr 1.4fr 1fr 1fr 1fr', gap: 8, padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.014)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {/* Online dot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.isOnline ? onlineColor : offlineColor, boxShadow: p.isOnline ? `0 0 6px ${onlineColor}` : 'none' }}/>
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{p.providerId?.name || 'Unknown'}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{p.agentUrl}</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{p.region || 'local'}</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{fmtGB(p.usedGB||0)} / {fmtGB(p.capacityGB||0)}</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${usedPct}%`, background: barC, borderRadius: 3 }}/>
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: p.latencyMs ? (p.latencyMs < 200 ? '#30d158' : p.latencyMs < 500 ? '#ff9f0a' : '#ff375f') : 'rgba(255,255,255,0.25)' }}>
                {p.latencyMs ? `${p.latencyMs}ms` : '—'}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2997ff' }}>{p.uptimePct ?? 0}%</div>
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: p.isOnline ? 'rgba(48,209,88,0.12)' : 'rgba(255,55,95,0.1)',
                  border: `1px solid ${p.isOnline ? 'rgba(48,209,88,0.3)' : 'rgba(255,55,95,0.3)'}`,
                  color: p.isOnline ? '#30d158' : '#ff375f',
                }}>
                  {p.isOnline ? <Wifi size={9}/> : <WifiOff size={9}/>}
                  {p.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          );
        })}

        {data?.providers?.length === 0 && !loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No providers registered</div>
        )}
      </div>
    </motion.div>
  );
}

/* ── FilesTab ─────────────────────────────────────────────────────────────── */
function FilesTab({ files }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const PER_PAGE = 20;
  const filtered = files.filter(f => !search || f.fileName?.toLowerCase().includes(search.toLowerCase()) || f.userId?.name?.toLowerCase().includes(search.toLowerCase()));
  const slice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 320 }}>
          <Search size={13} color="rgba(255,255,255,0.35)" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search files…"
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem', outline: 'none', width: '100%', fontFamily: 'inherit' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>{filtered.length} files</span>
      </div>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 1fr 1fr 80px', gap: 8 }}>
        {['File', 'Owner', 'Size', 'Date', 'On-Chain', 'Health'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {slice.map((f, i) => (
        <div key={f._id || i}
          style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 1fr 1fr 80px', gap: 8, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.012)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ fontSize: '0.8rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{f.userId?.name || '—'}</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{fmtBytes(f.fileSize)}</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{f.createdAt ? fmtDate(f.createdAt) : '—'}</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {f.cid && <a href={`https://gateway.pinata.cloud/ipfs/${f.cid}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.64rem', padding: '2px 7px', background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 6, color: '#2997ff', textDecoration: 'none', fontWeight: 700 }}>IPFS</a>}
            {f.txHash && <a href={`https://sepolia.etherscan.io/tx/${f.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.64rem', padding: '2px 7px', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.25)', borderRadius: 6, color: '#bf5af2', textDecoration: 'none', fontWeight: 700 }}>ETH</a>}
          </div>
          <Badge v={f.chunkHealth || 'healthy'} map={HEALTH_MAP} />
        </div>
      ))}
      {filtered.length > PER_PAGE && (
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ l: 'Prev', fn: () => setPage(p => Math.max(0, p - 1)), d: page === 0 }, { l: 'Next', fn: () => setPage(p => p + 1), d: (page + 1) * PER_PAGE >= filtered.length }].map(({ l, fn, d }) => (
              <button key={l} onClick={fn} disabled={d} style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: d ? 'rgba(255,255,255,0.2)' : '#fff', cursor: d ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── MarketplaceTab ───────────────────────────────────────────────────────── */
function MarketplaceTab({ listings, onRemove }) {
  const [removing, setRemoving] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const filtered = listings.filter(l => !search || l.title?.toLowerCase().includes(search.toLowerCase()) || l.sellerId?.name?.toLowerCase().includes(search.toLowerCase()));
  const slice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleRemove = async (id) => {
    setRemoving(id);
    try { await onRemove(id); } finally { setRemoving(null); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 320 }}>
          <Search size={13} color="rgba(255,255,255,0.35)" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search listings…"
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem', outline: 'none', width: '100%', fontFamily: 'inherit' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>{filtered.length} listings</span>
      </div>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr 80px', gap: 8 }}>
        {['Title', 'Seller', 'Category', 'Price SCT', 'Price USD', 'Downloads', 'Action'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {slice.length === 0 && <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No listings</div>}
      {slice.map((l, i) => (
        <div key={l._id || i}
          style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr 80px', gap: 8, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.012)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{l.fileName}</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{l.sellerId?.name || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: '#bf5af2' }}>{l.category || 'General'}</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff9f0a' }}>{l.priceSCT || 0}</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#30d158' }}>{l.priceUSDCents ? `$${(l.priceUSDCents / 100).toFixed(2)}` : 'Free'}</div>
          <div style={{ fontSize: '0.82rem', color: '#2997ff', fontWeight: 700 }}>{l.downloads || 0}</div>
          <button onClick={() => handleRemove(l._id)} disabled={removing === l._id || !l.isActive}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: l.isActive ? 'rgba(255,55,95,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${l.isActive ? 'rgba(255,55,95,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: l.isActive ? '#ff375f' : 'rgba(255,255,255,0.2)', cursor: l.isActive ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700 }}>
            <Trash2 size={11} /> {removing === l._id ? '…' : l.isActive ? 'Remove' : 'Removed'}
          </button>
        </div>
      ))}
      {filtered.length > PER_PAGE && (
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ l: 'Prev', fn: () => setPage(p => Math.max(0, p - 1)), d: page === 0 }, { l: 'Next', fn: () => setPage(p => p + 1), d: (page + 1) * PER_PAGE >= filtered.length }].map(({ l, fn, d }) => (
              <button key={l} onClick={fn} disabled={d} style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: d ? 'rgba(255,255,255,0.2)' : '#fff', cursor: d ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── TransactionsTab ──────────────────────────────────────────────────────── */
function TransactionsTab({ transactions }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '80px 2fr 1fr 2fr 1fr', gap: 8 }}>
        {['Type', 'Party', 'Amount', 'Tx Hash', 'Date'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {transactions.length === 0 && <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No transactions</div>}
      {transactions.map((t, i) => {
        const typeColor = TX_TYPE_COLORS[t.type] || TX_TYPE_COLORS._;
        return (
          <div key={t._id || i}
            style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1fr 2fr 1fr', gap: 8, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.035)', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.012)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'inline-block', padding: '3px 8px', background: typeColor + '18', border: `1px solid ${typeColor}44`, borderRadius: 8, fontSize: '0.65rem', fontWeight: 700, color: typeColor, textTransform: 'uppercase' }}>{t.type || '—'}</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
              {t.providerWallet ? short(t.providerWallet) : (t.buyerId ? String(t.buyerId).slice(-8) : '—')}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: typeColor }}>{(t.amountSCT || 0).toFixed(2)} SCT</div>
            <div>{t.txHash ? <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#2997ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>{short(t.txHash, 10)} <ExternalLink size={11} /></a> : <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)' }}>Pending</span>}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{t.createdAt ? fmtDate(t.createdAt) : '—'}</div>
          </div>
        );
      })}
    </motion.div>
  );
}

/* ── RewardCyclesTab ──────────────────────────────────────────────────────── */
function RewardCyclesTab({ cycles }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 100px 100px', gap: 8 }}>
        {['Run At', 'Providers', 'Total SCT', 'Status', ''].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {cycles.length === 0 && <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>No reward cycles yet</div>}
      {cycles.map((c, i) => {
        const isExp = expanded === (c._id || i);
        return (
          <React.Fragment key={c._id || i}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 100px 100px', gap: 8, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isExp ? null : (c._id || i))}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: '0.82rem', color: '#fff' }}>{fmt(c.runAt)}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2997ff' }}>{c.providersProcessed}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ff9f0a' }}>{(c.totalSCTMinted || 0).toFixed(4)} SCT</div>
              <Badge v={c.status || 'completed'} map={{ completed: { c: '#30d158', bg: 'rgba(48,209,88,0.1)', border: 'rgba(48,209,88,0.3)', label: 'Done' }, partial: { c: '#ff9f0a', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.3)', label: 'Partial' }, failed: { c: '#ff375f', bg: 'rgba(255,55,95,0.1)', border: 'rgba(255,55,95,0.3)', label: 'Failed' }, _: { c: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', label: '—' } }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{isExp ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}</div>
            </div>
            <AnimatePresence>
              {isExp && (c.results || []).length > 0 && (
                <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ background: 'rgba(0,0,0,0.15)', margin: '0 24px 12px', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', gap: 8, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Wallet', 'Storage·h·GB', 'Uptime', 'Reward SCT', 'Status'].map((h, k) => <div key={k} style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>{h}</div>)}
                    </div>
                    {c.results.map((r, j) => (
                      <div key={j} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', gap: 8, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#2997ff' }}>{short(r.walletAddress || '')}</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{(r.storageHoursGB || 0).toFixed(2)}</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{r.uptimePct ?? 0}%</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff9f0a' }}>{(r.rewardSCT || 0).toFixed(4)}</div>
                        <div>{r.status === 'success' ? <CheckCircle size={13} color="#30d158" /> : <XCircle size={13} color="#ff375f" />}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}

/* ── RiskPostureTab ───────────────────────────────────────────────────────── */
function RiskPostureTab({ risk }) {
  const rows = risk?.issues || [];
  const severityColor = s => ({ low: '#64d2ff', medium: '#ff9f0a', high: '#ff375f', critical: '#ff2d55' }[s] || 'rgba(255,255,255,0.5)');
  const statusColor   = s => ({ mitigated: '#30d158', at_risk: '#ff9f0a', open: 'rgba(255,255,255,0.55)' }[s] || 'rgba(255,255,255,0.55)');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>Total: {risk?.summary?.totalIssues || 0}</span>
        <span style={{ color: '#30d158', fontSize: '0.8rem' }}>Mitigated: {risk?.summary?.mitigated || 0}</span>
        <span style={{ color: '#ff9f0a', fontSize: '0.8rem' }}>At Risk: {risk?.summary?.atRisk || 0}</span>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>Open: {risk?.summary?.open || 0}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.key || i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
            <div style={{ color: '#fff', fontSize: '0.84rem', fontWeight: 600 }}>{r.title}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: severityColor(r.severity), fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.severity}</span>
              <span style={{ color: statusColor(r.status), fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{String(r.status || '').replace('_', ' ')}</span>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.78rem' }}>{r.mitigation}</div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', marginTop: 3 }}>{r.metric}</div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)' }}>No risk posture data</div>}
    </motion.div>
  );
}

/* ── AbuseReportsTab ──────────────────────────────────────────────────────── */
function AbuseReportsTab({ reports, onUpdate }) {
  const [updating, setUpdating] = useState('');
  const setStatus = async (id, status) => {
    setUpdating(id);
    try { await onUpdate(id, status); } finally { setUpdating(''); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 120px 140px', gap: 8 }}>
        {['Type', 'Reason', 'Reporter', 'Evidence', 'Status', 'Action'].map((h, i) => (
          <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{h}</div>
        ))}
      </div>
      {reports.map(r => (
        <div key={r._id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 120px 140px', gap: 8, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
          <div style={{ color: '#2997ff', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.targetType}</div>
          <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</div>
          <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: '0.78rem' }}>{r.reporterUserId?.name || 'Unknown'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {r.evidenceUrl && (
              <a href={r.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: '#64d2ff', fontSize: '0.73rem', textDecoration: 'none' }}>
                Open URL
              </a>
            )}
            {r.evidenceImageDataUrl && (
              <a href={r.evidenceImageDataUrl} target="_blank" rel="noreferrer" style={{ color: '#ff9f0a', fontSize: '0.73rem', textDecoration: 'none' }}>
                Screenshot
              </a>
            )}
            {!r.evidenceUrl && !r.evidenceImageDataUrl && <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.73rem' }}>None</span>}
          </div>
          <div style={{ color: r.status === 'resolved' ? '#30d158' : r.status === 'rejected' ? '#ff375f' : '#ff9f0a', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.status}</div>
          <select value={r.status} disabled={updating === r._id} onChange={e => setStatus(r._id, e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: '0.74rem', padding: '5px 8px' }}>
            {['open', 'reviewing', 'resolved', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ))}
      {reports.length === 0 && <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)' }}>No abuse reports</div>}
    </motion.div>
  );
}

/* ── SettingsTab ──────────────────────────────────────────────────────────── */
function SettingsTab({ onToast }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', adminSecret: '' });
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.adminSecret) {
      onToast('All fields are required', true); return;
    }
    setCreating(true);
    try {
      await api.post('/auth/admin-register', form);
      setDone(true);
      setForm({ name: '', email: '', password: '', adminSecret: '' });
      onToast('Admin account created successfully');
    } catch (e) {
      onToast(e.response?.data?.message || 'Failed to create admin account', true);
    } finally { setCreating(false); }
  };

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#fff', fontSize: '0.85rem', padding: '10px 12px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

      {/* Create Admin Account */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Shield size={15} color="#bf5af2" />
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Create Admin Account</h3>
        </div>
        {done && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: 10, fontSize: '0.78rem', color: '#30d158', display: 'flex', alignItems: 'center', gap: 7 }}>
            <CheckCircle size={13} /> Admin account created!
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Admin Name' },
            { key: 'email', label: 'Email Address', type: 'email', placeholder: 'admin@storachain.io' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
            { key: 'adminSecret', label: 'Admin Secret Key', type: 'password', placeholder: 'StoraChain-Admin-2024' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleCreate} disabled={creating}
            style={{ padding: '11px 0', background: creating ? 'rgba(255,255,255,0.04)' : 'rgba(191,90,242,0.15)', border: `1px solid ${creating ? 'rgba(255,255,255,0.1)' : 'rgba(191,90,242,0.35)'}`, borderRadius: 10, color: creating ? 'rgba(255,255,255,0.3)' : '#bf5af2', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', marginTop: 4 }}>
            {creating ? 'Creating…' : 'Create Admin Account'}
          </motion.button>
        </div>
      </div>

      {/* Platform Info */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <BarChart2 size={15} color="#2997ff" />
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Platform Configuration</h3>
        </div>
        {[
          { label: 'Admin Secret Key', value: 'StoraChain-Admin-2024', note: 'Set in backend .env as ADMIN_SECRET' },
          { label: 'Network', value: 'Ethereum Sepolia (Testnet)', note: 'Smart contract & token minting chain' },
          { label: 'IPFS Gateway', value: 'Pinata Cloud', note: 'Primary decentralized storage layer' },
          { label: 'Token Standard', value: 'ERC-20 — StoraChain Token (SCT)', note: 'ERC-20 on Sepolia' },
          { label: 'Stripe Mode', value: 'Test Mode (pk_test_51TRHz…)', note: 'Switch to live mode for production' },
          { label: 'Replication Factor', value: '3× chunks across providers', note: 'Configurable in replicationMonitor.js' },
          { label: 'Reward Schedule', value: 'Daily at midnight UTC', note: 'Cron job via node-cron' },
          { label: 'Cloud Backup', value: 'AWS S3 — eu-north-1', note: 'Fallback tier 4 storage' },
        ].map((item, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</div>
            <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>{item.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{item.note}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main AdminDashboard
══════════════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [tab,          setTab]          = useState(0);
  const [stats,        setStats]        = useState(null);
  const [users,        setUsers]        = useState([]);
  const [providers,    setProviders]    = useState([]);
  const [files,        setFiles]        = useState([]);
  const [txns,         setTxns]         = useState([]);
  const [cycles,       setCycles]       = useState([]);
  const [risk,         setRisk]         = useState(null);
  const [abuseReports, setAbuseReports] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [cycleDone,    setCycleDone]    = useState(false);
  const [replicationRunning, setReplicationRunning] = useState(false);
  const [toast,        setToast]        = useState('');

  const showToast = useCallback((msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(''), 4000);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, uRes, pRes, fRes, tRes, cRes, rRes, aRes, mRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/providers'),
        api.get('/admin/files'),
        api.get('/admin/transactions'),
        api.get('/admin/reward-cycles'),
        api.get('/admin/risk-posture'),
        api.get('/admin/abuse-reports'),
        api.get('/admin/marketplace'),
      ]);
      setStats(sRes.data);
      setUsers(uRes.data);
      setProviders(pRes.data);
      setFiles(fRes.data);
      setTxns(tRes.data);
      setCycles(cRes.data);
      setRisk(rRes.data);
      setAbuseReports(aRes.data);
      setMarketplaceListings(mRes.data);
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to load admin data', true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── actions ────────────────────────────────────────────────────────────── */
  const handleStatusChange = async (providerId, status) => {
    try {
      await api.put(`/admin/providers/${providerId}/status`, { status });
      setProviders(prev => prev.map(p => p._id === providerId ? { ...p, isActive: status === 'active' } : p));
      showToast(`Provider ${status} successfully`);
    } catch (e) { showToast(e.response?.data?.message || 'Status update failed', true); }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, updates);
      setUsers(prev => prev.map(u => u._id === userId ? data.user : u));
      showToast('User updated successfully');
    } catch (e) { showToast(e.response?.data?.message || 'Update failed', true); throw e; }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
      showToast('User deleted');
    } catch (e) { showToast(e.response?.data?.message || 'Delete failed', true); throw e; }
  };

  const handleRemoveListing = async (listingId) => {
    try {
      await api.delete(`/admin/marketplace/${listingId}`);
      setMarketplaceListings(prev => prev.map(l => l._id === listingId ? { ...l, isActive: false } : l));
      showToast('Listing removed from marketplace');
    } catch (e) { showToast(e.response?.data?.message || 'Remove failed', true); }
  };

  const handleRunCycle = async () => {
    setCycleRunning(true); setCycleDone(false);
    try {
      const { data } = await api.post('/admin/reward-cycle');
      setCycles(prev => [{ runAt: data.runAt, providersProcessed: (data.results || []).length, totalSCTMinted: data.totalMinted || 0, results: (data.results || []).map(r => ({ walletAddress: r.wallet, storageHoursGB: r.storageHoursGB, uptimePct: r.uptime, rewardSCT: r.rewardSCT, txHash: r.txHash, status: r.status === 'minted' ? 'success' : 'failed' })), status: 'completed' }, ...prev]);
      setCycleDone(true);
      setTab(6); // Reward Cycles tab
      showToast(`Cycle complete — ${data.totalMinted?.toFixed(4) ?? 0} SCT distributed`);
    } catch (e) { showToast(e.response?.data?.message || 'Reward cycle failed', true); }
    finally { setCycleRunning(false); }
  };

  const handleRunReplication = async () => {
    setReplicationRunning(true);
    try {
      const { data } = await api.post('/admin/replication-monitor/run');
      const r = data?.result || {};
      showToast(`Replication check complete — repaired ${r.repaired || 0}, failed ${r.failed || 0}`);
      await fetchAll();
    } catch (e) { showToast(e.response?.data?.message || 'Replication check failed', true); }
    finally { setReplicationRunning(false); }
  };

  const handleAbuseUpdate = async (id, status) => {
    try {
      const { data } = await api.put(`/admin/abuse-reports/${id}`, { status });
      setAbuseReports(prev => prev.map(r => r._id === id ? (data.report || { ...r, status }) : r));
      showToast('Abuse report updated');
    } catch (e) { showToast(e.response?.data?.message || 'Failed to update abuse report', true); }
  };

  /* ── tab content switch ───────────────────────────────────────────────── */
  const tabContent = () => {
    if (loading) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, paddingTop: 8 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 100, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }} />)}
      </div>
    );
    switch (tab) {
      case 0: return <OverviewTab onRunCycle={handleRunCycle} cycleRunning={cycleRunning} cycleDone={cycleDone} onRunReplication={handleRunReplication} replicationRunning={replicationRunning} files={files} stats={stats} />;
      case 1: return <UsersTab users={users} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
      case 2: return <ProvidersTab providers={providers} onStatusChange={handleStatusChange} />;
      case 3: return <ProviderMonitorTab />;
      case 4: return <FilesTab files={files} />;
      case 5: return <MarketplaceTab listings={marketplaceListings} onRemove={handleRemoveListing} />;
      case 6: return <TransactionsTab transactions={txns} />;
      case 7: return <RewardCyclesTab cycles={cycles} />;
      case 8: return <RiskPostureTab risk={risk} />;
      case 9: return <AbuseReportsTab reports={abuseReports} onUpdate={handleAbuseUpdate} />;
      case 10: return <SettingsTab onToast={showToast} />;
      default: return null;
    }
  };

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(191,90,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} color="#bf5af2" />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Admin Dashboard</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.93rem' }}>Full platform management — users, providers, files, marketplace, rewards</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={fetchAll}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>
          <RefreshCw size={13} /> Refresh All
        </motion.button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginBottom: 16, padding: '11px 18px', background: toast.err ? 'rgba(255,55,95,0.08)' : 'rgba(48,209,88,0.08)', border: `1px solid ${toast.err ? 'rgba(255,55,95,0.3)' : 'rgba(48,209,88,0.3)'}`, borderRadius: 10, color: toast.err ? '#ff375f' : '#30d158', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.err ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Users"     value={stats.totalUsers ?? 0}       icon={<Users     size={16} color="#2997ff" />} accent="#2997ff"  sub={`${stats.suspendedUsers ?? 0} suspended/banned`} />
          <StatCard label="Providers"        value={`${stats.activeProviders ?? 0}/${stats.totalProviders ?? 0}`} icon={<Server size={16} color="#30d158" />} accent="#30d158"  sub="Active / Total" />
          <StatCard label="Files Stored"     value={stats.totalFiles ?? 0}       icon={<FileText  size={16} color="#bf5af2" />} accent="#bf5af2"  sub="Non-deleted records" />
          <StatCard label="Storage Used"     value={`${(stats.totalStorageGB || 0).toFixed(2)} GB`} icon={<HardDrive size={16} color="#ff9f0a" />} accent="#ff9f0a"  sub="Across all providers" />
          <StatCard label="Marketplace"      value={stats.totalMarketplaceListings ?? 0} icon={<ShoppingBag size={16} color="#64d2ff" />} accent="#64d2ff"  sub="Active listings" />
          <StatCard label="SCT Minted"       value={`${(stats.totalSCTMinted || 0).toFixed(2)}`}   icon={<Coins size={16} color="#ff9f0a" />} accent="#ff9f0a"  sub="via reward cycles" />
          <StatCard label="Days Online"      value={stats.platformDaysOnline ?? 0} icon={<Calendar size={16} color="#ff375f" />} accent="#ff375f"  sub="Since launch" />
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ padding: '8px 14px', background: tab === i ? 'rgba(255,255,255,0.08)' : 'transparent', border: tab === i ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent', borderRadius: 9, color: tab === i ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: tab === i ? 700 : 500, transition: 'all 0.15s' }}>
            {t}
            {i === 1 && users.length > 0 && <span style={{ marginLeft: 5, background: 'rgba(41,151,255,0.2)', color: '#2997ff', fontSize: '0.65rem', borderRadius: 10, padding: '1px 6px' }}>{users.length}</span>}
            {i === 9 && abuseReports.filter(r => r.status === 'open').length > 0 && <span style={{ marginLeft: 5, background: 'rgba(255,55,95,0.2)', color: '#ff375f', fontSize: '0.65rem', borderRadius: 10, padding: '1px 6px' }}>{abuseReports.filter(r => r.status === 'open').length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabContent()}
    </div>
  );
}
