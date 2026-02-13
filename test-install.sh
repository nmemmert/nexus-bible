#!/bin/bash

# Test script for install.sh
# This creates a test environment to verify the install script works

echo "nexus-bible Install Script Test"
echo "============================"
echo ""

# Check if running on Ubuntu/Debian
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "OS: $NAME $VERSION"
else
    echo "Warning: Could not detect OS"
fi

echo ""
echo "Testing install script in dry-run mode..."
echo ""

# Set test environment variables
export INSTALL_DIR="/tmp/nexus-bible-test-$(date +%s)"
export SETUP_SERVICE=none

echo "Test installation directory: $INSTALL_DIR"
echo ""

# Check for required commands
echo "Checking prerequisites:"
command -v curl >/dev/null 2>&1 && echo "✓ curl installed" || echo "✗ curl missing"
command -v git >/dev/null 2>&1 && echo "✓ git installed" || echo "✗ git missing"
command -v node >/dev/null 2>&1 && echo "✓ node installed: $(node -v)" || echo "✗ node missing"
command -v npm >/dev/null 2>&1 && echo "✓ npm installed: $(npm -v)" || echo "✗ npm missing"

echo ""
echo "To run the actual install script:"
echo ""
echo "  Local test:"
echo "  ./install.sh"
echo ""
echo "  From GitHub (replace YOUR_USERNAME):"
echo "  curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash"
echo ""
echo "  With custom directory:"
echo "  INSTALL_DIR=$HOME/my-nexus-bible ./install.sh"
echo ""
echo "  With PM2 setup:"
echo "  SETUP_SERVICE=pm2 ./install.sh"
echo ""

# Cleanup test directory if it exists
if [ -d "$INSTALL_DIR" ]; then
    echo "Cleaning up test directory: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
fi
