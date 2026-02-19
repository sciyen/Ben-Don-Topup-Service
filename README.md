# Ben-Don Top-Up — Internal Cash Accounting Service

A web-based internal accounting tool for handling cash top-up transactions.
Transactions are recorded to Google Sheets and logged to Google Docs, authenticated via Google OAuth 2.0.

---

## Architecture

```
Browser (React SPA)
    ↓ HTTPS
Node.js Express Backend API
    ↓ Google APIs
Google Sheets + Google Docs
```

- **Frontend** never directly accesses Google Sheets/Docs APIs
- **Backend** holds all Google credentials via service account
- **Authentication** via Google OAuth 2.0 ID tokens

---

## Prerequisites

- Node.js 18+ and npm
- A Google Cloud project
- A Google Spreadsheet
- A Google Doc

---

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Note the project ID

### 2. Enable Required APIs

In the Google Cloud Console, navigate to **APIs & Services → Library** and enable:
- **Google Sheets API**
- **Google Docs API**

### 3. Create OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Ben-Don Top-Up`
5. Authorized JavaScript origins:
   - `http://localhost:5173` (for development)
6. Authorized redirect URIs:
   - `http://localhost:5173` (for development)
7. Click **Create** and note the **Client ID**

> You may need to configure the OAuth consent screen first. Set it to **Internal** if using Google Workspace, or **External** for testing.

### 4. Create a Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service account**
3. Name: `ben-don-topup-service`
4. Click **Create and Continue**
5. Grant role: skip (not needed)
6. Click **Done**
7. Click on the created service account
8. Go to **Keys** tab → **Add Key → Create new key → JSON**
9. Download the JSON key file
10. Save it as `backend/service-account-key.json`

### 5. Set Up the Google Spreadsheet

1. Create a new Google Spreadsheet
2. Rename the first sheet tab to `Transactions`
3. Add headers in row 1:
   ```
   Timestamp | TransactionID | Customer | Amount | PaymentMethod | CashierEmail | Note | IdempotencyKey
   ```
4. Create a second sheet tab named `AuthorizedUsers`
5. Add headers in row 1:
   ```
   email | role | active
   ```
6. Add your authorized user(s):
   ```
   alice@gmail.com | cashier | true
   ```
7. **Share the spreadsheet** with the service account email (found in the JSON key file as `client_email`) with **Editor** access
8. Note the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### 6. Set Up the Google Doc

1. Create a new Google Doc (this will be the transaction log)
2. Add a title like "Transaction Log"
3. **Share the doc** with the service account email with **Editor** access
4. Note the **Doc ID** from the URL:
   `https://docs.google.com/document/d/{DOC_ID}/edit`

---

## Installation

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values
npm install
```

Edit `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json
SPREADSHEET_ID=your-spreadsheet-id
DOC_ID=your-doc-id
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with your Google Client ID
npm install
```

Edit `frontend/.env`:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:3001
```

---

## Running

### Development

Start both servers:

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Usage

1. Open http://localhost:5173 in your browser
2. Click **Sign in with Google**
3. Fill in the top-up form and submit
4. Verify the transaction appears in recent transactions
5. Check your Google Sheet and Doc for the new entries

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/topup` | Submit a cash top-up transaction |
| GET | `/api/transactions?limit=20` | Get recent transactions |
| GET | `/api/health` | Health check |

### POST /api/topup

**Headers:** `Authorization: Bearer <ID_TOKEN>`

**Body:**
```json
{
  "customer": "John Doe",
  "amount": 500,
  "paymentMethod": "Cash",
  "note": "February top-up",
  "idempotencyKey": "uuid-v4-string"
}
```

**Response (200):**
```json
{
  "status": "success",
  "transactionID": "uuid-v4",
  "timestamp": "2026-02-19T14:32:12.000Z"
}
```

**Error codes:** 400 (validation), 401 (auth), 403 (forbidden), 409 (duplicate), 500 (server error)

---

## Project Structure

```
ben-don-top-up/
├── backend/
│   ├── server.js              # Express entry point
│   ├── config.js              # Environment config
│   ├── middleware/
│   │   └── auth.js            # Google ID token verification
│   ├── services/
│   │   ├── authorizationService.js   # AuthorizedUsers sheet check
│   │   ├── sheetsService.js          # Google Sheets operations
│   │   └── docsService.js            # Google Docs log appending
│   ├── routes/
│   │   └── topup.js           # API route handlers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # React entry point
│   │   ├── App.jsx            # Root component with auth routing
│   │   ├── App.css
│   │   ├── api.js             # Backend API client
│   │   ├── index.css          # Global styles
│   │   └── pages/
│   │       ├── Login.jsx      # Google Sign-In page
│   │       ├── Login.css
│   │       ├── Dashboard.jsx  # Main dashboard
│   │       └── Dashboard.css
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Security Notes

- Google service account credentials are **backend-only** (never exposed to browser)
- ID tokens are verified server-side using Google's token verification API
- Transactions are append-only (no updates or deletes)
- Rate limiting is applied to the `/api/topup` endpoint (30 req/min per IP)
- All numeric inputs are validated on the backend
- Authorization is checked against the AuthorizedUsers sheet on every request
