/**
 * Authentication middleware
 * Verifies Google ID tokens from the Authorization header.
 */
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');

const oauthClient = new OAuth2Client(config.googleClientId);

/**
 * Express middleware that:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies it as a valid Google ID token
 * 3. Attaches user info to req.user
 */
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const ticket = await oauthClient.verifyIdToken({
            idToken,
            audience: config.googleClientId,
        });

        const payload = ticket.getPayload();

        // Attach verified user info to the request
        req.user = {
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture || null,
        };

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired ID token' });
    }
}

module.exports = { verifyToken };
