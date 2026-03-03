import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { HardDrive, ChevronRight, Database, Shield, Cpu, Coins, ArrowUpRight } from "lucide-react";
import "./Landing.css";

/* --- Star Field Canvas --- */
function StarCanvas() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const stars = Array.from({ length: 250 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.2,
      speed: Math.random() * 0.2 + 0.05,
      opacity: Math.random() * 0.7 + 0.1,
    }));

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
        ctx.fill();
        s.y -= s.speed;
        if (s.y + s.r < 0) { s.y = canvas.height + s.r; s.x = Math.random() * canvas.width; }
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafRef.current); };
  }, []);
  
  return <canvas ref={canvasRef} className="star-canvas" />;
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
    let start = 0;
    const step = Math.ceil(to / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); } else setCount(start);
    }, 20);
    return () => clearInterval(timer);
  }, [started, to]);
  
  return <span ref={ref}>{count}{suffix}</span>;
}

/* --- Scroll-Driven Text Reveal --- */
const RevealWord = ({ children, progress, range, isHighlight }) => {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", opacity: 0.15, color: isHighlight ? "transparent" : "inherit" }}>{children}</span>
      <motion.span style={{ opacity }} className={isHighlight ? "grad-accent" : "txt-light"}>{children}</motion.span>
    </span>
  );
};

const ScrollQuote = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "center 45%"] });
  const text = "Centralized giants built empires on your data. StoraChain shifts the paradigm, returning ownership, privacy, and economic power back to the users.";
  const words = text.split(" ");
  return (
    <div ref={ref} className="quote-text" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "14px", rowGap: "8px", margin: 0 }}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + (1 / words.length);
        const isHighlight = i >= words.length - 4; // highlights "back to the users."
        return <RevealWord key={i} progress={scrollYProgress} range={[start, end]} isHighlight={isHighlight}>{word}</RevealWord>;
      })}
    </div>
  );
};


/* --- Data --- */
const TICKERS = [
  "Zero-Knowledge Proofs", "AI Matchmaking", "Ethereum", "Decentralized Nodes",
  "AES-256 Encryption", "Smart Contracts", "P2P Sharding", "Token Economy",
  "99.9% Availability", "Quantum Resistance", "Interplanetary File System",
  "Cost Effective", "Zero-Knowledge Proofs", "AI Matchmaking", "Ethereum"
];

