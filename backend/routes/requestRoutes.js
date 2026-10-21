const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const { getIO } = require('../socket');

router.use(verifyToken);

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

// GET /api/requests - Fetch all work requests (joined with user details for safety)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wr.*, u.name as user_name, u.email as user_email 
       FROM work_requests wr 
       LEFT JOIN users u ON wr.user_id = u.id 
       ORDER BY wr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch work requests:', err);
    res.status(500).json({ error: 'Server error fetching work requests.' });
  }
});

// GET /api/requests/:id/assignable-staff - Get staff eligible for assignment (excludes requester & admins)
router.get('/:id/assignable-staff', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch the request to get the creator's user_id
    const reqCheck = await pool.query('SELECT user_id FROM work_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found.' });
    }
    const requesterId = reqCheck.rows[0].user_id;

    // 2. Fetch staff members, excluding the requester and excluding any admins/managers
    const staffQuery = `
      SELECT id, name, email, role 
      FROM users 
      WHERE LOWER(role) = 'staff' 
        AND id != $1 
      ORDER BY name ASC;
    `;
    const { rows } = await pool.query(staffQuery, [requesterId || 0]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching assignable staff:", err);
    res.status(500).json({ error: 'Server error fetching assignable staff.' });
  }
});

// PUT /api/requests/:id - Admin updates status, priority, staff assignment, or processes rejections with a reason
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, priority, assigned_to, category, rejection_reason } = req.body;

  try {
    // 1. Fetch current request data to inspect resource code and category
    const checkQuery = 'SELECT * FROM work_requests WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found.' });
    }

    const currentRequest = checkResult.rows[0];
    const currentStatusLower = currentRequest.status.toLowerCase();
    const targetStatus = status || currentRequest.status;
    const targetStatusLower = targetStatus.toLowerCase();

    const resourceCode = currentRequest.resource_code;
    const staffRequester = currentRequest.requested_by;
    const targetCategory = category || currentRequest.category;

    // Check if it's an equipment or resource request
    const isEquipmentOrResourceCategory = 
      targetCategory.toLowerCase() === 'equipment' || 
      targetCategory.toLowerCase() === 'resource' || 
      (resourceCode && resourceCode.trim() !== '');

    // GUARD: Apply status lock ONLY if it's an equipment or resource request
    const isLocked = ['closed', 'resolved', 'completed'].includes(currentStatusLower);
    if (isEquipmentOrResourceCategory && isLocked && targetStatusLower !== currentStatusLower) {
      return res.status(400).json({ 
        error: `Cannot modify request. This equipment request is already '${currentRequest.status}' and is locked.` 
      });
    }

    // 2. Resource Validation & Status Control (Only for equipment/resources)
    if (resourceCode && resourceCode.trim() !== '') {
      const isApproving = ['in progress', 'resolved', 'approved', 'completed'].includes(targetStatusLower);
      const wasPending = currentStatusLower === 'pending';

      if (isApproving && wasPending) {
        // Check if the resource exists and its current status in the registry
        const resCheck = await pool.query('SELECT * FROM resources WHERE resource_code = $1', [resourceCode]);
        
        if (resCheck.rows.length > 0) {
          const resource = resCheck.rows[0];

          // RULE: Cannot approve if the resource is already 'In Use'
          if (resource.status.toLowerCase() === 'in use') {
            return res.status(400).json({ 
              error: `Cannot approve request. Resource code ${resourceCode} (${resource.name}) is already 'In Use' and cannot be taken.` 
            });
          }

          // RULE: Automatically mark the resource as 'In Use' upon approval
          await pool.query(
            'UPDATE resources SET status = $1 WHERE resource_code = $2',
            ['In Use', resourceCode]
          );
        }
      }
    }

    // 3. Determine final assignee: Automatically bind equipment/resource requests to the requesting staff member upon approval
    const finalAssignee = isEquipmentOrResourceCategory && ['in progress', 'resolved', 'approved', 'completed'].includes(targetStatusLower)
      ? staffRequester 
      : (assigned_to !== undefined ? assigned_to : currentRequest.assigned_to);

    // 4. Perform the update on work_requests
    const query = `
      UPDATE work_requests 
      SET status = $1, priority = $2, assigned_to = $3, category = $4
      WHERE id = $5
      RETURNING *;
    `;
    
    const values = [
      targetStatus, 
      priority || currentRequest.priority, 
      finalAssignee || null, 
      targetCategory,
      id
    ];
    const result = await pool.query(query, values);
    const updatedRequest = result.rows[0];

    // 5. NOTIFICATION TRIGGERS (Optimized with support for Rejection Reasons)
    if (updatedRequest.user_id && targetStatusLower !== currentStatusLower) {
      const isOwnerAssigned = finalAssignee && (finalAssignee.trim().toLowerCase() === staffRequester?.trim().toLowerCase());

      if (targetStatusLower === 'rejected') {
        await sendNotification(
          updatedRequest.user_id,
          'Request Rejected',
          `Your request (${updatedRequest.request_number}: "${updatedRequest.title}") has been rejected.${rejection_reason ? ` Reason: ${rejection_reason}` : ''}`
        );
      } else if (isEquipmentOrResourceCategory) {
        await sendNotification(
          updatedRequest.user_id,
          'Equipment Request Approved',
          `Your equipment request (${updatedRequest.request_number}: "${updatedRequest.title}") has been approved and assigned to you.`
        );
      } else {
        await sendNotification(
          updatedRequest.user_id,
          isOwnerAssigned ? 'New Task Assigned' : 'Request Status Updated',
          isOwnerAssigned 
            ? `You have been assigned to request ${updatedRequest.request_number}: "${updatedRequest.title}"`
            : `Your request (${updatedRequest.request_number}) status has been updated to: ${targetStatus}`
        );
      }
    } else if (finalAssignee && finalAssignee !== currentRequest.assigned_to) {
      const staffRes = await pool.query('SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [finalAssignee]);
      if (staffRes.rows.length > 0 && staffRes.rows[0].id !== updatedRequest.user_id) {
        await sendNotification(
          staffRes.rows[0].id,
          'New Task Assigned',
          `You have been assigned to request ${updatedRequest.request_number}: "${updatedRequest.title}"`
        );
      }
    } else if (priority && priority !== currentRequest.priority && updatedRequest.user_id) {
      await sendNotification(
        updatedRequest.user_id,
        'Request Priority Updated',
        `The priority for request ${updatedRequest.request_number} ("${updatedRequest.title}") was updated to: ${priority}`
      );
    }

    // 6. LOG ACTIVITY: Updated work request
    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)`,
      [
        'UPDATED', 
        'Work Request', 
        `Updated request #${updatedRequest.id} status to '${updatedRequest.status}' ${rejection_reason ? `(Reason: ${rejection_reason})` : ''}`
      ]
    );

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({
      message: 'Work request updated successfully!',
      request: updatedRequest,
    });
  } catch (err) {
    console.error('Failed to update work request:', err);
    res.status(500).json({ error: 'Server error updating work request.' });
  }
});

