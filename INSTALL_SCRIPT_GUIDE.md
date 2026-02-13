# Installation Script - Complete Guide

## What Was Created

### 📦 Installation Files

1. **`install.sh`** - Main installation script
   - 650+ lines of automated installation
   - Checks system compatibility
   - Installs all dependencies
   - Downloads database automatically
   - Sets up environment
   - Configures services (PM2/systemd)

2. **`test-install.sh`** - Quick prerequisite checker
   - Verifies your system is ready
   - Shows example commands

3. **`INSTALL.md`** - Complete installation guide
   - Usage examples
   - Troubleshooting
   - Configuration options

4. **`GITHUB_SETUP.md`** - Repository setup guide
   - How to publish on GitHub
   - One-line install setup
   - Best practices

---

## How to Use

### Option 1: Install from GitHub (Recommended)

After you push to GitHub, users can install with:

```bash
# Replace nmemmert with your GitHub username
curl -fsSL https://raw.githubusercontent.com/nmemmert/nexus-bible/main/install.sh | bash
```

**Before this works, you need to:**

1. **Create GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Add automated install script"
   git remote add origin https://github.com/nmemmert/nexus-bible.git
   git push -u origin main
   ```

2. **Update documentation**:
   ```bash
   # Replace nmemmert in these files:
   sed -i 's/nmemmert/your-github-username/g' README.md INSTALL.md DEPLOYMENT.md
   git add .
   git commit -m "Update GitHub username in docs"
   git push
   ```

3. **Make repository public** (optional):
   - Go to Settings → General → Danger Zone
   - Change visibility to Public

### Option 2: Local Installation

Use the script directly from your local copy:

```bash
# Make sure it's executable
chmod +x install.sh

# Run interactively
./install.sh

# Or with environment variables
INSTALL_DIR=$HOME/my-nexus-bible \
SETUP_SERVICE=pm2 \
./install.sh
```

### Option 3: Custom Installation

Download and customize before running:

```bash
# Download script
wget https://raw.githubusercontent.com/nmemmert/nexus-bible/main/install.sh

# Review it
less install.sh

# Make executable
chmod +x install.sh

# Run with custom options
INSTALL_DIR=/opt/nexus-bible ./install.sh
```

---

## What the Script Does

### Automatic Installation Steps

```
1. ✓ Check OS compatibility (Ubuntu/Debian)
   └─ Verify Linux distribution

2. ✓ Check port availability
   ├─ Port 5173 (Frontend)
   └─ Port 8787 (Backend)

3. ✓ Install system dependencies
   ├─ curl, wget, git
   ├─ build-essential
   ├─ python3
   └─ sqlite3

4. ✓ Install/Update Node.js
   ├─ Check current version
   ├─ Install Node.js 20 if needed
   └─ Verify npm installation

5. ✓ Clone repository
   ├─ From GitHub URL
   └─ Or prompt for URL

6. ✓ Download Bible database
   ├─ Download bible.eng.db (~100MB)
   └─ Verify download

7. ✓ Install dependencies
   └─ npm install (all packages)

8. ✓ Configure environment
   ├─ Generate secure JWT secret
   ├─ Create .env file
   └─ Set database paths

9. ✓ Build application
   ├─ Build frontend (dist/)
   └─ Optimize for production

10. ✓ Setup service (optional)
    ├─ PM2 process manager
    ├─ Systemd service
    └─ Or skip for manual
```

---

## Configuration Options

### Environment Variables

Control the installation with these variables:

```bash
# Installation directory (default: ~/nexus-bible)
INSTALL_DIR=/path/to/install

# GitHub repository URL
GIT_REPO=https://github.com/nmemmert/nexus-bible.git

# Service management: none, pm2, systemd
SETUP_SERVICE=pm2

