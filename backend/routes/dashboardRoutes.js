const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

// GET /api/dashboard/summary - Admin Operations Dashboard Data
router.get("/summary", verifyToken, async (req, res) => {
  try {
    // 1. Fetch total users & active members from 'users'
    const usersRes = await pool.query("SELECT * FROM users");
    const users = usersRes.rows || [];
    const totalMembers = users.length;
    const activeMembers =
      users.filter((u) => (u.status || "").toLowerCase() === "active").length ||
      totalMembers;

    // 2. Fetch work requests from 'work_requests'
    const reqRes = await pool.query("SELECT * FROM work_requests");
    const requests = reqRes.rows || [];
    const totalRequests = requests.length;

    const pendingRequests = requests.filter(
      (r) => (r.status || "").toLowerCase() === "pending",
    ).length;
    const inProgressRequests = requests.filter(
      (r) => (r.status || "").toLowerCase() === "in progress",
    ).length;

    // Matches your work_requests CHECK constraint: ('Pending', 'In Progress', 'Resolved', 'Closed')
    const completedRequests = requests.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return ["resolved", "closed", "completed", "approved"].includes(s);
    }).length;
    // DELETE /api/dashboard/activities - Clear all activity logs
    router.delete("/activities", verifyToken, async (req, res) => {
      try {
        // Optional: check if the user is an administrator
        if (
          (req.user.role || "").toLowerCase() !== "administrator" &&
          (req.user.role || "").toLowerCase() !== "admin"
        ) {
          return res
            .status(403)
            .json({
              success: false,
              error: "Unauthorized. Admin privileges required.",
            });
        }

        // Delete all rows from activity_logs
        await pool.query("DELETE FROM activity_logs");

        // Log the clear action itself (or you can leave it out if you want a totally blank slate)
        await pool.query(
          "INSERT INTO activity_logs (entity_type, action, description, created_at) VALUES ($1, $2, $3, NOW())",
          [
            "System",
            "Clear History",
            `Admin cleared all recent activity logs.`,
          ],
        );

        res.json({
          success: true,
          message: "Activity history cleared successfully.",
        });
      } catch (err) {
        console.error("Clear Activities Error:", err.message);
        res
          .status(500)
          .json({
            success: false,
            error: "Server error while clearing activity history.",
          });
      }
    });
    // 3. Fetch resources from 'resources' and map categories
    const resRes = await pool.query("SELECT * FROM resources");
    const resources = resRes.rows || [];
    const totalResources = resources.length;

    let laptopsCount = 0;
    let equipmentCount = 0;
    let furnitureCount = 0;
    let otherCount = 0;

    resources.forEach((res) => {
      const cat = (res.category || "").toLowerCase();
      if (
        cat.includes("laptop") ||
        cat.includes("desktop") ||
        cat.includes("projector")
      ) {
        laptopsCount++;
      } else if (
        cat.includes("equipment") ||
        cat.includes("printer") ||
        cat.includes("vehicle") ||
        cat.includes("meeting room")
      ) {
        equipmentCount++;
      } else if (cat.includes("furniture")) {
        furnitureCount++;
      } else {
        otherCount++;
      }
    });

    // 4. Fetch logs from 'activity_logs' with robust date validation
    const logsRes = await pool.query(
      "SELECT * FROM activity_logs ORDER BY id DESC LIMIT 10",
    );
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
    res
      .status(500)
      .json({
        success: false,
        error: "Server error fetching dashboard summary.",
      });
  }
});

module.exports = router;
