const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../frontend/src/pages/Landing.js');

const code = `import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, ChevronRight, Shield, Zap, Database, Coins, Globe, Lock, ArrowUpRight, Server, CheckCircle } from "lucide-react";
import "./Landing.css";

function StarCanvas() {
  const cvs = useRef(null), raf = useRef(null);
  useEffect(() => {
    const c = cvs.current, ctx = c.getContext("2d");
    const stars = Array.from({ length: 260 }, () => ({ x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, r: Math.random()*1.3+0.2, sp: Math.random()*0.22+0.04, o: Math.random()*0.7+0.1 }));
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const draw = () => { ctx.clearRect(0,0,c.width,c.height); stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=\`rgba(255,255,255,\${s.o})\`; ctx.fill(); s.y-=s.sp; if(s.y+s.r<0){s.y=c.height+s.r;s.x=Math.random()*c.width;} }); raf.current=requestAnimationFrame(draw); };
    draw();
    return () => { window.removeEventListener("resize",resize); cancelAnimationFrame(raf.current); };
  }, []);
  return <canvas ref={cvs} className="star-canvas" />;
}

function Counter({ to, suffix="" }) {
  const [n, setN] = useState(0); const ref = useRef(null); const [go, setGo] = useState(false);
  useEffect(() => { const o = new IntersectionObserver(([e]) => { if(e.isIntersecting && !go) setGo(true); },{threshold:0.5}); if(ref.current) o.observe(ref.current); return ()=>o.disconnect(); },[go]);
  useEffect(() => { if(!go) return; let v=0; const step=Math.ceil(to/60); const t=setInterval(()=>{v+=step;if(v>=to){setN(to);clearInterval(t);}else setN(v);},18); return()=>clearInterval(t); },[go,to]);
  return <span ref={ref}>{n}{suffix}</span>;
}

const FV = { hidden:{opacity:0,y:40}, show:{opacity:1,y:0,transition:{duration:0.7,ease:[0.16,1,0.3,1]}} };

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [blobPos, setBlobPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    const onMove = e => setBlobPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("mousemove", onMove); };
  }, []);

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#000", minHeight:"100vh", color:"#fff", overflowX:"hidden" }}>
      <StarCanvas />
      <div className="global-cursor-blob" style={{ left: blobPos.x, top: blobPos.y }} />

      {/* NAV */}
      <nav className={\`sc-nav\${scrolled?" stuck":""}\`}>
        <div className="sc-logo" onClick={()=>navigate("/")}>
          <div className="sc-logo-icon"><HardDrive size={22} color="#bf5af2"/></div>
          StoraChain
        </div>
        <div className="sc-nav-links">
          {[["How It Works","how"],["For Providers","providers"],["Marketplace","market"],["Pricing","pricing"]].map(([l,id])=>(
            <a key={id} onClick={()=>scrollTo(id)}>{l}</a>
          ))}
        </div>
        <div className="sc-nav-actions">
          <button className="btn-ghost" onClick={()=>navigate("/login")}>Sign In</button>
          <button className="btn-solid" onClick={()=>navigate("/register")}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"120px 5% 80px", position:"relative", zIndex:1 }}>
        <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.9,ease:[0.16,1,0.3,1]}}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(191,90,242,0.1)", border:"1px solid rgba(191,90,242,0.3)", borderRadius:40, padding:"6px 16px", marginBottom:32, fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#bf5af2" }}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#30d158",boxShadow:"0 0 8px #30d158",display:"inline-block"}}/>
            Network Live · Beta
          </div>

          <h1 style={{ fontSize:"clamp(2.8rem,7vw,5.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.05, margin:"0 0 24px" }}>
            Your Files.<br/>
            <span style={{ background:"linear-gradient(135deg,#bf5af2,#2997ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Decentralized. Encrypted. Owned.</span>
          </h1>

          <p style={{ fontSize:"clamp(1rem,2vw,1.25rem)", color:"rgba(255,255,255,0.5)", maxWidth:620, margin:"0 auto 48px", lineHeight:1.7 }}>
            StoraChain distributes your data across a global mesh of provider nodes using AI-driven placement, AES-256 encryption, and blockchain verification — giving you true data ownership.
          </p>

          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={()=>navigate("/register")} style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 32px", background:"linear-gradient(135deg,#bf5af2,#2997ff)", border:"none", borderRadius:12, color:"#fff", fontSize:"1rem", fontWeight:700, cursor:"pointer", boxShadow:"0 0 40px rgba(191,90,242,0.35)", transition:"all 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 50px rgba(191,90,242,0.5)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 0 40px rgba(191,90,242,0.35)";}}>
              Start Free <ArrowUpRight size={18}/>
            </button>
            <button onClick={()=>navigate("/login")} style={{ padding:"14px 32px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:12, color:"rgba(255,255,255,0.8)", fontSize:"1rem", fontWeight:600, cursor:"pointer", backdropFilter:"blur(10px)", transition:"all 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.09)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}}>
              Explore Marketplace
            </button>
          </div>
        </motion.div>

        {/* Floating stat pills */}
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8}}
          style={{ display:"flex", gap:16, marginTop:64, flexWrap:"wrap", justifyContent:"center" }}>
          {[["256-bit AES","Encryption"],["3× Redundancy","Replication"],["4-Tier Fallback","Recovery"],["SCT Token","Rewards"]].map(([v,l],i)=>(
            <div key={i} style={{ padding:"10px 20px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:40, backdropFilter:"blur(10px)" }}>
              <div style={{ fontSize:"0.85rem", fontWeight:800, color:"#fff" }}>{v}</div>
              <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em" }}>{l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* SCROLLING TICKER */}
      <div style={{ overflow:"hidden", borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"14px 0", position:"relative", zIndex:1 }}>
        <motion.div animate={{ x:[0,-1200] }} transition={{ duration:18, repeat:Infinity, ease:"linear" }}
          style={{ display:"flex", gap:48, whiteSpace:"nowrap", fontSize:"0.78rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)" }}>
          {["AI-Optimized Placement","AES-256 Encryption","P2P Sharding","Smart Contracts","Token Economy","99.9% Uptime","IPFS Backup","Blockchain Verified","Decentralized Nodes","SHA-256 Integrity",
            "AI-Optimized Placement","AES-256 Encryption","P2P Sharding","Smart Contracts","Token Economy","99.9% Uptime","IPFS Backup","Blockchain Verified","Decentralized Nodes","SHA-256 Integrity"].map((t,i)=>(
            <span key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>{t} <span style={{ color:"#bf5af2" }}>◆</span></span>
          ))}
        </motion.div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding:"120px 5%", position:"relative", zIndex:1 }}>
        <motion.div variants={FV} initial="hidden" whileInView="show" viewport={{once:true,margin:"-80px"}} style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#2997ff", marginBottom:16 }}>How It Works</div>
          <h2 style={{ fontSize:"clamp(2rem,4vw,3.2rem)", fontWeight:900, letterSpacing:"-0.04em", margin:0 }}>Simple for users.<br/><span style={{color:"rgba(255,255,255,0.4)"}}>Powerful underneath.</span></h2>
        </motion.div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, maxWidth:1100, margin:"0 auto" }}>
          {[
            { step:"01", icon:<Database size={22} color="#2997ff"/>, color:"#2997ff", title:"Upload Your File", desc:"Drag and drop any file. StoraChain automatically encrypts it with AES-256 and splits it into shards." },
            { step:"02", icon:<Server  size={22} color="#bf5af2"/>, color:"#bf5af2", title:"AI Distributes Shards", desc:"Our AI engine scores provider nodes on latency, uptime, and reputation, then places shards optimally." },
            { step:"03", icon:<Shield  size={22} color="#30d158"/>, color:"#30d158", title:"3× Redundancy", desc:"Each shard is replicated across 3 geographically diverse nodes with SHA-256 integrity verification." },
            { step:"04", icon:<Zap     size={22} color="#ff9f0a"/>, color:"#ff9f0a", title:"Instant Retrieval", desc:"Download triggers a 4-tier cascade: Provider Nodes → Replicas → IPFS → AWS S3. Always available." },
          ].map((c,i)=>(
            <motion.div key={i} variants={FV} initial="hidden" whileInView="show" viewport={{once:true,margin:"-60px"}} transition={{delay:i*0.1}}
              style={{ background:"rgba(255,255,255,0.03)", border:\`1px solid \${c.color}22\`, borderRadius:18, padding:"28px 26px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div style={{ width:44,height:44, borderRadius:12, background:c.color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>{c.icon}</div>
                <div style={{ fontSize:"2rem", fontWeight:900, color:c.color+"22", letterSpacing:"-0.05em" }}>{c.step}</div>
              </div>
              <h3 style={{ fontSize:"1rem", fontWeight:800, color:"#fff", margin:"0 0 10px" }}>{c.title}</h3>
              <p style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.45)", lineHeight:1.65, margin:0 }}>{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOR PROVIDERS */}
      <section id="providers" style={{ padding:"100px 5%", position:"relative", zIndex:1, background:"rgba(255,255,255,0.01)", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
          <motion.div variants={FV} initial="hidden" whileInView="show" viewport={{once:true}}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#30d158", marginBottom:16 }}>For Storage Providers</div>
            <h2 style={{ fontSize:"clamp(1.8rem,3.5vw,2.8rem)", fontWeight:900, letterSpacing:"-0.04em", margin:"0 0 20px" }}>Turn spare disk space into <span style={{color:"#30d158"}}>daily income.</span></h2>
            <p style={{ color:"rgba(255,255,255,0.45)", lineHeight:1.7, fontSize:"0.95rem", margin:"0 0 32px" }}>
              Install the StoraChain agent on any Windows or Linux machine. It runs silently in the background, serving file shards to seekers and earning you SCT tokens automatically.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {["One-click setup wizard — live in under 5 minutes","Configure disk space, region, and price freely","Dashboard shows real-time earnings, uptime, and traffic","Automatic rewards distributed every 24 hours"].map((t,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <CheckCircle size={16} color="#30d158" style={{flexShrink:0,marginTop:2}}/>
                  <span style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.6)", lineHeight:1.5 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>navigate("/register")} style={{ marginTop:36, display:"inline-flex", alignItems:"center", gap:8, padding:"12px 28px", background:"rgba(48,209,88,0.12)", border:"1px solid rgba(48,209,88,0.3)", borderRadius:10, color:"#30d158", fontSize:"0.9rem", fontWeight:700, cursor:"pointer" }}>
              Become a Provider <ChevronRight size={16}/>
            </button>
          </motion.div>
          <motion.div variants={FV} initial="hidden" whileInView="show" viewport={{once:true}}
            style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(48,209,88,0.15)", borderRadius:20, padding:"32px", display:"flex", flexDirection:"column", gap:16 }}>
            {[["Node Status","Online ● Active","#30d158"],["Stored Data","117.4 GB / 200 GB","#2997ff"],["Today's Earnings","12.4 SCT","#ff9f0a"],["Uptime","99.7%","#bf5af2"],["Connected Seekers","47","#fff"]].map(([l,v,c],i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:i<4?"1px solid rgba(255,255,255,0.05)":"none" }}>
                <span style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.4)", fontWeight:500 }}>{l}</span>
                <span style={{ fontSize:"0.9rem", fontWeight:800, color:c }}>{v}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* MARKETPLACE */}
      <section id="market" style={{ padding:"100px 5%", position:"relative", zIndex:1 }}>
        <motion.div variants={FV} initial="hidden" whileInView="show" viewport={{once:true}} style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#ff9f0a", marginBottom:16 }}>Marketplace</div>
          <h2 style={{ fontSize:"clamp(2rem,4vw,3.2rem)", fontWeight:900, letterSpacing:"-0.04em", margin:"0 0 16px" }}>Buy & sell files on-chain.</h2>
          <p style={{ color:"rgba(255,255,255,0.4)", maxWidth:560, margin:"0 auto", fontSize:"0.95rem", lineHeight:1.7 }}>List any file for sale with SCT tokens or USD. Buyers get instant access through the same encrypted retrieval pipeline.</p>
        </motion.div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, maxWidth:900, margin:"0 auto" }}>
          {[
            { icon:<Globe size={20} color="#2997ff"/>,  color:"#2997ff",  title:"Public Listings",   desc:"List files publicly for anyone to discover and purchase." },
            { icon:<Lock  size={20} color="#bf5af2"/>,  color:"#bf5af2",  title:"Private Sharing",   desc:"Share files directly with a specific wallet address." },
            { icon:<Coins size={20} color="#ff9f0a"/>,  color:"#ff9f0a",  title:"SCT Payments",      desc:"Pay with StoraChain tokens or demo USD — instant settlement." },
            { icon:<Shield size={20} color="#30d158"/>, color:"#30d158",  title:"Verified Downloads", desc:"Every download is cryptographically verified. No tampering." },
          ].map((c,i)=>(
            <motion.div key={i} variants={FV} initial="hidden" whileInView="show" viewport={{once:true}} transition={{delay:i*0.08}}
              style={{ background:"rgba(255,255,255,0.03)", border:\`1px solid \${c.color}22\`, borderRadius:16, padding:"24px 22px" }}>
              <div style={{ width:40,height:40, borderRadius:10, background:c.color+"15", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>{c.icon}</div>
              <h3 style={{ fontSize:"0.95rem", fontWeight:800, color:"#fff", margin:"0 0 8px" }}>{c.title}</h3>
              <p style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.4)", lineHeight:1.6, margin:0 }}>{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <div id="pricing" style={{ borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"60px 5%", position:"relative", zIndex:1, background:"rgba(255,255,255,0.01)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:32, maxWidth:900, margin:"0 auto", textAlign:"center" }}>
          {[{n:70,s:"%",l:"Cheaper vs Centralized"},{n:99.9,s:"%",l:"Availability SLA"},{n:256,s:"-bit",l:"AES Encryption"},{n:3,s:"×",l:"Shard Replication"}].map((st,i)=>(
            <div key={i}>
              <div style={{ fontSize:"2.8rem", fontWeight:900, letterSpacing:"-0.04em", background:"linear-gradient(135deg,#bf5af2,#2997ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                <Counter to={st.n} suffix={st.s}/>
              </div>
              <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.4)", marginTop:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>{st.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section style={{ padding:"120px 5%", position:"relative", zIndex:1, textAlign:"center" }}>
        <motion.div variants={FV} initial="hidden" whileInView="show" viewport={{once:true}}
          style={{ maxWidth:680, margin:"0 auto", padding:"64px 48px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:28, backdropFilter:"blur(20px)", boxShadow:"0 0 80px rgba(191,90,242,0.08)" }}>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#bf5af2", marginBottom:20 }}>Get Started Today</div>
          <h2 style={{ fontSize:"clamp(2rem,4vw,3rem)", fontWeight:900, letterSpacing:"-0.04em", margin:"0 0 20px" }}>
            Store smarter.<br/><span style={{background:"linear-gradient(135deg,#bf5af2,#2997ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Earn while you sleep.</span>
          </h2>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:"0.95rem", lineHeight:1.7, margin:"0 0 40px" }}>
            Join thousands of seekers uploading privately and providers earning daily rewards on the StoraChain network.
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={()=>navigate("/register")} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"14px 36px", background:"linear-gradient(135deg,#bf5af2,#2997ff)", border:"none", borderRadius:12, color:"#fff", fontSize:"1rem", fontWeight:700, cursor:"pointer", boxShadow:"0 0 40px rgba(191,90,242,0.3)" }}>
              Create Free Account <ArrowUpRight size={18}/>
            </button>
            <button onClick={()=>navigate("/login")} style={{ padding:"14px 36px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, color:"rgba(255,255,255,0.7)", fontSize:"1rem", fontWeight:600, cursor:"pointer" }}>
              Sign In
            </button>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"60px 5% 40px", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:48 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:"1.1rem", fontWeight:800, letterSpacing:"-0.02em", marginBottom:16 }}>
              <HardDrive size={20} color="#bf5af2"/> StoraChain
            </div>
            <p style={{ fontSize:"0.83rem", color:"rgba(255,255,255,0.3)", lineHeight:1.7, maxWidth:260 }}>
              The decentralized storage mesh network powered by AI, cryptographic proofs, and blockchain tokenomics.
            </p>
          </div>
          {[
            { title:"Platform", links:[["How It Works","how"],["Marketplace","market"],["Providers","providers"],["Pricing","pricing"]] },
            { title:"Account",  links:[["Sign In",null,()=>navigate("/login")],["Register",null,()=>navigate("/register")]] },
            { title:"Legal",    links:[["Terms of Service",null,null],["Privacy Policy",null,null]] },
          ].map(({title,links},i)=>(
            <div key={i}>
              <div style={{ fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,0.5)", marginBottom:20 }}>{title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {links.map(([label,id,fn],j)=>(
                  <span key={j} onClick={fn||(id?()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"}):undefined)}
                    style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.35)", cursor:"pointer", transition:"color 0.2s" }}
                    onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.35)"}>{label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ maxWidth:1100, margin:"48px auto 0", paddingTop:24, borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <span style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.2)" }}>© {new Date().getFullYear()} StoraChain. All rights reserved.</span>
          <span style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.2)" }}>BSc (Hons) Software Engineering · Plymouth University</span>
        </div>
      </footer>
    </div>
  );
}
`;

fs.writeFileSync(out, code, 'utf8');
console.log('Landing.js written:', out);
