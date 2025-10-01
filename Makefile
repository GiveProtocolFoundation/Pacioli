.PHONY: help dev build test lint format clean setup deps check

# Default target
help:
	@echo "Available commands:"
	@echo "  make setup    - Install all dependencies and setup development environment"
	@echo "  make dev      - Start development server"
	@echo "  make build    - Build the application for production"
	@echo "  make test     - Run all tests"
	@echo "  make lint     - Run linting checks"
	@echo "  make format   - Format code with prettier"
	@echo "  make check    - Run all checks (lint, test, build)"
	@echo "  make clean    - Clean build artifacts"
	@echo "  make deps     - Install/update dependencies"

# Setup development environment
setup:
	@echo "Setting up development environment..."
	@echo "Installing frontend dependencies..."
	pnpm install
	@echo "Installing Rust dependencies..."
	cd src-tauri && cargo fetch
	@echo "Setup complete!"

# Install/update dependencies
deps:
	@echo "Updating dependencies..."
	pnpm install
	cd src-tauri && cargo update

# Start development server
dev:
	@echo "Starting development server..."
	pnpm tauri dev

# Build for production
build:
	@echo "Building for production..."
	pnpm tauri build

# Run tests
test:
	@echo "Running tests..."
	pnpm test
	@echo "Running Rust tests..."
	cd src-tauri && cargo test

# Run linting
lint:
	@echo "Running ESLint..."
	pnpm lint
	@echo "Running Rust clippy..."
	cd src-tauri && cargo clippy -- -D warnings

# Format code
format:
	@echo "Formatting frontend code..."
	pnpm format
	@echo "Formatting Rust code..."
	cd src-tauri && cargo fmt

# Run all checks
check: lint test
	@echo "Running build check..."
	pnpm tauri build --debug
	@echo "All checks passed!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf src-tauri/target/
	rm -rf node_modules/.vite/
	@echo "Clean complete!"

# Development helpers
dev-frontend:
	@echo "Starting frontend dev server only..."
	pnpm dev

dev-backend:
	@echo "Building and watching backend changes..."
	cd src-tauri && cargo watch -x check -x test -x run

# Database management
db-setup:
	@echo "Setting up database..."
	cd src-tauri && cargo run --bin setup-db

db-migrate:
	@echo "Running database migrations..."
	cd src-tauri && cargo run --bin migrate

# Package management
add-frontend:
	@echo "Adding frontend dependency: $(PKG)"
	pnpm add $(PKG)

add-backend:
	@echo "Adding backend dependency: $(PKG)"
	cd src-tauri && cargo add $(PKG)

# Build variants
build-debug:
	@echo "Building debug version..."
	pnpm tauri build --debug

build-release:
	@echo "Building release version..."
	pnpm tauri build

# Documentation
docs:
	@echo "Generating Rust documentation..."
	cd src-tauri && cargo doc --open

# Security checks
audit:
	@echo "Running security audit..."
	pnpm audit
	cd src-tauri && cargo audit