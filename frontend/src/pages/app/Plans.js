import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Check, Zap, DollarSign, Coins,
  HardDrive, AlertCircle, CheckCircle, RefreshCw,
} from 'lucide-react';
import api from '../../api/client';

const PLAN_COLORS = {
  free:    '#30d158',
  basic:   '#2997ff',
  pro:     '#bf5af2',
  premium: '#ff9f0a',
};

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const isOk = type === 'ok';
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '12px 18px', marginBottom: 20,
        background: isOk ? 'rgba(48,209,88,0.1)' : 'rgba(255,55,95,0.1)',
        border: `1px solid ${isOk ? 'rgba(48,209,88,0.3)' : 'rgba(255,55,95,0.3)'}`,
        borderRadius: 12, fontSize: '0.86rem', fontWeight: 600,
        color: isOk ? '#30d158' : '#ff375f',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isOk ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        {msg}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}>×</button>
    </motion.div>
  );
}

function PlanCard({ plan, isCurrent, onSubscribe, loading }) {
  const color = PLAN_COLORS[plan.id] || '#bf5af2';
  const [payMethod, setPayMethod] = useState('stripe');

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ borderColor: color + '50' }}
      style={{
        background: isCurrent ? `${color}08` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isCurrent ? color + '60' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 20, padding: '28px 26px',
        position: 'relative', transition: 'all 0.25s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: color, color: '#000',
          fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.1em',
          padding: '3px 12px', borderRadius: 20,
        }}>{plan.badge}</div>
      )}
      {isCurrent && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: color + '20', border: `1px solid ${color}50`,
          borderRadius: 8, padding: '3px 10px',
          fontSize: '0.66rem', fontWeight: 700, color,
        }}>CURRENT</div>
      )}

      {/* Plan header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 900, color, marginBottom: 4 }}>{plan.name}</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{plan.description}</div>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 20 }}>
        {plan.priceUSD === 0 ? (
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
            Free <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>forever</span>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              ${plan.priceUSD}<span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/month</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              or {plan.priceSCT} SCT/month
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{ flex: 1, marginBottom: 22 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Check size={10} color={color} />
            </div>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Subscribe button */}
      {!isCurrent && (
        <div>
          {plan.priceUSD > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { val: 'stripe', label: 'Pay Stripe', icon: <DollarSign size={11} /> },
                { val: 'token', label: 'Pay SCT', icon: <Coins size={11} /> },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setPayMethod(opt.val)}
                  style={{
                    flex: 1, padding: '7px 4px',
                    background: payMethod === opt.val ? `${color}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${payMethod === opt.val ? color + '50' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, color: payMethod === opt.val ? color : 'rgba(255,255,255,0.4)',
                    fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => onSubscribe(plan.id, plan.priceUSD === 0 ? null : payMethod)}
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: `linear-gradient(135deg, ${color}25, ${color}15)`,
              border: `1px solid ${color}50`,
              borderRadius: 12, color,
              fontSize: '0.88rem', fontWeight: 800,
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {plan.priceUSD === 0 ? 'Switch to Free' : 'Continue to Payment'}
          </motion.button>
        </div>
      )}
      {isCurrent && (
        <div style={{
          padding: '12px', textAlign: 'center',
          background: color + '10', border: `1px solid ${color}30`,
          borderRadius: 12, fontSize: '0.86rem', fontWeight: 700, color,
        }}>
          Active Plan
        </div>
      )}
    </motion.div>
  );
}

export default function Plans({ user, refreshUser }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [myPlan, setMyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 5000);
  };

  const loadData = async () => {
    try {
      const [plansRes, myPlanRes] = await Promise.all([
        api.get('/plans'),
        api.get('/plans/my-plan'),
      ]);
      setPlans(plansRes.data.plans || []);
      setMyPlan(myPlanRes.data);
    } catch (err) {
      showToast('Failed to load plan data', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubscribe = async (planId, paymentMethod) => {
    const selectedPlan = plans.find((p) => p.id === planId);
    if (selectedPlan && selectedPlan.priceUSD > 0) {
      navigate('/app/plans/payment', {
        state: {
          planId,
          paymentMethod: paymentMethod || 'token',
        },
      });
      return;
    }

    setSubLoading(true);
    try {
      const res = await api.post('/plans/subscribe', { planId, paymentMethod });
      showToast(res.data.message, 'ok');
      // Update localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...stored,
        plan: planId,
        storageQuotaGB: res.data.plan.storageGB,
        demoUSD: res.data.wallet.demoUSD,
        sctBalance: res.data.wallet.sctBalance,
      }));
      await loadData();
      if (refreshUser) refreshUser();
    } catch (err) {
      showToast(err.response?.data?.message || 'Subscription failed', 'err');
    } finally {
      setSubLoading(false);
    }
  };

  const handleAddFunds = async () => {
    try {
      const res = await api.post('/plans/add-demo-funds');
      showToast(res.data.message, 'ok');
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, demoUSD: res.data.wallet.demoUSD, sctBalance: res.data.wallet.sctBalance }));
      await loadData();
      if (refreshUser) refreshUser();
    } catch {
      showToast('Failed to add funds', 'err');
    }
  };

  const color = PLAN_COLORS[myPlan?.currentPlan?.id] || '#2997ff';
  const usedPct = myPlan ? ((myPlan.usedStorageGB / myPlan.storageQuotaGB) * 100).toFixed(1) : 0;

  return (
    <div style={{ maxWidth: 1100, position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 14px',
          background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.2)',
          borderRadius: 100, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#bf5af2', marginBottom: 14,
        }}>
          <CreditCard size={12} /> Subscription Plans
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>
          Choose your plan
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: '0.95rem' }}>
          Pay with Stripe card checkout or SCT token balance.
        </p>
      </motion.div>

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: '' })} />

      {/* Current plan + wallet summary */}
      {myPlan && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 14, marginBottom: 32,
          }}
        >
          {/* Current plan card */}
          <div style={{ padding: '20px 22px', background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Current Plan</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color, marginBottom: 4 }}>{myPlan.currentPlan?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
              {myPlan.planExpiresAt ? `Renews ${new Date(myPlan.planExpiresAt).toLocaleDateString()}` : 'No expiry'}
            </div>
          </div>

          {/* Storage quota */}
          <div style={{ padding: '20px 22px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><HardDrive size={11} /> Storage Quota</div>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginBottom: 8 }}>
              {myPlan.usedStorageGB.toFixed(2)} / {myPlan.storageQuotaGB} GB
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
              <div style={{ height: '100%', width: `${Math.min(usedPct, 100)}%`, background: color, borderRadius: 4, transition: 'width 0.6s' }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>{usedPct}% used</div>
          </div>

          {/* Demo USD wallet */}
          <div style={{ padding: '20px 22px', background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.15)', borderRadius: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><DollarSign size={11} /> Demo USD Wallet</div>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#2997ff', marginBottom: 4 }}>
              ${myPlan.wallet.demoUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>Simulated USD balance</div>
          </div>

          {/* SCT wallet */}
          <div style={{ padding: '20px 22px', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Coins size={11} /> SCT Balance</div>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ff9f0a', marginBottom: 4 }}>
              {myPlan.wallet.sctBalance} SCT
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>StoraChain demo tokens</div>
          </div>
        </motion.div>
      )}

      {/* Add demo funds button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleAddFunds}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10,
            background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.25)',
            color: '#2997ff', fontSize: '0.83rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={13} /> Add Demo Funds (+$50 USD, +100 SCT)
        </motion.button>
        <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.2)' }}>Free to top-up during testing</span>
      </div>

      {/* Revenue split info */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{
          marginBottom: 28, padding: '16px 20px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Zap size={14} color="#ff9f0a" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Revenue distribution:</span>
        </div>
        {[
          { label: '70% → Providers', color: '#30d158' },
          { label: '20% → Platform reserve', color: '#2997ff' },
          { label: '10% → Infrastructure', color: '#ff9f0a' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Plan cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '60px 0' }}>Loading plans...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 18 }}>
          {plans.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <PlanCard
                plan={plan}
                isCurrent={myPlan?.currentPlan?.id === plan.id}
                onSubscribe={handleSubscribe}
                loading={subLoading}
              />
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 48, fontSize: '0.72rem', color: 'rgba(255,255,255,0.12)' }}>
        StoraChain · Plan billing via Stripe or SCT tokens · BSc (Hons) Software Engineering · Plymouth University
      </div>
    </div>
  );
}
