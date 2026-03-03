import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useSpring } from "framer-motion";
import { HardDrive, UserPlus } from "lucide-react";
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

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "seeker" });
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
      await axios.post("http://localhost:5000/api/auth/register", form);
      setSuccess("Node registered successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const cardV = { hidden: { opacity: 0, y: 40, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <div className="auth-page">
      <StarCanvas />
      <motion.div className="auth-blob" style={{ x: springX, y: springY }} />

      <div className="auth-logo" onClick={() => navigate("/")}>
        <HardDrive size={20} color="#bf5af2" /> StoraChain
      </div>

      <motion.div className="auth-card" variants={cardV} initial="hidden" animate="show">
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
              <option value="seeker">Storage Seeker - I want to store files</option>
              <option value="provider">Storage Provider - I want to earn</option>
            </select>
          </div>
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
