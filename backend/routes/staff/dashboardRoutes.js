const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const verifyToken = require("../../middleware/authMiddleware");
const { getIO } = require("../../socket");

// DELETE /api/staff/requests - Clear historical work requests for the logged-in staff
router.delete("/requests", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    
    const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [staffId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Staff user not found" });
    }
    const staffName = userResult.rows[0].name.trim();
    const staffEmail = userResult.rows[0].email.trim();
    const firstName = staffName.split(" ")[0];

    await db.query(
      `DELETE FROM work_requests 
       WHERE (
         user_id = $5
         OR LOWER(TRIM(requested_by)) = LOWER(TRIM($1))
         OR LOWER(TRIM(assigned_to)) = LOWER(TRIM($1))
         OR LOWER(TRIM(requested_by)) = LOWER(TRIM($2))
         OR LOWER(TRIM(assigned_to)) = LOWER(TRIM($2))
         OR requested_by::text = $3
         OR assigned_to::text = $3
         OR requested_by ILIKE $4
         OR assigned_to ILIKE $4
       ) AND LOWER(status) IN ('resolved', 'closed', 'completed', 'approved', 'rejected')`,
      [staffName, staffEmail, String(staffId), `%${firstName}%`, staffId]
    );

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: "Work requests cleared successfully." });
  } catch (err) {
    console.error("Clear Staff Requests Error:", err.message);
    res.status(500).json({ success: false, error: "Server error clearing work requests." });
  }
});

// DELETE /api/staff/activities - Clear activity history for the logged-in staff only
router.delete("/activities", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [staffId]);
    const staffName = userResult.rows.length > 0 ? userResult.rows[0].name.trim() : "";

    // Delete logs tied to this user_id OR matching their name description
    await db.query(
      `DELETE FROM activity_logs WHERE user_id = $1 OR description ILIKE $2`,
      [staffId, `%${staffName}%`]
    );

    // Real-time: broadcast to all clients
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: "Activity history cleared successfully." });
  } catch (err) {
    console.error("Clear Staff Activities Error:", err.message);
    res.status(500).json({ success: false, error: "Server error clearing activities." });
  }
});

