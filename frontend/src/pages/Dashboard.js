import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useSpring } from "framer-motion";
import { HardDrive, Database, Shield, Cpu, Coins, Zap, LogOut, Activity, Box, BarChart3 } from "lucide-react";

/* --- Star Canvas --- */
function StarCanvas() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 0.9 + 0.15, speed: Math.random() * 0.15 + 0.03,
      opacity: Math.random() * 0.5 + 0.15,
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
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* --- Animated Counter --- */
function Counter({ to, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let s = 0; const step = Math.max(1, Math.ceil(to / 60));
    const t = setInterval(() => { s += step; if (s >= to) { setCount(to); clearInterval(t); } else setCount(s); }, 18);
    return () => clearInterval(t);
  }, [started, to]);
  return <span ref={ref}>{count}{suffix}</span>;
}

const METRICS = [
  { icon: <Database size={26} color="#2997ff"/>, label: "Storage Allocated", value: <Counter to={256} suffix=" GB" />, sub: "Across 4 active shards", acc: "#2997ff" },
  { icon: <Activity size={26} color="#30d158"/>, label: "Network Uptime", value: <Counter to={99} suffix=".9%" />, sub: "Last 30 days", acc: "#30d158" },
  { icon: <Coins size={26} color="#ff9f0a"/>, label: "Tokens Earned", value: <Counter to={1240} suffix=" SCT" />, sub: "Pending payout: 340 SCT", acc: "#ff9f0a" },
  { icon: <Shield size={26} color="#bf5af2"/>, label: "Encryption Status", value: "AES-256", sub: "Quantum-resistant keys active", acc: "#bf5af2" },
  { icon: <Cpu size={26} color="#64d2ff"/>, label: "Active Nodes", value: <Counter to={12} suffix=" Nodes" />, sub: "3 in your region", acc: "#64d2ff" },
  { icon: <Zap size={26} color="#ff6369"/>, label: "Avg Latency", value: <Counter to={18} suffix=" ms" />, sub: "Optimized by AI router", acc: "#ff6369" },
];

