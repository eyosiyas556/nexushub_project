const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Contains id, role, email
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = verifyToken;