import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useSpring } from "framer-motion";
import { HardDrive, LogIn } from "lucide-react";
import axios from "axios";
import "./Auth.css";

/* --- Reusable Star Canvas --- */
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

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const springX = useSpring(mouse.x, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouse.y, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (localStorage.getItem("token")) navigate("/app/dashboard");
    const mo = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mo);
    return () => window.removeEventListener("mousemove", mo);
  }, [navigate]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      // Route admins to the admin dashboard, others to the app
      if (res.data.user?.role === 'admin') {
        navigate("/admin");
      } else {
        navigate("/app/dashboard");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Please check credentials.");
    } finally { setLoading(false); }
  };

  const cardV = { hidden: { opacity: 0, y: 40, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <div className="auth-page">
      <StarCanvas />
      <motion.div className="auth-blob" style={{ x: springX, y: springY }} />

      {/* Logo bar */}
      <div className="auth-logo" onClick={() => navigate("/")}>
        <HardDrive size={20} color="#bf5af2" /> StoraChain
      </div>

      {/* Card */}
      <motion.div className="auth-card" variants={cardV} initial="hidden" animate="show">
        <p className="auth-card-eyebrow">Secure Access</p>
        <h1 className="auth-card-title grad-text">Welcome Back.</h1>
        <p className="auth-card-sub">Sign in to manage your storage nodes and tokens.</p>

        {error && <div className="auth-alert error">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="auth-input" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange}
              className="auth-input" placeholder="��������" autoComplete="current-password" />
          </div>
          <motion.button type="submit" className="auth-btn" disabled={loading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {loading ? "Authenticating..." : <><LogIn size={18} /> Access Node</>}
          </motion.button>
        </form>

        <div className="auth-divider" />
        <div className="auth-footer">
          No account?{" "}
          <span onClick={() => navigate("/register")}>Register as Provider or Seeker</span>
        </div>
      </motion.div>

      <div className="auth-back">StoraChain</div>
    </div>
  );
}
