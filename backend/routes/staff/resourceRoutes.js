const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const verifyToken = require('../../middleware/authMiddleware');
const { getIO } = require('../../socket');

const { sendNotification, logActivity } = require('../../utils/activityLogger');

// GET /api/staff/resources - Fetch ALL system resources with current holder info
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT r.*, 
             (
               SELECT wr.requested_by 
               FROM work_requests wr 
               WHERE LOWER(TRIM(wr.resource_code)) = LOWER(TRIM(r.resource_code))
                 AND LOWER(wr.status) IN ('approved', 'in progress', 'assigned')
               ORDER BY wr.id DESC 
               LIMIT 1
             ) AS current_user_name,
             (
               SELECT wr.user_id 
               FROM work_requests wr 
               WHERE LOWER(TRIM(wr.resource_code)) = LOWER(TRIM(r.resource_code))
                 AND LOWER(wr.status) IN ('approved', 'in progress', 'assigned')
               ORDER BY wr.id DESC 
               LIMIT 1
             ) AS current_user_id,
             (
               SELECT wr.requested_by 
               FROM work_requests wr 
               WHERE LOWER(TRIM(wr.resource_code)) = LOWER(TRIM(r.resource_code))
                 AND LOWER(wr.status) IN ('approved', 'in progress', 'assigned')
               ORDER BY wr.id DESC 
               LIMIT 1
             ) AS in_use_by
      FROM resources r
      ORDER BY r.id DESC
    `;
    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      resources: result.rows
    });
  } catch (error) {
    console.error("Error fetching all system resources for staff:", error);
    res.status(500).json({ success: false, error: "Server error fetching resources" });
  }
});

// PUT /api/staff/resources/:code/release - Release an assigned resource from staff catalog
router.put("/:code/release", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const resourceCode = req.params.code;

    // 1. Fetch staff name for logging and notification
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [staffId]);
    const staffName = userResult.rows.length > 0 ? userResult.rows[0].name.trim() : "Staff";

    // 2. Fetch resource details for notification message
    const resCheck = await pool.query("SELECT * FROM resources WHERE LOWER(TRIM(resource_code)) = LOWER(TRIM($1))", [resourceCode]);
    if (resCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Resource not found." });
    }
    const resourceName = resCheck.rows[0].name || resourceCode;

    // 3. Update resource status back to 'Available' in the resources table ONLY if not already Available
    const updateRes = await pool.query(
      `UPDATE resources 
       SET status = 'Available' 
       WHERE LOWER(TRIM(resource_code)) = LOWER(TRIM($1))
         AND LOWER(TRIM(status)) != 'available'
       RETURNING *`,
      [resourceCode]
    );

    // If already Available, avoid duplicate processing/logging/notification
    if (updateRes.rows.length === 0) {
      return res.json({ success: true, message: "Resource is already released or available." });
    }

    // 4. Close the associated work request for this resource
    await pool.query(
      `UPDATE work_requests 
       SET status = 'Closed' 
       WHERE LOWER(TRIM(resource_code)) = LOWER(TRIM($1))`,
      [resourceCode]
    );

    // 5. Log the activity with atomic deduplication
    await logActivity(pool, {
      userId: staffId,
      action: "RELEASED",
      entityType: "Resource",
      description: `${staffName} released resource ${resourceCode} (${resourceName}), making it available.`
    });

    // 6. NOTIFICATION TRIGGER: Notify ALL users (Admins, Managers, and Staff) except the user releasing it
    const recipientsQuery = "SELECT id, name FROM users WHERE id != $1";
    const recipients = await pool.query(recipientsQuery, [staffId]);

    for (const recipient of recipients.rows) {
      await sendNotification(
        pool,
        recipient.id,
        'Resource Available',
        `${staffName} has released resource ${resourceCode} ("${resourceName}"). It is now available for request!`
      );
    }

    // Real-time: notify all clients
    getIO().emit('resources_updated');
    getIO().emit('requests_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: "Resource released successfully." });
  } catch (err) {
    console.error("Release Resource Error:", err.message);
    res.status(500).json({ success: false, error: "Server error while releasing resource." });
  }
});

module.exports = router;