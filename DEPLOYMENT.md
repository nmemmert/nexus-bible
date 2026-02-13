# Nexus Bible Deployment Guide

## Quick Install

### Automated Installation (Ubuntu/Debian)

The fastest way to get started on Ubuntu/Debian:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
```

This fully automated script will:
- Install Node.js and all dependencies
- Download the Bible database
- Set up environment configuration
- Build the application
- Optionally configure PM2 or systemd

**See [INSTALL.md](INSTALL.md) for detailed installation options and troubleshooting.**

---

## Overview

Nexus Bible is a React + TypeScript frontend with an Express backend server for local data sync. This guide covers deployment options for both small and large-scale deployments.

## Architecture

- **Frontend**: React SPA built with Vite
- **Backend**: Express server with SQLite database
- **External API**: Bible.helloao.org (proxied in development)

## Prerequisites

- Node.js 18+ 
- npm or pnpm
- Production server with SSL certificate (recommended)
- Database files: `bible.eng.db` (Bible search data)

## Build Process

### 1. Build Frontend

```bash
npm run build
```

This creates production files in `dist/`

### 2. Build Backend (Optional - for compiled deployment)

```bash
npm run build:server
```

This compiles TypeScript server to `dist/server/`

## Deployment Options

### Option 1: Small/Medium Scale - Single VPS (Recommended for Starting)

**Best for**: Personal use, small teams, testing

**Platforms**: DigitalOcean, Linode, Hetzner, AWS Lightsail

**Steps**:

1. **Provision VPS**
   - 1-2 GB RAM minimum
   - Ubuntu 22.04 LTS recommended

2. **Setup Server**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install nginx
sudo apt-get install nginx

# Install PM2 for process management
sudo npm install -g pm2
```

3. **Deploy Application**
```bash
# Clone or upload your code
git clone <your-repo>
cd nexus-bible

# Install dependencies
npm ci --production

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with production values

# Ensure database files exist
# Upload bible.eng.db to server/data/

# Build frontend
npm run build

# Start backend with PM2
pm2 start server/index.ts --name bsb-server --interpreter tsx
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

4. **Configure Nginx**
```nginx
# /etc/nginx/sites-available/nexus-bible
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend - serve static files
    location / {
        root /path/to/nexus-bible/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8787/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Bible API proxy
    location /bible-api/ {
        proxy_pass https://bible.helloao.org/;
        proxy_ssl_server_name on;
        proxy_set_header Host bible.helloao.org;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nexus-bible /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Cost**: ~$5-12/month

---

### Option 2: Serverless/JAMstack - Split Deployment

**Best for**: Scalability, global performance, minimal backend needs

**Frontend**: Vercel, Netlify, Cloudflare Pages  
**Backend**: Railway, Render, Fly.io

**Frontend Deployment (Vercel)**:

1. Connect repository to Vercel
2. Configure build:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`

3. Environment Variables:
   - `VITE_API_URL`: Your backend URL

4. Add nginx-style redirects in `vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.railway.app/:path*"
    },
    {
      "source": "/bible-api/:path*",
      "destination": "https://bible.helloao.org/:path*"
    }
  ]
}
```

**Backend Deployment (Railway)**:

1. Connect repository to Railway
2. Create new service from repo
3. Configure:
   - Start Command: `npm run server`
   - Or use compiled version: `npm run build:server && npm run start:server`

4. Add environment variables:
   - `BSB_JWT_SECRET`: Generate strong secret
   - `BSB_ORIGIN`: Your frontend URL
   - `PORT`: Railway sets automatically

5. **Important**: Upload `bible.eng.db` to persistent volume or S3-compatible storage

**Cost**: Free tier available, ~$5-10/month for backend

---

### Option 3: Docker Containerization

**Best for**: Kubernetes, cloud platforms, reproducible deployments

Create `Dockerfile`:

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Install production dependencies only
RUN npm ci --production

EXPOSE 8787 5173

# Start both frontend preview and backend
CMD ["sh", "-c", "npm run preview & npm run start:server"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5173:5173"
      - "8787:8787"
    environment:
      - BSB_JWT_SECRET=${BSB_JWT_SECRET}
      - BSB_ORIGIN=http://localhost:5173
    volumes:
      - ./server/data:/app/server/data
    restart: unless-stopped
```

Deploy to:
- **AWS ECS**: Higher scale, ~$20+/month
- **Google Cloud Run**: Serverless containers, pay per use
- **DigitalOcean App Platform**: ~$12+/month

