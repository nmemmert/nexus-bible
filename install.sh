#!/bin/bash

###########################################
# nexus-bible Installation Script for Ubuntu
# This script installs all dependencies,
# downloads databases, and sets up the app
###########################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_NODE_VERSION=18
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BACKEND_PORT=${BACKEND_PORT:-8787}
DB_URL="https://bible.helloao.org/bible.eng.db"
INSTALL_DIR="${INSTALL_DIR:-$PWD/nexus-bible}"
SETUP_SERVICE="${SETUP_SERVICE:-false}"

# Check if running non-interactively
if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
fi

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running on Ubuntu/Debian
check_os() {
    print_header "Checking Operating System"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        
        if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
            print_success "Running on $OS"
        else
            print_warning "This script is designed for Ubuntu/Debian. You're running $OS"
            if [ "$INTERACTIVE" = true ]; then
                read -p "Continue anyway? (y/n) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            else
                print_info "Non-interactive mode: continuing on $OS (some steps may fail)"
            fi
        fi
    else
        print_error "Could not detect OS"
        exit 1
    fi
}
        exit 1
    fi
}

# Check if port is available
check_port() {
    local port=$1
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        return 1
    else
        return 0
    fi
}

# Find next available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    
    while [ $port -lt 65535 ]; do
        if check_port $port; then
            echo $port
            return 0
        fi
        ((port++))
    done
    
    echo "No available port found" >&2
    return 1
}

# Check ports
check_ports() {
    print_header "Checking Required Ports"
    
    local ports_ok=true
    local suggested_frontend=""
    local suggested_backend=""
    
    if check_port $FRONTEND_PORT; then
        print_success "Port $FRONTEND_PORT is available for frontend"
    else
        print_error "Port $FRONTEND_PORT is already in use"
        suggested_frontend=$(find_available_port $FRONTEND_PORT)
        if [ -n "$suggested_frontend" ]; then
            print_info "Suggested alternative frontend port: $suggested_frontend"
        fi
        ports_ok=false
    fi
    
    if check_port $BACKEND_PORT; then
        print_success "Port $BACKEND_PORT is available for backend"
    else
        print_error "Port $BACKEND_PORT is already in use"
        suggested_backend=$(find_available_port $BACKEND_PORT)
        if [ -n "$suggested_backend" ]; then
            print_info "Suggested alternative backend port: $suggested_backend"
        fi
        ports_ok=false
    fi
    
    if [ "$ports_ok" = false ]; then
        print_warning "Required ports are in use."
        
        if [ "$INTERACTIVE" = true ]; then
            echo -e "${YELLOW}Options:${NC}"
            echo -e "  1) Stop services using these ports and retry"
            
            if [ -n "$suggested_frontend" ] && [ -n "$suggested_backend" ]; then
                echo -e "  2) Use suggested ports (Frontend: $suggested_frontend, Backend: $suggested_backend)"
                echo -e "  3) Continue with current ports anyway"
                echo -e "  4) Exit installation"
                
                read -p "Choose [1-4]: " -n 1 -r
                echo
                
                case $REPLY in
                    1)
                        print_info "Please stop the services and run the installer again."
                        exit 1
                        ;;
                    2)
                        FRONTEND_PORT=$suggested_frontend
                        BACKEND_PORT=$suggested_backend
                        print_success "Using alternative ports: Frontend=$FRONTEND_PORT, Backend=$BACKEND_PORT"
                        ;;
                    3)
                        print_warning "Continuing with occupied ports - services may fail to start"
                        ;;
                    4|*)
                        print_info "Installation cancelled"
                        exit 1
                        ;;
                esac
            else
                echo -e "  2) Continue anyway (services may fail to start)"
                echo -e "  3) Exit installation"
                
                read -p "Choose [1-3]: " -n 1 -r
                echo
                
                case $REPLY in
                    2)
                        print_warning "Continuing with occupied ports"
                        ;;
                    1|3|*)
                        print_info "Installation cancelled"
                        exit 1
                        ;;
                esac
            fi
        else
            print_warning "Non-interactive mode: continuing with specified ports (services may fail to start)"
        fi
    fi
}

