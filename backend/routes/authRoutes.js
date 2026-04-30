const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { PLANS } = require("../config/plans");

// @route   POST /api/auth/register
// @desc    Register a new user (seekers can select a plan)
// @access  Public
router.post("/register", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { name, email, password, role, plan } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please provide name, email and password" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Resolve plan (seekers only; providers don't use subscription plans)
    const userRole = role || 'seeker';
    const selectedPlan = (userRole === 'seeker' && PLANS[plan]) ? PLANS[plan] : PLANS.free;

    const user = new User({
      name,
      email,
      password:       hashedPassword,
      role:           userRole,
      plan:           selectedPlan.id,
      storageQuotaGB: selectedPlan.storageGB,
      demoUSD:        selectedPlan.demoUSD ?? 50,
      sctBalance:     selectedPlan.demoSCT ?? 100,
    });

    await user.save();

    console.log(`[Auth] New ${userRole} registered: ${email} on ${selectedPlan.name} plan`);

    res.status(201).json({
      message: "User registered successfully",
      plan: selectedPlan.id,
      wallet: { demoUSD: user.demoUSD, sctBalance: user.sctBalance },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT
// @access  Public
router.post("/login", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: "Your account has been banned. Contact support." });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: "Your account is suspended. Contact support." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      token,
      user: {
        id:             user._id,
        name:           user.name,
        email:          user.email,
        role:           user.role,
        plan:           user.plan || 'free',
        storageQuotaGB: user.storageQuotaGB || 2,
        usedStorageGB:  user.usedStorageGB || 0,
        demoUSD:        user.demoUSD ?? 50,
        sctBalance:     user.sctBalance ?? 100,
        walletAddress:  user.walletAddress || '',
        avatarColor:    user.avatarColor || '#bf5af2',
        bio:            user.bio || '',
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/auth/admin-register
// @desc    Create an admin account (requires ADMIN_SECRET in body)
// @access  Semi-public (secret-gated)
router.post("/admin-register", async (req, res) => {
  const { name, email, password, adminSecret } = req.body || {};

  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Invalid admin secret" });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name, email, password: hashedPassword,
      role: 'admin',
      plan: 'premium',
      storageQuotaGB: 100,
      demoUSD: 10000,
      sctBalance: 100000,
      status: 'active',
    });
    await user.save();
    console.log(`[Auth] Admin account created: ${email}`);
    res.status(201).json({ message: "Admin account created successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/auth/me
// @desc    Return current authenticated user
// @access  Private
router.get("/me", require('../middleware/authMiddleware'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      id:             user._id,
      name:           user.name,
      email:          user.email,
      role:           user.role,
      plan:           user.plan || 'free',
      storageQuotaGB: user.storageQuotaGB || 2,
      usedStorageGB:  user.usedStorageGB || 0,
      demoUSD:        user.demoUSD ?? 50,
      sctBalance:     user.sctBalance ?? 100,
      walletAddress:  user.walletAddress || '',
      avatarColor:    user.avatarColor || '#bf5af2',
      bio:            user.bio || '',
      status:         user.status || 'active',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
