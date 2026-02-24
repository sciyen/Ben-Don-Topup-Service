/**
 * Backend configuration.
 * Loads and validates environment variables.
 */
const path = require('path');

// Load .env from backend directory
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Validate required variables
const required = [
  'GOOGLE_SERVICE_ACCOUNT_KEY_PATH',
  'SPREADSHEET_ID',
  'DOC_ID',
  'JWT_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  spreadsheetId: process.env.SPREADSHEET_ID,
  docId: process.env.DOC_ID,
  port: parseInt(process.env.PORT, 10) || 3001,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
