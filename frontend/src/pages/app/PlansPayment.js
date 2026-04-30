import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Coins, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../api/client';

const METHOD_LABELS = {
  token:    'SCT Tokens',
  demo_usd: 'Demo USD',
  stripe:   'Stripe Card',
};

export default function PlansPayment({ refreshUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [plans, setPlans] = useState([]);
  const [myPlan, setMyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState(location.state?.paymentMethod || 'token');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const planId = location.state?.planId;

  useEffect(() => {
    if (!planId) {
      navigate('/app/plans', { replace: true });
      return;
    }

    Promise.all([
      api.get('/plans'),
      api.get('/plans/my-plan'),
    ])
      .then(([plansRes, myRes]) => {
        setPlans(plansRes.data?.plans || []);
        setMyPlan(myRes.data || null);
      })
      .catch(() => setErr('Failed to load payment information.'))
      .finally(() => setLoading(false));
  }, [planId, navigate]);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);

  const updateLocalUser = (wallet, selected) => {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({
      ...stored,
      plan: selected.id,
      storageQuotaGB: selected.storageGB,
      demoUSD: wallet.demoUSD,
      sctBalance: wallet.sctBalance,
    }));
  };

  const completeSubscription = async (paymentMethod) => {
    const res = await api.post('/plans/subscribe', { planId, paymentMethod });
    updateLocalUser(res.data.wallet, selectedPlan);
    if (refreshUser) refreshUser();
    setMsg(res.data.message || 'Plan updated successfully.');
    setTimeout(() => navigate('/app/plans'), 1000);
  };

  const handlePay = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setErr('');
    setMsg('');

    try {
      if (method === 'token' || method === 'demo_usd') {
        await completeSubscription(method);
      } else {
        const intentRes = await api.post('/plans/create-payment-intent', { planId });
        const txId = intentRes.data?.txId;
        if (!txId) throw new Error('Stripe payment initialization failed.');
        await api.post('/plans/confirm-stripe-payment', { txId });
        await completeSubscription('stripe');
      }
    } catch (e) {
      setErr(e.response?.data?.message || e.message || 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.5)', padding: '50px 0', textAlign: 'center' }}>
        Loading payment page...
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div style={{ color: '#ff375f', padding: '50px 0', textAlign: 'center' }}>
        Selected plan was not found.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <button
        onClick={() => navigate('/app/plans')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
          color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
        }}
      >
        <ArrowLeft size={13} /> Back to Plans
      </button>

      <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Payment</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>Complete payment to switch to {selectedPlan.name}.</p>

      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        style={{
          marginTop: 16, padding: '18px 20px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
        }}
      >
        <div style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 800, marginBottom: 10 }}>{selectedPlan.name} Plan</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.84rem', marginBottom: 6 }}>${selectedPlan.priceUSD}/month or {selectedPlan.priceSCT} SCT/month</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>Current balances: {(myPlan?.wallet?.sctBalance ?? 0)} SCT, ${(myPlan?.wallet?.demoUSD ?? 0).toFixed(2)} Demo USD</div>
      </motion.div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <button
          onClick={() => setMethod('token')}
          style={{
            padding: '12px', background: method === 'token' ? 'rgba(255,159,10,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${method === 'token' ? 'rgba(255,159,10,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, color: method === 'token' ? '#ff9f0a' : 'rgba(255,255,255,0.5)',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Coins size={14} /> {METHOD_LABELS.token}
        </button>
        <button
          onClick={() => setMethod('demo_usd')}
          style={{
            padding: '12px', background: method === 'demo_usd' ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${method === 'demo_usd' ? 'rgba(48,209,88,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, color: method === 'demo_usd' ? '#30d158' : 'rgba(255,255,255,0.5)',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <CreditCard size={14} /> {METHOD_LABELS.demo_usd}
        </button>
        <button
          onClick={() => setMethod('stripe')}
          style={{
            padding: '12px', background: method === 'stripe' ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${method === 'stripe' ? 'rgba(41,151,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, color: method === 'stripe' ? '#2997ff' : 'rgba(255,255,255,0.5)',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <CreditCard size={14} /> {METHOD_LABELS.stripe}
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 14, color: '#30d158', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={14} /> {msg}
        </div>
      )}
      {err && (
        <div style={{ marginTop: 14, color: '#ff375f', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={submitting}
        style={{
          marginTop: 18, width: '100%', padding: '12px',
          background: 'rgba(41,151,255,0.15)', border: '1px solid rgba(41,151,255,0.4)',
          borderRadius: 10, color: '#2997ff', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}
      >
        {submitting ? <><Loader2 size={14} /> Processing...</> : `Pay with ${METHOD_LABELS[method]}`}
      </button>
    </div>
  );
}
