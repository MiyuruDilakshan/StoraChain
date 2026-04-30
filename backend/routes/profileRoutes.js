const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route GET /api/profile
// @desc  Get own profile
// @access Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/profile
// @desc  Update profile fields
// @access Private
router.put('/', authMiddleware, async (req, res) => {
  const { name, bio, walletAddress, pricePerGB, totalStorageGB, avatarColor } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name          !== undefined) user.name           = name.trim();
    if (bio           !== undefined) user.bio            = bio.trim();
    if (walletAddress !== undefined) user.walletAddress  = walletAddress.trim();
    if (pricePerGB    !== undefined) user.pricePerGB     = Number(pricePerGB);
    if (totalStorageGB!== undefined) user.totalStorageGB = Number(totalStorageGB);
    if (avatarColor   !== undefined) user.avatarColor    = avatarColor;

    await user.save();
    res.json({ message: 'Profile updated', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    console.error('[Profile] Update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/profile/password
// @desc  Change password
// @access Private
router.put('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/profile/sct
// @desc  Internal: adjust SCT balance (used by marketplace and reward systems)
// @access Private
router.put('/sct', authMiddleware, async (req, res) => {
  const { delta } = req.body; // positive = add, negative = deduct
  if (delta === undefined) return res.status(400).json({ message: 'delta is required' });
  try {
    const user = await User.findById(req.user.id);
    const newBalance = (user.sctBalance || 0) + Number(delta);
    if (newBalance < 0) return res.status(400).json({ message: 'Insufficient SCT balance' });
    user.sctBalance = newBalance;
    await user.save();
    res.json({ sctBalance: user.sctBalance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
