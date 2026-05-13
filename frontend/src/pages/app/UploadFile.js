import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, CheckCircle, AlertCircle, CloudUpload, FileText,
  Lock, Zap, Loader, Globe, Link2, DollarSign, Coins, Share2,
  ShoppingBag, Copy, ExternalLink, Shield,
} from 'lucide-react';
import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from 'ethers';
import api from '../../api/client';
import StoraChainStorageABI from '../../abi/StoraChainStorage.json';

const STORAGE_CONTRACT = process.env.REACT_APP_STORAGE_CONTRACT_ADDRESS || '';

const STAGES = [
  { id: 'uploading',   label: 'Uploading file',           sub: 'Streaming to StoraChain' },
  { id: 'encrypting',  label: 'Encrypting file',           sub: 'AES-256-GCM before any write' },
  { id: 'matchmaking', label: 'AI matchmaking',            sub: 'Finding the best providers' },
  { id: 'splitting',   label: 'Splitting encrypted file',  sub: 'Preparing chunks for providers' },
  { id: 'storing',     label: 'Storing on providers',      sub: 'Writing encrypted chunks + replicas' },
  { id: 'pinata_backup', label: 'Pinata backup',           sub: 'Encrypted full-file IPFS backup' },
  { id: 'cloud_backup',  label: 'S3 backup',               sub: 'Encrypted disaster-recovery copy' },
  { id: 'blockchain',    label: 'Blockchain record',        sub: 'Finalizing the on-chain log' },
];

const VISIBILITY_OPTIONS = [
  { val: 'private', icon: <Lock size={13} />,  label: 'Private',            sub: 'Only you can access', color: 'rgba(255,255,255,0.5)' },
  { val: 'shared',  icon: <Link2 size={13} />, label: 'Anyone with the link', sub: 'Share a unique link', color: '#ff9f0a' },
  { val: 'public',  icon: <Globe size={13} />, label: 'Public',              sub: 'Discoverable by anyone', color: '#30d158' },
];

function fmt(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / (1024 ** 3); if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2); if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function normalizeStage(stage, status) {
  if (status === 'completed') return 'blockchain';
  if (stage === 'provider_storage_complete') return 'storing';
  return stage || 'uploading';
}

function stageState(stageId, activeStage, status) {
  if (status === 'completed') return 'done';
  const currentIndex = STAGES.findIndex(s => s.id === activeStage);
  const stepIndex    = STAGES.findIndex(s => s.id === stageId);
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

function StageStep({ stage, state, detail }) {
  const color  = state === 'done' ? '#30d158' : state === 'active' ? '#2997ff' : 'rgba(255,255,255,0.18)';
  const bg     = state === 'done' ? 'rgba(48,209,88,0.12)' : state === 'active' ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.04)';
  const border = state === 'done' ? 'rgba(48,209,88,0.35)' : state === 'active' ? 'rgba(41,151,255,0.35)' : 'rgba(255,255,255,0.08)';
  return (
    <motion.div animate={{ opacity: state === 'pending' ? 0.48 : 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: state === 'done' ? 'rgba(48,209,88,0.15)' : state === 'active' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.05)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {state === 'done'   && <CheckCircle size={13} color="#30d158" />}
        {state === 'active' && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader size={12} color="#2997ff" /></motion.div>}
        {state === 'pending' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: state === 'pending' ? 'rgba(255,255,255,0.4)' : '#fff' }}>{stage.label}</div>
        <div style={{ fontSize: '0.71rem', color: state === 'done' ? '#30d158' : 'rgba(255,255,255,0.38)', marginTop: 1 }}>
          {state === 'active' ? (detail || stage.sub) : state === 'done' ? 'Complete' : stage.sub}
        </div>
      </div>
      {state !== 'pending' && (
        <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', color, padding: '2px 7px', background: bg, borderRadius: 20 }}>
          {state === 'done' ? 'Done' : 'Running'}
        </div>
      )}
    </motion.div>
  );
}

