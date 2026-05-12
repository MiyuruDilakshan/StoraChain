import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useSpring } from "framer-motion";
import { HardDrive, UserPlus, Check } from "lucide-react";
import axios from "axios";
import "./Auth.css";

function StarCanvas() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.0 + 0.2, speed: Math.random() * 0.2 + 0.03,
      opacity: Math.random() * 0.6 + 0.2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`; ctx.fill();
        s.y -= s.speed; if (s.y + s.r < 0) { s.y = canvas.height + s.r; s.x = Math.random() * canvas.width; }
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafRef.current); };
  }, []);
  return <canvas ref={canvasRef} className="star-canvas" />;
}

const PLANS = [
  {
    id: 'free', name: 'Free', storageGB: 2, maxUploadMB: 100,
    priceUSD: 0, priceSCT: 0,
    features: ['2 GB storage', '100 MB max upload', '$50 demo USD + 100 SCT'],
    color: '#30d158', highlight: false,
  },
  {
    id: 'basic', name: 'Basic', storageGB: 50, maxUploadMB: 1024,
    priceUSD: 5, priceSCT: 100,
    features: ['50 GB storage', '1 GB max upload', 'Priority matching'],
    color: '#2997ff', highlight: false,
  },
  {
    id: 'pro', name: 'Pro', storageGB: 200, maxUploadMB: 5120,
    priceUSD: 15, priceSCT: 300,
    features: ['200 GB storage', '5 GB max upload', 'Analytics'],
    color: '#bf5af2', highlight: true,
  },
  {
    id: 'premium', name: 'Premium', storageGB: 1024, maxUploadMB: 20480,
    priceUSD: 50, priceSCT: 1000,
    features: ['1 TB storage', '20 GB max upload', 'Custom SLA'],
    color: '#ff9f0a', highlight: false,
  },
];

function PlanCard({ plan, selected, onSelect }) {
  return (
    <motion.div
      onClick={() => onSelect(plan.id)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        cursor: 'pointer', borderRadius: 12, padding: '14px 16px',
        border: `1.5px solid ${selected ? plan.color : 'rgba(255,255,255,0.1)'}`,
        background: selected ? `${plan.color}10` : 'rgba(255,255,255,0.03)',
        transition: 'all 0.2s', position: 'relative',
      }}
    >
      {plan.highlight && (
        <div style={{
          position: 'absolute', top: -8, right: 10,
          background: plan.color, color: '#000',
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
          padding: '2px 8px', borderRadius: 20,
        }}>POPULAR</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: selected ? plan.color : '#fff' }}>{plan.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{plan.storageGB >= 1024 ? `${plan.storageGB / 1024} TB` : `${plan.storageGB} GB`}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {plan.priceUSD === 0 ? (
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#30d158' }}>Free</div>
          ) : (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>${plan.priceUSD}<span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>{plan.priceSCT} SCT/mo</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
            <Check size={10} color={plan.color} /> {f}
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, borderRadius: '50%', background: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={9} color="#000" />
        </div>
      )}
    </motion.div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "seeker", plan: "free" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const springX = useSpring(mouse.x, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouse.y, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const mo = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mo);
    return () => window.removeEventListener("mousemove", mo);
  }, []);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError("Please fill in all required fields."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/register`, form);
      const planName = PLANS.find(p => p.id === form.plan)?.name || 'Free';
      setSuccess(`Registered on the ${planName} plan! Redirecting to login...`);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const cardV = { hidden: { opacity: 0, y: 40, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } };
  const isSeeker = form.role === 'seeker';

  return (
    <div className="auth-page">
      <StarCanvas />
      <motion.div className="auth-blob" style={{ x: springX, y: springY }} />

      <div className="auth-logo" onClick={() => navigate("/")}>
        <HardDrive size={20} color="#bf5af2" /> StoraChain
      </div>

      <motion.div className="auth-card" variants={cardV} initial="hidden" animate="show" style={{ maxWidth: isSeeker ? 520 : 440 }}>
        <p className="auth-card-eyebrow">Join the Network</p>
        <h1 className="auth-card-title grad-text">Initialize<br />Your Node.</h1>
        <p className="auth-card-sub">Become a provider and earn tokens, or connect as a seeker for affordable, decentralized storage.</p>

        {error && <div className="auth-alert error">{error}</div>}
        {success && <div className="auth-alert success">{success}</div>}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="auth-field">
            <label className="auth-label">Full Name</label>
            <input name="name" type="text" value={form.name} onChange={handleChange}
              className="auth-input" placeholder="Miyuru Dilakshan" autoComplete="name" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="auth-input" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange}
              className="auth-input" placeholder="Min. 6 characters" autoComplete="new-password" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Node Role</label>
            <select name="role" value={form.role} onChange={handleChange} className="auth-select">
              <option value="seeker">Storage Seeker — I want to store files</option>
              <option value="provider">Storage Provider — I want to earn</option>
            </select>
          </div>

          {/* Plan selection — only for seekers */}
          {isSeeker && (
            <div className="auth-field">
              <label className="auth-label" style={{ marginBottom: 10 }}>
                Choose Your Plan
                <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 8, textTransform: 'none' }}>
                  Free plan includes demo funds for testing
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PLANS.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={form.plan === plan.id}
                    onSelect={(id) => setForm(f => ({ ...f, plan: id }))}
                  />
                ))}
              </div>
              {form.plan === 'free' && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 8, fontSize: '0.72rem', color: 'rgba(48,209,88,0.8)' }}>
                  Free plan gives you <strong>$50 demo USD</strong> + <strong>100 demo SCT</strong> to test subscriptions and payments.
                </div>
              )}
            </div>
          )}

          <motion.button type="submit" className="auth-btn" disabled={loading || !!success}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {loading ? "Registering Node..." : <><UserPlus size={18} /> Register Node</>}
          </motion.button>
        </form>

        <div className="auth-divider" />
        <div className="auth-footer">
          Already on the network?{" "}
          <span onClick={() => navigate("/login")}>Sign in here</span>
        </div>
      </motion.div>

      <div className="auth-back">StoraChain</div>
    </div>
  );
}
