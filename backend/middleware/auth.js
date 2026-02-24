/**
 * Authentication middleware
 * Verifies JWT tokens from the Authorization header.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Express middleware that:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies it as a valid JWT
 * 3. Attaches user info to req.user
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const payload = jwt.verify(token, config.jwtSecret);

        // Attach verified user info to the request
        req.user = {
            email: payload.email,
            name: payload.name || payload.email,
            role: payload.role || null,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        }
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { verifyToken };
