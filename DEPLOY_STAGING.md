# Deploy Expo Dev Server to Staging (appbrio.com)

Run the Expo dev server on Ubuntu and expose it via nginx so team members can connect with Expo Go.

## Prerequisites

- Node.js 18+ on the server
- nginx with SSL (appbrio.com)
- DNS: Add `expo.appbrio.com` → same server IP as appbrio.com

> **Why subdomain?** The `exp://` URL format is `exp://host:port` — it doesn't support paths, so we need a dedicated subdomain.

---

## Mobile + shared concierge-client (required since shared code landed)

Mobile imports **`shared/concierge-client`** from the **web repo** (`appbrio`), not from inside `appbrio-mobile`.

On the server both clones must exist as siblings:

```
/var/www/appbrio          ← web + search API + shared/concierge-client
/var/www/appbrio-mobile   ← Expo app (Metro reads ../appbrio via PULSE_WEB_ROOT)
```

After pulling **both** repos:

```bash
cd /var/www/appbrio
git pull
npm install

cd /var/www/appbrio-mobile
git pull
npm install
sudo systemctl restart expo-staging
```

`expo-staging.service` sets `PULSE_WEB_ROOT=/var/www/appbrio`. If Metro fails with “Could not find web repo”, verify:

```bash
test -f /var/www/appbrio/shared/concierge-client/index.js && echo OK
ls -la /var/www/appbrio /var/www/appbrio-mobile
sudo journalctl -u expo-staging -n 50 --no-pager
```

Ensure `www-data` can read both trees:

```bash
sudo chown -R www-data:www-data /var/www/appbrio-mobile
# appbrio may be owned by ubuntu; at minimum:
sudo chmod -R o+rX /var/www/appbrio/shared /var/www/appbrio/src/utils
```

---

## Initial deployment (clone and setup)

Main site: `/var/www/appbrio` · API: systemd service · Mobile: `/var/www/appbrio-mobile`

### 1. Clone the repo

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone git@github.com:gjkloke-max/nightout-mobile.git appbrio-mobile
cd appbrio-mobile
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
EXPO_PUBLIC_SEARCH_API_URL=https://appbrio.com
```

(Use the same Supabase values as the main site at `/var/www/appbrio`.)

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
WorkingDirectory=/var/www/appbrio-mobile
Environment="PULSE_WEB_ROOT=/var/www/appbrio"
Environment="REACT_NATIVE_PACKAGER_HOSTNAME=expo.appbrio.com"
Environment="REACT_NATIVE_PACKAGER_PORT=80"
Environment="EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0"
Environment="NODE_ENV=development"
ExecStart=/usr/bin/npx expo start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> For Option B (direct 8081), remove the `REACT_NATIVE_PACKAGER_PORT=80` line.

Ensure `www-data` can read the app:

```bash
sudo chown -R www-data:www-data /var/www/appbrio-mobile
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
cd /var/www/appbrio && git pull && npm install
cd /var/www/appbrio-mobile && git pull && npm install
sudo systemctl restart expo-staging
# If you run the search API from appbrio:
sudo systemctl restart appbrio-search-api   # or your web API unit name
```

---

## Option A: nginx Proxy (recommended — no extra firewall port)

Proxy **HTTP** on port 80 to Metro (8081). Expo Go speaks plain HTTP for `exp://` — nginx must not use SSL on the advertised port.

### 1. DNS

Add an A record: `expo.appbrio.com` → your server IP (same as appbrio.com).

### 2. SSL certificate

Not required for Expo Go when using HTTP port 80. (Do not proxy Expo through nginx `:443` ssl — Expo Go sends plain HTTP and nginx returns 400.)

### 3. Add nginx server block

Copy the config from the repo (or create it manually):

```bash
# From your local machine, after cloning nightout-mobile to the server:
sudo cp /var/www/appbrio-mobile/nginx-expo-appbrio.conf /etc/nginx/sites-available/expo-appbrio
```

Or create it directly on the server:

```bash
sudo nano /etc/nginx/sites-available/expo-appbrio
```

