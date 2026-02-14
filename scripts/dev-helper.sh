#!/bin/bash

# Pacioli Development Helper Script
# Provides convenient commands for multi-repository development

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Pacioli Development Helper

Usage: ./dev-helper.sh [command]

Commands:
  status        Show git status for all repositories
  pull          Pull latest changes from all repositories
  update        Update dependencies in all repositories
  clean         Clean build artifacts and node_modules
  build         Build all projects
  test          Run tests in all repositories
  lint          Run linting in all repositories
  help          Show this help message

Examples:
  ./dev-helper.sh status
  ./dev-helper.sh pull
  ./dev-helper.sh build
EOF
}

WORKSPACE_DIR="${PACIOLI_WORKSPACE:-$HOME/pacioli-workspace}"

if [[ ! -d "$WORKSPACE_DIR" ]]; then
    log_error "Workspace directory not found: $WORKSPACE_DIR"
    log_info "Run setup-repos.sh first or set PACIOLI_WORKSPACE environment variable"
    exit 1
fi

REPOS=("pacioli-core" "pacioli-docs" "pacioli-plugins")

run_in_repos() {
    local command=$1
    local description=$2

    log_info "$description"
    echo

    for repo in "${REPOS[@]}"; do
        local repo_path="$WORKSPACE_DIR/$repo"

        if [[ -d "$repo_path" ]]; then
            echo -e "${BLUE}[$repo]${NC}"
            cd "$repo_path"
            eval "$command"
            echo
        else
            log_error "$repo not found at $repo_path"
        fi
    done
}

case "${1:-help}" in
    status)
        run_in_repos "git status -s" "Checking git status..."
        ;;

    pull)
        run_in_repos "git pull --rebase" "Pulling latest changes..."
        log_success "All repositories updated"
        ;;

    update)
        run_in_repos "[ -f package.json ] && pnpm install || echo 'No package.json found'" "Updating dependencies..."
        log_success "Dependencies updated"
        ;;

    clean)
        log_info "Cleaning build artifacts and node_modules..."
        echo

        cd "$WORKSPACE_DIR/pacioli-core"
        echo -e "${BLUE}[pacioli-core]${NC}"
        rm -rf node_modules dist src-tauri/target
        echo "Cleaned"
        echo

        cd "$WORKSPACE_DIR/pacioli-plugins"
        echo -e "${BLUE}[pacioli-plugins]${NC}"
        rm -rf node_modules dist packages/*/node_modules packages/*/dist
        echo "Cleaned"
        echo

        log_success "Clean complete"
        ;;

    build)
        log_info "Building all projects..."
        echo

        cd "$WORKSPACE_DIR/pacioli-plugins/packages/plugin-sdk"
        echo -e "${BLUE}[plugin-sdk]${NC}"
        pnpm build
        echo

        cd "$WORKSPACE_DIR/pacioli-core"
        echo -e "${BLUE}[pacioli-core]${NC}"
        pnpm build
        echo

        log_success "Build complete"
        ;;

    test)
        run_in_repos "[ -f package.json ] && pnpm test || echo 'No tests configured'" "Running tests..."
        log_success "Tests complete"
        ;;

    lint)
        run_in_repos "[ -f package.json ] && pnpm lint || echo 'No linter configured'" "Running linters..."
        log_success "Linting complete"
        ;;

    help)
        show_help
        ;;

    *)
        log_error "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac
