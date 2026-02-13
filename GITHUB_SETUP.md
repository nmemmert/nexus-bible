# How to Use This Repository on GitHub

## Setting Up Your Repository

### 1. Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Nexus Bible"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/nexus-bible.git
git branch -M main
git push -u origin main
```

### 2. Update Install Script URLs

Replace `YOUR_USERNAME` in these files with your actual GitHub username:

- `README.md` - Line with install command
- `INSTALL.md` - All install examples
- `DEPLOYMENT.md` - Quick install section

**Find and replace:**
```bash
# In your editor or with sed:
sed -i 's/YOUR_USERNAME/your-actual-username/g' README.md INSTALL.md DEPLOYMENT.md
```

### 3. Test the Install Script

Before sharing, test on a fresh Ubuntu installation:

```bash
# Local test first
./install.sh

# Test from GitHub (after pushing)
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
```

## Making the Repository Public

On GitHub:
1. Go to Settings → General
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make public"

## Sharing Your App

After setup, users can install with:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
```

## Repository Structure

```
nexus-bible/
├── install.sh              # Automated installation script ⭐
├── test-install.sh         # Test the installer
├── INSTALL.md             # Installation guide
├── DEPLOYMENT.md          # Deployment strategies
├── README.md              # Main documentation
├── .env.example           # Environment template
├── src/                   # React frontend
├── server/                # Express backend
└── public/                # Static assets
```

## Important Files for GitHub

### Files to Commit
- ✅ `install.sh` - Installation script
- ✅ `README.md` - Documentation
- ✅ `DEPLOYMENT.md` - Deployment guide
- ✅ `INSTALL.md` - Installation instructions
- ✅ `.env.example` - Environment template
- ✅ `.gitignore` - Git ignore rules
- ✅ All source code (`src/`, `server/`)

### Files to NEVER Commit
- ❌ `.env` - Contains secrets
- ❌ `node_modules/` - Dependencies
- ❌ `dist/` - Build output
- ❌ `*.db`, `*.sqlite` - Database files
- ❌ `server/data/*.db` - Bible database

(These should already be in `.gitignore`)

## README Badge Ideas

Add these to your README.md to make it look professional:

```markdown
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Debian-orange)
```

## GitHub Actions (Optional)

Create `.github/workflows/test-install.yml` to automatically test the install script:

```yaml
name: Test Installation

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test-install:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Test install script
      run: |
        chmod +x install.sh
        # Dry run test - check if script is valid bash
        bash -n install.sh
        
    - name: Verify required files
      run: |
        test -f install.sh
        test -f README.md
        test -f DEPLOYMENT.md
        test -f .env.example
        test -f package.json
```

## Creating Releases

Tag versions for releases:

```bash
# Tag a release
git tag -a v1.0.0 -m "First stable release"
git push origin v1.0.0

# Users can then install specific versions
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/v1.0.0/install.sh | bash
```

## Enable GitHub Pages (Optional)

To host documentation:

1. Go to Settings → Pages
2. Source: Deploy from branch `main`
3. Folder: `/ (root)` or `/docs`
4. Your README will be visible at: `https://YOUR_USERNAME.github.io/nexus-bible/`

## License

Add a LICENSE file. For open source, consider:

```bash
# MIT License (permissive)
curl -o LICENSE https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt

# Edit the year and name
nano LICENSE
```

## Contributing Guidelines

Create `CONTRIBUTING.md`:

```markdown
# Contributing to nexus-bible

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

Before submitting:
- Run `npm run lint`
- Run `npm run build`
- Test the install script: `./install.sh`

## Questions?

Open an issue on GitHub!
```

## Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug report
about: Create a report to help us improve
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Environment**
- OS: [e.g. Ubuntu 22.04]
- Node version: [e.g. 20.0.0]
- Installation method: [install.sh / manual]

**Logs**
Paste relevant logs here.
```

## Example README Badges

```markdown
# Nexus Bible

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Platform](https://img.shields.io/badge/platform-Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> A modern Bible study application with one-line installation

## Quick Install

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
\`\`\`

[Full documentation](./README.md) | [Installation Guide](./INSTALL.md) | [Deployment](./DEPLOYMENT.md)
```

## Maintenance

### Updating the App

When you push updates:

```bash
git add .
git commit -m "Update features"
git push

# Users can update with:
cd ~/nexus-bible
git pull
npm install
npm run build
pm2 restart bsb-server  # or systemctl restart
```

### Security

- Enable Dependabot on GitHub for dependency updates
- Add `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Next Steps

1. ✅ Push to GitHub
2. ✅ Update YOUR_USERNAME in docs
3. ✅ Test install script
4. ✅ Make repository public
5. ✅ Add LICENSE file
6. ✅ Add badges to README
7. ✅ Share with users!

---

**Your app is ready to share with the world! 🚀**
