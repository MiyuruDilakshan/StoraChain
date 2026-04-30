import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, Clock, CheckCircle, XCircle, AlertCircle, Coins, ExternalLink } from 'lucide-react';
import api from '../../api/client';

function StatusBadge({ status }) {
  const map = {
    pending:   { c: '#ff9f0a', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.3)',   icon: <Clock size={11} /> },
    processed: { c: '#30d158', bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.3)',    icon: <CheckCircle size={11} /> },
    failed:    { c: '#ff375f', bg: 'rgba(255,55,95,0.12)',  border: 'rgba(255,55,95,0.3)',    icon: <XCircle size={11} /> },
  };
  const s = map[status] || map.pending;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, color: s.c, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {s.icon} {status}
    </div>
  );
}

function fmt(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Withdraw({ user }) {
  const [balance,      setBalance]     = useState(user?.sctBalance || 0);
  const [tokensEarned, setTokensEarned] = useState(0);
  const [history,      setHistory]     = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [amount,       setAmount]      = useState('');
  const [wallet,       setWallet]      = useState(user?.walletAddress || '');
  const [sending,      setSending]     = useState(false);
  const [toast,        setToast]       = useState('');
  const [toastErr,     setToastErr]    = useState(false);

  const showMsg = (m, err = false) => { setToast(m); setToastErr(err); setTimeout(() => setToast(''), 5000); };

  useEffect(() => {
    Promise.all([
      api.get('/withdraw/history'),
      api.get('/analytics/overview'),
    ]).then(([hRes, aRes]) => {
      setHistory(hRes.data);
      if (aRes.data?.pendingBalance !== undefined) setBalance(aRes.data.pendingBalance);
      if (aRes.data?.tokensEarned   !== undefined) setTokensEarned(aRes.data.tokensEarned);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleRequest = async () => {
    if (!amount || Number(amount) <= 0) { showMsg('Enter a valid amount', true); return; }
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) { showMsg('Enter a valid Ethereum wallet address', true); return; }
    if (Number(amount) > balance) { showMsg('Insufficient token balance', true); return; }
    setSending(true);
    try {
      const { data } = await api.post('/withdraw/request', { amountSCT: Number(amount), walletAddress: wallet.trim() });
      setHistory(prev => [data.withdrawal || data, ...prev]);
      setBalance(b => b - Number(amount));
      setAmount('');
      const txHash = data.withdrawal?.txHash || '';
      const msg = txHash
        ? `Withdrawal submitted! Tx: ${txHash.slice(0, 10)}…`
        : `Withdrawal submitted! ${amount} SCT queued for transfer.`;
      showMsg(msg);
    } catch (e) {
      showMsg(e.response?.data?.message || 'Request failed', true);
    } finally { setSending(false); }
  };

  const S = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '12px 15px', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Withdraw Tokens</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Transfer earned SCT tokens to your Ethereum wallet</p>
      </div>

      {/* Balance card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ padding: '28px 32px', background: 'linear-gradient(135deg,rgba(255,159,10,0.08),rgba(191,90,242,0.08))', border: '1px solid rgba(255,159,10,0.2)', borderRadius: 20, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,159,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={26} color="#ff9f0a" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Pending Balance</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.05em', color: '#ff9f0a' }}>{balance.toFixed(2)} <span style={{ fontSize: '1rem', color: 'rgba(255,159,10,0.6)' }}>SCT</span></div>
          </div>
        </div>
        {tokensEarned > 0 && (
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
            <div>Lifetime earned: <span style={{ color: '#ff9f0a', fontWeight: 700 }}>{tokensEarned.toFixed(2)} SCT</span></div>
            <div>Withdrawn: <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{(tokensEarned - balance).toFixed(2)} SCT</span></div>
          </div>
        )}
      </motion.div>

      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 16, padding: '11px 18px', background: toastErr ? 'rgba(255,55,95,0.08)' : 'rgba(48,209,88,0.08)', border: `1px solid ${toastErr ? 'rgba(255,55,95,0.3)' : 'rgba(48,209,88,0.3)'}`, borderRadius: 10, color: toastErr ? '#ff375f' : '#30d158', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {toastErr ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {toast}
        </motion.div>
      )}

      {/* Withdrawal Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 32px', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 800, margin: '0 0 20px' }}>Request Withdrawal</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Amount (SCT)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" min="1" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100" style={S} />
              <button onClick={() => setAmount(String(balance))}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,159,10,0.15)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: 6, color: '#ff9f0a', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px' }}>
                MAX
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Ethereum Wallet Address</label>
            <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x..." style={S} />
          </div>

          {/* Warning */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: 10 }}>
            <AlertCircle size={14} color="#ff9f0a" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Withdrawals are processed via the StoraChain smart contract. Ensure your wallet address is correct — transfers cannot be reversed.
            </p>
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleRequest} disabled={sending || !amount || !wallet}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: sending ? 'rgba(255,255,255,0.04)' : 'rgba(255,159,10,0.15)', border: `1px solid ${sending ? 'rgba(255,255,255,0.1)' : 'rgba(255,159,10,0.4)'}`, borderRadius: 12, color: sending ? 'rgba(255,255,255,0.3)' : '#ff9f0a', cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem' }}>
            <ArrowDownLeft size={16} /> {sending ? 'Submitting…' : 'Request Withdrawal'}
          </motion.button>
        </div>
      </motion.div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 800, margin: 0 }}>Withdrawal History</h2>
        </div>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 28px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {['Wallet', 'Amount', 'Status', 'Date'].map((h, i) => (
            <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '32px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading history…</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <ArrowDownLeft size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 8 }} />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No withdrawals yet</div>
          </div>
        ) : (
          history.map((w, i) => (
            <div key={w._id || i}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: '0.82rem', color: '#2997ff', fontWeight: 600 }}>
                {w.walletAddress?.slice(0, 10)}…{w.walletAddress?.slice(-6)}
                {w.txHash && (
                  <a href={`https://sepolia.etherscan.io/tx/${w.txHash}`} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: 'rgba(41,151,255,0.5)', textDecoration: 'none' }}>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ff9f0a' }}>{w.amountSCT} SCT</div>
              <div><StatusBadge status={w.status} /></div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>{fmt(w.createdAt)}</div>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