// PUT /api/staff/resources/:code/release - Release an assigned resource
router.put("/resources/:code/release", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const resourceCode = req.params.code;

    // 1. Fetch staff user details
    const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [staffId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Staff user not found" });
    }
    const staffName = userResult.rows[0].name.trim();

    // 2. Update resource status back to 'Available' in the resources table
    const updateRes = await db.query(
      `UPDATE resources 
       SET status = 'Available' 
       WHERE LOWER(TRIM(resource_code)) = LOWER(TRIM($1)) 
       RETURNING *`,
      [resourceCode]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Resource not found." });
    }

    // 3. Close the associated work request status to 'Closed'
    await db.query(
      `UPDATE work_requests 
       SET status = 'Closed' 
       WHERE LOWER(TRIM(resource_code)) = LOWER(TRIM($1))`,
      [resourceCode]
    );

    // 4. Log the activity with user_id so it remains strictly user-specific
    await db.query(
      `INSERT INTO activity_logs (user_id, entity_type, action, description, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [staffId, "Resource", "Release Resource", `Staff member ${staffName} released resource ${resourceCode}.`]
    );

    // 5. Fetch resource name for the notification message
    const resDetails = await db.query(
      "SELECT name FROM resources WHERE resource_code = $1",
      [resourceCode]
    );
    const resourceName = resDetails.rows.length > 0 ? resDetails.rows[0].name : resourceCode;

    // 6. Notify all users (admins, managers, and staff) about the released resource
    const usersToNotify = await db.query(
      "SELECT id FROM users WHERE id != $1",
      [staffId]
    );
    for (const user of usersToNotify.rows) {
      await db.query(
        "INSERT INTO notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false)",
        [
          user.id,
          "Resource Now Available",
          `${staffName} has released resource ${resourceCode} ("${resourceName}"). It is now available for requests.`
        ]
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

// GET /api/staff/dashboard - Staff Dashboard with Assigned Resources
router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    let staffName = "";
    let staffEmail = "";

    // 1. Fetch user info from database
    const userResult = await db.query(
      "SELECT name, email FROM users WHERE id = $1",
      [staffId],
    );
    if (userResult.rows.length > 0) {
      staffName = userResult.rows[0].name.trim();
      staffEmail = userResult.rows[0].email.trim();
    }

    if (!staffName) {
      return res
        .status(404)
        .json({ success: false, error: "Staff user not found" });
    }

    // 2. Fetch requests matching this user by name, email, or user ID
    const firstName = staffName.split(" ")[0];
    const requestsQuery = `
      SELECT DISTINCT * FROM work_requests 
      WHERE user_id = $5
         OR LOWER(TRIM(requested_by)) = LOWER(TRIM($1))
         OR LOWER(TRIM(assigned_to)) = LOWER(TRIM($1))
         OR LOWER(TRIM(requested_by)) = LOWER(TRIM($2))
         OR LOWER(TRIM(assigned_to)) = LOWER(TRIM($2))
         OR requested_by::text = $3
         OR assigned_to::text = $3
         OR requested_by ILIKE $4
         OR assigned_to ILIKE $4
      ORDER BY id DESC
    `;

    const staffRequestsRes = await db.query(requestsQuery, [
      staffName,
      staffEmail,
      String(staffId),
      `%${firstName}%`,
      staffId,
    ]);

    const allRequests = staffRequestsRes.rows;

    // 3. Compute stats
    const totalRequests = allRequests.length;
    const pendingRequests = allRequests.filter(
      (r) => r.status && r.status.toLowerCase() === "pending",
    ).length;
    const completedRequests = allRequests.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return (
        s === "resolved" ||
        s === "closed" ||
        s === "completed" ||
        s === "in progress"
      );
    }).length;

    const recentRequests = allRequests.slice(0, 5);

    // 4. Fetch Assigned Resources: only resources currently In Use whose latest active request belongs to this staff member
    let assignedResources = [];
    try {
      const resourceQuery = `
        SELECT r.* 
        FROM resources r
        WHERE LOWER(r.status) = 'in use'
          AND EXISTS (
            SELECT 1 FROM (
              SELECT wr.user_id, wr.requested_by 
              FROM work_requests wr 
              WHERE LOWER(TRIM(wr.resource_code)) = LOWER(TRIM(r.resource_code))
                AND LOWER(wr.status) IN ('approved', 'in progress', 'assigned')
              ORDER BY wr.id DESC 
              LIMIT 1
            ) latest_wr
            WHERE latest_wr.user_id = $1 
               OR LOWER(TRIM(latest_wr.requested_by)) = LOWER(TRIM($2))
               OR LOWER(TRIM(latest_wr.requested_by)) = LOWER(TRIM($3))
               OR latest_wr.requested_by::text = $4
          )
        ORDER BY r.id DESC
      `;
      const resResult = await db.query(resourceQuery, [
        staffId,
        staffName,
        staffEmail,
        String(staffId),
      ]);
      assignedResources = resResult.rows;
    } catch (err) {
      console.error("Error fetching assigned resources for staff dashboard:", err);
      assignedResources = [];
    }

    const totalAssignedResources = assignedResources.length;

    // 5. FIXED: Fetch user-specific activity logs matching user_id OR staff name/email
    let recentLogs = [];
    try {
      const logsRes = await db.query(
        `SELECT * FROM activity_logs 
         WHERE user_id = $1 
            OR description ILIKE $2 
            OR description ILIKE $3 
         ORDER BY id DESC LIMIT 5`,
        [staffId, `%${staffName}%`, `%${staffEmail}%`]
      );
      recentLogs = logsRes.rows;
    } catch (err) {
      console.error("Error fetching logs:", err);
      recentLogs = [];
    }

    res.status(200).json({
      success: true,
      stats: {
        totalRequests,
        pendingRequests,
        completedRequests,
        totalAssignedResources,
      },
      recentRequests,
      assignedResources,
      recentLogs,
    });
  } catch (error) {
    console.error("Error fetching staff dashboard requests:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error loading dashboard" });
  }
});

module.exports = router;