---

### Option 4: Large Scale - Cloud Architecture

**Best for**: High traffic, enterprise, geographic distribution

**Architecture**:
- **Frontend**: Cloudflare + S3/Cloud Storage
- **Backend**: Auto-scaling containers (ECS, Cloud Run)
- **Database**: Managed PostgreSQL (migrate from SQLite)
- **Cache**: Redis for sessions
- **CDN**: CloudFront or Cloudflare

**Approximate Costs**: $50-500+/month depending on traffic

---

## Environment Configuration

### Production Environment Variables

Create `.env` file:

```bash
# CRITICAL: Use strong random secret in production
BSB_JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Database paths
BSB_DB_PATH=./server/data/bsb.sqlite
BSB_BIBLE_DB_PATH=./server/data/bible.eng.db

# CORS - set to your frontend URL
BSB_ORIGIN=https://yourdomain.com

# Port (some platforms set this automatically)
PORT=8787
```

Generate secure JWT secret:
```bash
openssl rand -base64 32
```

---

## Database Setup

### Required Files

1. **bible.eng.db**: Bible search database
   - Download or obtain this file
   - Place in `server/data/`
   - ~50-200MB depending on content

2. **bsb.sqlite**: User data (auto-created)
   - Stores users, notes, highlights, plans
   - Auto-created on first run
   - Backup regularly in production!

### Database Backups

```bash
# Backup user database
cp server/data/bsb.sqlite backups/bsb-$(date +%Y%m%d).sqlite

# Automated daily backup with cron
0 2 * * * /path/to/backup-script.sh
```

---

## Performance Optimization

### Frontend

1. **Enable compression**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
})
```

2. **Lazy load routes**:
```typescript
const ReaderRoute = lazy(() => import('./routes/Reader'))
```

### Backend

1. **Enable compression**:
```typescript
import compression from 'compression'
app.use(compression())
```

2. **Add rate limiting**:
```typescript
import rateLimit from 'express-rate-limit'
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})
app.use('/api/', limiter)
```

3. **Database optimization**:
```typescript
// Add indexes for common queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
`)
```

---

## Monitoring & Maintenance

### Health Checks

The app includes `/health` endpoint for monitoring:

```bash
curl http://your-backend.com/health
```

### Logging

Use PM2 for logs on VPS:
```bash
pm2 logs bsb-server
pm2 monit
```

For production, integrate with:
- Sentry (error tracking)
- LogRocket (session replay)
- DataDog (infrastructure monitoring)

### Database Maintenance

```bash
# Vacuum SQLite database monthly
sqlite3 server/data/bsb.sqlite "VACUUM;"

# Check database integrity
sqlite3 server/data/bsb.sqlite "PRAGMA integrity_check;"
```

---

## Security Checklist

- [ ] Strong JWT secret (32+ random characters)
- [ ] HTTPS/SSL certificate enabled
- [ ] CORS properly configured
- [ ] Environment variables not committed to git
- [ ] Database files in .gitignore
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Regular dependency updates (`npm audit`)
- [ ] Database backups automated
- [ ] Error messages don't leak sensitive info

---

## Recommended Approach for Your Large App

Given this is a large app, I recommend:

**For Initial Launch**:
- **Option 1** (VPS) or **Option 2** (Serverless split)
- Start with a $10-12/month VPS or free tier serverless
- Monitor usage and scale as needed

**For Growth**:
- Migrate to **Option 4** (Cloud Architecture) when you hit:
  - 10k+ daily active users
  - Need for geographic distribution
  - Require 99.9%+ uptime SLA

**Quick Start Recommendation**:
1. Deploy backend to Railway/Render (easier database management)
2. Deploy frontend to Vercel (automatic HTTPS, global CDN)
3. Cost: $0-10/month to start
4. Scale from there

---

## Troubleshooting

### Common Issues

**Frontend can't connect to backend**:
- Check CORS configuration in backend
- Verify `BSB_ORIGIN` environment variable
- Check network/firewall rules

**Database errors**:
- Ensure `bible.eng.db` file exists
- Check file permissions (chmod 644)
- Verify database paths in .env

**Authentication not working**:
- Verify JWT_SECRET is set
- Check token expiration
- Clear browser localStorage

---

## Support & Updates

Keep dependencies updated:
```bash
npm outdated
npm update
```

Security updates:
```bash
npm audit
npm audit fix
```

---

For questions or issues, check the project README or open an issue in the repository.
