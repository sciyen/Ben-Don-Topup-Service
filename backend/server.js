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

// CORS: allow frontend origin
app.use(cors({
    origin: config.allowedOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies
app.use(express.json());

// Rate limiting on top-up endpoint (max 30 requests per minute per IP)
const topupLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/topup', topupLimiter);

// --- Routes ---
app.use('/api', topupRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start Server ---
app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`   Allowed origin: ${config.allowedOrigin}`);
});
