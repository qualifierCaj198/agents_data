# Policy Pulse – Application Form

A simple Node/Express app with:
- Public application form
- Resume upload (PDF/DOC/DOCX/TXT/RTF, up to 10MB)
- SQLite storage
- Admin panel showing submissions and resume download link
- GitHub Actions workflow to deploy to a Vultr Ubuntu server via SSH

## Local Dev

```bash
cp .env.example .env
npm ci
npm run dev
# visit http://localhost:3000
```

Admin is at `/admin` and uses HTTP Basic Auth with `ADMIN_USER`/`ADMIN_PASS` from `.env`.

Uploads are stored in `uploads/` and are served statically at `/uploads/<filename>`.

## Production (Ubuntu 22.04 on Vultr)

1. Install Node, PM2, Nginx

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
npm i -g pm2

apt-get install -y nginx
```

2. Put the app under `/var/www/policy-pulse`

The GitHub Action included in this repo will copy files there and run:
```bash
npm ci
pm2 startOrReload ecosystem.config.cjs
```

3. Nginx site (reverse proxy on port 80) – example:

```
server {
  listen 80;
  server_name _;
  client_max_body_size 20M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```
Enable and reload:
```bash
rm -f /etc/nginx/sites-enabled/default
tee /etc/nginx/sites-available/policy-pulse <<'CONF'
server {
  listen 80;
  server_name _;
  client_max_body_size 20M;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
CONF
ln -sf /etc/nginx/sites-available/policy-pulse /etc/nginx/sites-enabled/policy-pulse
nginx -t && systemctl reload nginx
```

4. Create `.env` on the server:
```
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=changeme
BASE_URL=http://207.246.115.9
```
(Use strong values.)

## GitHub Actions Deployment

- Add the following GitHub Action secrets in your repo settings:
  - `SSH_HOST` – e.g., 207.246.115.9
  - `SSH_USER` – e.g., root
  - `SSH_PASSWORD` – your SSH password
- Push to `main` to trigger the workflow.

## Admin Login
Go to `http://<server-ip>/admin` and use the admin credentials from `.env`.

## Backups
The SQLite file is `policy_pulse.sqlite`. Back it up regularly.
