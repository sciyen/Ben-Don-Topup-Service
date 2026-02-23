/**
 * Express Server Entry Point
 * Internal cash top-up accounting service.
 */
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const topupRoutes = require('./routes/topup');

const app = express();

// --- Middleware ---

// CORS: allow multiple origins (frontend SPA + bookmarklet on dinbendon.net)
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. server-to-server, curl)
        if (!origin) return callback(null, true);
        if (config.allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies
app.use(express.json());

// Rate limiting on write endpoints (max 30 requests per minute per IP)
const writeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/topup', writeLimiter);
app.use('/api/spend', writeLimiter);
app.use('/api/checkout/batch', writeLimiter);

// --- Routes ---
app.use('/api', topupRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start Server ---
app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`   Allowed origins: ${config.allowedOrigins.join(', ')}`);
});
