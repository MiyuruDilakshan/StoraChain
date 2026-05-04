const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AbuseReport = require('../models/AbuseReport');

router.get('/terms', (req, res) => {
  res.json({
    title: 'StoraChain Terms of Service',
    bullets: [
      'Users must not upload illegal, harmful, or prohibited content.',
      'Users are responsible for data they upload or share.',
      'StoraChain may suspend accounts involved in abuse or policy violations.',
      'Abuse reports are reviewed by admins and may be shared with authorities when legally required.',
    ],
    updatedAt: '2026-04-30',
  });
});

router.post('/report', authMiddleware, async (req, res) => {
  try {
    const { targetType, targetId, reason, evidenceUrl, evidenceImageName, evidenceImageDataUrl } = req.body || {};
    if (!targetType || !reason) {
      return res.status(400).json({ message: 'targetType and reason are required' });
    }
    const report = await AbuseReport.create({
      reporterUserId: req.user.id,
      targetType,
      targetId: targetId || '',
      reason: String(reason).trim(),
      evidenceUrl: evidenceUrl || '',
      evidenceImageName: evidenceImageName || '',
      evidenceImageDataUrl: evidenceImageDataUrl || '',
      status: 'open',
    });
    res.status(201).json({ message: 'Report submitted', reportId: report._id });
  } catch (err) {
    console.error('[Abuse] report error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
