const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Adjust path to your database configuration pool if needed
const bcrypt = require("bcrypt");

// GET all members / users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, department, role, status, created_at FROM users ORDER BY id DESC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching members:", err.message);
    res.status(500).json({ error: "Server error while fetching members" });
  }
});

// POST a new member / user
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, department, role, status, password } = req.body;

    // Basic validation
    if (!name || !email || !department || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, department, and password are required." });
    }

    // Hash the password for password_hash column
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const newMemberResult = await pool.query(
      `INSERT INTO users (name, email, phone, department, role, status, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, name, email, phone, department, role, status, created_at`,
      [
        name,
        email,
        phone || null,
        department,
        role || "Staff",
        status || "Active",
        password_hash,
      ],
    );

    const newMember = newMemberResult.rows[0];

    // LOG ACTIVITY: Created new member
    await pool.query(
      "INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)",
      ["CREATED", "Team Member", `Created new team member: ${newMember.name} (${newMember.role})`]
    );

    res.status(201).json(newMember);
  } catch (err) {
    console.error("Error adding member:", err.message);
    if (err.code === "23505") {
      // Unique constraint violation for email
      return res
        .status(400)
        .json({ error: "A user with this email already exists." });
    }
    res.status(500).json({ error: "Server error while adding member" });
  }
});

// PUT update an existing member / user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, department, role, status } = req.body;

    const updatedMemberResult = await pool.query(
      `UPDATE users 
             SET name = $1, email = $2, phone = $3, department = $4, role = $5, status = $6 
             WHERE id = $7 
             RETURNING id, name, email, phone, department, role, status, created_at`,
      [name, email, phone || null, department, role, status, id],
    );

    if (updatedMemberResult.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const updatedMember = updatedMemberResult.rows[0];

    // LOG ACTIVITY: Updated member
    await pool.query(
      "INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)",
      ["UPDATED", "Team Member", `Updated team member details: ${updatedMember.name} (${updatedMember.role})`]
    );

    res.json(updatedMember);
  } catch (err) {
    console.error("Error updating member:", err.message);
    res.status(500).json({ error: "Server error while updating member" });
  }
});

// DELETE a member / user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // First, fetch the member name before deleting so we can log it cleanly
    const fetchMember = await pool.query("SELECT name, role FROM users WHERE id = $1", [id]);
    
    const deleteMember = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [id],
    );

    if (deleteMember.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const memberName = fetchMember.rows.length > 0 ? fetchMember.rows[0].name : `ID #${id}`;
    const memberRole = fetchMember.rows.length > 0 ? fetchMember.rows[0].role : 'Staff';

    // LOG ACTIVITY: Deleted member
    await pool.query(
      "INSERT INTO activity_logs (action, entity_type, description) VALUES ($1, $2, $3)",
      ["DELETED", "Team Member", `Removed team member: ${memberName} (${memberRole})`]
    );

    res.json({ message: "Member deleted successfully" });
  } catch (err) {
    console.error("Error deleting member:", err.message);
    res.status(500).json({ error: "Server error while deleting member" });
  }
});

module.exports = router;