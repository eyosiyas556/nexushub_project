const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/activities - Fetch recent system activities
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 15'
    );
    
    // Map rows with robust date validation to prevent any "Invalid Date" errors
    const activities = (result.rows || []).map(log => {
      let validDate = new Date();
      if (log.created_at) {
        const parsed = new Date(log.created_at);
        if (!isNaN(parsed.getTime())) {
          validDate = parsed;
        }
      }

      return {
        ...log,
        entity_type: log.entity_type || 'System',
        action: log.action || 'Activity',
        description: log.description || log.action || 'System action performed',
        created_at: validDate.toISOString()
      };
    });

    // Deduplicate any identical activities within a 2-minute window
    const uniqueActivities = [];
    const seen = new Set();
    for (const act of activities) {
      const timeWindow = Math.floor(new Date(act.created_at).getTime() / 120000);
      const key = `${act.action}_${act.description}_${timeWindow}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueActivities.push(act);
      }
    }

    res.json(uniqueActivities);
  } catch (err) {
    console.error('Failed to fetch activity logs:', err);
    res.status(500).json({ error: 'Server error fetching activities.' });
  }
});

module.exports = router;