function ProviderMatches({ matchmaking }) {
  if (!matchmaking?.candidates?.length) return null;
  return (
    <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Matchmaking</div>
        <div style={{ fontSize: '0.7rem', color: '#2997ff', fontWeight: 700 }}>{matchmaking.source || 'local'}</div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {matchmaking.candidates.slice(0, 4).map(c => (
          <div key={`${c.agentUrl}-${c.selectedRole}`}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 10px', background: c.selectedRole === 'selected' ? 'rgba(41,151,255,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${c.selectedRole === 'selected' ? 'rgba(41,151,255,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 9 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.region || 'local'} provider</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>{Number(c.score || 0).toFixed(4)}</div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: c.selectedRole === 'selected' ? '#30d158' : 'rgba(255,255,255,0.35)', background: c.selectedRole === 'selected' ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${c.selectedRole === 'selected' ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 999, padding: '3px 8px', textTransform: 'uppercase' }}>
              {c.selectedRole || 'candidate'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── File Settings Panel (shown after upload completes) ── */
function FileSettingsPanel({ fileId, fileName, origin, onDone }) {
  const [visibility,  setVisibility]  = useState('private');
  const [isLocked,    setIsLocked]    = useState(false);
  const [priceUSD,    setPriceUSD]    = useState('');
  const [priceSCT,    setPriceSCT]    = useState('');
  const [listMarket,  setListMarket]  = useState(false);
  const [mkTitle,     setMkTitle]     = useState(fileName || '');
  const [mkDesc,      setMkDesc]      = useState('');
  const [mkCategory,  setMkCategory]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [shareToken,  setShareToken]  = useState('');
  const [copied,      setCopied]      = useState(false);
  const [error,       setError]       = useState('');

  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : '';

  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await api.patch(`/storage/files/${fileId}/settings`, {
        visibility,
        isLocked,
        priceUSD:    isLocked ? (Number(priceUSD) || 0) : 0,
        priceSCT:    isLocked ? (Number(priceSCT) || 0) : 0,
        marketplaceTitle:    mkTitle,
        marketplaceDesc:     mkDesc,
        marketplaceCategory: mkCategory,
      });
      setShareToken(r.data.shareToken || '');
      if (listMarket && mkTitle) {
        await api.post('/marketplace/list', {
          fileRecordId:  fileId,
          title:         mkTitle,
          description:   mkDesc,
          priceSCT:      Number(priceSCT) || 0,
          priceUSDCents: Math.round((Number(priceUSD) || 0) * 100),
          acceptsTokens: true,
          acceptsFiat:   (Number(priceUSD) || 0) > 0,
          category:      mkCategory,
        });
      }
      setSaved(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  if (saved) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 16, padding: '20px 24px', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <CheckCircle size={18} color="#30d158" />
          <span style={{ fontWeight: 700, color: '#30d158', fontSize: '0.95rem' }}>Settings saved!</span>
        </div>
        {shareUrl && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your Shareable Link</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shareUrl}
              </div>
              <button onClick={copyLink}
                style={{ padding: '9px 14px', background: copied ? 'rgba(48,209,88,0.12)' : 'rgba(41,151,255,0.1)', border: `1px solid ${copied ? 'rgba(48,209,88,0.3)' : 'rgba(41,151,255,0.25)'}`, borderRadius: 9, color: copied ? '#30d158' : '#2997ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit' }}>
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <a href="/app/marketplace" style={{ flex: 1, padding: '9px', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.25)', borderRadius: 9, color: '#bf5af2', textDecoration: 'none', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ShoppingBag size={13} /> View Marketplace
          </a>
          <a href="/app/files" style={{ flex: 1, padding: '9px', background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 9, color: '#2997ff', textDecoration: 'none', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            My Files
          </a>
        </div>
        <button onClick={onDone}
          style={{ marginTop: 10, width: '100%', padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 600 }}>
          Upload Another
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px 24px', marginTop: 14 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Share2 size={14} color="#bf5af2" /> File Sharing & Monetization
      </div>

      {/* Visibility */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Who can access</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {VISIBILITY_OPTIONS.map(opt => (
            <button key={opt.val} onClick={() => setVisibility(opt.val)}
              style={{ flex: 1, padding: '9px 6px', background: visibility === opt.val ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${visibility === opt.val ? opt.color : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ color: visibility === opt.val ? opt.color : 'rgba(255,255,255,0.35)' }}>{opt.icon}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: visibility === opt.val ? '#fff' : 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.2 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lock & Price */}
      <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isLocked ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={13} color={isLocked ? '#ff9f0a' : 'rgba(255,255,255,0.35)'} />
            <div>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#fff' }}>Lock & Sell</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>Require payment to access</div>
            </div>
          </div>
          <div onClick={() => setIsLocked(v => !v)}
            style={{ width: 40, height: 22, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s', background: isLocked ? '#ff9f0a' : 'rgba(255,255,255,0.12)', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: isLocked ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>
        {isLocked && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Price USD ($)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                <DollarSign size={11} color="#30d158" />
                <input type="number" min="0" step="0.01" value={priceUSD} onChange={e => setPriceUSD(e.target.value)} placeholder="0.00"
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.86rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 4 }}>Price SCT (optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                <Coins size={11} color="#ff9f0a" />
                <input type="number" min="0" step="1" value={priceSCT} onChange={e => setPriceSCT(e.target.value)} placeholder="0"
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.86rem', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Marketplace */}
      <div style={{ marginBottom: 14, padding: '12px 14px', background: listMarket ? 'rgba(191,90,242,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${listMarket ? 'rgba(191,90,242,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: listMarket ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={13} color={listMarket ? '#bf5af2' : 'rgba(255,255,255,0.35)'} />
            <div>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#fff' }}>List on Marketplace</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>Sell to anyone on StoraChain</div>
            </div>
          </div>
          <div onClick={() => setListMarket(v => !v)}
            style={{ width: 40, height: 22, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s', background: listMarket ? '#bf5af2' : 'rgba(255,255,255,0.12)', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: listMarket ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>
        {listMarket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <input value={mkTitle} onChange={e => setMkTitle(e.target.value)} placeholder="Listing title *"
              style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none' }} />
            <textarea value={mkDesc} onChange={e => setMkDesc(e.target.value)} placeholder="Describe what buyers will receive…" rows={2}
              style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', resize: 'none' }} />
            <select value={mkCategory} onChange={e => setMkCategory(e.target.value)}
              style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', colorScheme: 'dark' }}>
              <option value="">Select category</option>
              {['Media','Documents','Archives','Software','Data'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <div style={{ marginBottom: 10, padding: '9px 12px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 9, color: '#ff375f', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={12} />{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDone}
          style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.84rem' }}>
          Skip
        </button>
        <button onClick={save} disabled={saving}
          style={{ flex: 2, padding: '10px', background: saving ? 'rgba(41,151,255,0.08)' : 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 9, color: '#2997ff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Share2 size={13} /> Save & Share</>}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Main Upload Component ── */
export default function UploadFile({ user }) {
  const [dragging,    setDragging]    = useState(false);
  const [file,        setFile]        = useState(null);
  const [processing,  setProcessing]  = useState({ status: 'idle', stage: 'queued', progressPct: 0, detail: '' });
  const [transportProgress, setTransportProgress] = useState(0);
  const [done,        setDone]        = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [wallet,      setWallet]      = useState(user?.walletAddress || '');
  const [mmStatus,    setMmStatus]    = useState('idle');
  const [mmTxHash,    setMmTxHash]    = useState('');
  const [onChainTxHash, setOnChainTxHash] = useState('');
  const [matchmaking, setMatchmaking] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const pollRef          = useRef(null);
  const abortCtrlRef     = useRef(null);
  const origin           = window.location.origin;

  const reset = () => {
    setFile(null);
    setProcessing({ status: 'idle', stage: 'queued', progressPct: 0, detail: '' });
    setTransportProgress(0); setDone(false); setResult(null); setError('');
    setMmStatus('idle'); setMmTxHash(''); setOnChainTxHash(''); setMatchmaking(null);
    setShowSettings(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const cancelUpload = useCallback(() => {
    abortCtrlRef.current?.abort();
    if (pollRef.current) clearInterval(pollRef.current);
    setProcessing({ status: 'idle', stage: 'queued', progressPct: 0, detail: '' });
    setTransportProgress(0);
    setError('');
  }, []);

  const pickFile = useCallback((picked) => {
    if (!picked) return;
    setFile(picked); setError('');
  }, []);

  const onDrop      = useCallback(e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }, [pickFile]);
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);

  const ensureSepoliaNetwork = async () => {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId === '0xaa36a7') return;
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] }); }
    catch (switchErr) {
      if (switchErr.code !== 4902) throw switchErr;
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0xaa36a7', chainName: 'Sepolia Test Network', nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] }] });
    }
  };

  const attemptMetaMaskTx = async (uploadResult) => {
    if (!STORAGE_CONTRACT || !window.ethereum) { setMmStatus('unavail'); return; }
    setMmStatus('pending');
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await ensureSepoliaNetwork();
      const provider  = new BrowserProvider(window.ethereum);
      const signer    = await provider.getSigner();
      const contract  = new Contract(STORAGE_CONTRACT, StoraChainStorageABI.abi, signer);
      const rawHash   = uploadResult.sha256Hash || keccak256(toUtf8Bytes(uploadResult.fileName || 'storachain-file'));
      const fileHash  = rawHash.startsWith('0x') ? rawHash : `0x${rawHash}`;
      const tx = await contract.storeFile(fileHash.padEnd(66, '0'), uploadResult.ipfsCid || '', await signer.getAddress(), [], uploadResult.fileSize || 0);
      setMmTxHash(tx.hash); setMmStatus('done');
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') setMmStatus('declined');
      else setMmStatus('unavail');
    }
  };

  const startPolling = useCallback((fileId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/storage/files/${fileId}`);
        const latest   = response.data;
        if (latest.processing) setProcessing(latest.processing);
        if (latest.matchmaking) setMatchmaking(latest.matchmaking);
        if (latest.onChainTxHash || latest.txHash) setOnChainTxHash(latest.onChainTxHash || latest.txHash);
        setResult(prev => ({ ...prev, ...latest }));
        if (latest.processing?.status === 'completed') { setDone(true); setShowSettings(true); clearInterval(pollRef.current); }
        if (latest.processing?.status === 'failed') { setError(latest.processing.error || 'Processing failed'); clearInterval(pollRef.current); }
      } catch { /* keep polling */ }
    }, 2500);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;
    setError(''); setDone(false); setResult(null); setMatchmaking(null); setTransportProgress(0); setShowSettings(false);
    setProcessing({ status: 'processing', stage: 'uploading', progressPct: 0, detail: 'Streaming file to StoraChain' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (wallet) formData.append('walletAddress', wallet);
      const response = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: abortCtrl.signal,
        onUploadProgress: e => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          setTransportProgress(pct);
          setProcessing(prev => prev.stage === 'uploading' ? { ...prev, progressPct: pct, detail: pct < 100 ? `Uploaded ${pct}%` : 'Received. Starting secure processing…' } : prev);
        },
      });
      setResult(response.data);
      if (response.data.processing) setProcessing(response.data.processing);
      if (response.data.matchmaking) setMatchmaking(response.data.matchmaking);
      const fileId = response.data?.fileId || response.data?._id;
      if (fileId) startPolling(fileId);
      attemptMetaMaskTx(response.data);
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      setProcessing({ status: 'failed', stage: 'uploading', progressPct: 100, detail: 'Upload failed' });
      setError(err.response?.data?.message || err.message || 'Upload failed');
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const activeStage     = normalizeStage(processing.stage, processing.status);
  const overallProgress = activeStage === 'uploading' ? transportProgress : (processing.progressPct || 0);
  const ipfsUrl         = result?.ipfsCid ? `https://gateway.pinata.cloud/ipfs/${result.ipfsCid}` : '';
  const uploadedFileId  = result?.fileId || result?._id;

  return (
    <div style={{ maxWidth: 780, width: '100%', margin: '0 auto', position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Upload File</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.9rem' }}>
          Encrypted before any storage write. Set visibility, lock with a price, and list on the marketplace after upload.
        </p>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { icon: <Lock size={15} color="#30d158" />, label: 'Encrypt First', detail: 'AES-256-GCM before providers', accent: '#30d158' },
          { icon: <Zap size={15} color="#ff9f0a" />,  label: 'AI Matchmaking', detail: 'Best providers selected for you', accent: '#ff9f0a' },
          { icon: <CloudUpload size={15} color="#2997ff" />, label: 'Tiered Recovery', detail: 'Provider → Replica → IPFS → S3', accent: '#2997ff' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: `${item.accent}0a`, border: `1px solid ${item.accent}20`, borderRadius: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${item.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{item.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet input */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Wallet Address (optional)</label>
        <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x…"
          style={{ width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Drop zone */}
      {!file && (
        <motion.div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          animate={{ borderColor: dragging ? '#2997ff' : 'rgba(255,255,255,0.1)', background: dragging ? 'rgba(41,151,255,0.06)' : 'rgba(255,255,255,0.02)' }}
          style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 18, padding: '56px 40px', textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
          onClick={() => document.getElementById('fileInput').click()}>
          <motion.div animate={{ y: dragging ? -8 : 0 }}>
            <CloudUpload size={44} color={dragging ? '#2997ff' : 'rgba(255,255,255,0.15)'} style={{ marginBottom: 14 }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: dragging ? '#2997ff' : 'rgba(255,255,255,0.7)', marginBottom: 5 }}>
              {dragging ? 'Drop to upload' : 'Drag and drop your file here'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.25)' }}>or click to browse — no size limit</div>
          </motion.div>
          <input id="fileInput" type="file" style={{ display: 'none' }} onChange={e => pickFile(e.target.files[0])} />
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 10, color: '#ff375f', fontSize: '0.85rem', fontWeight: 600, marginBottom: 14 }}>
          <AlertCircle size={15} /> {error}
          <button onClick={reset} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Retry</button>
        </motion.div>
      )}

      {/* File card + progress */}
      <AnimatePresence>
        {file && !done && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '22px 26px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(41,151,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={18} color="#2997ff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>{file.name}</div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{fmt(file.size)} · {file.type || 'unknown type'}</div>
              </div>
              {processing.status === 'idle' && (
                <button onClick={reset} style={{ padding: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><X size={15} /></button>
              )}
              {processing.status === 'processing' && (
                <button onClick={cancelUpload}
                  style={{ padding: '5px 12px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 8, color: '#ff375f', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <X size={12} /> Cancel
                </button>
              )}
            </div>

            {processing.status !== 'idle' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>StoraChain processing</span>
                    <span style={{ fontSize: '0.75rem', color: '#2997ff', fontWeight: 700 }}>{overallProgress}%</span>
                  </div>
                  <div style={{ height: 9, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${Math.max(overallProgress, 4)}%` }} transition={{ duration: 0.35 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg,#2997ff 0%,#30d158 100%)' }} />
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.38)', marginTop: 7 }}>{processing.detail || 'Preparing upload pipeline'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {STAGES.map(stage => (
                    <StageStep key={stage.id} stage={stage} state={stageState(stage.id, activeStage, processing.status)} detail={normalizeStage(processing.stage, processing.status) === stage.id ? processing.detail : ''} />
                  ))}
                </div>
              </>
            )}

            <ProviderMatches matchmaking={matchmaking} />

            {processing.status === 'idle' && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleUpload}
                style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'linear-gradient(135deg,rgba(41,151,255,0.2),rgba(48,209,88,0.2))', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 12, color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Upload size={15} /> Upload to StoraChain
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Done — success card */}
      {done && result && !showSettings && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          style={{ background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 18, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CheckCircle size={20} color="#30d158" />
            <h3 style={{ color: '#30d158', fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>Upload complete!</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'File',    value: result.fileName },
              { label: 'Size',    value: fmt(result.fileSize) },
              { label: 'Shards',  value: `${result.shardCount || result.chunks?.length || 0} shards` },
              { label: 'IPFS',    value: result.ipfsCid ? `${result.ipfsCid.slice(0,16)}…` : 'Pending' },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <ProviderMatches matchmaking={matchmaking} />
          {mmStatus === 'done' && mmTxHash && (
            <div style={{ marginTop: 12, padding: '9px 12px', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 9 }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>MetaMask Tx</div>
              <a href={`https://sepolia.etherscan.io/tx/${mmTxHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#30d158', wordBreak: 'break-all', textDecoration: 'none', fontWeight: 600 }}>{mmTxHash.slice(0,22)}…</a>
            </div>
          )}
          {onChainTxHash && (
            <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(41,151,255,0.05)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 9 }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>On-chain record</div>
              <a href={`https://sepolia.etherscan.io/tx/${onChainTxHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#2997ff', wordBreak: 'break-all', textDecoration: 'none', fontWeight: 600 }}>{onChainTxHash.slice(0,22)}…</a>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {ipfsUrl && <a href={ipfsUrl} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.25)', borderRadius: 9, color: '#bf5af2', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><ExternalLink size={12} /> Pinata</a>}
            <button onClick={() => setShowSettings(true)}
              style={{ padding: '8px 16px', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 9, color: '#2997ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Share2 size={12} /> Share & Monetize
            </button>
            <button onClick={reset} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>Upload Another</button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
            <Shield size={13} /> Only encrypted bytes were stored on providers, Pinata, and S3.
          </div>
        </motion.div>
      )}

      {/* File settings panel after upload */}
      {done && result && showSettings && uploadedFileId && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ padding: '16px 20px', background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 14, marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="#30d158" />
              <span style={{ fontWeight: 700, color: '#30d158', fontSize: '0.88rem' }}>{result.fileName} uploaded successfully</span>
            </div>
          </div>
          <FileSettingsPanel fileId={uploadedFileId} fileName={result.fileName} origin={origin} onDone={reset} />
        </motion.div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
