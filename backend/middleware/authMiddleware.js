const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { isAccountActive } = require('../utils/accountStatus');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        const userRes = await pool.query('SELECT status FROM users WHERE id = $1', [verified.id]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Access denied. User no longer exists.' });
        }
        if (!isAccountActive(userRes.rows[0].status)) {
            return res.status(403).json({ error: 'Account is inactive. Contact an administrator.' });
        }

        req.user = verified; // Contains id, role, email
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        console.error('Auth middleware error:', err.message);
        return res.status(500).json({ error: 'Server error during authentication.' });
    }
};

module.exports = verifyToken;