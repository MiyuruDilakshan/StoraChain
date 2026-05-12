/**
 * LiveActivity.js — StoraChain Admin Live Activity Feed
 *
 * Shows a real-time stream of every backend operation:
 *   upload → encrypt → shard → provider → replica → IPFS → S3 → blockchain → reward
 *   download → chunk-fetch → decrypt → integrity check → serve
 *
 * Connects via Server-Sent Events (SSE) to /api/admin/activity/stream
 * Falls back to polling /api/admin/activity/recent every 3 seconds if SSE fails.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Wifi, WifiOff, Trash2, Pause, Play,
  ChevronDown, Filter, Download,
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ── colour / label map ──────────────────────────────────────────────────── */
const TYPE_META = {
  upload:     { color: '#2997ff', bg: 'rgba(41,151,255,0.12)',  label: 'Upload'      },
  encrypt:    { color: '#bf5af2', bg: 'rgba(191,90,242,0.12)',  label: 'Encryption'  },
  chunk:      { color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)',  label: 'Sharding'    },
  provider:   { color: '#30d158', bg: 'rgba(48,209,88,0.12)',   label: 'Provider'    },
  replica:    { color: '#5ac8fa', bg: 'rgba(90,200,250,0.12)',  label: 'Replication' },
  matchmake:  { color: '#ff6b35', bg: 'rgba(255,107,53,0.12)',  label: 'AI Match'    },
  ipfs:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'IPFS/Pinata' },
  s3:         { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  label: 'AWS S3'      },
  chain:      { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  label: 'Blockchain'  },
  reward:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Tokens'      },
  download:   { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Download'    },
  decrypt:    { color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)', label: 'Decryption'  },
  replication:{ color: '#5ac8fa', bg: 'rgba(90,200,250,0.12)',  label: 'Replication' },
  system:     { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', label: 'System'      },
  error:      { color: '#ff375f', bg: 'rgba(255,55,95,0.12)',   label: 'Error'       },
  info:       { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Info'        },
};

const ALL_TYPES = Object.keys(TYPE_META);

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ── LogEntry row component ──────────────────────────────────────────────── */
function LogEntry({ entry, isNew }) {
  const meta = TYPE_META[entry.type] || TYPE_META.info;
  const [expanded, setExpanded] = useState(false);
  const hasMeta = entry.meta && Object.keys(entry.meta).length > 0;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -12, backgroundColor: `${meta.color}22` } : { opacity: 1 }}
      animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex', gap: 12, padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: hasMeta ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => hasMeta && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      onClick={() => hasMeta && setExpanded(p => !p)}
    >
      {/* Icon + type badge */}
      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', marginTop: 1 }}>
        {entry.icon || '•'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 7px', borderRadius: 5, flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
          <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, flex: 1 }}>
            {entry.message}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
            {fmt(entry.timestamp)}
          </span>
          {hasMeta && (
            <ChevronDown size={13} color="rgba(255,255,255,0.25)" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginTop: 2 }} />
          )}
        </div>

        {/* Expanded meta */}
        {expanded && hasMeta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}
          >
            {Object.entries(entry.meta).map(([k, v]) => v && (
              <div key={k} style={{ fontSize: '0.7rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>{k}:</span>
                <span style={{ color: meta.color, fontWeight: 600, wordBreak: 'break-all' }}>{String(v)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Stats bar at top ────────────────────────────────────────────────────── */
function StatsBar({ logs }) {
  const counts = {};
  for (const l of logs) counts[l.type] = (counts[l.type] || 0) + 1;
  const uploads   = (counts.upload   || 0);
  const downloads = (counts.download || 0);
  const errors    = (counts.error    || 0);
  const rewards   = (counts.reward   || 0);

  const stat = (label, value, color) => (
    <div style={{ textAlign: 'center', padding: '0 16px' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
      {stat('Total Events', logs.length, '#fff')}
      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
      {stat('Uploads', uploads, '#2997ff')}
      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
      {stat('Downloads', downloads, '#34d399')}
      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
      {stat('Token Rewards', rewards, '#fbbf24')}
      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
      {stat('Errors', errors, errors > 0 ? '#ff375f' : 'rgba(255,255,255,0.3)')}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function LiveActivity() {
  const [logs, setLogs]         = useState([]);
  const [newIds, setNewIds]     = useState(new Set());
  const [connected, setConnected] = useState(false);
  const [paused, setPaused]     = useState(false);
  const [filter, setFilter]     = useState('all');   // 'all' or a type key
  const [autoScroll, setAutoScroll] = useState(true);

  const listRef   = useRef(null);
  const esRef     = useRef(null);
  const bufferRef = useRef([]);  // holds entries while paused

  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const addEntries = useCallback((entries) => {
    if (!Array.isArray(entries)) entries = [entries];
    const ids = entries.map(e => e.id);
    setLogs(prev => {
      const combined = [...prev, ...entries];
      // Keep max 500 in UI
      return combined.length > 500 ? combined.slice(combined.length - 500) : combined;
    });
    setNewIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    // Clear "new" highlight after 2s
    setTimeout(() => {
      setNewIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 2000);
  }, []);

  // Connect SSE
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let es;
    let retryTimeout;

    const connect = () => {
      try {
        // SSE with auth token passed as query param (EventSource doesn't support custom headers)
        es = new EventSource(`${API}/api/admin/activity/stream?token=${encodeURIComponent(token)}`);
        esRef.current = es;

        es.onopen = () => setConnected(true);

        es.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === '__init__') {
              // Initial batch of historical logs
              setLogs(payload.logs || []);
              setConnected(true);
              return;
            }
            if (pausedRef.current) {
              bufferRef.current.push(payload);
            } else {
              addEntries([payload]);
            }
          } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
          setConnected(false);
          es.close();
          // Retry after 5s
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch {
        retryTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, [addEntries]);

  // Auth header workaround: SSE doesn't support custom headers.
  // The backend needs to accept token via query param.
  // We monkey-patch the auth middleware to also check req.query.token.
  // (That's handled on the backend side in authMiddleware.)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !paused && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, autoScroll, paused]);

  // Resume: flush buffer
  const resume = () => {
    setPaused(false);
    if (bufferRef.current.length > 0) {
      addEntries(bufferRef.current);
      bufferRef.current = [];
    }
  };

  const clearLogs = () => { setLogs([]); bufferRef.current = []; };

  const exportLogs = () => {
    const text = logs.map(l =>
      `[${fmt(l.timestamp)}] [${l.label || l.type}] ${l.message}` +
      (l.meta && Object.keys(l.meta).length > 0 ? '\n  ' + JSON.stringify(l.meta, null, 2).replace(/\n/g, '\n  ') : '')
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `storachain-activity-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  return (
    <div style={{ minHeight: '100vh', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} color="#bf5af2" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>Live Activity Feed</h1>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Real-time backend operations — every upload, encrypt, shard, distribute, backup &amp; download</p>
          </div>
          {/* SSE connection status */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: connected ? 'rgba(48,209,88,0.1)' : 'rgba(255,55,95,0.1)', border: `1px solid ${connected ? 'rgba(48,209,88,0.3)' : 'rgba(255,55,95,0.3)'}` }}>
            {connected
              ? <><Wifi size={13} color="#30d158" /> <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#30d158' }}>Live</span></>
              : <><WifiOff size={13} color="#ff375f" /> <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff375f' }}>Connecting…</span></>
            }
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#30d158' : '#ff375f', animation: connected ? 'pulse 1.5s infinite' : 'none' }} />
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>

        {/* Stats bar */}
        <StatsBar logs={logs} />

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="rgba(255,255,255,0.3)" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: '0.78rem', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <option value="all">All events</option>
              {ALL_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
              ))}
            </select>
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(p => !p)}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${autoScroll ? 'rgba(41,151,255,0.4)' : 'rgba(255,255,255,0.15)'}`, background: autoScroll ? 'rgba(41,151,255,0.1)' : 'rgba(255,255,255,0.05)', color: autoScroll ? '#2997ff' : 'rgba(255,255,255,0.4)' }}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          <div style={{ flex: 1 }} />

          {/* Event count */}
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
            {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
            {filter !== 'all' ? ` (${logs.length} total)` : ''}
            {paused && bufferRef.current.length > 0 && <span style={{ color: '#ff9f0a' }}> · {bufferRef.current.length} buffered</span>}
          </span>

          {/* Pause / Resume */}
          <button
            onClick={paused ? resume : () => setPaused(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${paused ? 'rgba(48,209,88,0.4)' : 'rgba(255,159,10,0.4)'}`, background: paused ? 'rgba(48,209,88,0.1)' : 'rgba(255,159,10,0.1)', color: paused ? '#30d158' : '#ff9f0a' }}
          >
            {paused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
          </button>

          {/* Export */}
          <button
            onClick={exportLogs}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
          >
            <Download size={11} /> Export
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,55,95,0.3)', background: 'rgba(255,55,95,0.08)', color: '#ff375f' }}
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>

        {/* Log list */}
        <div
          ref={listRef}
          style={{ height: 520, overflowY: 'auto', scrollBehavior: 'smooth' }}
          onScroll={e => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setAutoScroll(atBottom);
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={24} color="rgba(191,90,242,0.4)" />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                {connected ? 'Waiting for activity…\nUpload a file as a seeker to see the full pipeline.' : 'Connecting to live feed…'}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredLogs.map(entry => (
                <LogEntry key={entry.id} entry={entry} isNew={newIds.has(entry.id)} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Pipeline legend */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pipeline:</span>
          {['upload','encrypt','chunk','matchmake','provider','replica','ipfs','s3','chain','reward','download','decrypt'].map(t => {
            const m = TYPE_META[t];
            return (
              <span key={t} onClick={() => setFilter(filter === t ? 'all' : t)} style={{ fontSize: '0.65rem', fontWeight: 700, color: m.color, background: m.bg, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${filter === t ? m.color : 'transparent'}`, transition: 'border 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {m.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Paused banner */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,159,10,0.95)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, color: '#000', fontWeight: 700, fontSize: '0.85rem', zIndex: 999, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <Pause size={14} />
            Feed paused — {bufferRef.current.length} new event{bufferRef.current.length !== 1 ? 's' : ''} buffered
            <button onClick={resume} style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: 'none', color: '#000', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>Resume</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
