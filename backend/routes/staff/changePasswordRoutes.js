const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const bcrypt = require("bcrypt");
const verifyToken = require("../../middleware/authMiddleware");
const { getIO } = require("../../socket");

// PUT /api/staff/change-password - Update user password securely for Admin and Staff
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; 
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Please provide both current and new passwords." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters long." });
    }

    // 1. Fetch user from database
    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const user = userRes.rows[0];

    // 2. Safeguard check for password_hash field existence
    const storedHash = user.password_hash || user.password;
    if (!storedHash) {
      console.error("Change Password Error: User record is missing a password hash field.");
      return res.status(500).json({ success: false, error: "Account security configuration error. Please contact support." });
    }

    // 3. Compare current password with stored hash
    const isMatch = await bcrypt.compare(currentPassword, storedHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Incorrect current password." });
    }

    // 4. Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 5. Update database (supports both 'password_hash' and legacy 'password' columns)
    const columnName = user.password_hash !== undefined ? "password_hash" : "password";
    await pool.query(`UPDATE users SET ${columnName} = $1 WHERE id = $2`, [hashedNewPassword, userId]);

    // 6. Log activity
    await pool.query(
      "INSERT INTO activity_logs (entity_type, action, description, created_at) VALUES ($1, $2, $3, NOW())",
      ["User", "Password Change", `${user.role || 'User'} (${user.email}) successfully updated their password.`]
    );

    // Real-time: notify dashboard
    getIO().emit('dashboard_updated');

    res.json({ success: true, message: "Password updated successfully." });

  } catch (err) {
    console.error("Change Password Error:", err.message);
    res.status(500).json({ success: false, error: "Server error while changing password." });
  }
});

module.exports = router;