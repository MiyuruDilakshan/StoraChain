import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Key, Wallet, Save, CheckCircle, AlertCircle, HardDrive, CreditCard, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const PLAN_COLORS = { free: '#30d158', basic: '#2997ff', pro: '#bf5af2', premium: '#ff9f0a' };
const PLAN_LABELS = { free: 'Free', basic: 'Basic', pro: 'Pro', premium: 'Premium' };

const AVATAR_COLORS = ['#bf5af2', '#2997ff', '#30d158', '#ff9f0a', '#ff375f', '#64d2ff'];

function Section({ title, icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 32px', marginBottom: 18 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        {icon}
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={value} onChange={onChange} placeholder={placeholder} rows={3}
          style={{
            width: '100%', padding: '11px 14px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e  => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
          onBlur={e   => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      ) : (
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder}
          style={{
            width: '100%', padding: '11px 14px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
            outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
          }}
          onFocus={e  => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
          onBlur={e   => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      )}
      {hint && <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function SaveBtn({ loading, label = 'Save Changes' }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      type="submit" disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 22px', borderRadius: 10,
        background: loading ? 'rgba(255,255,255,0.05)' : 'rgba(191,90,242,0.15)',
        border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(191,90,242,0.4)'}`,
        color: loading ? 'rgba(255,255,255,0.3)' : '#bf5af2',
        fontSize: '0.87rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.2s',
      }}
    >
      <Save size={15} /> {loading ? 'Saving...' : label}
    </motion.button>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const isOk = type === 'ok';
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px',
        background: isOk ? 'rgba(48,209,88,0.1)'  : 'rgba(255,55,95,0.1)',
        border: `1px solid ${isOk ? 'rgba(48,209,88,0.3)' : 'rgba(255,55,95,0.3)'}`,
        borderRadius: 10, marginBottom: 18,
        fontSize: '0.84rem', fontWeight: 600,
        color: isOk ? '#30d158' : '#ff375f',
      }}
    >
      {isOk ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {msg}
    </motion.div>
  );
}

export default function Profile({ user, refreshUser }) {
  const navigate   = useNavigate();
  const isProvider = user?.role === 'provider';

  // Profile form state
  const [name,           setName]           = useState(user?.name || '');
  const [bio,            setBio]            = useState(user?.bio || '');
  const [walletAddress,  setWalletAddress]  = useState(user?.walletAddress || '');
  const [avatarColor,    setAvatarColor]    = useState(user?.avatarColor || '#bf5af2');
  const [pricePerGB,     setPricePerGB]     = useState(user?.pricePerGB || 1);
  const [totalStorageGB, setTotalStorageGB] = useState(user?.totalStorageGB || 0);
  const [profLoading,    setProfLoading]    = useState(false);
  const [profToast,      setProfToast]      = useState({ msg: '', type: '' });

  // Password form state
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwLoading,  setPwLoading]  = useState(false);
  const [pwToast,    setPwToast]    = useState({ msg: '', type: '' });

  const [myPlan, setMyPlan] = useState(null);

  // Load fresh profile on mount
  useEffect(() => {
    api.get('/profile').then(r => {
      const u = r.data;
      setName(u.name || '');
      setBio(u.bio || '');
      setWalletAddress(u.walletAddress || '');
      setAvatarColor(u.avatarColor || '#bf5af2');
      setPricePerGB(u.pricePerGB || 1);
      setTotalStorageGB(u.totalStorageGB || 0);
    }).catch(() => {});

    if (!isProvider) {
      api.get('/plans/my-plan').then(r => setMyPlan(r.data)).catch(() => {});
    }
  }, [isProvider]);

  const showToast = (setter, msg, type) => {
    setter({ msg, type });
    setTimeout(() => setter({ msg: '', type: '' }), 4000);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return showToast(setProfToast, 'Name cannot be empty', 'err');
    setProfLoading(true);
    try {
      const { data } = await api.put('/profile', { name, bio, walletAddress, avatarColor, pricePerGB, totalStorageGB });
      // Update localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = { ...stored, name: data.user.name, bio: data.user.bio, walletAddress: data.user.walletAddress, avatarColor: data.user.avatarColor };
      localStorage.setItem('user', JSON.stringify(updated));
      if (refreshUser) refreshUser();
      showToast(setProfToast, 'Profile saved successfully!', 'ok');
    } catch (err) {
      showToast(setProfToast, err.response?.data?.message || 'Save failed', 'err');
    } finally {
      setProfLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) return showToast(setPwToast, 'New passwords do not match', 'err');
    if (newPw.length < 6)    return showToast(setPwToast, 'Password must be at least 6 characters', 'err');
    setPwLoading(true);
    try {
      await api.put('/profile/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast(setPwToast, 'Password changed successfully!', 'ok');
    } catch (err) {
      showToast(setPwToast, err.response?.data?.message || 'Password change failed', 'err');
    } finally {
      setPwLoading(false);
    }
  };

  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth: 760, position: 'relative', zIndex: 1 }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Profile Settings</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: '0.93rem' }}>Manage your identity, wallet, and security</p>
      </div>

      {/* Avatar preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '24px 28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, marginBottom: 18 }}
      >
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: avatarColor + '22', border: `3px solid ${avatarColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 900, color: avatarColor, flexShrink: 0 }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>{name || 'Your Name'}</div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>{user?.email} · {user?.role}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => setAvatarColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: avatarColor === c ? `3px solid #fff` : 'none', cursor: 'pointer', transition: 'all 0.15s' }} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Profile form */}
      <Section title="Personal Information" icon={<User size={18} color="#2997ff" />}>
        <Toast msg={profToast.msg} type={profToast.type} />
        <form onSubmit={handleProfileSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Full Name"    value={name}   onChange={e => setName(e.target.value)}   placeholder="Your full name" />
            <Field label="Email" value={user?.email || ''} onChange={() => {}} placeholder="" hint="Email cannot be changed" />
          </div>
          <Field label="Bio" type="textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio about yourself..." />
          <Field label="Wallet Address (MetaMask)" value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="0x..." hint="Used for SCT token withdrawals and on-chain transactions" />

          {/* Provider-specific */}
          {isProvider && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 24px' }}>
              <Field label="Storage Capacity (GB)" type="number" value={totalStorageGB} onChange={e => setTotalStorageGB(e.target.value)} placeholder="e.g. 50" hint="How much disk space you're offering" />
            </div>
          )}

          <SaveBtn loading={profLoading} />
        </form>
      </Section>

      {/* Password section */}
      <Section title="Change Password" icon={<Key size={18} color="#ff9f0a" />}>
        <Toast msg={pwToast.msg} type={pwToast.type} />
        <form onSubmit={handlePasswordChange}>
          <Field label="Current Password" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="New Password"     type="password" value={newPw}     onChange={e => setNewPw(e.target.value)}     placeholder="New password (min 6 chars)" />
            <Field label="Confirm Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" />
          </div>
          <SaveBtn loading={pwLoading} label="Update Password" />
        </form>
      </Section>

      {/* Wallet section */}
      <Section title="Wallet & Tokens" icon={<Wallet size={18} color="#ff9f0a" />}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, padding: '18px 20px', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>SCT Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ff9f0a', letterSpacing: '-0.04em' }}>{user?.sctBalance ?? 100} SCT</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>StoraChain Tokens (off-chain)</div>
          </div>
          <div style={{ flex: 1, padding: '18px 20px', background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Wallet</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2997ff', letterSpacing: '-0.01em', wordBreak: 'break-all' }}>
              {walletAddress || <span style={{ color: 'rgba(255,255,255,0.25)' }}>Not set — add above</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>StoraChain Network (MetaMask)</div>
          </div>
        </div>
      </Section>

      {/* Provider storage info */}
      {isProvider && (
        <Section title="Storage Node Info" icon={<HardDrive size={18} color="#30d158" />}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Your node configuration is saved here. Update your capacity and pricing above, then go to <strong style={{ color: '#30d158' }}>My Storage Node</strong> to activate/manage your listing.
          </div>
        </Section>
      )}

      {/* Seeker: subscription plan + demo wallet */}
      {!isProvider && (
        <Section title="Subscription Plan &amp; Wallet" icon={<CreditCard size={18} color="#bf5af2" />}>
          {myPlan ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
                {/* Plan */}
                <div style={{ padding: '16px 18px', background: `${PLAN_COLORS[myPlan.currentPlan?.id] || '#30d158'}08`, border: `1px solid ${PLAN_COLORS[myPlan.currentPlan?.id] || '#30d158'}25`, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Plan</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: PLAN_COLORS[myPlan.currentPlan?.id] || '#30d158' }}>{myPlan.currentPlan?.name || 'Free'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>{myPlan.planExpiresAt ? `Renews ${new Date(myPlan.planExpiresAt).toLocaleDateString()}` : 'No expiry'}</div>
                </div>
                {/* Demo USD */}
                <div style={{ padding: '16px 18px', background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 12 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={10} /> Demo USD</div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2997ff' }}>${(myPlan.wallet.demoUSD || 0).toFixed(2)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>Simulated USD</div>
                </div>
                {/* SCT */}
                <div style={{ padding: '16px 18px', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: 12 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>SCT Balance</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ff9f0a' }}>{myPlan.wallet.sctBalance} SCT</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>Demo tokens</div>
                </div>
              </div>
              {/* Storage quota bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Storage quota</span>
                  <span style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>{myPlan.usedStorageGB.toFixed(2)} / {myPlan.storageQuotaGB} GB</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${Math.min((myPlan.usedStorageGB / myPlan.storageQuotaGB) * 100, 100)}%`, background: PLAN_COLORS[myPlan.currentPlan?.id] || '#30d158', borderRadius: 4 }} />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/app/plans')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10,
                  background: 'rgba(191,90,242,0.12)', border: '1px solid rgba(191,90,242,0.35)',
                  color: '#bf5af2', fontSize: '0.86rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <CreditCard size={15} /> Manage Subscription
              </motion.button>
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading plan info...</div>
          )}
        </Section>
      )}
    </div>
  );
}
