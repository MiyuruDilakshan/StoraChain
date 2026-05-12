const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const dns = require("dns");
const cors = require("cors");

// Fix for transient DNS ENOTFOUND issues in restricted environments
dns.setServers(['8.8.8.8', '1.1.1.1']);
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

dotenv.config({ path: path.join(__dirname, ".env") });

connectDB();

const app = express();

// Rate limiting — 100 requests per 15 minutes per IP (skip for localhost in dev)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => process.env.NODE_ENV !== 'production' &&
    (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
});
app.use(limiter);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:19006',
  'https://storachain.miyuru.dev',
  'https://www.storachain.miyuru.dev',
  // Vercel preview deployments (any branch)
  /^https:\/\/storachain.*\.vercel\.app$/,
  // Allow origin from FRONTEND_URL env var (set on VPS)
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    allowed ? callback(null, true) : callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

app.get("/", (req, res) => {
  res.send("StoraChain API Running");
});

app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/plans",       require("./routes/planRoutes"));
app.use("/api/providers",   require("./routes/providerRoutes"));
app.use("/api/storage",     require("./routes/storageRoutes"));
app.use("/api/ai",          require("./routes/aiRoutes"));
app.use("/api/profile",     require("./routes/profileRoutes"));
app.use("/api/analytics",   require("./routes/analyticsRoutes"));
app.use("/api/marketplace", require("./routes/marketplaceRoutes"));
app.use("/api/withdraw",    require("./routes/withdrawRoutes"));
app.use("/api/admin",       require("./routes/adminRoutes"));
app.use("/api/abuse",       require("./routes/abuseRoutes"));

// ─── Background jobs ─────────────────────────────────────────────────────────
// Replication monitor: checks chunk health and re-replicates if a provider goes
// offline. Interval controlled by REPLICATION_INTERVAL_MINUTES env var (default 60).
require("./jobs/replicationMonitor");
// Reward distribution: runs at midnight UTC, mints SCT for active storage providers.
require("./jobs/rewardDistributionJob");
// Offline penalty detector: runs every 60s to penalize unresponsive nodes.
const StorageListing = require("./models/StorageListing");
const { applyOfflinePenalties } = require("./services/penaltyService");
setInterval(() => applyOfflinePenalties(StorageListing), 60 * 1000);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

