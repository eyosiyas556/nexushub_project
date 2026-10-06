const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

// Initialize Nodemailer transporter safely
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role, email: user.rows[0].email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.rows[0].id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                role: user.rows[0].role,
                department: user.rows[0].department,
                phone: user.rows[0].phone,
                status: user.rows[0].status,
                profile_picture: user.rows[0].profile_picture
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// 1. Request Password Reset OTP via Email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email address is required.' });
        }

        const trimmedEmail = email.trim();

        // Check if user exists with this email address
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No account found with this email address.' });
        }

        // Generate 6-digit OTP and 10-minute expiry time
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        // Save OTP to database
        await pool.query(
            'UPDATE users SET reset_otp = $1, otp_expiry = $2 WHERE email = $3',
            [otp, otpExpiry, trimmedEmail]
        );

        const mailOptions = {
            from: `"Nexus Hub Support" <${process.env.EMAIL_USER}>`,
            to: trimmedEmail,
            subject: 'Nexus Hub Password Reset Verification Code',
            text: `Your Nexus Hub password reset verification code is: ${otp}. Valid for 10 minutes.`,
        };

        // Send Email via Nodemailer
        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL SENT] Password reset OTP sent to ${trimmedEmail}`);

        res.json({
            success: true,
            message: 'Password reset OTP sent successfully to your email.',
            debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
        });
    } catch (err) {
        console.error('Forgot Password Error:', err.message);
        res.status(500).json({ success: false, error: 'Server error while processing request.' });
    }
});

// 2. Verify OTP and Update Password Hash via Email
router.post('/reset-password-otp', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, error: 'All fields are required.' });
        }

        const trimmedEmail = email.trim();

        // Verify OTP and check expiration
        const userRes = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND reset_otp = $2 AND otp_expiry > NOW()',
            [trimmedEmail, otp.trim()]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
        }

        // Hash the new password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password_hash and clear OTP fields
        await pool.query(
            'UPDATE users SET password_hash = $1, reset_otp = NULL, otp_expiry = NULL WHERE email = $2',
            [hashedPassword, trimmedEmail]
        );

        res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
    } catch (err) {
        console.error('Reset Password Error:', err.message);
        res.status(500).json({ success: false, error: 'Server error while resetting password.' });
    }
});

// PUT endpoint to update full profile details (name, email, phone, department, role, status, avatar)
router.put('/profile', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone, department, role, status } = req.body;

        // 1. Get current user info to retain existing picture if no new one is uploaded
        const currentUser = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (currentUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        let picturePath = currentUser.rows[0].profile_picture;
        if (req.file) {
            picturePath = `/uploads/${req.file.filename}`;
        }

        // 2. Update database with all fields from your schema
        const updateResult = await pool.query(
            `UPDATE users 
             SET name = COALESCE(NULLIF($1, ''), name), 
                 email = COALESCE(NULLIF($2, ''), email), 
                 phone = COALESCE($3, phone), 
                 department = COALESCE(NULLIF($4, ''), department), 
                 role = COALESCE(NULLIF($5, ''), role),
                 status = COALESCE(NULLIF($6, ''), status),
                 profile_picture = COALESCE($7, profile_picture) 
             WHERE id = $8 
             RETURNING id, name, email, phone, department, role, status, profile_picture`,
            [name, email, phone, department, role, status, picturePath, userId]
        );

        res.json({
            message: 'Profile updated successfully!',
            user: updateResult.rows[0]
        });
    } catch (err) {
        console.error('Error updating user profile:', err);
        res.status(500).json({ error: 'Server error updating user profile.' });
    }
});

// PUT endpoint to update profile picture only (kept for backward compatibility)
router.put('/profile-picture', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const picturePath = `/uploads/${req.file.filename}`;
        const userId = req.user.id; 

        const result = await pool.query(
            'UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, name, email, role, department, phone, status, profile_picture',
            [picturePath, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            message: 'Profile picture updated successfully!',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Error uploading profile picture:', err);
        res.status(500).json({ error: 'Server error uploading profile picture.' });
    }
});

module.exports = router;