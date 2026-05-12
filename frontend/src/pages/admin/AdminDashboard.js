import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Server, HardDrive, Coins, Activity, Calendar,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Shield,
  FileText, ShoppingBag, Trash2, Edit3,
  Search, Eye, BarChart2, Wifi, WifiOff,
  ShieldAlert, Flag, Terminal, Copy, BookOpen,
} from 'lucide-react';
import api from '../../api/client';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const short = (h, n = 8) => h ? `${h.slice(0, n)}…${h.slice(-6)}` : '—';
const fmtGB = v => v >= 1 ? `${Number(v).toFixed(2)} GB` : `${(v * 1024).toFixed(0)} MB`;
const fmtBytes = b => { if (!b) return '—'; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; if (b < 1073741824) return `${(b/1048576).toFixed(1)} MB`; return `${(b/1073741824).toFixed(2)} GB`; };

const TABS = ['Overview', 'Users', 'Providers', 'Provider Monitor', 'Files', 'Marketplace', 'Transactions', 'Reward Cycles', 'Risk Posture', 'Provider Integrity', 'Abuse Reports', 'Settings'];

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
  active:    { c: '#30d158', bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.3)',  label: 'Active' },
  offline:   { c: '#888888', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', label: 'Offline' },
  paused:    { c: '#ff9f0a', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.3)', label: 'Paused' },
  suspended: { c: '#ff9f0a', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.3)', label: 'Suspended' },
  banned:    { c: '#ff375f', bg: 'rgba(255,55,95,0.12)',  border: 'rgba(255,55,95,0.3)',  label: 'Banned' },
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
                {opts.map(o => <option key={o} value={o} style={{ background: '#1e293b', color: '#fff' }}>{o[0].toUpperCase() + o.slice(1)}</option>)}
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
          <option value="all" style={{ background: '#1e293b', color: '#fff' }}>All Roles</option>
          <option value="seeker" style={{ background: '#1e293b', color: '#fff' }}>Seeker</option>
          <option value="provider" style={{ background: '#1e293b', color: '#fff' }}>Provider</option>
          <option value="admin" style={{ background: '#1e293b', color: '#fff' }}>Admin</option>
        </select>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option value="all" style={{ background: '#1e293b', color: '#fff' }}>All Plans</option>
          <option value="free" style={{ background: '#1e293b', color: '#fff' }}>Free</option>
          <option value="basic" style={{ background: '#1e293b', color: '#fff' }}>Basic</option>
          <option value="pro" style={{ background: '#1e293b', color: '#fff' }}>Pro</option>
          <option value="premium" style={{ background: '#1e293b', color: '#fff' }}>Premium</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option value="all" style={{ background: '#1e293b', color: '#fff' }}>All Status</option>
          <option value="active" style={{ background: '#1e293b', color: '#fff' }}>Active</option>
          <option value="suspended" style={{ background: '#1e293b', color: '#fff' }}>Suspended</option>
          <option value="banned" style={{ background: '#1e293b', color: '#fff' }}>Banned</option>
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
        const userStatus = p.providerId?.status || 'active';
        let statusKey = 'active';
        if (userStatus !== 'active') statusKey = userStatus;
        else if (p.isPaused) statusKey = 'paused';
        else if (!p.isActive) statusKey = 'offline';
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
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <select 
                  value={statusKey} 
                  disabled={updating === p._id} 
                  onChange={e => {
                    const next = e.target.value;
                    if (next === 'active' || next === 'suspended' || next === 'banned') {
                      handleStatus(p._id, next);
                    }
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 7, 
                    color: '#fff', 
                    fontSize: '0.68rem', 
                    padding: '4px 8px',
                    cursor: 'pointer',
                    outline: 'none',
                    width: '100%',
                    appearance: 'none',
                    fontFamily: 'inherit'
                  }}>
                  <option value="active" style={{ background: '#1e293b', color: '#fff' }}>Activate</option>
                  <option value="suspended" style={{ background: '#1e293b', color: '#fff' }}>Suspend</option>
                  <option value="banned" style={{ background: '#1e293b', color: '#fff' }}>Ban</option>
                </select>
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.3)' }}>
                  <ChevronDown size={10} />
                </div>
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

/* ── VPS Setup Guide ─────────────────────────────────────────────────────── */
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
      body: 'After install, the agent registers with 0 GB. Go to My Storage Node page (log in as the provider) and set the space you want to offer (e.g. 50 GB). Or edit ~/.env → SPACE_GB=50 then pm2 restart storachain-provider.',
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