Paste:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name expo.appbrio.com;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```


### 4. Enable and reload nginx

```bash
sudo ln -sf /etc/nginx/sites-available/expo-appbrio /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Verify

```bash
curl -I http://expo.appbrio.com
```

You should get a response (possibly 404 or similar from Metro until Expo is running — the important part is that nginx is proxying).

### 6. Start Expo (or use systemd from Initial deployment)

Metro runs on 8081; Expo advertises port 80 so the QR code uses `exp://expo.appbrio.com:80`:

```bash
cd /var/www/appbrio-mobile

REACT_NATIVE_PACKAGER_HOSTNAME=expo.appbrio.com \
REACT_NATIVE_PACKAGER_PORT=80 \
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
npx expo start
```

For the systemd service, set `Environment="REACT_NATIVE_PACKAGER_PORT=80"`.

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
cd /var/www/appbrio-mobile

REACT_NATIVE_PACKAGER_HOSTNAME=expo.appbrio.com \
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
npx expo start
```

Connection URL: `exp://expo.appbrio.com:8081`

---

## Environment (.env)

Create `.env` in nightout-mobile with staging values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SEARCH_API_URL=https://appbrio.com
```

---

## Run as a service (systemd)

See the systemd block in **Initial deployment** above. Path: `/var/www/appbrio-mobile`.

---

## Connect with Expo Go

1. Install **Expo Go** on your phone.
2. Ensure the phone can reach `expo.appbrio.com` (same network or public DNS).
3. Scan the QR code from the terminal, or open the `exp://` URL in Expo Go.

---

## Troubleshooting (app not loading in Expo Go)

`systemctl status` showing **active (running)** only means the process started — Metro may still be crashing. Run these on the server:

### 1. Read Expo logs (most important)

```bash
sudo journalctl -u expo-staging -n 150 --no-pager
```

Look for:
- `Could not find pulse web repo` → fix `PULSE_WEB_ROOT=/var/www/appbrio` and paths
- `Missing pulse web file` → pull web repo; `chmod -R o+rX /var/www/appbrio/shared`
- `EACCES` / permission denied → fix ownership (step 4 below)
- Metro never prints `Metro waiting on exp://expo.appbrio.com:80` → Expo failed before ready

### 2. Is Metro listening?

```bash
sudo ss -tlnp | grep 8081
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081
curl -I https://expo.appbrio.com
```

You want something on port **8081** and HTTPS **200/404** from nginx (not 502).

### 3. Run manually as www-data (surfaces errors immediately)

```bash
sudo -u www-data -H bash -lc '
  cd /var/www/appbrio-mobile
  export HOME=/var/www/appbrio-mobile
  export PULSE_WEB_ROOT=/var/www/appbrio
  export REACT_NATIVE_PACKAGER_HOSTNAME=expo.appbrio.com
  export REACT_NATIVE_PACKAGER_PORT=80
  export EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
  ./node_modules/.bin/expo start --port 8081 --non-interactive
'
```

Fix whatever error appears, then Ctrl+C and restart the service.

### 4. Permissions

```bash
sudo mkdir -p /var/www/appbrio-mobile/.expo
sudo chown -R www-data:www-data /var/www/appbrio-mobile
sudo chmod -R o+rX /var/www/appbrio/shared /var/www/appbrio/src/utils
test -f /var/www/appbrio/shared/concierge-client/index.js && echo "web repo OK"
test -f /var/www/appbrio-mobile/node_modules/.bin/expo && echo "expo CLI OK"
```

### 5. Update systemd unit (use local Expo, set HOME)

Copy `expo-staging.service` from the repo (uses `node_modules/.bin/expo`, `HOME`, `--non-interactive`):

```bash
sudo cp /var/www/appbrio-mobile/expo-staging.service /etc/systemd/system/expo-staging.service
sudo systemctl daemon-reload
sudo systemctl restart expo-staging
```

### 6. Phone / Expo Go

- Project uses **Expo SDK 54** — update Expo Go from the App Store / Play Store.
- Connection URL: `exp://expo.appbrio.com:80` (not `:443` — Expo Go uses plain HTTP)
- If bundle loads but auth fails, add the redirect URL printed in Metro logs to Supabase.
