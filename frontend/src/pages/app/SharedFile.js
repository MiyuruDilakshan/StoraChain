import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Download, Lock, Globe, Link2, Shield, CheckCircle, AlertCircle,
  Loader, FileText, Image, Video, Music, Archive, Code, Copy,
  Coins, DollarSign, User, Calendar, HardDrive, Eye, ShoppingBag,
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function fmt(b) {
  if (!b) return '—';
  const gb = b / (1024 ** 3); if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = b / (1024 ** 2); if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function mimeIcon(mime = '', size = 28) {
  if (mime.startsWith('image/'))  return <Image   size={size} color="#bf5af2" />;
  if (mime.startsWith('video/'))  return <Video   size={size} color="#ff375f" />;
  if (mime.startsWith('audio/'))  return <Music   size={size} color="#30d158" />;
  if (mime.includes('zip') || mime.includes('tar')) return <Archive size={size} color="#ff9f0a" />;
  if (mime.includes('javascript') || mime.includes('python')) return <Code size={size} color="#2997ff" />;
  return <FileText size={size} color="rgba(255,255,255,0.4)" />;
}
function getAuth() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function SharedFile() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [user, setUser]           = useState(null);
  const [payMethod, setPayMethod] = useState('demo_sct');
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [purchaseErr, setPurchaseErr] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem('user'); if (s) setUser(JSON.parse(s)); } catch {}
  }, []);

  const fetchFile = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get(`${API}/storage/public/${shareToken}`, { headers: getAuth() });
      setFile(data);
      if (!data.isLocked || data.alreadyPurchased || data.isOwner) setPurchased(true);
    } catch (e) {
      setError(e.response?.data?.error || 'File not found or access denied.');
    } finally { setLoading(false); }
  }, [shareToken]);

  useEffect(() => { fetchFile(); }, [fetchFile]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/storage/public/${shareToken}/download`, {
        headers: getAuth(), responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'];
      const m = cd && cd.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : (file?.fileName || 'download');
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setFile(prev => prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : prev);
    } catch (e) { alert(e.response?.data?.error || 'Download failed.'); }
    finally { setDownloading(false); }
  };

  const handlePurchase = async () => {
    if (!user) { navigate(`/login?redirect=/share/${shareToken}`); return; }
    setPurchasing(true); setPurchaseErr('');
    try {
      await axios.post(`${API}/storage/public/${shareToken}/purchase`,
        { method: payMethod },
        { headers: { ...getAuth(), 'Content-Type': 'application/json' } }
      );
      setPurchased(true);
      try {
        const { data: me } = await axios.get(`${API}/auth/me`, { headers: getAuth() });
        localStorage.setItem('user', JSON.stringify(me)); setUser(me);
      } catch {}
      await fetchFile();
    } catch (e) {
      setPurchaseErr(e.response?.data?.error || 'Purchase failed.');
    } finally { setPurchasing(false); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const showPreview  = !file?.isLocked || purchased || file?.isOwner;
  const showDownload = !file?.isLocked || purchased || file?.isOwner;
  const priceSCT     = file?.priceSCT || 0;
  const priceUSD     = file?.priceUSD || 0;
  const isFree       = priceSCT === 0 && priceUSD === 0;
  const priceLabel   = priceUSD > 0 ? `$${priceUSD.toFixed(2)}` : priceSCT > 0 ? `${priceSCT} SCT` : 'Free';
  const userSCT      = user?.sctBalance ?? 0;
  const userUSD      = user?.demoUSD ?? 0;

  /* ── LOADING ── */
  if (loading) return (
    <div style={S.page}>
      <Nav user={user} />
      <div style={S.center}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Loader size={32} color="#2997ff" />
        </motion.div>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>Loading file…</p>
      </div>
    </div>
  );

  /* ── ERROR ── */
  if (error) return (
    <div style={S.page}>
      <Nav user={user} />
      <div style={S.center}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,55,95,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Lock size={28} color="#ff375f" />
        </div>
        <h2 style={{ color: '#fff', fontWeight: 800, margin: 0 }}>Access Denied</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{error}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Link to="/" style={S.btnGhost}>← Home</Link>
          <Link to="/login" style={S.btnAccent}>Log In</Link>
        </div>
      </div>
    </div>
  );

  if (!file) return null;

  /* ── MAIN ── */
  return (
    <div style={S.page}>
      <Nav user={user} />

      <div style={S.wrap}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={S.card}>

          {/* Preview Area */}
          <div style={S.previewWrap}>
            {showPreview && file.previewCid && file.previewType?.startsWith('image/') ? (
              <img src={`https://gateway.pinata.cloud/ipfs/${file.previewCid}`} alt={file.fileName}
                style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 14 }}
                onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div style={S.previewPlaceholder}>
                {showPreview ? (
                  <div style={{ opacity: 0.5 }}>{mimeIcon(file.mimeType || file.previewType, 56)}</div>
                ) : (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,159,10,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={24} color="#ff9f0a" />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 12, fontSize: '0.85rem', textAlign: 'center' }}>
                      This file is locked. Purchase to unlock.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {file.isLocked && <Badge icon={<Lock size={10} />} label="Locked" bg="rgba(255,159,10,0.12)" border="rgba(255,159,10,0.3)" color="#ff9f0a" />}
              {file.visibility === 'public' && <Badge icon={<Globe size={10} />} label="Public" bg="rgba(48,209,88,0.1)" border="rgba(48,209,88,0.3)" color="#30d158" />}
              {file.visibility === 'shared' && <Badge icon={<Link2 size={10} />} label="Shared Link" bg="rgba(41,151,255,0.1)" border="rgba(41,151,255,0.3)" color="#2997ff" />}
              {file.marketplaceCategory && <Badge label={file.marketplaceCategory} bg="rgba(191,90,242,0.1)" border="rgba(191,90,242,0.3)" color="#bf5af2" />}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

          {/* File Info */}
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.3, wordBreak: 'break-word' }}>
              {file.marketplaceTitle || file.fileName}
            </h1>
            {file.marketplaceTitle && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginTop: 4 }}>{file.fileName}</p>}
            {file.marketplaceDesc && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.6, marginTop: 10 }}>{file.marketplaceDesc}</p>}
          </div>

          {/* Meta Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 18 }}>
            <Meta icon={<User size={12} color="#bf5af2" />} label="By" value={file.ownerName || 'Unknown'} />
            <Meta icon={<Calendar size={12} color="#2997ff" />} label="Date" value={fmtDate(file.createdAt)} />
            <Meta icon={<HardDrive size={12} color="#ff9f0a" />} label="Size" value={fmt(file.fileSize)} />
            <Meta icon={<Download size={12} color="#30d158" />} label="Downloads" value={file.downloadCount ?? 0} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

          {/* Purchase or Download */}
          {file.isLocked && !purchased && !file.isOwner ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ff9f0a' }}>{priceLabel}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>to unlock</span>
              </div>

              {!user && (
                <div style={{ padding: '12px 14px', background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 10, marginBottom: 14, fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
                  <Link to={`/login?redirect=/share/${shareToken}`} style={{ color: '#2997ff', fontWeight: 700 }}>Log in</Link>
                  {' or '}
                  <Link to="/register" style={{ color: '#2997ff', fontWeight: 700 }}>sign up</Link>
                  {' to purchase this file.'}
                </div>
              )}

              {user && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {priceSCT > 0 && (
                      <PayBtn selected={payMethod === 'demo_sct'} onClick={() => setPayMethod('demo_sct')}
                        icon={<Coins size={16} color="#ff9f0a" />} label={`${priceSCT} SCT`}
                        sub={`Balance: ${userSCT} SCT`} accent="#ff9f0a" disabled={userSCT < priceSCT} />
                    )}
                    {priceUSD > 0 && (
                      <PayBtn selected={payMethod === 'demo_usd'} onClick={() => setPayMethod('demo_usd')}
                        icon={<DollarSign size={16} color="#30d158" />} label={`$${priceUSD.toFixed(2)}`}
                        sub={`Balance: $${userUSD.toFixed(2)}`} accent="#30d158" disabled={userUSD < priceUSD} />
                    )}
                  </div>

                  {purchaseErr && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', background: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', borderRadius: 8, color: '#ff375f', fontSize: '0.82rem', marginBottom: 10 }}>
                      <AlertCircle size={13} /> {purchaseErr}
                    </div>
                  )}

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handlePurchase} disabled={purchasing}
                    style={{ width: '100%', padding: '13px', background: 'rgba(255,159,10,0.15)', border: '1px solid rgba(255,159,10,0.4)', borderRadius: 12, color: '#ff9f0a', cursor: purchasing ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {purchasing ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : <><Lock size={14} /> Unlock — {priceLabel}</>}
                  </motion.button>
                </>
              )}
            </div>
          ) : (
            <div>
              {purchased && !file.isOwner && file.isLocked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: 10, marginBottom: 14, color: '#30d158', fontSize: '0.84rem', fontWeight: 600 }}>
                  <CheckCircle size={14} /> You have access to this file
                </div>
              )}
              {file.isOwner && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 10, marginBottom: 14, color: '#2997ff', fontSize: '0.84rem', fontWeight: 600 }}>
                  <Eye size={14} /> This is your file — <Link to="/app/files" style={{ color: '#2997ff', fontWeight: 700 }}>manage in My Files</Link>
                </div>
              )}
              {showDownload && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleDownload} disabled={downloading}
                    style={{ flex: 2, padding: '13px', background: 'linear-gradient(135deg,rgba(41,151,255,0.2),rgba(48,209,88,0.2))', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 12, color: '#fff', cursor: downloading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {downloading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Downloading…</> : <><Download size={15} /> Download File</>}
                  </motion.button>
                  <button onClick={copyLink}
                    style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: copied ? '#30d158' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {copied ? <><CheckCircle size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
                  </button>
                </div>
              )}
              {!file.isLocked && isFree && (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.76rem', marginTop: 10, textAlign: 'center' }}>
                  Free public file — no account required
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Shield size={13} color="rgba(255,255,255,0.2)" />
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.73rem' }}>Decentralized · Encrypted · Permanent</span>
            </div>
            <Link to={user ? '/app/marketplace' : '/register'}
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.3)', fontSize: '0.73rem', textDecoration: 'none' }}>
              <ShoppingBag size={11} /> Marketplace
            </Link>
          </div>
        </motion.div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

/* ── Sub Components ── */
function Nav({ user }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#bf5af2,#2997ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HardDrive size={13} color="#fff" />
        </div>
        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>StoraChain</span>
      </Link>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {user ? (
          <>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Hi, {user.name?.split(' ')[0]}</span>
            <Link to="/app/files" style={S.btnGhost}>My Files</Link>
          </>
        ) : (
          <>
            <Link to="/login" style={S.btnGhost}>Log In</Link>
            <Link to="/register" style={S.btnAccent}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Badge({ icon, label, bg, border, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: bg, border: `1px solid ${border}`, borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, color }}>
      {icon} {label}
    </span>
  );
}

function Meta({ icon, label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{value}</div>
    </div>
  );
}

function PayBtn({ selected, onClick, icon, label, sub, accent, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: '12px 10px', background: selected ? `${accent}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${selected ? `${accent}40` : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.45 : 1, transition: 'all 0.15s', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#050505', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff' },
  wrap: { maxWidth: 560, margin: '0 auto', padding: '40px 20px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '28px 30px' },
  previewWrap: {},
  previewPlaceholder: { width: '100%', height: 220, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  btnGhost: { padding: '7px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 },
  btnAccent: { padding: '7px 14px', background: 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)', borderRadius: 8, color: '#2997ff', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 },
};
