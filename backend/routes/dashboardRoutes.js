const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");
const { getIO } = require("../socket");

// GET /api/dashboard/summary - Admin Operations Dashboard Data
router.get("/summary", verifyToken, async (req, res) => {
  try {
    // Run optimized database queries concurrently with Promise.all
    const [usersStatsRes, requestsStatsRes, resourcesStatsRes, logsRes] = await Promise.all([
      // 1. Efficient user metrics
      pool.query(`
        SELECT 
          COUNT(*)::int AS total_members,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'active')::int AS active_members
        FROM users
      `),
      // 2. Efficient work request metrics
      pool.query(`
        SELECT 
          COUNT(*)::int AS total_requests,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'pending')::int AS pending_requests,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'in progress')::int AS in_progress_requests,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) IN ('resolved', 'closed', 'completed', 'approved'))::int AS completed_requests
        FROM work_requests
      `),
      // 3. Efficient resource category metrics
      pool.query(`
        SELECT 
          COUNT(*)::int AS total_resources,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(category, '')) ILIKE '%laptop%' OR LOWER(COALESCE(category, '')) ILIKE '%desktop%' OR LOWER(COALESCE(category, '')) ILIKE '%projector%')::int AS laptops_count,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(category, '')) ILIKE '%equipment%' OR LOWER(COALESCE(category, '')) ILIKE '%printer%' OR LOWER(COALESCE(category, '')) ILIKE '%vehicle%' OR LOWER(COALESCE(category, '')) ILIKE '%meeting room%')::int AS equipment_count,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(category, '')) ILIKE '%furniture%')::int AS furniture_count
        FROM resources
      `),
      // 4. Fetch last 10 activity logs
      pool.query(
        "SELECT id, entity_type, action, description, created_at FROM activity_logs ORDER BY id DESC LIMIT 10"
      )
    ]);

    const uStats = usersStatsRes.rows[0] || {};
    const totalMembers = uStats.total_members || 0;
    const activeMembers = uStats.active_members || totalMembers;

    const rStats = requestsStatsRes.rows[0] || {};
    const totalRequests = rStats.total_requests || 0;
    const pendingRequests = rStats.pending_requests || 0;
    const inProgressRequests = rStats.in_progress_requests || 0;
    const completedRequests = rStats.completed_requests || 0;

    const resStats = resourcesStatsRes.rows[0] || {};
    const totalResources = resStats.total_resources || 0;
    const laptopsCount = resStats.laptops_count || 0;
    const equipmentCount = resStats.equipment_count || 0;
    const furnitureCount = resStats.furniture_count || 0;
    const otherCount = Math.max(0, totalResources - (laptopsCount + equipmentCount + furnitureCount));

    const activities = (logsRes.rows || []).map((log) => {
      let validDate = new Date();
      if (log.created_at) {
        const parsed = new Date(log.created_at);
        if (!isNaN(parsed.getTime())) {
          validDate = parsed;
        }
      }

      return {
        id: log.id,
        entity_type: log.entity_type || "System",
        action: log.action || "Activity",
        description: log.description || log.action || "System action performed",
        created_at: validDate.toISOString(),
      };
    });

    res.json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        totalRequests,
        pendingRequests,
        completedRequests,
        totalResources,
        requestsByStatus: {
          pending: pendingRequests,
          inProgress: inProgressRequests,
          completed: completedRequests,
        },
        resourcesByCategory: {
          laptops: laptopsCount,
          equipment: equipmentCount,
          furniture: furnitureCount,
          other: otherCount,
        },
      },
      activities,
    });
  } catch (err) {
    console.error("Dashboard Summary Error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error fetching dashboard summary.",
    });
  }
});

// DELETE /api/dashboard/activities - Clear all activity logs
router.delete("/activities", verifyToken, async (req, res) => {
  try {
    // Check if the user has administrator or admin role
    const userRole = (req.user?.role || "").toLowerCase();
    if (userRole !== "administrator" && userRole !== "admin" && userRole !== "manager") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized. Admin privileges required.",
      });
    }

    // Delete all rows from activity_logs
    await pool.query("DELETE FROM activity_logs");

    // Log the clear action itself
    await pool.query(
      "INSERT INTO activity_logs (entity_type, action, description, created_at) VALUES ($1, $2, $3, NOW())",
      [
        "System",
        "Clear History",
        "Admin cleared all recent activity logs.",
      ],
    );

    // Real-time: broadcast to all clients
    getIO().emit('dashboard_updated');

    res.json({
      success: true,
      message: "Activity history cleared successfully.",
    });
  } catch (err) {
    console.error("Clear Activities Error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error while clearing activity history.",
    });
  }
});

module.exports = router;
