import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Download, Trash2, ExternalLink, Search, RefreshCw,
  FileText, Image, Music, Video, Archive, Code, Share2, Eye,
  X, Lock, HardDrive, Shield, MoreVertical, Link2, Flag,
  Grid, List, Globe, Users, DollarSign, Coins, CheckCircle,
  ShoppingBag, Tag, ChevronDown, Copy, AlertCircle, Plus,
  Star, Clock, ChevronRight,
} from 'lucide-react';
import api from '../../api/client';

/* ── Helpers ─────────────────────────────────────────────────────────── */
function fileIcon(name = '', mime = '', size = 20) {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext) || mime.startsWith('image/'))
    return <Image size={size} color="#bf5af2" />;
  if (['mp4','avi','mov','mkv','webm'].includes(ext) || mime.startsWith('video/'))
    return <Video size={size} color="#ff375f" />;
  if (['mp3','wav','ogg','flac','aac'].includes(ext) || mime.startsWith('audio/'))
    return <Music size={size} color="#30d158" />;
  if (['zip','tar','gz','7z','rar'].includes(ext))
    return <Archive size={size} color="#ff9f0a" />;
  if (['js','ts','py','java','c','cpp','html','css','json','go','rs'].includes(ext))
    return <Code size={size} color="#2997ff" />;
  return <FileText size={size} color="rgba(255,255,255,0.4)" />;
}

function fileColor(name = '', mime = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext) || mime.startsWith('image/')) return '#bf5af2';
  if (['mp4','avi','mov','mkv'].includes(ext) || mime.startsWith('video/')) return '#ff375f';
  if (['mp3','wav','ogg','flac'].includes(ext) || mime.startsWith('audio/')) return '#30d158';
  if (['zip','tar','gz','7z','rar'].includes(ext)) return '#ff9f0a';
  if (['js','ts','py','java','c','cpp','html','css','json'].includes(ext)) return '#2997ff';
  return 'rgba(255,255,255,0.25)';
}