# Check Node.js installation
check_node() {
    print_header "Checking Node.js Installation"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        print_info "Found Node.js version $(node -v)"
        
        if [ "$NODE_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
            print_success "Node.js version is compatible"
            return 0
        else
            print_warning "Node.js version $NODE_VERSION is below required version $REQUIRED_NODE_VERSION"
        fi
    else
        print_info "Node.js not found"
    fi
    
    # Ask to install Node.js
    read -p "Install/Update Node.js $REQUIRED_NODE_VERSION? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_node
    else
        print_error "Node.js $REQUIRED_NODE_VERSION+ is required"
        exit 1
    fi
}

# Install Node.js
install_node() {
    print_header "Installing Node.js"
    
    print_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    
    print_info "Installing Node.js..."
    sudo apt-get install -y nodejs
    
    print_success "Node.js installed: $(node -v)"
    print_success "npm installed: $(npm -v)"
}

# Install system dependencies
install_system_deps() {
    print_header "Installing System Dependencies"
    
    print_info "Updating package list..."
    sudo apt-get update -qq
    
    print_info "Installing required packages..."
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        netstat-nat \
        net-tools \
        sqlite3
    
    print_success "System dependencies installed"
}

# Clone or update repository
setup_repository() {
    print_header "Setting Up Repository"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Directory $INSTALL_DIR already exists"
        read -p "Update existing installation? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Updating repository..."
            cd "$INSTALL_DIR"
            git pull
            print_success "Repository updated"
        else
            print_info "Using existing installation"
        fi
    else
        print_info "Cloning repository to $INSTALL_DIR..."
        
        # Check if git repo is set
        if [ -z "$GIT_REPO" ]; then
            print_info "No GIT_REPO environment variable set"
            read -p "Enter GitHub repository URL (or press Enter to skip): " GIT_REPO
            
            if [ -z "$GIT_REPO" ]; then
                print_error "Cannot clone without repository URL"
                print_info "Please clone manually or set GIT_REPO environment variable"
                exit 1
            fi
        fi
        
        git clone "$GIT_REPO" "$INSTALL_DIR"
        print_success "Repository cloned"
    fi
    
    cd "$INSTALL_DIR"
}

# Download database file
download_database() {
    print_header "Downloading Bible Database"
    
    # Create data directory
    mkdir -p "$INSTALL_DIR/server/data"
    
    local db_file="$INSTALL_DIR/server/data/bible.eng.db"
    
    if [ -f "$db_file" ]; then
        local db_size=$(du -h "$db_file" | cut -f1)
        print_info "Database already exists ($db_size)"
        read -p "Re-download database? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping database download"
            return 0
        fi
    fi
    
    print_info "Downloading database (~100MB, this may take a while)..."
    
    if command -v wget &> /dev/null; then
        wget -q --show-progress -O "$db_file" "$DB_URL"
    else
        curl -L -o "$db_file" "$DB_URL"
    fi
    
    if [ -f "$db_file" ]; then
        local db_size=$(du -h "$db_file" | cut -f1)
        print_success "Database downloaded ($db_size)"
    else
        print_error "Failed to download database"
        exit 1
    fi
}

# Install npm dependencies
install_npm_deps() {
    print_header "Installing Node.js Dependencies"
    
    cd "$INSTALL_DIR"
    
    print_info "Installing dependencies (this may take a few minutes)..."
    npm install --quiet
    
    print_success "Dependencies installed"
}

# Setup environment file
setup_env() {
    print_header "Setting Up Environment Configuration"
    
    local env_file="$INSTALL_DIR/.env"
    
    if [ -f "$env_file" ]; then
        print_info "Environment file already exists"
        read -p "Overwrite existing .env file? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return 0
        fi
    fi
    
    print_info "Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    
    print_info "Creating .env file..."
    cat > "$env_file" << EOF
# Nexus Bible Environment Configuration
# Generated on $(date)

# JWT Secret for authentication tokens
BSB_JWT_SECRET=$JWT_SECRET

# Database paths
BSB_DB_PATH=./server/data/bsb.sqlite
BSB_BIBLE_DB_PATH=./server/data/bible.eng.db

# CORS allowed origin
BSB_ORIGIN=http://localhost:$FRONTEND_PORT

# Server port
PORT=$BACKEND_PORT
EOF
    
    print_success "Environment configured"
    print_info "JWT Secret generated and saved"
}

# Build the application
build_app() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    print_info "Building frontend..."
    npm run build
    
    print_success "Application built successfully"
}

