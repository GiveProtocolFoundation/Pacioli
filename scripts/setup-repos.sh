#!/bin/bash

# Pacioli Multi-Repository Setup Script
# This script clones and sets up all Pacioli repositories for development

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

echo "=========================================="
echo "  Pacioli Multi-Repository Setup"
echo "=========================================="
echo

# Check prerequisites
log_info "Checking prerequisites..."
check_command git
check_command node
check_command pnpm

log_success "All prerequisites satisfied"
echo

# Determine organization and workspace directory
ORG="GiveProtocol"
WORKSPACE_DIR="${1:-$HOME/pacioli-workspace}"

log_info "Workspace directory: $WORKSPACE_DIR"
log_info "GitHub organization: $ORG"
echo

# Create workspace directory
if [[ ! -d "$WORKSPACE_DIR" ]]; then
    log_info "Creating workspace directory..."
    mkdir -p "$WORKSPACE_DIR"
    log_success "Workspace directory created"
else
    log_warning "Workspace directory already exists"
fi

cd "$WORKSPACE_DIR"

# Clone pacioli-core (main application)
if [[ ! -d "pacioli-core" ]]; then
    log_info "Cloning pacioli-core..."
    git clone git@github.com:$ORG/Pacioli.git pacioli-core
    log_success "pacioli-core cloned"
else
    log_warning "pacioli-core already exists, skipping clone"
fi

# Clone pacioli-docs (documentation)
if [[ ! -d "pacioli-docs" ]]; then
    log_info "Cloning pacioli-docs..."
    git clone git@github.com:$ORG/pacioli-docs.git pacioli-docs
    log_success "pacioli-docs cloned"
else
    log_warning "pacioli-docs already exists, skipping clone"
fi

# Clone pacioli-plugins (plugin system)
if [[ ! -d "pacioli-plugins" ]]; then
    log_info "Cloning pacioli-plugins..."
    git clone git@github.com:$ORG/pacioli-plugins.git pacioli-plugins
    log_success "pacioli-plugins cloned"
else
    log_warning "pacioli-plugins already exists, skipping clone"
fi

echo
log_info "Installing dependencies..."
echo

# Install pacioli-core dependencies
log_info "Installing pacioli-core dependencies..."
cd "$WORKSPACE_DIR/pacioli-core"
pnpm install
log_success "pacioli-core dependencies installed"

# Install pacioli-plugins dependencies
log_info "Installing pacioli-plugins dependencies..."
cd "$WORKSPACE_DIR/pacioli-plugins"
pnpm install
log_success "pacioli-plugins dependencies installed"

echo
log_success "All repositories set up successfully!"
echo
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo
echo "1. Navigate to the workspace:"
echo "   cd $WORKSPACE_DIR"
echo
echo "2. Start development:"
echo "   cd pacioli-core"
echo "   pnpm run tauri dev"
echo
echo "3. Build plugin SDK:"
echo "   cd pacioli-plugins/packages/plugin-sdk"
echo "   pnpm build"
echo
echo "4. View documentation:"
echo "   cd pacioli-docs"
echo "   Open index.md in your editor"
echo
echo "=========================================="
log_success "Setup complete!"
