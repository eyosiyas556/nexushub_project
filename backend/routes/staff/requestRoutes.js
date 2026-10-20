const express = require('express');
const router = express.Router();
const pool = require('../../config/db'); // PostgreSQL connection pool
const verifyToken = require('../../middleware/authMiddleware'); // Authentication middleware
const { getIO } = require('../../socket');

// Helper to generate a unique request number
const generateRequestNumber = () => {
  return `REQ-${Date.now().toString().slice(-6)}`;
};

// Helper function to create system notifications
const sendNotification = async (targetUserId, title, message) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
      [targetUserId, title, message]
    );
    // Real-time: push new notification to all connected clients immediately
    getIO().emit('notifications_updated');
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
};

// @route   GET /api/work-requests
// @desc    Get work requests (Staff see only requests they created or are assigned to; Admins see all)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    const userId = req.user?.id;

    let userName = '';
    if (userId) {
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      userName = userRes.rows[0]?.name?.trim() || '';
    }

    if (userRole.toLowerCase() === 'staff' && userId) {
      const staffQuery = `
        SELECT wr.*, u.name as user_name, u.email as user_email 
        FROM work_requests wr
        LEFT JOIN users u ON wr.user_id = u.id
        WHERE wr.user_id = $1 
           OR LOWER(TRIM(wr.requested_by)) = LOWER(TRIM($2))
           OR (wr.assigned_to IS NOT NULL AND LOWER(TRIM(wr.assigned_to)) = LOWER(TRIM($2)))
        ORDER BY wr.created_at DESC
      `;
      const { rows } = await pool.query(staffQuery, [userId, userName]);
      return res.json(rows);
    }

    const query = `
      SELECT wr.*, u.name as user_name, u.email as user_email 
      FROM work_requests wr
      LEFT JOIN users u ON wr.user_id = u.id
      ORDER BY wr.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching work requests:", err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/work-requests/assigned
// @desc    Get manageable work requests assigned to the logged-in staff member
router.get('/assigned', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ msg: 'Staff identifier missing' });
    }

    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const staffName = userRes.rows[0]?.name?.trim();

    if (!staffName) {
      return res.status(400).json({ msg: 'Staff name not found' });
    }

    const query = `
      SELECT wr.*, u.name as user_name, u.email as user_email 
      FROM work_requests wr
      LEFT JOIN users u ON wr.user_id = u.id
      WHERE LOWER(TRIM(wr.assigned_to)) = LOWER(TRIM($1)) 
        AND LOWER(wr.category) NOT IN ('equipment', 'resource')
      ORDER BY wr.created_at DESC;
    `;
    const { rows } = await pool.query(query, [staffName]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching assigned requests:", err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/work-requests/:id/status
// @desc    Update the status of a work request (Supports completion and rejection reasons)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    const checkQuery = 'SELECT * FROM work_requests WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Work request not found' });
    }

    const currentReq = checkResult.rows[0];
    const currentStatus = currentReq.status;

    if (currentStatus === 'Resolved' || currentStatus === 'Closed') {
      return res.status(400).json({ 
        success: false, 
        msg: `This task is already ${currentStatus} and can no longer be updated.` 
      });
    }

    const updateQuery = `
      UPDATE work_requests 
      SET status = $1, rejection_reason = COALESCE($2, rejection_reason)
      WHERE id = $3 
      RETURNING *;
    `;
    const { rows } = await pool.query(updateQuery, [status, rejection_reason || null, id]);
    const updatedReq = rows[0];

    // Fetch staff member name
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const staffName = userRes.rows[0]?.name?.trim() || 'A staff member';

    // Notify the request creator if applicable
    if (updatedReq.user_id && updatedReq.user_id !== userId) {
      await sendNotification(
        updatedReq.user_id,
        'Request Status Updated',
        `Your request (${updatedReq.request_number}) status has been updated to: ${status}`
      );
    }

    // NOTIFICATION TRIGGER: Notify Admins / Managers if staff marks task as Completed
    if (userRole === 'staff' && status.toLowerCase() === 'completed') {
      const adminQuery = "SELECT id FROM users WHERE LOWER(role) IN ('administrator', 'manager', 'admin')";
      const admins = await pool.query(adminQuery);

      for (const admin of admins.rows) {
        await sendNotification(
          admin.id,
          'Task Completed by Staff',
          `${staffName} has marked assigned task ${updatedReq.request_number} ("${updatedReq.title}") as Completed.`
        );
      }
      console.log(`[SUCCESS] Task completion notification sent to ${admins.rows.length} admin(s).`);
    }

    // NOTIFICATION TRIGGER: Notify Admins / Managers if staff rejects a task
    if (userRole === 'staff' && status.toLowerCase() === 'rejected') {
      const adminQuery = "SELECT id FROM users WHERE LOWER(role) IN ('administrator', 'manager', 'admin')";
      const admins = await pool.query(adminQuery);

      for (const admin of admins.rows) {
        await sendNotification(
          admin.id,
          'Task Rejected by Staff',
          `${staffName} has rejected assigned task ${updatedReq.request_number} ("${updatedReq.title}"). Reason: "${rejection_reason || 'No reason provided'}"`
        );
      }
      console.log(`[SUCCESS] Task rejection notification sent to ${admins.rows.length} admin(s).`);
    }

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({ success: true, data: updatedReq });
  } catch (err) {
    console.error("Error updating work request status:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   POST /api/work-requests
// @desc    Create a new work request
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      priority, 
      resource_code 
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, error: 'Request title is mandatory.' });
    }

    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required.' });
    }

    const isEquipmentOrResource = 
      category.toLowerCase() === 'equipment' || 
      category.toLowerCase() === 'resource';

    if (isEquipmentOrResource && (!resource_code || resource_code.trim() === '')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Selecting an equipment/resource type is mandatory for Equipment or Resource requests.' 
      });
    }

    const userId = req.user.id;
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const requested_by = userRes.rows[0]?.name?.trim() || 'Staff Member';

    const assigned_to = isEquipmentOrResource ? null : (req.body.assigned_to || null);
    const request_number = generateRequestNumber();

    const query = `
      INSERT INTO work_requests 
      (request_number, title, description, category, priority, status, requested_by, assigned_to, resource_code, user_id) 
      VALUES ($1, $2, $3, $4, $5, 'Pending', $6, $7, $8, $9) 
      RETURNING *;
    `;

    const values = [
      request_number,
      title.trim(),
      description && description.trim() !== '' ? description.trim() : null,
      category,
      priority || 'Medium',
      requested_by,
      assigned_to,
      isEquipmentOrResource ? resource_code.trim() : null,
      userId
    ];

    const { rows } = await pool.query(query, values);
    const newRequest = rows[0];

    const adminQuery = "SELECT id FROM users WHERE LOWER(role) IN ('administrator', 'manager')";
    const admins = await pool.query(adminQuery);

    for (const admin of admins.rows) {
      await sendNotification(
        admin.id,
        `New ${category} Request (${request_number})`,
        `${requested_by} submitted a new request: "${title.trim()}"`
      );
    }

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.status(201).json({ 
      success: true, 
      message: "Work request submitted successfully",
      data: newRequest 
    });
  } catch (err) {
    console.error("Error creating work request:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   PUT /api/work-requests/:id
// @desc    Update work request details (Staff can edit pending requests; Admins can update status/assignment)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, priority, status, assigned_to, resource_code } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    const checkQuery = 'SELECT * FROM work_requests WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Work request not found' });
    }

    const currentReq = checkResult.rows[0];

    // Staff Edit Restrictions: Must own the request and it must be Pending
    if (userRole === 'staff') {
      if (currentReq.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to edit this request.' });
      }
      if (currentReq.status.toLowerCase() !== 'pending') {
        return res.status(400).json({ success: false, error: 'Only pending requests can be edited.' });
      }

      const targetCategory = category || currentReq.category;
      const isEquipmentOrResource = 
        targetCategory?.toLowerCase() === 'equipment' || 
        targetCategory?.toLowerCase() === 'resource';

      if (isEquipmentOrResource && (!resource_code || resource_code.trim() === '')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Selecting an equipment/resource type is mandatory for Equipment or Resource requests.' 
        });
      }

      const updateQuery = `
        UPDATE work_requests 
        SET title = COALESCE($1, title), 
            description = COALESCE($2, description), 
            category = COALESCE($3, category), 
            priority = COALESCE($4, priority),
            resource_code = CASE WHEN $3 = 'Equipment' OR $3 = 'Resource' THEN COALESCE($5, resource_code) ELSE NULL END
        WHERE id = $6 
        RETURNING *;
      `;
      const { rows } = await pool.query(updateQuery, [
        title ? title.trim() : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        category,
        priority,
        resource_code ? resource_code.trim() : null,
        id
      ]);

      // Real-time: broadcast to all clients
      getIO().emit('requests_updated');
      getIO().emit('resources_updated');
      getIO().emit('dashboard_updated');

      return res.json({ success: true, message: 'Request updated successfully', data: rows[0] });
    }

    // Admin / Manager Update Logic
    const targetCategory = category || currentReq.category;
    const isEquipmentOrResource = 
      targetCategory?.toLowerCase() === 'equipment' || 
      targetCategory?.toLowerCase() === 'resource';

    const finalAssignee = isEquipmentOrResource ? null : (assigned_to !== undefined ? assigned_to : currentReq.assigned_to);
    const finalStatus = status || currentReq.status;
    const finalPriority = priority || currentReq.priority;

    const updateQuery = `
      UPDATE work_requests 
      SET status = $1, priority = $2, assigned_to = $3
      WHERE id = $4 
      RETURNING *;
    `;

    const { rows } = await pool.query(updateQuery, [finalStatus, finalPriority, finalAssignee, id]);
    const updatedReq = rows[0];

    if (finalAssignee && finalAssignee !== currentReq.assigned_to) {
      const staffRes = await pool.query('SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [finalAssignee]);
      if (staffRes.rows.length > 0) {
        await sendNotification(
          staffRes.rows[0].id,
          'New Task Assigned',
          `You have been assigned to request ${updatedReq.request_number}: "${updatedReq.title}"`
        );
      }
    }

    if (updatedReq.user_id && finalStatus !== currentReq.status) {
      await sendNotification(
        updatedReq.user_id,
        'Request Status Updated',
        `Your request (${updatedReq.request_number}) status has been updated to: ${finalStatus}`
      );
    }

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: "Work request updated successfully", data: updatedReq });
  } catch (err) {
    console.error("Error updating work request:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   GET /api/work-requests/:id
// @desc    Get a single work request by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT wr.*, u.name as user_name, u.email as user_email 
      FROM work_requests wr
      LEFT JOIN users u ON wr.user_id = u.id
      WHERE wr.id = $1
    `;
    const { rows } = await pool.query(query, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Work request not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching work request details:", err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/work-requests/:id
// @desc    Delete a work request (Staff can delete their own requests; auto-releases held resources)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role.toLowerCase();

    const checkQuery = 'SELECT * FROM work_requests WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Work request not found' });
    }

    const currentReq = checkResult.rows[0];

    if (userRole === 'staff') {
      if (currentReq.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete this request.' });
      }
    }

    const resourceCode = currentReq.resource_code;

    // Delete the work request
    const deleteQuery = 'DELETE FROM work_requests WHERE id = $1 RETURNING *;';
    await pool.query(deleteQuery, [id]);

    // AUTOMATIC RELEASE: If the deleted request was tied to a resource, release it back to Available
    if (resourceCode) {
      await pool.query(
        `UPDATE resources SET status = 'Available' WHERE resource_code = $1`,
        [resourceCode]
      );

      // Fetch user name for logging
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows[0]?.name?.trim() || 'Staff Member';

      // Log the auto-release action in activity logs
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, description) VALUES ($1, $2, $3, $4)`,
        [userId, "AUTO_RELEASED", "Resource", `${userName} deleted request #${currentReq.request_number}, automatically releasing resource ${resourceCode} back to available inventory.`]
      );
    }

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: 'Work request deleted and resource successfully released.' });
  } catch (err) {
    console.error("Error deleting work request:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;