const { getIO } = require('../socket');

/**
 * sendNotification - Atomically sends a system notification with strict deduplication
 * Prevents race conditions and multiple identical notifications within a 1-minute window.
 */
const sendNotification = async (pool, targetUserId, title, message) => {
  if (!targetUserId || !title || !message) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Acquire transactional advisory lock unique to this user and message content
    const lockKey = `notif_${targetUserId}_${title}_${message}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

    const dupCheck = await client.query(
      `SELECT id FROM notifications 
       WHERE user_id = $1 AND title = $2 AND message = $3 
         AND created_at > NOW() - INTERVAL '1 minute'`,
      [targetUserId, title, message]
    );

    if (dupCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO notifications (user_id, title, message, is_read, created_at) VALUES ($1, $2, $3, false, NOW())',
        [targetUserId, title, message]
      );
      await client.query('COMMIT');
      getIO().emit('notifications_updated');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error("Failed to send notification:", err.message);
  } finally {
    client.release();
  }
};

/**
 * logActivity - Atomically logs an activity with strict deduplication
 * Prevents race conditions and identical activity logs within a 1-minute window.
 */
const logActivity = async (pool, { userId = null, action, entityType = 'System', description }) => {
  if (!action || !description) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Acquire transactional advisory lock unique to this activity
    const lockKey = `act_${userId || 0}_${action}_${description}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

    const checkQuery = userId
      ? `SELECT id FROM activity_logs 
         WHERE user_id = $1 AND action = $2 AND description = $3 
           AND created_at > NOW() - INTERVAL '1 minute'`
      : `SELECT id FROM activity_logs 
         WHERE user_id IS NULL AND action = $1 AND description = $2 
           AND created_at > NOW() - INTERVAL '1 minute'`;

    const checkParams = userId
      ? [userId, action, description]
      : [action, description];

    const dupCheck = await client.query(checkQuery, checkParams);

    if (dupCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, description, created_at) 
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, action, entityType, description]
      );
      await client.query('COMMIT');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error("Failed to log activity:", err.message);
  } finally {
    client.release();
  }
};

module.exports = {
  sendNotification,
  logActivity,
};