# Setup systemd service
setup_systemd_service() {
    print_header "Setting Up Systemd Service"
    
    local service_file="/etc/systemd/system/nexus-bible.service"
    
    print_info "Creating systemd service..."
    
    sudo tee "$service_file" > /dev/null << EOF
[Unit]
Description=Nexus Bible Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    print_info "Reloading systemd..."
    sudo systemctl daemon-reload
    
    print_info "Enabling service..."
    sudo systemctl enable nexus-bible
    
    print_success "Systemd service created and enabled"
    print_info "Service will start automatically on boot"
}

# Install PM2 globally
install_pm2() {
    print_header "Installing PM2 Process Manager"
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 already installed: $(pm2 -v)"
    else
        print_info "Installing PM2 globally..."
        sudo npm install -g pm2
        print_success "PM2 installed"
    fi
}

# Setup PM2 service
setup_pm2() {
    print_header "Setting Up PM2 Service"
    
    cd "$INSTALL_DIR"
    
    print_info "Starting application with PM2..."
    pm2 stop bsb-server 2>/dev/null || true
    pm2 delete bsb-server 2>/dev/null || true
    pm2 start server/index.ts --name bsb-server --interpreter tsx
    
    print_info "Saving PM2 configuration..."
    pm2 save
    
    print_info "Setting up PM2 startup script..."
    pm2 startup | grep "sudo" | bash || true
    
    print_success "PM2 configured"
}

# Test installation
test_installation() {
    print_header "Testing Installation"
    
    cd "$INSTALL_DIR"
    
    # Check if database file exists
    if [ -f "$INSTALL_DIR/server/data/bible.eng.db" ]; then
        print_success "Database file exists"
    else
        print_error "Database file missing"
    fi
    
    # Check if node_modules exists
    if [ -d "$INSTALL_DIR/node_modules" ]; then
        print_success "Dependencies installed"
    else
        print_error "Dependencies missing"
    fi
    
    # Check if dist folder exists
    if [ -d "$INSTALL_DIR/dist" ]; then
        print_success "Application built"
    else
        print_warning "Application not built (run 'npm run build')"
    fi
    
    # Check if .env exists
    if [ -f "$INSTALL_DIR/.env" ]; then
        print_success "Environment configured"
    else
        print_error "Environment file missing"
    fi
}

# Print final instructions
print_instructions() {
    print_header "Installation Complete!"
    
    echo -e "${GREEN}Nexus Bible has been installed successfully!${NC}\n"
    
    echo -e "${BLUE}Installation Directory:${NC}"
    echo -e "  $INSTALL_DIR\n"
    
    echo -e "${BLUE}To start the application:${NC}"
    
    if [ "$SETUP_SERVICE" = "pm2" ]; then
        echo -e "  ${GREEN}pm2 status${NC}                 # Check status"
        echo -e "  ${GREEN}pm2 logs bsb-server${NC}        # View logs"
        echo -e "  ${GREEN}pm2 restart bsb-server${NC}     # Restart"
        echo -e "  ${GREEN}pm2 stop bsb-server${NC}        # Stop\n"
    elif [ "$SETUP_SERVICE" = "systemd" ]; then
        echo -e "  ${GREEN}sudo systemctl start nexus-bible${NC}    # Start service"
        echo -e "  ${GREEN}sudo systemctl status nexus-bible${NC}   # Check status"
        echo -e "  ${GREEN}sudo systemctl stop nexus-bible${NC}     # Stop service"
        echo -e "  ${GREEN}journalctl -u nexus-bible -f${NC}        # View logs\n"
    else
        echo -e "  ${GREEN}cd $INSTALL_DIR${NC}"
        echo -e "  ${GREEN}npm run dev:full${NC}           # Start dev server\n"
        echo -e "  Or for production:"
        echo -e "  ${GREEN}npm run server${NC}             # Start backend only\n"
    fi
    
    echo -e "${BLUE}Access the application:${NC}"
    echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}\n"
    
    echo -e "${BLUE}Useful commands:${NC}"
    echo -e "  ${GREEN}cd $INSTALL_DIR${NC}            # Go to app directory"
    echo -e "  ${GREEN}npm run dev${NC}                # Start frontend dev server"
    echo -e "  ${GREEN}npm run build${NC}              # Build for production"
    echo -e "  ${GREEN}cat .env${NC}                   # View configuration\n"
    
    if [ "$SETUP_SERVICE" = "none" ]; then
        echo -e "${YELLOW}Note: Application is not set up to start automatically.${NC}"
        echo -e "${YELLOW}Run the install script with SETUP_SERVICE=pm2 or systemd to enable.${NC}\n"
    fi
    
    echo -e "${BLUE}Documentation:${NC}"
    echo -e "  README:     $INSTALL_DIR/README.md"
    echo -e "  Deployment: $INSTALL_DIR/DEPLOYMENT.md\n"
    
    echo -e "${GREEN}Enjoy using Nexus Bible!${NC}\n"
}

