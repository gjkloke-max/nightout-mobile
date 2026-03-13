# Deploy Expo Dev Server to Staging (pulse.techies.com)

Run the Expo dev server on Ubuntu and expose it via nginx so team members can connect with Expo Go.

## Prerequisites

- Node.js 18+ on the server
- nginx with SSL (pulse.techies.com)
- DNS: Add `expo.techies.com` → same server IP as pulse.techies.com

> **Why subdomain?** The `exp://` URL format is `exp://host:port` — it doesn't support paths, so we need a dedicated subdomain.

---

## Initial deployment (clone and setup)

Main site: `/var/www/pulse` · API: systemd service · Mobile: `/var/www/pulse-mobile`

### 1. Clone the repo

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone git@github.com:gjkloke-max/nightout-mobile.git pulse-mobile
cd pulse-mobile
```

### 2. Install dependencies

```bash
npm install
```

No build step — Metro bundles on demand when clients connect.

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with staging values:
nano .env
```

Set:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SEARCH_API_URL=https://pulse.techies.com
```

(Use the same Supabase values as the main site at `/var/www/pulse`.)

### 4. Add nginx config (Option A) or open firewall (Option B)

See sections below.

### 5. Create systemd service

```bash
sudo nano /etc/systemd/system/expo-staging.service
```

```ini
[Unit]
Description=Expo Dev Server (nightout-mobile staging)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/pulse-mobile
Environment="REACT_NATIVE_PACKAGER_HOSTNAME=expo.techies.com"
Environment="REACT_NATIVE_PACKAGER_PORT=443"
Environment="EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0"
Environment="NODE_ENV=development"
ExecStart=/usr/bin/npx expo start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> For Option B (direct 8081), remove the `REACT_NATIVE_PACKAGER_PORT=443` line.

Ensure `www-data` can read the app:

```bash
sudo chown -R www-data:www-data /var/www/pulse-mobile
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable expo-staging
sudo systemctl start expo-staging
sudo systemctl status expo-staging
```

### 6. Updating after code changes

```bash
cd /var/www/pulse-mobile
git pull
npm install
sudo systemctl restart expo-staging
```

---

## Option A: nginx Proxy (recommended — no extra firewall port)

Proxy HTTPS traffic to Metro so everything goes through port 443.

### 1. DNS

Add an A record: `expo.techies.com` → your server IP (same as pulse.techies.com).

### 2. SSL certificate

Get a cert for `expo.techies.com`:

```bash
sudo certbot certonly --nginx -d expo.techies.com
```

### 3. Add nginx server block

Copy the config from the repo (or create it manually):

```bash
# From your local machine, after cloning nightout-mobile to the server:
sudo cp /var/www/pulse-mobile/nginx-expo-pulse.conf /etc/nginx/sites-available/expo-pulse
```

Or create it directly on the server:

```bash
sudo nano /etc/nginx/sites-available/expo-pulse
```

Paste (SSL paths assume `certbot -d expo.techies.com`):

```nginx
server {
    listen 443 ssl;
    server_name expo.techies.com;

    ssl_certificate /etc/letsencrypt/live/expo.techies.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/expo.techies.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```


### 4. Enable and reload nginx

```bash
sudo ln -sf /etc/nginx/sites-available/expo-pulse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Verify

```bash
curl -I https://expo.techies.com
```

You should get a response (possibly 404 or similar from Metro until Expo is running — the important part is that nginx is proxying).

### 6. Start Expo (or use systemd from Initial deployment)

Metro runs on 8081; Expo advertises 443 so the QR code uses `exp://expo.techies.com:443`:

```bash
cd /var/www/pulse-mobile

REACT_NATIVE_PACKAGER_HOSTNAME=expo.techies.com \
REACT_NATIVE_PACKAGER_PORT=443 \
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
npx expo start
```

For the systemd service, add `Environment="REACT_NATIVE_PACKAGER_PORT=443"` to the `[Service]` block.

> If `REACT_NATIVE_PACKAGER_PORT=443` doesn't change the QR URL, use Option B (direct port 8081).

---

## Option B: Direct port 8081 (simpler, requires firewall)

Open port 8081 and connect directly to Metro.

### 1. Firewall

```bash
sudo ufw allow 8081/tcp
sudo ufw reload
```

### 2. Start Expo

```bash
cd /var/www/pulse-mobile

REACT_NATIVE_PACKAGER_HOSTNAME=expo.techies.com \
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
npx expo start
```

Connection URL: `exp://expo.techies.com:8081`

---

## Environment (.env)

Create `.env` in nightout-mobile with staging values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SEARCH_API_URL=https://pulse.techies.com
```

---

## Run as a service (systemd)

See the systemd block in **Initial deployment** above. Path: `/var/www/pulse-mobile`.

---

## Connect with Expo Go

1. Install **Expo Go** on your phone.
2. Ensure the phone can reach `expo.techies.com` (same network or public DNS).
3. Scan the QR code from the terminal, or open the `exp://` URL in Expo Go.