function fmt(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / (1024 ** 3); if (gb >= 1) return gb.toFixed(2) + ' GB';
  const mb = bytes / (1024 ** 2); if (mb >= 1) return mb.toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VISIBILITY_CONFIG = {
  private: { label: 'Private',   icon: <Lock  size={12} />, color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' },
  shared:  { label: 'Link only', icon: <Link2 size={12} />, color: '#ff9f0a',               bg: 'rgba(255,159,10,0.1)' },
  public:  { label: 'Public',    icon: <Globe size={12} />, color: '#30d158',               bg: 'rgba(48,209,88,0.1)' },
};

const SORT_OPTIONS  = ['Date modified', 'Name', 'Size', 'Type'];
const FILTER_TYPES  = ['All', 'Images', 'Video', 'Audio', 'Documents', 'Code', 'Archives'];

function mimeMatchesFilter(mime = '', name = '', filter) {
  if (filter === 'All') return true;
  const ext = name.split('.').pop().toLowerCase();
  if (filter === 'Images')    return mime.startsWith('image/');
  if (filter === 'Video')     return mime.startsWith('video/');
  if (filter === 'Audio')     return mime.startsWith('audio/');
  if (filter === 'Documents') return mime.includes('pdf') || mime.includes('text/') || mime.includes('document') || ['doc','docx','pdf','txt','md'].includes(ext);
  if (filter === 'Code')      return ['js','ts','py','java','c','cpp','html','css','json','go','rs'].includes(ext);
  if (filter === 'Archives')  return ['zip','tar','gz','7z','rar'].includes(ext);
  return true;
}

/* ── Share & Settings Modal ──────────────────────────────────────────── */
function ShareModal({ file, onClose, onSaved, origin }) {
  const [visibility,  setVisibility]  = useState(file.visibility || 'private');
  const [isLocked,    setIsLocked]    = useState(file.isLocked || false);
  const [priceUSD,    setPriceUSD]    = useState(file.priceUSD || '');
  const [priceSCT,    setPriceSCT]    = useState(file.priceSCT || '');
  const [mkTitle,     setMkTitle]     = useState(file.marketplaceTitle || file.fileName || '');
  const [mkDesc,      setMkDesc]      = useState(file.marketplaceDesc || '');
  const [mkCategory,  setMkCategory]  = useState(file.marketplaceCategory || '');
  const [listMarket,  setListMarket]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [error,       setError]       = useState('');
  const [shareToken,  setShareToken]  = useState(file.shareToken || '');

  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : '';

  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await api.patch(`/storage/files/${file._id}/settings`, {
        visibility, isLocked,
        priceUSD:    isLocked ? (Number(priceUSD) || 0) : 0,
        priceSCT:    isLocked ? (Number(priceSCT) || 0) : 0,
        marketplaceTitle:    mkTitle,
        marketplaceDesc:     mkDesc,
        marketplaceCategory: mkCategory,
      });
      setShareToken(r.data.shareToken || shareToken);
      if (listMarket && mkTitle) {
        await api.post('/marketplace/list', {
          fileRecordId:  file._id,
          title:         mkTitle,
          description:   mkDesc,
          priceSCT:      Number(priceSCT) || 0,
          priceUSDCents: Math.round((Number(priceUSD) || 0) * 100),
          acceptsTokens: true,
          acceptsFiat:   (Number(priceUSD) || 0) > 0,
          category:      mkCategory,
        });
      }
      onSaved?.({ ...file, visibility, isLocked, priceUSD: Number(priceUSD)||0, priceSCT: Number(priceSCT)||0, shareToken: r.data.shareToken || shareToken });
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1200,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22,
                 width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Share & Monetize</div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{file.fileName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Who can access</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { val: 'private', icon: <Lock  size={14} />, title: 'Private',              sub: 'Only you can access this file' },
                { val: 'shared',  icon: <Link2 size={14} />, title: 'Anyone with the link', sub: 'Share a unique link to let others access' },
                { val: 'public',  icon: <Globe size={14} />, title: 'Public',               sub: 'Anyone can find and access this file' },
              ].map(opt => (
                <div key={opt.val} onClick={() => setVisibility(opt.val)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer',
                           background: visibility === opt.val ? 'rgba(41,151,255,0.08)' : 'rgba(255,255,255,0.03)',
                           border: `1px solid ${visibility === opt.val ? 'rgba(41,151,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                           borderRadius: 10, transition: 'all 0.15s' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8,
                                background: visibility === opt.val ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                color: visibility === opt.val ? '#2997ff' : 'rgba(255,255,255,0.4)' }}>
                    {opt.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: visibility === opt.val ? '#fff' : 'rgba(255,255,255,0.6)' }}>{opt.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{opt.sub}</div>
                  </div>
                  {visibility === opt.val && <CheckCircle size={15} color="#2997ff" />}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isLocked ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={14} color={isLocked ? '#ff9f0a' : 'rgba(255,255,255,0.4)'} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Lock access</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>Require payment to view or download</div>
                </div>
              </div>
              <div onClick={() => setIsLocked(v => !v)}
                style={{ width: 42, height: 24, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                         background: isLocked ? '#ff9f0a' : 'rgba(255,255,255,0.12)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 3, left: isLocked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {isLocked && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 5 }}>Price USD ($)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                    <DollarSign size={12} color="#30d158" />
                    <input type="number" min="0" step="0.01" value={priceUSD} onChange={e => setPriceUSD(e.target.value)}
                      placeholder="0.00" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 5 }}>Price SCT (optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                    <Coins size={12} color="#ff9f0a" />
                    <input type="number" min="0" step="1" value={priceSCT} onChange={e => setPriceSCT(e.target.value)}
                      placeholder="0" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          {(visibility === 'public' || listMarket) && (
            <div style={{ padding: '14px', background: 'rgba(191,90,242,0.05)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={14} color="#bf5af2" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>List on Marketplace</span>
                </div>
                <div onClick={() => setListMarket(v => !v)}
                  style={{ width: 42, height: 24, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s',
                           background: listMarket ? '#bf5af2' : 'rgba(255,255,255,0.12)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 3, left: listMarket ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
              {listMarket && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={mkTitle} onChange={e => setMkTitle(e.target.value)} placeholder="Listing title *"
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }} />
                  <textarea value={mkDesc} onChange={e => setMkDesc(e.target.value)} placeholder="Description" rows={2}
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', resize: 'none' }} />
                  <select value={mkCategory} onChange={e => setMkCategory(e.target.value)}
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}>
                    <option value="">Category</option>
                    {['Media','Documents','Archives','Software','Data'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          {!listMarket && (
            <button onClick={() => setListMarket(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 9, color: '#bf5af2', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              <Plus size={13} /> Add to Marketplace
            </button>
          )}
          {visibility !== 'private' && shareToken && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Shareable Link</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shareUrl}
                </div>
                <button onClick={copyLink}
                  style={{ padding: '8px 14px', background: copied ? 'rgba(48,209,88,0.12)' : 'rgba(41,151,255,0.1)', border: `1px solid ${copied ? 'rgba(48,209,88,0.3)' : 'rgba(41,151,255,0.25)'}`, borderRadius: 8, color: copied ? '#30d158' : '#2997ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          {error && <div style={{ padding: '10px 14px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 9, color: '#ff375f', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 7 }}><AlertCircle size={13} />{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '11px', background: 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 10, color: '#2997ff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Preview Modal ──────────────────────────────────────────────────── */
function PreviewModal({ file, onClose, onDownload, dlLoading }) {
  const isImage = file.previewType === 'image-thumb';
  const isPdf   = file.previewType === 'pdf-text';
  const isText  = file.previewType === 'text';
  const imgSrc  = file.previewCid
    ? `https://gateway.pinata.cloud/ipfs/${file.previewCid}`
    : `/api/storage/files/${file._id}/preview`;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1200,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, overflow: 'hidden',
                 width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            {fileIcon(file.fileName, file.mimeType)}
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{file.fileName}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, display: 'flex', gap: 10 }}>
                <span>{fmt(file.fileSize)}</span>
                {file.isEncrypted && <span style={{ color: '#30d158', display: 'flex', alignItems: 'center', gap: 3 }}><Shield size={10} /> AES-256-GCM</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onDownload(file._id, file.fileName)} disabled={dlLoading[file._id]}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.35)', borderRadius: 9, color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.83rem', fontWeight: 700 }}>
              <Download size={13} /> Download
            </button>
            <button onClick={onClose}
              style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          {isImage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
              <img src={imgSrc} alt={file.fileName} style={{ maxWidth: '100%', maxHeight: '58vh', borderRadius: 14, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
            </div>
          )}
          {(isPdf || isText) && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {isPdf ? 'PDF — first page extract' : 'Text preview — first 600 chars'}
              </div>
              <pre style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', color: 'rgba(255,255,255,0.72)', fontSize: '0.83rem', fontFamily: 'Menlo, Monaco, monospace', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto', maxHeight: '52vh' }}>
                {file.previewText}
              </pre>
            </div>
          )}
          {!isImage && !isPdf && !isText && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              {fileIcon(file.fileName, file.mimeType, 48)}
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', fontWeight: 600, marginTop: 14 }}>Preview not available</div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', marginTop: 6 }}>Download the file to view it</div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Size',      value: fmt(file.fileSize) },
            { label: 'Shards',    value: `${file.chunks?.length || 1} chunks` },
            { label: 'Encrypted', value: file.isEncrypted ? 'AES-256-GCM ✓' : 'Plaintext' },
            { label: 'Uploaded',  value: timeAgo(file.createdAt) },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{item.value}</div>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)' }}>
            <Lock size={11} /> Encrypted end-to-end
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Grid File Card ──────────────────────────────────────────────────── */
function FileCard({ file, onPreview, onDownload, onShare, onDelete, onReport, onDrive, dlLoading, starred, onToggleStar }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef(null);
  const cid       = file.ipfsCid || file.cid;
  const vis       = VISIBILITY_CONFIG[file.visibility] || VISIBILITY_CONFIG.private;
  const col       = fileColor(file.fileName, file.mimeType);
  const isStarred = starred?.has(file._id);

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <motion.div whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} transition={{ duration: 0.18 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18,
               overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'default' }}>
      {/* Thumbnail */}
      <div onClick={() => onPreview(file)}
        style={{ height: 140, background: `${col}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {file.previewType === 'image-thumb' && file.previewCid
          ? <img src={`https://gateway.pinata.cloud/ipfs/${file.previewCid}`} alt={file.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ opacity: 0.6 }}>{fileIcon(file.fileName, file.mimeType, 44)}</div>
        }
        {file.isLocked && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(255,159,10,0.9)', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, color: '#000' }}>
            <Lock size={9} /> {file.priceUSD ? `$${file.priceUSD}` : `${file.priceSCT} SCT`}
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, color: vis.color }}>
          {vis.icon} {vis.label}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.fileName}>{file.fileName}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{fmt(file.fileSize)} · {timeAgo(file.createdAt)}</div>
        {file.onChainTxHash && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: '#30d158' }}>
            <CheckCircle size={9} /> On Chain
          </div>
        )}
      </div>
      {/* Actions row */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => onDownload(file._id, file.fileName)} disabled={dlLoading[file._id]} title="Download"
          style={{ flex: 1, padding: '9px', background: 'none', border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#2997ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dlLoading[file._id] ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
        </button>
        <button onClick={() => onShare(file)} title="Share & Monetize"
          style={{ flex: 1, padding: '9px', background: 'none', border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#bf5af2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Share2 size={13} />
        </button>
        <button onClick={() => onToggleStar?.(file._id)} title={isStarred ? 'Unstar' : 'Star'}
          style={{ flex: 1, padding: '9px', background: 'none', border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', color: isStarred ? '#ff9f0a' : 'rgba(255,255,255,0.22)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}>
          <Star size={13} fill={isStarred ? '#ff9f0a' : 'none'} />
        </button>
        <div ref={menuRef} style={{ position: 'relative', flex: 1 }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ width: '100%', padding: '9px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoreVertical size={13} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', bottom: '100%', right: 0, minWidth: 160, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 30 }}>
              {file.previewType && <button onClick={() => { onPreview(file); setMenuOpen(false); }} style={menuBtn}><Eye size={13} /> Preview</button>}
              <button onClick={() => { onDownload(file._id, file.fileName); setMenuOpen(false); }} style={menuBtn}><Download size={13} /> Download</button>
              <button onClick={() => { onShare(file); setMenuOpen(false); }} style={menuBtn}><Share2 size={13} /> Share & Sell</button>
              <button onClick={() => { onDrive(file); setMenuOpen(false); }} style={menuBtn}><ExternalLink size={13} /> Google Drive</button>
              {cid && <a href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer" style={{ ...menuBtn, textDecoration: 'none' }}><ExternalLink size={13} /> View on IPFS</a>}
              {file.onChainTxHash && <a href={`https://sepolia.etherscan.io/tx/${file.onChainTxHash}`} target="_blank" rel="noreferrer" style={{ ...menuBtn, textDecoration: 'none' }}><ExternalLink size={13} /> Etherscan</a>}
              <button onClick={() => { onReport(file); setMenuOpen(false); }} style={{ ...menuBtn, color: 'rgba(255,55,95,0.7)' }}><Flag size={13} /> Report</button>
              <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
              <button onClick={() => { onDelete(file._id); setMenuOpen(false); }} style={{ ...menuBtn, color: '#ff375f' }}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── List Row ─────────────────────────────────────────────────────────── */
function FileRow({ file, onPreview, onDownload, onShare, onDelete, onReport, onDrive, dlLoading, starred, onToggleStar }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef(null);
  const cid       = file.ipfsCid || file.cid;
  const vis       = VISIBILITY_CONFIG[file.visibility] || VISIBILITY_CONFIG.private;
  const isStarred = starred?.has(file._id);

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      style={{ display: 'grid', gridTemplateColumns: '3fr 80px 90px 110px 160px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
        {file.previewType === 'image-thumb' && file.previewCid
          ? <img src={`https://gateway.pinata.cloud/ipfs/${file.previewCid}`} alt="" onClick={() => onPreview(file)}
              style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }} />
          : <div style={{ width: 34, height: 34, borderRadius: 7, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{fileIcon(file.fileName, file.mimeType, 16)}</div>
        }
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '0.87rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', background: vis.bg, borderRadius: 20, color: vis.color, display: 'flex', alignItems: 'center', gap: 3 }}>{vis.icon}{vis.label}</span>
            {file.isLocked && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', background: 'rgba(255,159,10,0.1)', borderRadius: 20, color: '#ff9f0a', display: 'flex', alignItems: 'center', gap: 3 }}><Lock size={8} />{file.priceUSD ? `$${file.priceUSD}` : `${file.priceSCT} SCT`}</span>}
            {file.onChainTxHash && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', background: 'rgba(48,209,88,0.08)', borderRadius: 20, color: '#30d158' }}>On Chain</span>}
            {cid && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', background: 'rgba(191,90,242,0.08)', borderRadius: 20, color: '#bf5af2' }}>IPFS</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{fmt(file.fileSize)}</div>
      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>{file.chunks?.length || 1} shards</div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>{timeAgo(file.createdAt)}</div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
        {file.previewType && (
          <button onClick={() => onPreview(file)} title="Preview"
            style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Eye size={12} /></button>
        )}
        <button onClick={() => onDownload(file._id, file.fileName)} disabled={dlLoading[file._id]}
          style={{ padding: '6px 8px', background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.2)', borderRadius: 7, color: '#2997ff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {dlLoading[file._id] ? <RefreshCw size={12} /> : <Download size={12} />}
        </button>
        <button onClick={() => onShare(file)} title="Share"
          style={{ padding: '6px 8px', background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 7, color: '#bf5af2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Share2 size={12} /></button>
        <button onClick={() => onToggleStar?.(file._id)} title={isStarred ? 'Unstar' : 'Star'}
          style={{ padding: '6px 8px', background: isStarred ? 'rgba(255,159,10,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isStarred ? 'rgba(255,159,10,0.25)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, color: isStarred ? '#ff9f0a' : 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
          <Star size={12} fill={isStarred ? '#ff9f0a' : 'none'} />
        </button>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><MoreVertical size={12} /></button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 32, minWidth: 160, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 30 }}>
              {cid && <a href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer" style={{ ...menuBtn, textDecoration: 'none' }}><ExternalLink size={13} /> View on IPFS</a>}
              {file.onChainTxHash && <a href={`https://sepolia.etherscan.io/tx/${file.onChainTxHash}`} target="_blank" rel="noreferrer" style={{ ...menuBtn, textDecoration: 'none' }}><ExternalLink size={13} /> Etherscan</a>}
              <button onClick={() => { onDrive(file); setMenuOpen(false); }} style={menuBtn}><ExternalLink size={13} /> Google Drive</button>
              <button onClick={() => { onReport(file); setMenuOpen(false); }} style={menuBtn}><Flag size={13} /> Report</button>
              <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
              <button onClick={() => { onDelete(file._id); setMenuOpen(false); }} style={{ ...menuBtn, color: '#ff375f' }}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Folder category definitions ─────────────────────────────────────── */
const FOLDER_DEFS = [
  { type: 'Images',    color: '#bf5af2', icon: (s) => <Image    size={s} color="#bf5af2" /> },
  { type: 'Documents', color: '#2997ff', icon: (s) => <FileText size={s} color="#2997ff" /> },
  { type: 'Video',     color: '#ff375f', icon: (s) => <Video    size={s} color="#ff375f" /> },
  { type: 'Audio',     color: '#30d158', icon: (s) => <Music    size={s} color="#30d158" /> },
  { type: 'Code',      color: '#ff9f0a', icon: (s) => <Code     size={s} color="#ff9f0a" /> },
  { type: 'Archives',  color: '#a0a0a0', icon: (s) => <Archive  size={s} color="#a0a0a0" /> },
];

/* ── Main Component ───────────────────────────────────────────────────── */
export default function MyFiles({ user }) {
  const navigate = useNavigate();

  // Google Drive-style section navigation
  const [activeSection, setActiveSection] = useState('myfiles'); // myfiles | recent | starred | shared
  const [currentFolder,  setCurrentFolder]  = useState(null);    // null = all, or type label 'Images' etc.

  const [viewMode,       setViewMode]       = useState('grid');
  const [files,          setFiles]          = useState([]);
  const [shared,         setShared]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [sharedLoading,  setSharedLoading]  = useState(false);
  const [search,         setSearch]         = useState('');
  const [sortBy,         setSortBy]         = useState('Date modified');
  const [filterType,     setFilterType]     = useState('All');
  const [showSort,       setShowSort]       = useState(false);
  const [showFilter,     setShowFilter]     = useState(false);
  const [delId,          setDelId]          = useState(null);
  const [dlLoading,      setDlLoading]      = useState({}); // eslint-disable-line no-unused-vars
  const [toast,          setToast]          = useState('');
  const [toastErr,       setToastErr]       = useState(false);
  const [previewFile,    setPreviewFile]    = useState(null);
  const [shareFile,      setShareFile]      = useState(null);

  // Starred files – localStorage persisted
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sc_starred') || '[]')); }
    catch { return new Set(); }
  });
  const toggleStar = useCallback((fileId) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      try { localStorage.setItem('sc_starred', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const origin   = window.location.origin;
  const showToast = (msg, err = false) => { setToast(msg); setToastErr(err); setTimeout(() => setToast(''), 3500); };

  const fetchFiles = useCallback(() => {
    setLoading(true);
    api.get('/storage/files').then(r => setFiles(r.data)).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);
  const fetchShared = useCallback(() => {
    setSharedLoading(true);
    api.get('/marketplace/shared-with-me').then(r => setShared(r.data)).catch(() => setShared([])).finally(() => setSharedLoading(false));
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { if (activeSection === 'shared' && shared.length === 0) fetchShared(); }, [activeSection]); // eslint-disable-line

  const handleDownload = (fileId, fileName) => {
    // Use direct browser navigation instead of XHR/fetch to avoid ad blocker ERR_BLOCKED_BY_CLIENT.
    // The auth middleware accepts ?token= query param so no Authorization header is needed.
    const token = localStorage.getItem('token');
    const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
    const url = `${base}/storage/download/${fileId}?token=${encodeURIComponent(token)}&dl=${encodeURIComponent(fileName)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (fileId) => {
    try {
      await api.delete(`/storage/files/${fileId}`);
      setFiles(prev => prev.filter(f => f._id !== fileId));
      showToast('File deleted');
    } catch { showToast('Delete failed', true); }
    setDelId(null);
  };

  const handleReport = async (file) => {
    const reason = window.prompt('Report reason');
    if (!reason) return;
    try { await api.post('/abuse/report', { targetType: 'file', targetId: file._id, reason }); showToast('Report submitted'); }
    catch { showToast('Failed to submit report', true); }
  };

  const handleOpenGoogleDrive = (file) => {
    const q = encodeURIComponent(file?.fileName || '');
    window.open(q ? `https://drive.google.com/drive/u/0/search?q=${q}` : 'https://drive.google.com/drive/u/0/my-drive', '_blank', 'noopener,noreferrer');
    showToast('Google Drive opened in a new tab');
  };

  const handleShareSaved = (updated) => {
    setFiles(prev => prev.map(f => f._id === updated._id ? { ...f, ...updated } : f));
    setShareFile(null);
    showToast('Settings saved');
  };

  const goSection = (section) => { setActiveSection(section); setCurrentFolder(null); setSearch(''); setFilterType('All'); };

  const applySort = (arr) => [...arr].sort((a, b) => {
    if (sortBy === 'Name') return a.fileName.localeCompare(b.fileName);
    if (sortBy === 'Size') return b.fileSize - a.fileSize;
    if (sortBy === 'Type') return (a.mimeType || '').localeCompare(b.mimeType || '');
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const getDisplayFiles = () => {
    if (activeSection === 'recent') return [...files].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    let base = files;
    if (activeSection === 'starred') base = base.filter(f => starred.has(f._id));
    if (currentFolder) base = base.filter(f => mimeMatchesFilter(f.mimeType || '', f.fileName || '', currentFolder));
    base = base.filter(f =>
      f.fileName?.toLowerCase().includes(search.toLowerCase()) &&
      mimeMatchesFilter(f.mimeType || '', f.fileName || '', filterType)
    );
    return applySort(base);
  };
  const filtered = getDisplayFiles();

  const folderCounts = FOLDER_DEFS
    .map(fd => ({ ...fd, count: files.filter(f => mimeMatchesFilter(f.mimeType || '', f.fileName || '', fd.type)).length }))
    .filter(fd => fd.count > 0);

  const totalSize  = files.reduce((a, f) => a + (f.fileSize || 0), 0);
  const quotaGB    = user?.storageQuotaGB || 2;
  const usedGB     = user?.usedStorageGB  || 0;
  const quotaPct   = Math.min(100, (usedGB / quotaGB) * 100);
  const quotaColor = quotaPct > 90 ? '#ff375f' : quotaPct > 70 ? '#ff9f0a' : '#2997ff';

  // Reusable card/row props builder
  const itemProps = (file) => ({
    file, onPreview: setPreviewFile, onDownload: handleDownload, onShare: setShareFile,
    onDelete: (id) => setDelId(id), onReport: handleReport, onDrive: handleOpenGoogleDrive,
    dlLoading, starred, onToggleStar: toggleStar,
  });

  // File grid/list renderer
  const renderFiles = (list, showUploadCta, emptyIcon, emptyMsg) => {
    if (loading) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
        {[0,1,2,3,4,5].map(i => <div key={i} style={{ height: 210, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, animation: 'pulse 1.5s ease infinite' }} />)}
      </div>
    );
    if (list.length === 0) return (
      <div style={{ padding: '70px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18 }}>
        {emptyIcon}
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', marginTop: 14 }}>{emptyMsg}</div>
        {showUploadCta && (
          <button onClick={() => navigate('/app/upload')} style={{ marginTop: 14, padding: '9px 18px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 9, color: '#2997ff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Upload file now
          </button>
        )}
      </div>
    );
    if (viewMode === 'grid') return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
        <AnimatePresence>
          {list.map((file, i) => (
            <motion.div key={file._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
              <FileCard {...itemProps(file)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
    return (
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 90px 110px 160px', padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Name','Size','Shards','Modified','Actions'].map((h, i) => (
            <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
          ))}
        </div>
        <AnimatePresence>
          {list.map(file => <FileRow key={file._id} {...itemProps(file)} />)}
        </AnimatePresence>
        </div></div>
      </div>
    );
  };

  // Sidebar nav item
  const NavItem = ({ section, icon, label, badge }) => {
    const active = activeSection === section;
    return (
      <button onClick={() => goSection(section)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 2,
                 background: active ? 'rgba(41,151,255,0.1)' : 'transparent',
                 border: 'none', borderLeft: `2px solid ${active ? '#2997ff' : 'transparent'}`,
                 borderRadius: '0 10px 10px 0', cursor: 'pointer', fontFamily: 'inherit',
                 color: active ? '#2997ff' : 'rgba(255,255,255,0.5)',
                 fontSize: '0.87rem', fontWeight: active ? 700 : 500, textAlign: 'left', transition: 'all 0.14s' }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ color: active ? '#2997ff' : 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge != null && badge > 0 && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', background: active ? 'rgba(41,151,255,0.18)' : 'rgba(255,255,255,0.08)', borderRadius: 999, color: active ? '#2997ff' : 'rgba(255,255,255,0.35)' }}>{badge}</span>
        )}
      </button>
    );
  };

  const sectionTitle =
    currentFolder        ? currentFolder
    : activeSection === 'recent'  ? 'Recent'
    : activeSection === 'starred' ? 'Starred'
    : activeSection === 'shared'  ? 'Shared with me'
    : 'My Files';

  return (
    <div style={{ display: 'flex', position: 'relative', zIndex: 1, minHeight: '65vh' }}>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
      <div style={{ width: 214, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    paddingRight: 8, marginRight: 22, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* New Upload button */}
        <button onClick={() => navigate('/app/upload')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', marginBottom: 22,
                   background: 'rgba(41,151,255,0.13)', border: '1px solid rgba(41,151,255,0.35)',
                   borderRadius: 14, color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit',
                   fontSize: '0.9rem', fontWeight: 800, width: '100%', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,151,255,0.22)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(41,151,255,0.13)'}>
          <Plus size={16} /> New Upload
        </button>

        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px', marginBottom: 5 }}>MY STORACHAIN</div>
        <NavItem section="myfiles"  icon={<HardDrive size={16} />} label="My Files"       badge={files.length} />
        <NavItem section="recent"   icon={<Clock     size={16} />} label="Recent"         />
        <NavItem section="starred"  icon={<Star      size={16} />} label="Starred"        badge={starred.size > 0 ? starred.size : null} />

        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px', marginTop: 16, marginBottom: 5 }}>SHARED</div>
        <NavItem section="shared"   icon={<Users     size={16} />} label="Shared with me" badge={shared.length > 0 ? shared.length : null} />

        {/* Storage quota at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 28 }}>
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
              <HardDrive size={12} /> Storage
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999, marginBottom: 7 }}>
              <motion.div animate={{ width: `${quotaPct}%` }} transition={{ duration: 0.6 }}
                style={{ height: '100%', borderRadius: 999, background: quotaColor }} />
            </div>
            <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.3)' }}>{usedGB.toFixed(2)} / {quotaGB} GB used</div>
          </div>
        </div>
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Top toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          {/* Breadcrumb + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {currentFolder && (
              <>
                <button onClick={() => setCurrentFolder(null)}
                  style={{ background: 'none', border: 'none', color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, padding: 0 }}>
                  My Files
                </button>
                <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
              </>
            )}
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>
              {sectionTitle}
            </h1>
            {activeSection === 'myfiles' && !currentFolder && (
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', fontWeight: 500, marginLeft: 4 }}>
                {files.length} file{files.length !== 1 ? 's' : ''} · {fmt(totalSize)}
              </span>
            )}
          </div>

          {/* Toolbar (hidden for shared section) */}
          {activeSection !== 'shared' && (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9 }}>
                <Search size={12} color="rgba(255,255,255,0.3)" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none', width: 120 }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={11} /></button>}
              </div>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowSort(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Tag size={11} /> {sortBy} <ChevronDown size={11} />
                </button>
                {showSort && (
                  <div style={{ position: 'absolute', top: 36, right: 0, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 50, minWidth: 150 }}>
                    {SORT_OPTIONS.map(o => (
                      <button key={o} onClick={() => { setSortBy(o); setShowSort(false); }}
                        style={{ display: 'block', width: '100%', padding: '7px 11px', background: sortBy === o ? 'rgba(41,151,255,0.1)' : 'transparent', border: 'none', borderRadius: 8, color: sortBy === o ? '#2997ff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', textAlign: 'left', fontWeight: sortBy === o ? 700 : 400 }}>{o}</button>
                    ))}
                  </div>
                )}
              </div>
              {!currentFolder && activeSection !== 'recent' && (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowFilter(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600 }}>
                    {filterType} <ChevronDown size={11} />
                  </button>
                  {showFilter && (
                    <div style={{ position: 'absolute', top: 36, right: 0, background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, zIndex: 50, minWidth: 120 }}>
                      {FILTER_TYPES.map(t => (
                        <button key={t} onClick={() => { setFilterType(t); setShowFilter(false); }}
                          style={{ display: 'block', width: '100%', padding: '7px 11px', background: filterType === t ? 'rgba(41,151,255,0.1)' : 'transparent', border: 'none', borderRadius: 8, color: filterType === t ? '#2997ff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', textAlign: 'left', fontWeight: filterType === t ? 700 : 400 }}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, overflow: 'hidden' }}>
                {[{ mode: 'grid', icon: <Grid size={13} /> }, { mode: 'list', icon: <List size={13} /> }].map(({ mode, icon }) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    style={{ padding: '7px 10px', background: viewMode === mode ? 'rgba(255,255,255,0.1)' : 'none', border: 'none', color: viewMode === mode ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {icon}
                  </button>
                ))}
              </div>
              <button onClick={fetchFiles}
                style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginBottom: 14, padding: '10px 16px', background: toastErr ? 'rgba(255,55,95,0.08)' : 'rgba(41,151,255,0.08)', border: `1px solid ${toastErr ? 'rgba(255,55,95,0.3)' : 'rgba(41,151,255,0.25)'}`, borderRadius: 10, color: toastErr ? '#ff375f' : '#2997ff', fontSize: '0.84rem', fontWeight: 600 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ MY FILES ══ */}
        {activeSection === 'myfiles' && (
          <>
            {/* Folder category cards – only at root when files are loaded */}
            {!currentFolder && !loading && folderCounts.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Folders</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
                  {folderCounts.map(fd => (
                    <motion.button key={fd.type} whileHover={{ y: -2 }} onClick={() => setCurrentFolder(fd.type)}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px',
                               background: `${fd.color}09`, border: `1px solid ${fd.color}22`,
                               borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = `${fd.color}55`}
                      onMouseLeave={e => e.currentTarget.style.borderColor = `${fd.color}22`}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${fd.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {fd.icon(22)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{fd.type}</div>
                        <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.33)', marginTop: 2 }}>{fd.count} file{fd.count !== 1 ? 's' : ''}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            {!currentFolder && !loading && files.length > 0 && (
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>All Files</div>
            )}
            {currentFolder && !loading && (
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                {filtered.length} file{filtered.length !== 1 ? 's' : ''}
              </div>
            )}
            {renderFiles(
              filtered,
              !search && filterType === 'All' && !currentFolder,
              <FolderOpen size={44} color="rgba(255,255,255,0.1)" />,
              search || filterType !== 'All' || currentFolder ? 'No files matching filters' : 'No files yet — upload one!'
            )}
          </>
        )}

        {/* ══ RECENT ══ */}
        {activeSection === 'recent' && renderFiles(filtered, false, <Clock size={44} color="rgba(255,255,255,0.1)" />, 'No recent files')}

        {/* ══ STARRED ══ */}
        {activeSection === 'starred' && renderFiles(
          filtered, false,
          <Star size={44} color="rgba(255,255,255,0.1)" />,
          starred.size === 0 ? 'No starred files — click ★ on any file to star it' : 'No starred files match your filters'
        )}

        {/* ══ SHARED WITH ME ══ */}
        {activeSection === 'shared' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 500 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 100px', padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['File','From','Access','Granted','Action'].map((h, i) => (
                <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
              ))}
            </div>
            {sharedLoading ? (
              <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0,1,2].map(i => <div key={i} style={{ height: 50, background: 'rgba(255,255,255,0.02)', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />)}
              </div>
            ) : shared.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Share2 size={36} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>No shared files yet</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', marginTop: 5 }}>Files shared or purchased will appear here</div>
              </div>
            ) : shared.map((access, i) => {
              const fr     = access.fileRecordId;
              const seller = access.sellerUserId;
              const isShr  = access.accessType === 'share';
              return (
                <motion.div key={access._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 100px', padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    {fileIcon(fr?.fileName || '', fr?.mimeType || '', 16)}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fr?.fileName || 'Unknown file'}</div>
                      <div style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{fmt(fr?.fileSize)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)' }}>{seller?.name || 'Unknown'}</div>
                  <div>
                    <span style={{ display: 'inline-flex', padding: '3px 8px', background: isShr ? 'rgba(48,209,88,0.1)' : 'rgba(255,159,10,0.1)', border: `1px solid ${isShr ? 'rgba(48,209,88,0.25)' : 'rgba(255,159,10,0.25)'}`, borderRadius: 20, fontSize: '0.67rem', fontWeight: 700, color: isShr ? '#30d158' : '#ff9f0a' }}>
                      {isShr ? 'Shared' : 'Purchased'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>{timeAgo(access.grantedAt)}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {fr?._id && (
                      <button onClick={() => handleDownload(fr._id, fr.fileName || 'file')} disabled={dlLoading[fr._id]}
                        style={{ padding: '6px 9px', background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.2)', borderRadius: 7, color: '#2997ff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {dlLoading[fr._id] ? <RefreshCw size={12} /> : <Download size={12} />}
                      </button>
                    )}
                    {fr?.ipfsCid && (
                      <a href={`https://gateway.pinata.cloud/ipfs/${fr.ipfsCid}`} target="_blank" rel="noreferrer"
                        style={{ padding: '6px 9px', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 7, color: '#bf5af2', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div></div>{/* overflow wrappers close */}
          </div>
        )}

        {/* Delete confirm */}
        {delId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: '#111', border: '1px solid rgba(255,55,95,0.3)', borderRadius: 18, padding: '32px 36px', maxWidth: 360, textAlign: 'center' }}>
              <Trash2 size={32} color="#ff375f" style={{ marginBottom: 12 }} />
              <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 800, margin: '0 0 8px' }}>Delete File?</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: '0 0 24px' }}>The IPFS CID will remain accessible. Encrypted chunks will be cleaned up.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setDelId(null)} style={{ padding: '9px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>
                <button onClick={() => handleDelete(delId)} style={{ padding: '9px 20px', background: 'rgba(255,55,95,0.15)', border: '1px solid rgba(255,55,95,0.4)', borderRadius: 9, color: '#ff375f', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>Delete</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modals */}
        <AnimatePresence>
          {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownload} dlLoading={dlLoading} />}
          {shareFile   && <ShareModal   file={shareFile}   onClose={() => setShareFile(null)}   onSaved={handleShareSaved} origin={origin} />}
        </AnimatePresence>

        <style>{`
          @keyframes pulse { 0%,100%{opacity:0.5}50%{opacity:1} }
          @keyframes spin   { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}

const menuBtn = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
  background: 'transparent', border: 'none', borderRadius: 8,
  color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
};
