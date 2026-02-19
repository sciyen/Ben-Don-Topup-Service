# Ben-Don Top-Up — Internal Cash Accounting Service

A web-based internal accounting tool for handling cash top-up and spend transactions.
Transactions are recorded to Google Sheets and logged to Google Docs, authenticated via Google OAuth 2.0.

## Features

- **Top-Up & Spend** — record deposits and deductions per customer
- **Dynamic Balance** — computed in real-time from the append-only ledger
- **Auto Checkout** — paste a table from [dinbendon.net](https://dinbendon.net), preview balances, and batch-deduct in one click
- **Overdraft Prevention** — single and batch spends are rejected if balance is insufficient
- **Google Sheets Ledger** — append-only, never modifies past rows
- **Google Docs Log** — human-readable transaction log
- **Google OAuth 2.0** — role-based access (cashier / admin / viewer)

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

### 2. Enable Required APIs

In **APIs & Services → Library**, enable:
- **Google Sheets API**
- **Google Docs API**

### 3. Create OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins: `http://localhost:5173`
5. Authorized redirect URIs: `http://localhost:5173`
6. Note the **Client ID**

> Configure the OAuth consent screen first: **Internal** for Google Workspace, or **External** for testing.

### 4. Create a Service Account

1. Go to **APIs & Services → Credentials → Create Credentials → Service account**
2. Name: `ben-don-topup-service`
3. Go to **Keys** tab → **Add Key → Create new key → JSON**
4. Save the JSON key file as `backend/service-account-key.json`

### 5. Set Up the Google Spreadsheet

1. Create a new Google Spreadsheet
2. Rename the first sheet tab to `Transactions` with headers:
   ```
   Timestamp | TransactionID | Customer | Type | Amount | CashierEmail | Note | IdempotencyKey
   ```
3. Create a second sheet tab named `AuthorizedUsers` with headers:
   ```
   email | role | active
   ```
4. Add your authorized user(s):
   ```
   alice@gmail.com | cashier | true
   ```
5. **Share the spreadsheet** with the service account email (`client_email` in the JSON key) with **Editor** access
6. Note the **Spreadsheet ID** from the URL

### 6. Set Up the Google Doc

1. Create a new Google Doc
2. **Share** with the service account email with **Editor** access
3. Note the **Doc ID** from the URL

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

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/topup` | cashier/admin | Submit a top-up (deposit) |
| POST | `/api/spend` | cashier/admin | Submit a spend (deduction) with overdraft check |
| GET | `/api/balance?customer=xxx` | all roles | Look up customer balance |
| POST | `/api/balance/batch` | all roles | Batch balance lookup |
| POST | `/api/checkout/batch` | cashier/admin | Atomic batch checkout |
| GET | `/api/transactions?limit=20` | all roles | Get recent transactions |
| GET | `/api/health` | none | Health check |

### POST /api/topup

```json
{ "customer": "John", "amount": 500, "note": "Feb top-up", "idempotencyKey": "uuid" }
```

### POST /api/spend

```json
{ "customer": "John", "amount": 100, "note": "Lunch", "idempotencyKey": "uuid" }
```

### POST /api/checkout/batch

```json
{
  "rows": [
    { "customer": "Alice", "amount": 35, "note": "酸辣湯" },
    { "customer": "Bob", "amount": 95, "note": "古早味乾麵, 珍珠餛飩湯" }
  ],
  "idempotencyKey": "uuid"
}
```

Returns `transactionCount`, `skippedCount`, and `skippedRows` details. Invalid rows are skipped, not rejected.

---

## Sheets Schema

**Transactions** sheet columns:

| Timestamp | TransactionID | Customer | Type | Amount | CashierEmail | Note | IdempotencyKey |

- `Type` ∈ `{ TOPUP, SPEND }`
- `Amount`: positive for TOPUP, negative for SPEND
- Append-only — rows are never modified or deleted

**AuthorizedUsers** sheet columns:

| email | role | active |

Roles: `cashier` (read+write), `admin` (read+write), `viewer` (read-only)

---

## Project Structure

```
ben-don-top-up/
├── backend/
│   ├── server.js                     # Express entry point
│   ├── config.js                     # Environment config
│   ├── middleware/
│   │   └── auth.js                   # Google ID token verification
│   ├── services/
│   │   ├── authorizationService.js   # Role-based authorization
│   │   ├── sheetsService.js          # Google Sheets CRUD
│   │   ├── docsService.js            # Google Docs log appending
│   │   ├── balanceService.js         # Dynamic balance computation
│   │   └── batchCheckoutService.js   # Atomic batch spend logic
│   ├── routes/
│   │   └── topup.js                  # All API route handlers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx                  # React entry point
│   │   ├── App.jsx                   # Root component with nav tabs
│   │   ├── App.css
│   │   ├── api.js                    # Backend API client
│   │   ├── index.css                 # Global styles
│   │   └── pages/
│   │       ├── Login.jsx / .css      # Google Sign-In page
│   │       ├── Dashboard.jsx / .css  # Top-Up, Spend, Balance
│   │       └── AutoCheckout.jsx / .css # Batch checkout from clipboard
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Security Notes

- Service account credentials are **backend-only** (never exposed to browser)
- ID tokens verified server-side using Google's token verification API
- Append-only ledger — no updates or deletes
- Rate limiting on `/api/topup`, `/api/spend`, `/api/checkout/batch` (30 req/min per IP)
- All inputs validated on the backend
- Authorization checked on every request against the AuthorizedUsers sheet