# Main installation flow
main() {
    print_header "nexus-bible Installation Script"
    
    echo -e "This script will install nexus-bible on your system.\n"
    
    # Ask for installation directory in interactive mode
    if [ "$INTERACTIVE" = true ]; then
        echo -e "Default installation directory: ${GREEN}$INSTALL_DIR${NC}"
        read -p "Press Enter to accept, or type a custom path: " custom_dir
        
        if [ -n "$custom_dir" ]; then
            INSTALL_DIR="$custom_dir"
            print_info "Using custom directory: $INSTALL_DIR"
        fi
        echo ""
    fi
    
    echo -e "Installation directory: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "Frontend port: ${GREEN}$FRONTEND_PORT${NC}"
    echo -e "Backend port: ${GREEN}$BACKEND_PORT${NC}\n"
    
    if [ "$INTERACTIVE" = true ]; then
        read -p "Continue with installation? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled"
            exit 0
        fi
    else
        print_info "Running in non-interactive mode, proceeding automatically..."
    fi
    
    # Run installation steps
    check_os
    check_ports
    install_system_deps
    check_node
    
    # Ask about repository
    if [ ! -d "$INSTALL_DIR" ]; then
        print_info "\nTo clone from GitHub, set GIT_REPO environment variable:"
        print_info "  export GIT_REPO=https://github.com/username/nexus-bible.git"
        print_info "  curl -fsSL <url-to-this-script> | bash\n"
    fi
    
    setup_repository
    download_database
    install_npm_deps
    if [ "$INTERACTIVE" = true ] && [ "$SETUP_SERVICE" = "false" ]; then
        echo -e "\n${BLUE}How do you want to run the application?${NC}"
        echo -e "  1) Manual (npm run dev:full)"
        echo -e "  2) PM2 (recommended for development/small production)"
        echo -e "  3) Systemd service (recommended for production)"
        echo -e "  4) Skip for now"
        
        read -p "Choose [1-4]: " -n 1 -r
        echo
        
        case $REPLY in
            2)
                install_pm2
                setup_pm2
                SETUP_SERVICE="pm2"
                ;;
            3)
                setup_systemd_service
                SETUP_SERVICE="systemd"
                ;;
            1|4)
                SETUP_SERVICE="none"
                ;;
            *)
                print_warning "Invalid choice, skipping service setup"
                SETUP_SERVICE="none"
                ;;
        esac
    elif [ "$SETUP_SERVICE" = "pm2" ]; then
        install_pm2
        setup_pm2
    elif [ "$SETUP_SERVICE" = "systemd" ]; then
        setup_systemd_service
    else
        SETUP_SERVICE="none"
        print_info "Skipping service setup (you can run manually later)"
    fi*)
            print_warning "Invalid choice, skipping service setup"
            SETUP_SERVICE="none"
            ;;
    esac
    
    test_installation
    print_instructions
}

# Run main function
main "$@"
