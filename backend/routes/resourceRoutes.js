const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");
const { getIO } = require("../socket");

// 1. Get All Resources (with search, filters, and accurate current user holder info)
router.get("/", verifyToken, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    
    // Using a subquery to grab the exact latest active staff name from work_requests
    let query = `
      SELECT r.*, 
             (
               SELECT wr.requested_by 
               FROM work_requests wr 
               WHERE LOWER(TRIM(wr.resource_code)) = LOWER(TRIM(r.resource_code))
                 AND LOWER(wr.status) IN ('approved', 'in progress', 'assigned', 'pending')
               ORDER BY wr.id DESC 
               LIMIT 1
             ) AS in_use_by
      FROM resources r
      WHERE 1=1
    `;
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (r.name ILIKE $${paramIndex} OR r.resource_code ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND r.category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    query += " ORDER BY r.created_at DESC";

    const resources = await pool.query(query, queryParams);
    res.json(resources.rows);
  } catch (err) {
    console.error("Fetch Resources Error:", err.message);
    res.status(500).json({ error: "Server error while fetching resources." });
  }
});

// 2. Add a New Resource
router.post("/", verifyToken, async (req, res) => {
  try {
    const { resource_code, name, category, status, details } = req.body;

    const newResourceResult = await pool.query(
      `INSERT INTO resources (resource_code, name, category, status, details) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [resource_code, name, category, status || "Available", details]
    );

    const newResource = newResourceResult.rows[0];

    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)`,
      ["CREATED", "Resource", `Added new resource: ${newResource.name} (${newResource.category})`]
    );

    // Real-time: notify all clients
    getIO().emit('resources_updated');

    res.status(201).json({
      message: "Resource added successfully!",
      resource: newResource,
    });
  } catch (err) {
    console.error("Add Resource Error:", err.message);
    res.status(500).json({
      error: "Server error while adding resource (Resource code might already exist).",
    });
  }
});

// 5. Release Resource — MUST be registered before /:id to avoid route shadowing
router.put("/:code/release", verifyToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const resourceCode = req.params.code;

    // 1. Fetch staff name for logging
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [staffId]);
    const staffName = userResult.rows.length > 0 ? userResult.rows[0].name.trim() : "Staff";

    // 2. Fetch resource details for notification message
    const resCheck = await pool.query("SELECT * FROM resources WHERE resource_code = $1", [resourceCode]);
    const resourceName = resCheck.rows.length > 0 ? resCheck.rows[0].name : resourceCode;

    // 3. Update resource status back to 'Available'
    const updateRes = await pool.query(
      `UPDATE resources 
       SET status = 'Available' 
       WHERE resource_code = $1 
       RETURNING *`,
      [resourceCode]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Resource not found." });
    }

    // 4. Close associated work requests
    await pool.query(
      `UPDATE work_requests 
       SET status = 'Closed' 
       WHERE resource_code = $1`,
      [resourceCode]
    );

    // 5. Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, description) VALUES ($1, $2, $3, $4)`,
      [staffId, "RELEASED", "Resource", `${staffName} released resource ${resourceCode} (${resourceName}), making it available.`]
    );

    // 6. NOTIFICATION TRIGGER: Notify all Admins and Managers
    const adminQuery = "SELECT id, name, role FROM users WHERE LOWER(role) LIKE '%admin%' OR LOWER(role) LIKE '%manager%'";
    const admins = await pool.query(adminQuery);

    console.log(`[DEBUG] Found ${admins.rows.length} admin(s) to notify for resource release.`);

    for (const admin of admins.rows) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false)',
        [
          admin.id,
          'Resource Released',
          `${staffName} has released resource ${resourceCode} ("${resourceName}"). It is now available.`
        ]
      );
    }

    // Real-time: notify all clients
    getIO().emit('resources_updated');

    res.json({ success: true, message: "Resource released successfully." });
  } catch (err) {
    console.error("Release Resource Error:", err.message);
    res.status(500).json({ success: false, error: "Server error while releasing resource." });
  }
});

// 3. Update Resource
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { resource_code, name, category, status, details } = req.body;

    const updatedResourceResult = await pool.query(
      `UPDATE resources 
       SET resource_code = COALESCE($1, resource_code), 
           name = COALESCE($2, name), 
           category = COALESCE($3, category), 
           status = COALESCE($4, status), 
           details = COALESCE($5, details)
       WHERE id = $6 
       RETURNING *`,
      [resource_code, name, category, status, details, id]
    );

    if (updatedResourceResult.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found." });
    }

    const updatedResource = updatedResourceResult.rows[0];

    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)`,
      ["UPDATED", "Resource", `Updated resource details: ${updatedResource.name} (${updatedResource.category})`]
    );

    // Real-time: notify all clients
    getIO().emit('resources_updated');

    res.json({
      message: "Resource updated successfully!",
      resource: updatedResource,
    });
  } catch (err) {
    console.error("Update Resource Error:", err.message);
    res.status(500).json({ error: "Server error while updating resource." });
  }
});

// 4. Delete Resource
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedResourceResult = await pool.query(
      "DELETE FROM resources WHERE id = $1 RETURNING *",
      [id]
    );

    if (deletedResourceResult.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found." });
    }

    const deletedResource = deletedResourceResult.rows[0];

    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)`,
      ["DELETED", "Resource", `Removed resource: ${deletedResource.name} (${deletedResource.category})`]
    );

    // Real-time: notify all clients
    getIO().emit('resources_updated');

    res.json({
      message: `Resource ${deletedResource.name} deleted successfully!`,
    });
  } catch (err) {
    console.error("Delete Resource Error:", err.message);
    res.status(500).json({ error: "Server error while deleting resource." });
  }
});

module.exports = router;