/* ── ProviderMonitorTab ─────────────────────────────────────────────────── */
function ProviderMonitorTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [showGuide, setShowGuide] = useState(false);

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

      {showGuide && <VpsSetupGuide onClose={() => setShowGuide(false)} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowGuide(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 9, color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600 }}>
          <BookOpen size={13}/> VPS Setup Guide
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={fetchOnline} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Refresh
        </motion.button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(255,55,95,0.07)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 10, color: '#ff375f', fontSize: '0.84rem', marginBottom: 12 }}>{error}</div>}

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '28px 2fr 1.2fr 1.2fr 1.4fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
          {['', 'Provider', 'Region', 'IP Address', 'Storage', 'Latency', 'Uptime', 'Status'].map((h,i) => (
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
          const isHeartbeat = p.onlineSource === 'heartbeat';
          const hbAgo = p.lastHeartbeatAt
            ? (() => { const s = Math.floor((Date.now() - new Date(p.lastHeartbeatAt)) / 1000); return s < 60 ? `${s}s ago` : `${Math.floor(s/60)}m ago`; })()
            : null;
          return (
            <div key={p._id || i}
              style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1.2fr 1.2fr 1.4fr 1fr 1fr 1fr', gap: 8, padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.014)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {/* Online dot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.isOnline ? onlineColor : offlineColor, boxShadow: p.isOnline ? `0 0 6px ${onlineColor}` : 'none' }}/>
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{p.providerId?.name || 'Unknown'}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{p.agentUrl}</div>
                {p.isSuspended && <div style={{ fontSize: '0.62rem', color: '#ff375f', marginTop: 2 }}>⚠ Suspended</div>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{p.region || 'local'}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                {(() => {
                  // Prefer hardware.ip; fall back to hostname from agentUrl
                  let ip = p.hardware?.ip || '';
                  // Strip IPv4-mapped IPv6 prefix if still present
                  ip = ip.replace(/^::ffff:/, '').trim();
                  if (!ip) {
                    try { ip = new URL(p.agentUrl).hostname; } catch { ip = ''; }
                  }
                  return ip || '—';
                })()
              }
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{fmtGB(p.usedGB||0)} / {fmtGB(p.capacityGB||0)}</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${usedPct}%`, background: barC, borderRadius: 3 }}/>
                </div>
              </div>
              {/* Latency — show ms for direct ping, heartbeat time for NAT providers */}
              <div>
                {p.latencyMs
                  ? <span style={{ fontSize: '0.82rem', fontWeight: 700, color: p.latencyMs < 200 ? '#30d158' : p.latencyMs < 500 ? '#ff9f0a' : '#ff375f' }}>{p.latencyMs}ms</span>
                  : isHeartbeat && hbAgo
                    ? <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }} title="NAT provider — status via heartbeat">HB {hbAgo}</span>
                    : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>—</span>
                }
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
                  {p.isOnline ? (isHeartbeat ? 'Online·HB' : 'Online') : 'Offline'}
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
            <div>
              {t.txHash ? (
                <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#2997ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  {short(t.txHash, 10)} <ExternalLink size={11} />
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.72rem', color: t.type === 'reward' ? '#ff9f0a' : 'rgba(255,255,255,0.2)' }}>
                    {t.type === 'reward' ? (t.providerWallet ? 'Pending Mint' : 'No Wallet') : 'Off-chain'}
                  </span>
                  {t.type === 'reward' && t.providerWallet && <RefreshCw size={10} color="#ff9f0a" style={{ animation: 'spin 2s linear infinite' }} />}
                </div>
              )}
            </div>
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

/* ── ProviderIntegrityTab ─────────────────────────────────────────────────── */
function ProviderIntegrityTab({ onToast }) {
  const [providers, setProviders]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [suspended, setSuspended]   = useState([]);
  const [clearing,  setClearing]    = useState('');
  const [expanded,  setExpanded]    = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/admin/providers'),
        api.get('/providers/admin/suspended'),
      ]);
      setProviders(pRes.data || []);
      setSuspended(sRes.data || []);
    } catch { /* non-critical */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const clearSuspension = async (listingId) => {
    setClearing(listingId);
    try {
      await api.post(`/providers/admin/clear-suspension/${listingId}`);
      onToast('Suspension cleared successfully');
      load();
    } catch (e) { onToast(e.response?.data?.message || 'Failed', true); }
    setClearing('');
  };

  const repColor = s => s >= 80 ? '#30d158' : s >= 50 ? '#ff9f0a' : '#ff375f';

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ marginTop: 12, fontSize: '0.85rem' }}>Loading integrity data…</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {[
          { label: 'Total Providers', value: providers.length, color: '#2997ff' },
          { label: 'Suspended', value: suspended.length, color: '#ff375f' },
          { label: 'Avg Reputation', value: providers.length ? Math.round(providers.reduce((a,p)=>a+(p.reputationScore||100),0)/providers.length) + '%' : '—', color: '#30d158' },
          { label: 'With Violations', value: providers.filter(p=>(p.totalViolations||0)>0).length, color: '#ff9f0a' },
          { label: 'Healthy Nodes', value: providers.filter(p=>p.integrityHealthy!==false).length, color: '#30d158' },
        ].map((s,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(255,255,255,0.3)', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:'1.4rem', fontWeight:900, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Suspended providers banner */}
      {suspended.length > 0 && (
        <div style={{ background:'rgba(255,55,95,0.06)', border:'1px solid rgba(255,55,95,0.2)', borderRadius:14, padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, color:'#ff375f', fontWeight:800, fontSize:'0.85rem' }}>
            <ShieldAlert size={16}/> {suspended.length} Provider{suspended.length>1?'s':''} Suspended — Requires Review
          </div>
          {suspended.map(p => (
            <div key={p._id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:'0.84rem', fontWeight:700, color:'#fff' }}>{p.providerId?.name || 'Unknown'} <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:400 }}>({p.providerId?.email})</span></div>
                <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>{p.suspensionReason || 'No reason recorded'}</div>
              </div>
              <button onClick={() => clearSuspension(p._id)} disabled={clearing===p._id}
                style={{ padding:'7px 16px', background:'rgba(48,209,88,0.1)', border:'1px solid rgba(48,209,88,0.3)', borderRadius:8, color:'#30d158', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {clearing===p._id ? 'Clearing…' : 'Clear Suspension'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* All providers integrity table */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 80px', gap:8 }}>
          {['Provider','Reputation','Penalties','Violations','Last Check','Status'].map((h,i)=>(
            <div key={i} style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)' }}>{h}</div>
          ))}
        </div>
        {providers.length === 0 && <div style={{ padding:24, color:'rgba(255,255,255,0.3)', fontSize:'0.85rem' }}>No providers registered</div>}
        {providers.map((p,i) => {
          const isExp = expanded === p._id;
          return (
            <React.Fragment key={p._id||i}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 80px', gap:8, padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center', cursor:'pointer' }}
                onClick={()=>setExpanded(isExp?null:p._id)}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.015)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div>
                  <div style={{ fontSize:'0.84rem', fontWeight:700, color:'#fff' }}>{p.providerId?.name||'Unknown'}</div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>{p.providerId?.email||'—'}</div>
                </div>
                <div style={{ fontWeight:800, fontSize:'0.88rem', color:repColor(p.reputationScore||100) }}>{Math.round(p.reputationScore||100)}/100</div>
                <div style={{ fontWeight:700, fontSize:'0.88rem', color:(p.penaltyPoints||0)===0?'#30d158':(p.penaltyPoints||0)<25?'#ff9f0a':'#ff375f' }}>{p.penaltyPoints||0} pts</div>
                <div style={{ fontSize:'0.88rem', color:(p.totalViolations||0)===0?'rgba(255,255,255,0.4)':'#ff9f0a' }}>{p.totalViolations||0}</div>
                <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.35)' }}>{p.lastIntegrityCheck?new Date(p.lastIntegrityCheck).toLocaleTimeString():'Never'}</div>
                <div>
                  {p.isSuspended ? <span style={{ fontSize:'0.68rem', fontWeight:700, color:'#ff375f', background:'rgba(255,55,95,0.1)', padding:'3px 8px', borderRadius:8 }}>SUSPENDED</span>
                    : p.integrityHealthy===false ? <span style={{ fontSize:'0.68rem', fontWeight:700, color:'#ff9f0a', background:'rgba(255,159,10,0.1)', padding:'3px 8px', borderRadius:8 }}>ISSUES</span>
                    : <span style={{ fontSize:'0.68rem', fontWeight:700, color:'#30d158', background:'rgba(48,209,88,0.1)', padding:'3px 8px', borderRadius:8 }}>HEALTHY</span>}
                </div>
              </div>
              <AnimatePresence>
                {isExp && (
                  <motion.div key="exp" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden'}}>
                    <div style={{ background:'rgba(0,0,0,0.15)', margin:'0 20px 12px', borderRadius:10, padding:'14px 16px' }}>
                      <div style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Recent Violations</div>
                      {(p.integrityViolations||[]).length===0
                        ? <div style={{ fontSize:'0.8rem', color:'#30d158', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/> No violations recorded</div>
                        : (p.integrityViolations||[]).slice(-5).reverse().map((v,j)=>(
                          <div key={j} style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginBottom:5, display:'flex', gap:8 }}>
                            <AlertCircle size={12} color="#ff375f" style={{flexShrink:0,marginTop:2}}/>
                            <span><strong style={{color:'rgba(255,255,255,0.7)'}}>{v.type}</strong> — {v.detail} <span style={{color:'rgba(255,255,255,0.25)'}}>{v.detectedAt?new Date(v.detectedAt).toLocaleString():''}</span></span>
                          </div>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── AbuseReportsTab ──────────────────────────────────────────────────────── */
function AbuseReportsTab({ reports, onUpdate }) {
  const [updating, setUpdating] = useState('');
  const [expanded, setExpanded] = useState(null);
  const setStatus = async (id, status) => {
    setUpdating(id);
    try { await onUpdate(id, status); } finally { setUpdating(''); }
  };

  const statusColor = s => s==='resolved'?'#30d158':s==='rejected'?'#ff375f':'#ff9f0a';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Summary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {['open','reviewing','resolved','rejected'].map(s=>{
          const count = (reports || []).filter(r=>r.status===s).length;
          return (
            <div key={s} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid rgba(255,255,255,0.08)`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(255,255,255,0.3)', marginBottom:6 }}>{s}</div>
              <div style={{ fontSize:'1.4rem', fontWeight:900, color:statusColor(s) }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Report list */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'grid', gridTemplateColumns:'100px 1.5fr 1fr 100px 130px', gap:8 }}>
          {['Type','Reason / Reporter','Date','Status','Action'].map((h,i)=>(
            <div key={i} style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)' }}>{h}</div>
          ))}
        </div>
        {(!reports || reports.length === 0) && (
          <div style={{ padding:'40px 24px', textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:'0.85rem' }}>
            <Flag size={28} style={{ marginBottom:12, opacity:0.3, display:'block', margin:'0 auto 12px' }}/> No abuse reports submitted yet
          </div>
        )}
        {(reports || []).map((r,i) => {
          const isExp = expanded===r._id;
          return (
            <React.Fragment key={r._id||i}>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1.5fr 1fr 100px 130px', gap:8, padding:'12px 24px', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center', cursor:'pointer' }}
                onClick={()=>setExpanded(isExp?null:r._id)}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.015)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#2997ff', textTransform:'uppercase', background:'rgba(41,151,255,0.1)', padding:'2px 8px', borderRadius:6 }}>{r.targetType||'—'}</span>
                </div>
                <div>
                  <div style={{ fontSize:'0.82rem', color:'#fff', fontWeight:600, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280 }}>{r.reason||'—'}</div>
                  <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)' }}>by {r.reporterUserId?.name||r.reporterUserId?.email||'Unknown user'}</div>
                </div>
                <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.35)' }}>{r.createdAt?new Date(r.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'—'}</div>
                <div style={{ fontSize:'0.74rem', fontWeight:700, color:statusColor(r.status), textTransform:'uppercase' }}>{r.status}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <select value={r.status} disabled={updating===r._id} onChange={e=>{ e.stopPropagation(); setStatus(r._id,e.target.value); }} onClick={e=>e.stopPropagation()}
                    style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#fff', fontSize:'0.72rem', padding:'5px 8px', fontFamily:'inherit', outline:'none', cursor:'pointer', appearance:'auto' }}>
                    {['open','reviewing','resolved','rejected'].map(s=><option key={s} value={s} style={{background:'#1e293b',color:'#fff'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                  <div style={{ color:'rgba(255,255,255,0.25)' }}>{isExp?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</div>
                </div>
              </div>
              <AnimatePresence>
                {isExp && (
                  <motion.div key="detail" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <div style={{ background:'rgba(0,0,0,0.15)', margin:'0 20px 12px', borderRadius:10, padding:'16px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:12 }}>
                        <div>
                          <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.25)', marginBottom:5 }}>Target ID</div>
                          <div style={{ fontSize:'0.8rem', color:'#fff', wordBreak:'break-all' }}>{r.targetId||'—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.25)', marginBottom:5 }}>Reporter</div>
                          <div style={{ fontSize:'0.8rem', color:'#fff' }}>{r.reporterUserId?.name||'—'} <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.72rem'}}>({r.reporterUserId?.email||'—'})</span></div>
                        </div>
                      </div>
                      {r.description && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.25)', marginBottom:5 }}>Description</div>
                          <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.65)', lineHeight:1.55 }}>{r.description}</div>
                        </div>
                      )}
                      {(r.evidenceUrl||r.evidenceImageDataUrl) && (
                        <div style={{ display:'flex', gap:10 }}>
                          {r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer" style={{ fontSize:'0.78rem', color:'#64d2ff', display:'flex', alignItems:'center', gap:4 }}><ExternalLink size={12}/> Evidence URL</a>}
                          {r.evidenceImageDataUrl && <a href={r.evidenceImageDataUrl} target="_blank" rel="noreferrer" style={{ fontSize:'0.78rem', color:'#ff9f0a', display:'flex', alignItems:'center', gap:4 }}><Eye size={12}/> Screenshot</a>}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
      </div>
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
      const p = providers.find(x => x._id === providerId);
      if (!p || !p.providerId?._id) throw new Error("No linked user account found");
      
      const { data } = await api.patch(`/admin/users/${p.providerId._id}`, { status });
      setUsers(prev => prev.map(u => u._id === p.providerId._id ? data.user : u));
      setProviders(prev => prev.map(x => x._id === providerId ? { ...x, providerId: { ...x.providerId, status } } : x));
      showToast(`Provider ${status} successfully`);
    } catch (e) { showToast(e.response?.data?.message || e.message || 'Status update failed', true); }
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }`}</style>
        {[120, 80, 200, 80, 160].map((h, i) => (
          <div key={i} style={{
            height: h, borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
            backgroundSize: '800px 100%',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }} />
        ))}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: 24, color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading dashboard data…
        </div>
      </motion.div>
    );
    switch (tab) {
      case 0:  return <OverviewTab onRunCycle={handleRunCycle} cycleRunning={cycleRunning} cycleDone={cycleDone} onRunReplication={handleRunReplication} replicationRunning={replicationRunning} files={files} stats={stats} />;
      case 1:  return <UsersTab users={users} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
      case 2:  return <ProvidersTab providers={providers} onStatusChange={handleStatusChange} />;
      case 3:  return <ProviderMonitorTab />;
      case 4:  return <FilesTab files={files} />;
      case 5:  return <MarketplaceTab listings={marketplaceListings} onRemove={handleRemoveListing} />;
      case 6:  return <TransactionsTab transactions={txns} />;
      case 7:  return <RewardCyclesTab cycles={cycles} />;
      case 8:  return <RiskPostureTab risk={risk} />;
      case 9:  return <ProviderIntegrityTab onToast={showToast} />;
      case 10: return <AbuseReportsTab reports={abuseReports} onUpdate={handleAbuseUpdate} />;
      case 11: return <SettingsTab onToast={showToast} />;
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
            style={{ padding: '8px 14px', background: tab === i ? 'rgba(255,255,255,0.08)' : 'transparent', border: tab === i ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent', borderRadius: 9, color: tab === i ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: tab === i ? 700 : 500, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t}
            {i === 1 && users.length > 0 && <span style={{ marginLeft: 5, background: 'rgba(41,151,255,0.2)', color: '#2997ff', fontSize: '0.65rem', borderRadius: 10, padding: '1px 6px' }}>{users.length}</span>}
            {i === 10 && abuseReports.filter(r => r.status === 'open').length > 0 && <span style={{ marginLeft: 5, background: 'rgba(255,55,95,0.2)', color: '#ff375f', fontSize: '0.65rem', borderRadius: 10, padding: '1px 6px' }}>{abuseReports.filter(r => r.status === 'open').length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabContent()}
    </div>
  );
}