# Port configuration
FRONTEND_PORT=5173  # Vite dev server
BACKEND_PORT=8787   # Express API
```

### Example Configurations

**Basic install:**
```bash
./install.sh
```

**Custom directory:**
```bash
INSTALL_DIR=/opt/nexus-bible ./install.sh
```

**With PM2:**
```bash
SETUP_SERVICE=pm2 ./install.sh
```

**Complete custom:**
```bash
INSTALL_DIR=/srv/bsb \
GIT_REPO=https://github.com/myuser/my-fork.git \
SETUP_SERVICE=systemd \
./install.sh
```

---

## Service Management

The script offers 3 service options:

### 1. Manual (Development)

No service setup. Run manually:

```bash
cd ~/nexus-bible
npm run dev:full  # Both frontend + backend
```

**Good for:** Local development, testing

### 2. PM2 (Recommended)

Process manager with auto-restart:

```bash
pm2 status              # Check status
pm2 logs bsb-server     # View logs
pm2 restart bsb-server  # Restart app
pm2 stop bsb-server     # Stop app
```

**Good for:** 
- Development servers
- Small production deployments
- Easy management

**Features:**
- Auto-restart on crash
- Log management
- Startup on boot
- Process monitoring

### 3. Systemd Service

System-level service:

```bash
sudo systemctl status nexus-bible   # Check status
sudo systemctl restart nexus-bible  # Restart
sudo systemctl stop nexus-bible     # Stop
journalctl -u nexus-bible -f        # View logs
```

**Good for:**
- Production servers
- Enterprise deployments
- System integration

**Features:**
- System-managed
- Better security
- Standard Linux service
- Integration with system tools

---

## After Installation

### Accessing the App

```
Frontend:  http://localhost:5173
Backend:   http://localhost:8787
```

### File Locations

```
~/nexus-bible/                   # Installation directory
├── .env                     # Environment config (generated)
├── server/data/
│   ├── bsb.sqlite          # User data (auto-created)
│   └── bible.eng.db        # Bible database (downloaded)
├── dist/                    # Built frontend
└── node_modules/            # Dependencies
```

### Managing the App

**PM2:**
```bash
pm2 list                    # List processes
pm2 logs bsb-server         # Tail logs
pm2 restart bsb-server      # Restart
pm2 stop bsb-server         # Stop
pm2 delete bsb-server       # Remove from PM2
```

**Systemd:**
```bash
sudo systemctl status nexus-bible      # Status
sudo systemctl restart nexus-bible     # Restart
journalctl -u nexus-bible --since today # Today's logs
```

**Manual:**
```bash
cd ~/nexus-bible
npm run dev:full            # Development
npm run server              # Backend only
```

### Updating the App

```bash
cd ~/nexus-bible
git pull                    # Get updates
npm install                 # Update dependencies
npm run build               # Rebuild

# Restart service
pm2 restart bsb-server      # PM2
# or
sudo systemctl restart nexus-bible  # Systemd
```

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port
sudo lsof -i :5173
sudo lsof -i :8787

# Kill process
sudo kill -9 <PID>

# Or use different ports
FRONTEND_PORT=3000 BACKEND_PORT=3001 ./install.sh
```

**Database download fails:**
```bash
# Download manually
cd ~/nexus-bible/server/data
curl -L -o bible.eng.db https://bible.helloao.org/bible.eng.db
```

**Permission denied:**
```bash
chmod +x install.sh
```

**Node.js version issues:**
```bash
# Remove old Node.js
sudo apt-get remove nodejs
sudo apt-get autoremove

# Re-run installer (will install Node 20)
./install.sh
```

**PM2 not found:**
```bash
sudo npm install -g pm2
```

### Getting Help

1. Check [INSTALL.md](INSTALL.md) - Detailed troubleshooting
2. Check [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guides
3. Open an issue on GitHub

---

## Sharing Your App

### Quick Install for Users

Once on GitHub, share this one-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/nmemmert/nexus-bible/main/install.sh | bash
```

### For Your README

Add this to your README.md:

```markdown
## Quick Install

One command to install everything on Ubuntu/Debian:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/nmemmert/nexus-bible/main/install.sh | bash
\`\`\`

See [INSTALL.md](INSTALL.md) for more options.
```

---

## Security Notes

The install script:

- ✅ Generates a random JWT secret automatically
- ✅ Creates environment file with secure defaults
- ✅ Sets proper file permissions
- ✅ Uses official package sources
- ✅ Downloads from trusted URLs only

**For production:**
- Review `.env` and adjust `BSB_ORIGIN` to your domain
- Never commit `.env` to git (already in `.gitignore`)
- Use strong passwords for any accounts
- Consider firewall rules for ports

---

## Next Steps

1. ✅ **Push to GitHub** (see [GITHUB_SETUP.md](GITHUB_SETUP.md))
2. ✅ **Update nmemmert** in all docs
3. ✅ **Test the install** on a fresh Ubuntu VM
4. ✅ **Share with users**!

---

## Summary

You now have:

- ✅ **Automated installation** - One command to install everything
- ✅ **GitHub-ready** - Users can install directly from your repo
- ✅ **Service options** - Manual, PM2, or systemd
- ✅ **Complete docs** - Installation, deployment, and setup guides
- ✅ **Production-ready** - Secure environment, optimized build

**Your app is ready to share with the world! 🚀**
