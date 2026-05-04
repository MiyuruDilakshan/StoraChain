import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, X, Coins, RefreshCw, Search, AlertCircle,
  CheckCircle, Loader, Image, Video, Music, FileText, Archive,
  Code, Filter, ChevronDown, Download, MoreVertical, Link2, Flag,
  DollarSign, Eye, Globe, Lock, TrendingUp, Star, Tag, Copy,
  Shield, Zap, Users,
} from 'lucide-react';
import api from '../../api/client';

async function downloadFile(fileId, fileName) {
  const token = localStorage.getItem('token');
  const res = await fetch(`http://localhost:5000/api/storage/download/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName || 'file'; a.click();
  URL.revokeObjectURL(url);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function fmt(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 ** 2); if (mb >= 1) return mb.toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}
function timeAgo(d) {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function mimeIcon(mime = '', size = 22) {
  if (mime.startsWith('image/'))  return <Image  size={size} color="#bf5af2" />;
  if (mime.startsWith('video/'))  return <Video  size={size} color="#ff375f" />;
  if (mime.startsWith('audio/'))  return <Music  size={size} color="#30d158" />;
  if (mime.includes('zip') || mime.includes('tar'))  return <Archive size={size} color="#ff9f0a" />;
  if (mime.includes('javascript') || mime.includes('python')) return <Code size={size} color="#2997ff" />;
  return <FileText size={size} color="rgba(255,255,255,0.4)" />;
}
function catColor(cat = '') {
  const map = { Media: '#bf5af2', Documents: '#2997ff', Archives: '#ff9f0a', Software: '#30d158', Data: 'rgba(255,255,255,0.4)' };
  return map[cat] || 'rgba(255,255,255,0.4)';
}

const CATEGORIES = ['All', 'Media', 'Documents', 'Archives', 'Software', 'Data'];
const SORT_OPTS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'popular',   label: 'Most popular' },
  { value: 'cheapest',  label: 'Price: low → high' },
  { value: 'expensive', label: 'Price: high → low' },
];
const I = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
const menuBtn = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };

/* ── Buy Modal ────────────────────────────────────────────────────────── */
function BuyModal({ listing, user, onClose, onSuccess }) {
  const [step,    setStep]    = useState('idle');
  const [method,  setMethod]  = useState('token');
  const [txHash,  setTxHash]  = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const [fileId,  setFileId]  = useState(null);

  const priceUSD = (listing.priceUSDCents || 0) / 100;
  const priceSCT = listing.priceSCT || 0;
  const fee      = Math.floor(priceSCT * 0.05);
  const hasUSD   = priceUSD > 0;
  const hasSCT   = priceSCT > 0;

  const handleBuy = async () => {
    setErrMsg(''); setTxHash('');
    try {
      setStep('processing');
      let res;
      if (method === 'token') {
        res = await api.post(`/marketplace/${listing._id}/purchase/token`);
        setTxHash(res.data.txId || '');
      } else if (method === 'demo_usd') {
        res = await api.post(`/marketplace/${listing._id}/purchase/demo-usd`);
      } else {
        res = await api.post('/marketplace/purchase', { listingId: listing._id });
        setTxHash(res.data.txHash || '');
      }
      setFileId(res.data.fileRecordId || null);
      setStep('success');
      onSuccess?.();
    } catch (e) {
      setErrMsg(e.response?.data?.message || 'Purchase failed');
      setStep('error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '28px 30px', width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Buy Access</h2>
          {step === 'idle' || step === 'error' ? (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
          ) : null}
        </div>

        {/* File summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 18 }}>
          {listing.fileRecordId?.previewCid ? (
            <img src={`https://gateway.pinata.cloud/ipfs/${listing.fileRecordId.previewCid}`} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 9, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{mimeIcon(listing.mimeType, 20)}</div>
          )}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {listing.sellerId?.name || 'Anonymous'} · {fmt(listing.fileSize)}
            </div>
          </div>
        </div>

        {/* Payment method */}
        {step === 'idle' && (
          <>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Payment method</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {hasSCT && (
                <div onClick={() => setMethod('token')}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: method === 'token' ? 'rgba(255,159,10,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${method === 'token' ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,159,10,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Coins size={16} color="#ff9f0a" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Pay with SCT Tokens</div>
                    <div style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.4)' }}>{priceSCT} SCT · Balance: {(user?.sctBalance || 0).toFixed(0)} SCT</div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ff9f0a' }}>{priceSCT} SCT</div>
                  {method === 'token' && <CheckCircle size={15} color="#ff9f0a" />}
                </div>
              )}
              {hasUSD && (
                <div onClick={() => setMethod('demo_usd')}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: method === 'demo_usd' ? 'rgba(48,209,88,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${method === 'demo_usd' ? 'rgba(48,209,88,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(48,209,88,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={16} color="#30d158" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Pay with Demo USD</div>
                    <div style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.4)' }}>${priceUSD.toFixed(2)} · Balance: ${(user?.demoUSD || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#30d158' }}>${priceUSD.toFixed(2)}</div>
                  {method === 'demo_usd' && <CheckCircle size={15} color="#30d158" />}
                </div>
              )}
              {!hasSCT && !hasUSD && (
                <div style={{ padding: '12px 14px', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, color: '#30d158', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={15} /> Free — no payment required
                </div>
              )}
            </div>
          </>
        )}

        {/* Status */}
        {step === 'processing' && (
          <div style={{ padding: '20px', textAlign: 'center', marginBottom: 16 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex', marginBottom: 10 }}>
              <Loader size={28} color="#2997ff" />
            </motion.div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Processing payment…</div>
          </div>
        )}
        {step === 'success' && (
          <div style={{ padding: '16px', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={18} color="#30d158" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#30d158' }}>Purchase Successful!</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>File access has been granted. Check "Shared With Me" in My Files.</div>
            {txHash && <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.73rem', color: '#2997ff', textDecoration: 'none', display: 'block', marginTop: 6 }}>Tx: {txHash.slice(0,20)}…</a>}
          </div>
        )}
        {step === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(255,55,95,0.06)', border: '1px solid rgba(255,55,95,0.2)', borderRadius: 10, color: '#ff375f', fontSize: '0.83rem', fontWeight: 600, marginBottom: 14 }}>
            <AlertCircle size={14} /> {errMsg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {step === 'success' ? (
            <>
              <a href="/app/files" style={{ flex: 1, padding: '11px', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.35)', borderRadius: 10, color: '#30d158', textDecoration: 'none', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Download size={14} /> My Files
              </a>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
            </>
          ) : step === 'error' ? (
            <>
              <button onClick={() => setStep('idle')} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Try Again</button>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,55,95,0.1)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 10, color: '#ff375f', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Cancel</button>
            </>
          ) : step === 'processing' ? (
            <div style={{ flex: 1, padding: '11px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Please wait…</div>
          ) : (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleBuy}
                style={{ flex: 2, padding: '11px', background: 'rgba(255,159,10,0.15)', border: '1px solid rgba(255,159,10,0.4)', borderRadius: 10, color: '#ff9f0a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Coins size={14} /> Confirm Purchase
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── List File Panel ──────────────────────────────────────────────────── */
function ListPanel({ myFiles, onClose, onCreated, onFileUploaded }) {
  const [fileId,       setFileId]       = useState('');
  const [title,        setTitle]        = useState('');
  const [desc,         setDesc]         = useState('');
  const [priceSCT,     setPriceSCT]     = useState('');
  const [priceUSD,     setPriceUSD]     = useState('');
  const [category,     setCategory]     = useState('');
  const [tags,         setTags]         = useState('');
  const [isPrivate,    setIsPrivate]    = useState(false);
  const [targetWallet, setTargetWallet] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [uploading,    setUploading]    = useState(false);

  const selectedFile = myFiles.find(f => f._id === fileId);

  const handleQuickUpload = async (event) => {
    const uploadFile = event.target.files?.[0];
    if (!uploadFile) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedId = response.data?.fileId || response.data?._id;
      if (uploadedId) {
        setFileId(uploadedId);
      }
      onFileUploaded?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Quick upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const submit = async () => {
    if (!fileId || !title) { setError('Select a file and enter a title'); return; }
    if (isPrivate && !targetWallet) { setError('Enter the recipient wallet address'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/marketplace/list', {
        fileRecordId:        fileId,
        title:               title.trim(),
        description:         desc.trim(),
        priceSCT:            isPrivate ? 0 : Math.max(0, Number(priceSCT) || 0),
        priceUSDCents:       isPrivate ? 0 : Math.round((Number(priceUSD) || 0) * 100),
        acceptsTokens:       !isPrivate && (Number(priceSCT) || 0) >= 0,
        acceptsFiat:         !isPrivate && (Number(priceUSD) || 0) > 0,
        category,
        tags:                tags.split(',').map(t => t.trim()).filter(Boolean),
        isPrivate,
        targetWalletAddress: isPrivate ? targetWallet.trim() : undefined,
      });
      onCreated(isPrivate ? `File shared with ${targetWallet.slice(0,12)}…` : 'File listed on the marketplace!');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 900 }} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: '#0d0d0d', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '24px 22px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 800, margin: 0 }}>List a File</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Public / Private toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {[false, true].map(priv => (
            <button key={String(priv)} onClick={() => setIsPrivate(priv)}
              style={{ flex: 1, padding: '8px', background: isPrivate === priv ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isPrivate === priv ? 'rgba(41,151,255,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 9, color: isPrivate === priv ? '#2997ff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700 }}>
              {priv ? '🔒 Private Share' : '🌐 Public Listing'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {/* File select */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>File *</label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '7px 10px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.28)', borderRadius: 8, color: '#2997ff', fontSize: '0.76rem', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}>
              <Plus size={12} /> {uploading ? 'Uploading...' : 'Upload New File'}
              <input type="file" onChange={handleQuickUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
            <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ ...I, cursor: 'pointer' }}>
              <option value="">— Choose a file —</option>
              {myFiles.map(f => <option key={f._id} value={f._id} style={{ color: '#111' }}>{f.fileName} ({fmt(f.fileSize)})</option>)}
            </select>
            {selectedFile && !selectedFile.ipfsCid && !isPrivate && (
              <div style={{ marginTop: 5, fontSize: '0.71rem', color: '#ff9f0a' }}>⚠ File not yet pinned to IPFS — listing will use pending CID</div>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Premium Dataset 2024" style={I} />
          </div>

          {!isPrivate && (
            <>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="What buyers receive…" style={{ ...I, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Price SCT</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...I, padding: '9px 11px' }}>
                    <Coins size={13} color="#ff9f0a" />
                    <input type="number" min="0" value={priceSCT} onChange={e => setPriceSCT(e.target.value)} placeholder="0 = free" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Price USD ($)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...I, padding: '9px 11px' }}>
                    <DollarSign size={13} color="#30d158" />
                    <input type="number" min="0" step="0.01" value={priceUSD} onChange={e => setPriceUSD(e.target.value)} placeholder="0.00" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...I, cursor: 'pointer' }}>
                  <option value="">— Select category —</option>
                  {['Media','Documents','Archives','Software','Data'].map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Tags (comma-separated)</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. AI, dataset, 2024" style={I} />
              </div>
            </>
          )}

          {isPrivate && (
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Recipient Wallet *</label>
              <input value={targetWallet} onChange={e => setTargetWallet(e.target.value)} placeholder="0x…" style={I} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '10px 13px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 9, color: '#ff375f', fontSize: '0.82rem', fontWeight: 600 }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={loading}
            style={{ flex: 2, padding: '11px', background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.4)', borderRadius: 10, color: '#bf5af2', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem' }}>
            {loading ? 'Submitting…' : isPrivate ? 'Share File' : 'List for Sale'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ── Listing Card ─────────────────────────────────────────────────────── */
function ListingCard({ listing, onBuy, onDelete, onReport, onCopyLink, currentUserId, hasAccess }) {
  const isMine  = listing.sellerId?._id === currentUserId || listing.sellerId === currentUserId;
  const cat     = listing.category || 'Data';
  const priceUSD = (listing.priceUSDCents || 0) / 100;
  const priceSCT = listing.priceSCT || 0;
  const isFree   = priceUSD === 0 && priceSCT === 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const thumbCid = listing.fileRecordId?.previewCid;

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <motion.div whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }} transition={{ duration: 0.18 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Thumbnail */}
      <div style={{ height: 120, background: `${catColor(cat)}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {thumbCid ? (
          <img src={`https://gateway.pinata.cloud/ipfs/${thumbCid}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ opacity: 0.5 }}>{mimeIcon(listing.mimeType || '', 36)}</div>
        )}
        {/* Category badge */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', borderRadius: 20, color: catColor(cat), border: `1px solid ${catColor(cat)}30` }}>
          {cat}
        </div>
        {/* Menu */}
        <div ref={menuRef} style={{ position: 'absolute', top: 8, right: 8 }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: '5px 7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <MoreVertical size={12} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 30, minWidth: 160, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 20 }}>
              <button onClick={() => { onCopyLink?.(listing); setMenuOpen(false); }} style={menuBtn}><Link2 size={13} /> Copy Link</button>
              <button onClick={() => { onReport?.(listing); setMenuOpen(false); }} style={{ ...menuBtn, color: 'rgba(255,55,95,0.7)' }}><Flag size={13} /> Report</button>
              {isMine && <><div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }} /><button onClick={() => { onDelete(listing._id); setMenuOpen(false); }} style={{ ...menuBtn, color: '#ff375f' }}>Remove Listing</button></>}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={listing.title}>
          {listing.title}
        </div>
        <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)' }}>
          {isMine ? 'You' : listing.sellerId?.name || 'Anonymous'} · {fmt(listing.fileSize)} · {timeAgo(listing.createdAt)}
        </div>
        {listing.description && (
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {listing.description}
          </p>
        )}
        {/* Tags */}
        {listing.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {listing.tags.slice(0,3).map(t => (
              <span key={t} style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 7px', background: 'rgba(255,255,255,0.06)', borderRadius: 20, color: 'rgba(255,255,255,0.4)' }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Price row */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isFree ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, color: '#30d158' }}>Free</div>
          ) : (
            <>
              {priceSCT > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, color: '#ff9f0a' }}><Coins size={11} />{priceSCT} SCT</div>}
              {priceUSD > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, color: '#30d158' }}><DollarSign size={11} />${priceUSD.toFixed(2)}</div>}
            </>
          )}
        </div>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>{listing.downloads || 0} sold</span>
      </div>

      {/* Action */}
      <div style={{ padding: '0 16px 14px' }}>
        {isMine ? (
          <button onClick={() => onDelete(listing._id)}
            style={{ width: '100%', padding: '9px', background: 'rgba(255,55,95,0.07)', border: '1px solid rgba(255,55,95,0.18)', borderRadius: 9, color: 'rgba(255,55,95,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.81rem', fontWeight: 600 }}>
            Remove Listing
          </button>
        ) : hasAccess ? (
          <button onClick={() => { window.location.href = '/app/files'; }}
            style={{ width: '100%', padding: '10px', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 9, color: '#30d158', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <CheckCircle size={13} /> Access Granted
          </button>
        ) : (
          <button onClick={() => onBuy(listing)}
            style={{ width: '100%', padding: '10px', background: isFree ? 'rgba(48,209,88,0.12)' : 'rgba(255,159,10,0.12)', border: `1px solid ${isFree ? 'rgba(48,209,88,0.3)' : 'rgba(255,159,10,0.3)'}`, borderRadius: 9, color: isFree ? '#30d158' : '#ff9f0a', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {isFree ? <><Download size={13} /> Get for Free</> : <><Coins size={13} /> Buy Access</>}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Stats Bar ────────────────────────────────────────────────────────── */
function StatsBar({ total, listings }) {
  const totalRevSCT = listings.reduce((a, l) => a + (l.priceSCT || 0) * (l.downloads || 0), 0);
  const freeCount   = listings.filter(l => !l.priceSCT && !l.priceUSDCents).length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
      {[
        { label: 'Total Listings', value: total, icon: <ShoppingBag size={14} color="#2997ff" />, color: '#2997ff' },
        { label: 'Free Files',     value: freeCount, icon: <Globe size={14} color="#30d158" />,   color: '#30d158' },
        { label: 'Sellers',        value: new Set(listings.map(l => l.sellerId?._id || l.sellerId)).size, icon: <Users size={14} color="#bf5af2" />, color: '#bf5af2' },
        { label: 'Total SCT Vol.', value: totalRevSCT.toFixed(0) + ' SCT', icon: <Coins size={14} color="#ff9f0a" />, color: '#ff9f0a' },
      ].map((s, i) => (
        <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>{s.icon}<span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span></div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Marketplace ─────────────────────────────────────────────────── */
export default function Marketplace({ user }) {
  const [listings,  setListings]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [myFiles,   setMyFiles]   = useState([]);
  const [showList,  setShowList]  = useState(false);
  const [buyTarget, setBuyTarget] = useState(null);
  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('All');
  const [sort,      setSort]      = useState('newest');
  const [showSort,  setShowSort]  = useState(false);
  const [toast,     setToast]     = useState('');
  const [toastErr,  setToastErr]  = useState(false);
  const [copiedId,  setCopiedId]  = useState('');
  const [ownedListingIds, setOwnedListingIds] = useState(new Set());
  const sortRef = useRef(null);

  const showMsg = (msg, err = false) => { setToast(msg); setToastErr(err); setTimeout(() => setToast(''), 4000); };

  const fetchListings = useCallback((opts = {}) => {
    const params = new URLSearchParams();
    const q = opts.search   ?? search;
    const c = opts.category ?? category;
    const s = opts.sort     ?? sort;
    if (q && q !== '') params.set('search', q);
    if (c && c !== 'All') params.set('category', c);
    params.set('sort', s);
    setLoading(true);
    api.get(`/marketplace?${params}`)
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : (r.data.listings || []);
        setListings(data);
        setTotal(r.data.total ?? data.length);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [search, category, sort]);

  const fetchMyFiles = () => { api.get('/storage/files').then(r => setMyFiles(r.data)).catch(() => {}); };

  const fetchOwnedAccesses = useCallback(async () => {
    try {
      const [sharedRes, purchasesRes] = await Promise.all([
        api.get('/marketplace/shared-with-me').catch(() => ({ data: [] })),
        api.get('/marketplace/purchases').catch(() => ({ data: [] })),
      ]);

      const ids = new Set();
      (sharedRes.data || []).forEach((a) => {
        const id = a.listingId?._id || a.listingId;
        if (id) ids.add(String(id));
      });
      (purchasesRes.data || []).forEach((p) => {
        const id = p.listingId?._id || p.listingId;
        if (id) ids.add(String(id));
      });
      setOwnedListingIds(ids);
    } catch {
      setOwnedListingIds(new Set());
    }
  }, []);

  useEffect(() => { fetchListings(); fetchMyFiles(); fetchOwnedAccesses(); }, []); // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => fetchListings(), 350); return () => clearTimeout(t); }, [search, category, sort]); // eslint-disable-line

  useEffect(() => {
    const handler = e => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/marketplace/${id}`); setListings(prev => prev.filter(l => l._id !== id)); showMsg('Listing removed'); }
    catch { showMsg('Failed', true); }
  };

  const handleCreated = (msg) => { setShowList(false); showMsg(msg || 'Done!'); fetchListings(); fetchMyFiles(); };

  const handleCopyLink = async (listing) => {
    const shareToken = listing.fileRecordId?.shareToken;
    const link = shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `${window.location.origin}/app/marketplace?listing=${listing._id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(listing._id);
      setTimeout(() => setCopiedId(''), 2000);
      showMsg('Link copied to clipboard');
    } catch { showMsg('Failed to copy', true); }
  };

  const handleReport = async (listing) => {
    const reason = window.prompt('Report reason');
    if (!reason) return;
    try { await api.post('/abuse/report', { targetType: 'listing', targetId: listing._id, reason }); showMsg('Report submitted'); }
    catch { showMsg('Failed', true); }
  };

  const featured = [...listings].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 3);

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Marketplace</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 5, fontSize: '0.88rem' }}>
            Buy & sell files. Set your price. Earn from your content.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => fetchListings()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.81rem' }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setShowList(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.4)', borderRadius: 9, color: '#bf5af2', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.87rem', fontWeight: 700 }}>
            <Plus size={14} /> List a File
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar total={total} listings={listings} />

      {/* Featured */}
      {!loading && featured.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <TrendingUp size={14} color="#ff9f0a" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Most Popular</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
            {featured.map(listing => (
              <motion.div key={listing._id} whileHover={{ y: -2 }} style={{ background: 'rgba(255,159,10,0.04)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setBuyTarget(listing)}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{mimeIcon(listing.mimeType || '', 20)}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{listing.downloads || 0} sales · {listing.priceSCT > 0 ? `${listing.priceSCT} SCT` : 'Free'}</div>
                </div>
                <Star size={13} color="#ff9f0a" fill="#ff9f0a" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, flex: '1 1 200px', minWidth: 180 }}>
          <Search size={13} color="rgba(255,255,255,0.3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings…"
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ padding: '6px 13px', background: category === cat ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${category === cat ? 'rgba(41,151,255,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, color: category === cat ? '#2997ff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.77rem', fontWeight: 600 }}>
              {cat}
            </button>
          ))}
        </div>
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowSort(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.81rem', fontWeight: 600 }}>
            <Filter size={12} /> {SORT_OPTS.find(s => s.value === sort)?.label} <ChevronDown size={11} />
          </button>
          {showSort && (
            <div style={{ position: 'absolute', top: 40, right: 0, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 50, minWidth: 180 }}>
              {SORT_OPTS.map(opt => (
                <button key={opt.value} onClick={() => { setSort(opt.value); setShowSort(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', background: sort === opt.value ? 'rgba(41,151,255,0.1)' : 'transparent', border: 'none', borderRadius: 8, color: sort === opt.value ? '#2997ff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', textAlign: 'left', fontWeight: sort === opt.value ? 700 : 400 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
        <Shield size={12} color="#30d158" />
        <span>All files are end-to-end encrypted. Payment via SCT tokens or Demo USD.</span>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginBottom: 14, padding: '10px 16px', background: toastErr ? 'rgba(255,55,95,0.08)' : 'rgba(48,209,88,0.08)', border: `1px solid ${toastErr ? 'rgba(255,55,95,0.3)' : 'rgba(48,209,88,0.3)'}`, borderRadius: 10, color: toastErr ? '#ff375f' : '#30d158', fontSize: '0.84rem', fontWeight: 600 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {[0,1,2,3,4,5].map(i => <div key={i} style={{ height: 340, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, animation: 'pulse 1.5s ease infinite' }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 0' }}>
          <ShoppingBag size={42} color="rgba(255,255,255,0.1)" style={{ marginBottom: 14 }} />
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.95rem', fontWeight: 600 }}>No listings found</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem', marginTop: 6 }}>
            {search || category !== 'All' ? 'Try adjusting your search or filters' : 'Be the first to list a file and start earning!'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          <AnimatePresence>
            {listings.map((listing, i) => (
              <motion.div key={listing._id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
                <ListingCard listing={listing} onBuy={setBuyTarget} onDelete={handleDelete} onReport={handleReport} onCopyLink={handleCopyLink} currentUserId={user?._id} hasAccess={ownedListingIds.has(String(listing._id))} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Panels / modals */}
      <AnimatePresence>
        {showList && <ListPanel myFiles={myFiles} onClose={() => setShowList(false)} onCreated={handleCreated} onFileUploaded={fetchMyFiles} />}
      </AnimatePresence>

      {buyTarget && (
        <BuyModal listing={buyTarget} user={user} onClose={() => setBuyTarget(null)} onSuccess={() => { fetchListings(); fetchMyFiles(); fetchOwnedAccesses(); setBuyTarget(null); }} />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`}</style>
    </div>
  );
}
