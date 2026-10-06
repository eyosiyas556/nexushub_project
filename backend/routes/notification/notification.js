const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const verifyToken = require('../../middleware/authMiddleware');

// @route   GET /api/notifications
// @desc    Get all notifications for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 30;
    `;
    const { rows } = await pool.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching notifications:", err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark a specific notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const query = `
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE id = $1 AND user_id = $2 
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Notification not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error updating notification:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   PATCH /api/notifications/mark-all-read
// @desc    Mark all notifications as read for the user
router.patch('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error("Error marking notifications read:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// @route   DELETE /api/notifications
// @desc    Clear all notifications for the logged-in user
router.delete('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error("Error clearing notifications:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;