# Quick Install Guide

## One-Line Install from GitHub

Once your repository is on GitHub, users can install Nexus Bible with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
```

Or with custom configuration:

```bash
# Install to custom directory
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | INSTALL_DIR=/opt/nexus-bible bash

# Install with PM2 auto-setup
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | SETUP_SERVICE=pm2 bash

# Clone from your fork
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | GIT_REPO=https://github.com/YOUR_USERNAME/nexus-bible.git bash
```

## Manual Installation

### 1. Download the Script

```bash
wget https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh
chmod +x install.sh
```

### 2. Run with Options

```bash
# Interactive install (recommended)
./install.sh

# Or with environment variables
INSTALL_DIR=$HOME/my-nexus-bible \
GIT_REPO=https://github.com/YOUR_USERNAME/nexus-bible.git \
SETUP_SERVICE=pm2 \
./install.sh
```

## What the Script Does

The install script automatically:

1. ✅ Checks Ubuntu/Debian OS compatibility
2. ✅ Verifies ports 5173 and 8787 are available
3. ✅ Installs/updates Node.js 20
4. ✅ Installs system dependencies (git, sqlite3, etc.)
5. ✅ Clones the repository
6. ✅ Downloads the Bible database (~100MB)
7. ✅ Installs npm dependencies
8. ✅ Generates secure environment configuration
9. ✅ Builds the production frontend
10. ✅ Optionally sets up PM2 or systemd service

## Environment Variables

Configure the installation with these variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTALL_DIR` | `$HOME/nexus-bible` | Installation directory |
| `GIT_REPO` | (interactive) | GitHub repository URL |
| `SETUP_SERVICE` | `none` | Service manager: `none`, `pm2`, or `systemd` |
| `FRONTEND_PORT` | `5173` | Frontend development port |
| `BACKEND_PORT` | `8787` | Backend API port |

## Service Setup Options

During installation, you'll be asked how to run the application:

### Option 1: Manual (Development)
```bash
cd ~/nexus-bible
npm run dev:full
```
Good for: Local development, testing

### Option 2: PM2 (Recommended)
```bash
pm2 status
pm2 logs bsb-server
```
Good for: Development servers, small production deployments
- Auto-restart on crash
- Easy log management
- Startup on boot

### Option 3: Systemd Service
```bash
sudo systemctl status nexus-bible
journalctl -u nexus-bible -f
```
Good for: Production servers
- System-level service
- Managed by systemd
- Better integration with Ubuntu

### Option 4: Skip for Now
Set up service later or use different deployment method

## After Installation

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8787

### Useful Commands

```bash
# Navigate to installation
cd ~/nexus-bible

# View logs (PM2)
pm2 logs bsb-server

# View logs (systemd)
journalctl -u nexus-bible -f

# Restart (PM2)
pm2 restart bsb-server

# Restart (systemd)
sudo systemctl restart nexus-bible

# Update application
cd ~/nexus-bible
git pull
npm install
npm run build
pm2 restart bsb-server  # or systemctl restart
```

## Requirements

- Ubuntu 20.04+ or Debian 11+ (may work on other Linux distros)
- 2GB RAM minimum
- 500MB disk space minimum
- Internet connection for installation
- sudo privileges (for system packages and optional service setup)

## Troubleshooting

### Port Already in Use

If ports are in use, stop the conflicting services:

```bash
# Find what's using the port
sudo lsof -i :5173
sudo lsof -i :8787

# Kill the process
sudo kill -9 <PID>
```

Or use different ports:

```bash
FRONTEND_PORT=3000 BACKEND_PORT=3001 ./install.sh
```

### Database Download Fails

Download manually:

```bash
cd ~/nexus-bible/server/data
curl -L -o bible.eng.db https://bible.helloao.org/bible.eng.db
```

### Node.js Version Issues

The script installs Node.js 20, but if you have issues:

```bash
# Remove old Node.js
sudo apt-get remove nodejs
sudo apt-get autoremove

# Re-run install script
./install.sh
```

### Permission Denied

Ensure the script is executable:

```bash
chmod +x install.sh
```

### PM2 Command Not Found

Install PM2 globally:

```bash
sudo npm install -g pm2
```

## Uninstallation

To completely remove nexus-bible:

```bash
# Stop service
pm2 delete bsb-server  # if using PM2
# or
sudo systemctl stop nexus-bible
sudo systemctl disable nexus-bible
sudo rm /etc/systemd/system/nexus-bible.service

# Remove installation directory
rm -rf ~/nexus-bible  # or your custom INSTALL_DIR

# Optional: Remove Node.js if only installed for nexus-bible
sudo apt-get remove nodejs
```

## Security Notes

- The script generates a random JWT secret automatically
- Database files are stored in the installation directory
- Never commit the `.env` file to git
- For production, change the `BSB_ORIGIN` in `.env` to your actual domain

## GitHub Repository Setup

To enable one-line install from your GitHub repo:

1. **Push to GitHub**:
   ```bash
   git add install.sh
   git commit -m "Add installation script"
   git push origin main
   ```

2. **Update URLs** in this guide with your username:
   - Replace `YOUR_USERNAME` with your GitHub username
   - Update in README.md and DEPLOYMENT.md

3. **Test the install**:
   ```bash
   # On a fresh Ubuntu VM/container
   curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
   ```

4. **Share with users**:
   ```
   To install: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
   ```

## Advanced Usage

### Silent Installation

For automated deployments:

```bash
# Pre-configure all options
export INSTALL_DIR=/opt/nexus-bible
export GIT_REPO=https://github.com/YOUR_USERNAME/nexus-bible.git
export SETUP_SERVICE=systemd
export DEBIAN_FRONTEND=noninteractive

# Run non-interactively (requires all options set)
curl -fsSL <script-url> | bash
```

### Docker Alternative

If you prefer Docker, see [DEPLOYMENT.md](DEPLOYMENT.md#option-3-docker-containerization)

---

**Questions?** See the full [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guides.