const FEATS = [
  { icon: <Cpu size={26} color="#bf5af2"/>, title: "AI Matchmaking Engine", desc: "Machine learning algorithms instantly pair seekers with optimal geographic storage providers — scoring latency, reliability, and cost in real time.", color: "#bf5af2", span: "wide" },
  { icon: <Shield size={26} color="#2997ff"/>, title: "Quantum-Safe Encryption", desc: "Military-grade AES-256 sharding with quantum-resistant keys. Your files are fragmented across global nodes.", color: "#2997ff", span: "narrow" },
  { icon: <Coins size={26} color="#ff9f0a"/>, title: "Tokenized Economy", desc: "Earn rewards for hosting. Spend tokens for storage. A self-sustaining micro-payment ecosystem leveraging intelligent contracts.", color: "#ff9f0a", span: "half" },
  { icon: <Database size={26} color="#30d158"/>, title: "P2P Sharded Network", desc: "True peer-to-peer storage with automated geographic redundancy. Zero single points of failure.", color: "#30d158", span: "half" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [navStuck, setNavStuck] = useState(false);
  
  // Custom cursor logic
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });
  const springConfig = { stiffness: 45, damping: 15, mass: 0.2 };
  const springX = useSpring(mouse.x, springConfig);
  const springY = useSpring(mouse.y, springConfig);

  // Advanced Global Scroll Effects
  const { scrollYProgress } = useScroll();
  const progressBarX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  
  // Hero Exit transforms
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.85]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const heroBlur = useTransform(scrollYProgress, [0, 0.15], ["blur(0px)", "blur(12px)"]);

  // CTA Section transforms
  const ctaRef = useRef(null);
  const { scrollYProgress: ctaProgress } = useScroll({ target: ctaRef, offset: ["start end", "end end"] });
  const ctaScale = useTransform(ctaProgress, [0, 1], [0.85, 1]);

  useEffect(() => {
    const onMouseMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    const onScroll = () => setNavStuck(window.scrollY > 50);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("scroll", onScroll); };
  }, []);

  const scrollTo = useCallback((id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), []);

  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <div style={{ background: "#000", position: "relative", overflow: "hidden" }}>
      
      {/* Scroll Progress Bar at the top */}
      <motion.div style={{ scaleX: progressBarX, position: 'fixed', top: 0, left: 0, right: 0, height: 3, transformOrigin: "0%", background: "linear-gradient(90deg, #bf5af2, #2997ff, #30d158)", zIndex: 9999 }} />

      <StarCanvas />

      {/* Cursor Blob */}
      <motion.div className="global-cursor-blob" style={{ x: springX, y: springY }} />

      {/* -- Navbar -- */}
      <nav className={`sc-nav ${navStuck ? "stuck" : ""}`}>
        <div className="sc-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <HardDrive className="sc-logo-icon" size={24} color="#fff" /> StoraChain
        </div>
        <div className="sc-nav-links">
          <a onClick={() => scrollTo("features")}>Architecture</a>
          <a onClick={() => scrollTo("stats")}>Network Metrics</a>
          <a onClick={() => scrollTo("economy")}>Token Economy</a>
        </div>
        <div className="sc-nav-actions">
          <button className="btn-ghost" onClick={() => navigate("/login")}>Sign In</button>
          <button className="btn-solid" onClick={() => navigate("/register")}>Initialize Node</button>
        </div>
      </nav>

      {/* -- Hero -- */}
      <section className="hero-wrap">
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ y: heroY, opacity: heroOpacity, scale: heroScale, filter: heroBlur, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          <motion.div variants={fadeUp} className="hero-pill">
            <span className="dot-pulse" /> Network Alpha Online
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="hero-h1">
            <span className="text-shimmer">Unleash</span> the grid.<br />
            <span className="grad-accent">Own your data.</span>
          </motion.h1>
          
          <motion.p variants={fadeUp} className="hero-sub">
            StoraChain is an AI-powered blockchain storage mesh. Monetize your unused disk space, or access a global decentralised cloud up to 70% cheaper than AWS S3.
          </motion.p>
          
          <motion.div variants={fadeUp} className="hero-actions">
            <button className="btn-cta-main" onClick={() => navigate("/register")}>
              Deploy Node <ChevronRight size={20} />
            </button>
            <button className="btn-cta-ghost" onClick={() => scrollTo("features")}>
              Explore Architecture
            </button>
          </motion.div>
          
        </motion.div>
        
        <div className="hero-scroll-hint">
          <div className="scroll-line" />
        </div>
      </section>

      {/* -- Marquee Ticker -- */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {TICKERS.map((t, i) => (
            <span key={i} className="ticker-item">{t} <span style={{ width: 4, height: 4, background: "#6e6e73", borderRadius: "50%", margin: "0 10px" }} /></span>
          ))}
        </div>
      </div>

      {/* -- Statement Quote -- */}
      <section className="quote-section">
        {/* Antigravity Style Text Scroll Fill */}
        <ScrollQuote />
      </section>

      {/* -- Features Bento Grid -- */}
      <section id="features" className="bento-section">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 2%" }}>
          <motion.p className="sc-eyebrow" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>Core Architecture</motion.p>
          <motion.h2 className="sc-heading grad-text" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
            Intelligently Distributed.
          </motion.h2>
          
          <div className="bento-grid">
            {FEATS.map((f, i) => (
              <motion.div key={i} className={`b-card ${f.span}`} onMouseMove={handleCardMouseMove}
                initial={{ opacity: 0, y: 80, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
              >
                <div className="b-content">
                  <div className="b-icon">{f.icon}</div>
                  <h3 className="b-title">{f.title}</h3>
                  <p className="b-desc">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Stats Bar -- */}
      <div id="stats" className="stats-bar">
        {[{ n: 70, s: "%", label: "Cost Mitigation" }, { n: 99.9, s: "%", label: "Availability Target" }, { n: 10000, s: "+", label: "Global Nodes" }, { n: 256, s: "-Bit", label: "AES Encryption" }].map((st, i) => (
          <div key={i} className="stat-item">
            <span className="stat-num grad-accent"><Counter to={st.n} suffix={st.s} /></span>
            <span className="stat-label">{st.label}</span>
          </div>
        ))}
      </div>

      {/* -- CTA -- */}
      <section id="economy" className="cta-section">
        <motion.div ref={ctaRef} style={{ scale: ctaScale }} className="cta-card">
          <p className="sc-eyebrow" style={{ color: "#a1a1aa", marginBottom: 20 }}>Ready for Liftoff</p>
          <h2 className="cta-h">Stop Paying.<br /><span className="grad-accent">Start Earning.</span></h2>
          <p className="cta-sub">Join the grid today. Become a provider to earn native tokens, or connect as a seeker for blazing-fast secure storage.</p>
          <div className="hero-actions">
            <button className="btn-cta-main" onClick={() => navigate("/register")}>
              Launch Node <ArrowUpRight size={22} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* -- Footer -- */}
      <footer className="sc-footer">
        <div className="footer-inner">
          <div className="footer-col">
            <div className="footer-logo"><HardDrive size={20} color="#fff" /> StoraChain</div>
            <div className="footer-text" style={{ maxWidth: 300, lineHeight: 1.5, marginTop: 10 }}>
              The decentralized storage mesh network powered by artificial intelligence and cryptographic proofs.
            </div>
          </div>
          
          <div className="footer-col">
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>Platform</div>
            <div className="footer-links" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span onClick={() => scrollTo("features")}>Architecture</span>
              <span onClick={() => scrollTo("stats")}>Metrics</span>
              <span onClick={() => scrollTo("economy")}>Tokenomics</span>
            </div>
          </div>
          
          <div className="footer-col">
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>Nodes</div>
            <div className="footer-links" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span onClick={() => navigate("/register")}>Deploy Node</span>
              <span onClick={() => navigate("/login")}>Console Login</span>
              <span>Documentation</span>
            </div>
          </div>
        </div>
        
        <div className="footer-inner footer-bottom" style={{ maxWidth: 1400, margin: "0 auto", marginTop: 60 }}>
          <div className="footer-text">
            © {new Date().getFullYear()} StoraChain. All rights reserved.
          </div>
          <div className="footer-text">
            BSc (Hons) Software Engineering • Plymouth University • 10952709
          </div>
        </div>
      </footer>
    </div>
  );
}
