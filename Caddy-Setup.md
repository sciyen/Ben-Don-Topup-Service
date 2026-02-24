# Caddy HTTPS Reverse Proxy Setup

This guide sets up Caddy to serve both the **frontend** (port 5173) and **backend API** (port 6001) behind HTTPS, solving the mixed-content error when the bookmarklet runs on `https://dinbendon.net`.

## Prerequisites

You need **either** a domain name (recommended) or an IP-only setup (self-signed certs).

- **With a domain** → Caddy auto-provisions free TLS certs from Let's Encrypt (zero config).
- **With an IP only** → Caddy uses self-signed certs. Browsers will show a warning; you must accept it once.

---

## 1. Install Caddy

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Verify installation:
```bash
caddy version
```

---

## 2. Create the Caddyfile

Create `/etc/caddy/Caddyfile` (or anywhere you prefer).

### Option A: With a domain name (recommended)

Replace `yourdomain.com` with your actual domain. DNS must point to this server.

```caddyfile
yourdomain.com {
    # Frontend (Vite dev server or static files)
    handle {
        reverse_proxy localhost:5173
    }

    # Backend API
    handle /api/* {
        reverse_proxy localhost:6001
    }
}
```

### Option B: IP-only (self-signed cert)

Replace `10.61.221.28` with your server's IP.

```caddyfile
https://10.61.221.28 {
    tls internal

    # Backend API — match first (more specific)
    handle /api/* {
        reverse_proxy localhost:6001
    }

    # Auth page and static assets
    handle /auth.html {
        reverse_proxy localhost:5173
    }

    # Frontend (everything else)
    handle {
        reverse_proxy localhost:5173
    }
}
```

> **Note:** `tls internal` generates a self-signed certificate. The first time you visit `https://10.61.221.28`, accept the browser security warning.

---

## 3. Start Caddy

```bash
# If installed as a system service:
sudo systemctl restart caddy
sudo systemctl status caddy

# Or run directly (foreground, good for testing):
sudo caddy run --config /etc/caddy/Caddyfile
```

---

## 4. Update your configuration

### Backend `.env`

Add the Caddy HTTPS origin to your allowed origins:

```env
# If using a domain:
ALLOWED_ORIGINS=https://yourdomain.com,https://www.dinbendon.net,https://dinbendon.net

# If using IP:
ALLOWED_ORIGINS=https://10.61.221.28,https://www.dinbendon.net,https://dinbendon.net
```

### Plugin `plugin.js`

Update CONFIG to use HTTPS URLs:

```javascript
const CONFIG = {
    API_BASE: 'https://yourdomain.com',              // or https://10.61.221.28
    AUTH_PAGE: 'https://yourdomain.com/auth.html',    // or https://10.61.221.28/auth.html
};
```

### Frontend `.env`

```env
VITE_API_URL=https://yourdomain.com    # or https://10.61.221.28
```

---

## 5. Verify

1. Open `https://yourdomain.com` (or `https://10.61.221.28`) — should show the frontend
2. Open `https://yourdomain.com/api/me` — should return 401 (no token)
3. Run the bookmarklet on `https://dinbendon.net` — no more mixed-content error

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 443 already in use | Stop the conflicting service: `sudo lsof -i :443` |
| Caddy can't bind port 80/443 | Run with `sudo`, or use `setcap`: `sudo setcap cap_net_bind_service=+ep $(which caddy)` |
| Self-signed cert not trusted by bookmarklet | Visit `https://10.61.221.28` directly in browser first and accept the warning |
| Let's Encrypt fails | Ensure port 80 is open and DNS points to this server |