// DELETE /api/requests/:id - Admin deletes a work request
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const reqCheck = await pool.query('SELECT * FROM work_requests WHERE id = $1', [id]);
    
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found.' });
    }

    const targetReq = reqCheck.rows[0];

    const result = await pool.query(
      'DELETE FROM work_requests WHERE id = $1 RETURNING *;',
      [id]
    );

    const deletedRequest = result.rows[0];

    if (deletedRequest.resource_code) {
      await pool.query(
        "UPDATE resources SET status = 'Available' WHERE resource_code = $1 AND status = 'In Use'",
        [deletedRequest.resource_code]
      );
    }

    if (targetReq.user_id) {
      await sendNotification(
        targetReq.user_id,
        'Request Removed',
        `Your request (${targetReq.request_number}: "${targetReq.title}") has been removed by an administrator.`
      );
    }

    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)`,
      [
        'DELETED', 
        'Work Request', 
        `Deleted work request #${deletedRequest.id}`
      ]
    );

    // Real-time: broadcast to all clients
    getIO().emit('requests_updated');
    getIO().emit('resources_updated');
    getIO().emit('notifications_updated');
    getIO().emit('dashboard_updated');

    res.json({ message: 'Work request deleted successfully!' });
  } catch (err) {
    console.error('Failed to delete work request:', err);
    res.status(500).json({ error: 'Server error deleting work request.' });
  }
});

module.exports = router;