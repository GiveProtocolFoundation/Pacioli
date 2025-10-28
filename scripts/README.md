# Development Scripts

Helper scripts for Pacioli multi-repository development workflow.

## Available Scripts

### setup-repos.sh

Sets up the complete Pacioli development environment by cloning all repositories and installing dependencies.

**Usage:**

```bash
# Clone to default location (~/pacioli-workspace)
./scripts/setup-repos.sh

# Clone to custom location
./scripts/setup-repos.sh /path/to/workspace
```

**What it does:**

1. Checks for required tools (git, node, pnpm)
2. Creates workspace directory
3. Clones all Pacioli repositories:
   - pacioli-core (main application)
   - pacioli-docs (documentation)
   - pacioli-plugins (plugin system)
4. Installs dependencies in each repository

### dev-helper.sh

Provides convenient commands for working across multiple repositories.

**Usage:**

```bash
# Show git status for all repos
./scripts/dev-helper.sh status

# Pull latest changes from all repos
./scripts/dev-helper.sh pull

# Update dependencies in all repos
./scripts/dev-helper.sh update

# Clean build artifacts and node_modules
./scripts/dev-helper.sh clean

# Build all projects
./scripts/dev-helper.sh build

# Run tests in all repos
./scripts/dev-helper.sh test

# Run linting in all repos
./scripts/dev-helper.sh lint

# Show help
./scripts/dev-helper.sh help
```

**Environment Variables:**

- `PACIOLI_WORKSPACE` - Override default workspace directory

**Example:**

```bash
export PACIOLI_WORKSPACE=/custom/path
./scripts/dev-helper.sh status
```

## Quick Start

1. **Initial Setup:**

   ```bash
   # Clone and setup all repositories
   ./scripts/setup-repos.sh

   # Verify setup
   ./scripts/dev-helper.sh status
   ```

2. **Daily Development:**

   ```bash
   # Update all repositories
   ./scripts/dev-helper.sh pull

   # Build everything
   ./scripts/dev-helper.sh build

   # Run tests
   ./scripts/dev-helper.sh test
   ```

3. **Clean State:**

   ```bash
   # Clean and rebuild
   ./scripts/dev-helper.sh clean
   ./scripts/dev-helper.sh update
   ./scripts/dev-helper.sh build
   ```

## Repository Structure

After running `setup-repos.sh`, your workspace will look like:

```
pacioli-workspace/
├── pacioli-core/           # Main application
│   ├── src/                # React frontend
│   ├── src-tauri/          # Rust backend
│   └── package.json
├── pacioli-docs/           # Documentation
│   ├── user-guide/
│   ├── developer-guide/
│   └── api-reference/
└── pacioli-plugins/        # Plugin system
    ├── packages/
    │   └── plugin-sdk/     # Plugin SDK
    └── package.json
```

## Prerequisites

- **Node.js** v18 or higher
- **pnpm** v8 or higher
- **Git**
- **Rust** (for building Tauri application)
- **SSH keys** configured for GitHub

## Troubleshooting

### "Permission denied" when running scripts

Make scripts executable:

```bash
chmod +x scripts/*.sh
```

### "Repository not found"

Ensure you have:
1. SSH keys configured with GitHub
2. Access to GiveProtocol organization repositories

### "pnpm: command not found"

Install pnpm globally:

```bash
npm install -g pnpm
```

### Workspace not found

Set the workspace directory explicitly:

```bash
export PACIOLI_WORKSPACE=/path/to/workspace
./scripts/dev-helper.sh status
```

## Development Workflow

### Working on Multiple Repos

1. **Feature Development:**

   ```bash
   # Create feature branch in relevant repo
   cd ~/pacioli-workspace/pacioli-core
   git checkout -b feature/new-feature

   # Make changes and test
   pnpm run tauri dev

   # Run tests
   pnpm test

   # Commit changes
   git add .
   git commit -m "feat: add new feature"

   # Push and create PR
   git push -u origin feature/new-feature
   ```

2. **Plugin Development:**

   ```bash
   # Build plugin SDK first
   cd ~/pacioli-workspace/pacioli-plugins/packages/plugin-sdk
   pnpm build

   # Create new plugin
   cd ~/pacioli-workspace/pacioli-plugins
   pnpm create-plugin my-plugin

   # Develop plugin
   cd packages/my-plugin
   pnpm dev
   ```

3. **Documentation Updates:**

   ```bash
   # Edit documentation
   cd ~/pacioli-workspace/pacioli-docs
   # Make changes to markdown files

   # Commit and push
   git add .
   git commit -m "docs: update user guide"
   git push
   ```

### Syncing Changes

```bash
# Pull latest from all repos
./scripts/dev-helper.sh pull

# Check status
./scripts/dev-helper.sh status

# Update dependencies
./scripts/dev-helper.sh update
```

## Advanced Usage

### Custom Commands

You can extend `dev-helper.sh` with custom commands by editing the script:

```bash
# Add to the case statement
mycommand)
    run_in_repos "your command here" "Your description"
    ;;
```

### Parallel Operations

For faster operations, you can modify scripts to run commands in parallel:

```bash
# Example: parallel pull
for repo in "${REPOS[@]}"; do
    (cd "$WORKSPACE_DIR/$repo" && git pull) &
done
wait
```

## Notes

- Scripts assume SSH-based Git authentication
- Default workspace: `~/pacioli-workspace`
- Scripts require Bash 4.0+
- Tested on Linux and macOS

## See Also

- [Contributing Guide](../CONTRIBUTING.md)
- [Development Guide](https://docs.pacioli.io/developer-guide/)
- [Multi-Repository Architecture](../README.md#repository-structure)