const ACTIVITY = [
  { type: "SHARD_SYNC", msg: "Shard #4A2F synchronized across 3 nodes", time: "2 min ago", dot: "#30d158" },
  { type: "TOKEN_REWARD", msg: "Earned 12 SCT for hosting block batch", time: "18 min ago", dot: "#ff9f0a" },
  { type: "CONTRACT", msg: "Smart contract executed — storage lease renewed", time: "1 hr ago", dot: "#2997ff" },
  { type: "SECURITY", msg: "Zero-knowledge proof verified for seeker request", time: "3 hr ago", dot: "#bf5af2" },
  { type: "NODE_UP", msg: "New peer node connected from SG region", time: "5 hr ago", dot: "#64d2ff" },
];

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16,1,0.3,1] } } };

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const springX = useSpring(mouse.x, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouse.y, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    try { setUser(JSON.parse(localStorage.getItem("user"))); } catch {}
    const mo = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mo);
    return () => window.removeEventListener("mousemove", mo);
  }, [navigate]);

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  const isProvider = user?.role === "provider";

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000", fontFamily: "Inter, sans-serif" }}>
      <StarCanvas />
      <motion.div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(191,90,242,0.09) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none", zIndex: 1, translateX: "-50%", translateY: "-50%", x: springX, y: springY }} />

      {/* -- Top Navbar -- */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#fff", cursor: "pointer" }} onClick={() => navigate("/")}>
          <HardDrive size={20} color="#bf5af2" /> StoraChain
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: isProvider ? "rgba(48,209,88,0.2)" : "rgba(41,151,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: isProvider ? "#30d158" : "#2997ff" }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{user.name}</div>
                <div style={{ fontSize: "0.68rem", color: isProvider ? "#30d158" : "#2997ff", textTransform: "uppercase", letterSpacing: "0.08em" }}>{user.role}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,55,95,0.1)", border: "1px solid rgba(255,55,95,0.25)", borderRadius: 10, color: "#ff375f", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,55,95,0.2)"; e.currentTarget.style.borderColor="rgba(255,55,95,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,55,95,0.1)"; e.currentTarget.style.borderColor="rgba(255,55,95,0.25)"; }}>
            <LogOut size={14} /> Terminate Session
          </button>
        </div>
      </nav>

      {/* -- Main Content -- */}
      <main style={{ position: "relative", zIndex: 10, padding: "100px 40px 60px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", background: isProvider ? "rgba(48,209,88,0.08)" : "rgba(41,151,255,0.08)", border: `1px solid ${isProvider ? "rgba(48,209,88,0.2)" : "rgba(41,151,255,0.2)"}`, borderRadius: 100, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: isProvider ? "#30d158" : "#2997ff", marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isProvider ? "#30d158" : "#2997ff", animation: "pulse 2s infinite" }} />
            {isProvider ? "Provider Node" : "Storage Seeker"} — Active
          </div>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 900, letterSpacing: "-0.05em", color: "#fff", margin: 0, lineHeight: 1.1 }}>
            Welcome back,{" "}
            <span style={{ background: "linear-gradient(135deg,#bf5af2,#2997ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user?.name?.split(" ")[0] || "Node"}</span>.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "1rem", marginTop: 10, letterSpacing: "-0.01em" }}>
            Your StoraChain node is online. Real-time metrics below.
          </p>
        </motion.div>

        {/* Metrics Grid */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {METRICS.map((m, i) => (
            <motion.div key={i} variants={fadeUp}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 28px 24px", position: "relative", overflow: "hidden", cursor: "default" }}
              whileHover={{ borderColor: `${m.acc}40`, boxShadow: `0 0 30px ${m.acc}12` }} transition={{ duration: 0.3 }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${m.acc}14 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.acc}16`, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.icon}</div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{m.label}</span>
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1.1, marginBottom: 6 }}>{m.value}</div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.28)" }}>{m.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Activity Feed + Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          {/* Activity */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <BarChart3 size={18} color="#2997ff" />
              <h2 style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: 0 }}>Live Activity Feed</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {ACTIVITY.map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06, duration: 0.5 }}
                  style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: i < ACTIVITY.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "flex-start" }}>
                  <div style={{ marginTop: 6, width: 8, height: 8, borderRadius: "50%", background: a.dot, flexShrink: 0, boxShadow: `0 0 8px ${a.dot}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", color: a.dot, marginBottom: 3 }}>{a.type}</div>
                    <div style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{a.msg}</div>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", marginTop: 4 }}>{a.time}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <Box size={16} color="#bf5af2" />
                <h2 style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>Quick Actions</h2>
              </div>
              {[
                { label: "Upload Files", color: "#2997ff", bg: "rgba(41,151,255,0.12)" },
                { label: "Manage Nodes", color: "#30d158", bg: "rgba(48,209,88,0.12)" },
                { label: isProvider ? "Withdraw Tokens" : "Purchase Storage", color: "#ff9f0a", bg: "rgba(255,159,10,0.12)" },
                { label: "View Contracts", color: "#bf5af2", bg: "rgba(191,90,242,0.12)" },
              ].map((btn, i) => (
                <motion.button key={i} style={{ width: "100%", marginBottom: 8, padding: "12px 18px", background: btn.bg, border: `1px solid ${btn.color}28`, borderRadius: 12, color: btn.color, fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {btn.label}
                </motion.button>
              ))}
            </div>

            {/* Network Status Card */}
            <div style={{ background: "rgba(48,209,88,0.05)", border: "1px solid rgba(48,209,88,0.15)", borderRadius: 20, padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#30d158", display: "block" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Network Status</span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#30d158", letterSpacing: "-0.04em" }}>Operational</div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>All systems nominal · 0 incidents</div>
            </div>
          </motion.div>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: "center", marginTop: 60, fontSize: "0.75rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.03em" }}>
          StoraChain · BSc (Hons) Software Engineering · Plymouth University · 10952709
        </div>
      </main>
    </div>
  );
}
