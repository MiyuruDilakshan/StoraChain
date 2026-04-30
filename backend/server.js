const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

dotenv.config();

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:19006"] }));

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

