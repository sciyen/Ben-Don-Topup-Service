/**
 * Configuration module
 * Centralizes environment variable reading with validation.
 */
require('dotenv').config();

const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_SERVICE_ACCOUNT_KEY_PATH',
  'SPREADSHEET_ID',
  'DOC_ID',
];

// Validate that all required environment variables are set
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    console.error(`   See .env.example for reference.`);
    process.exit(1);
  }
}

module.exports = {
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  spreadsheetId: process.env.SPREADSHEET_ID,
  docId: process.env.DOC_ID,
  port: parseInt(process.env.PORT, 10) || 3001,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
