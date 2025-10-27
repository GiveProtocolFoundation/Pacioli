# Pacioli Repository Split Plan

## Executive Summary

This document outlines the plan to restructure the Pacioli project from a single monolithic repository into separate public and private repositories to support an open-source freemium model.

**Current State:** Single repository with mixed content
**Target State:** 6 repositories (3 public, 3 private)
**License Strategy:** MIT/Apache 2.0 for public, proprietary for private

---

## Repository Structure Overview

### PUBLIC REPOSITORIES

#### 1. **pacioli-core** (Main Application)
**Purpose:** Core open-source accounting platform
**License:** MIT + Apache 2.0 (dual license)
**URL:** `github.com/<org>/pacioli-core`

**Contents:**
```
pacioli-core/
├── src/                          # React frontend
│   ├── app/                      # Application pages
│   ├── components/               # React components
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # API services
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utility functions
│   ├── data/                     # Static data (chart of accounts, etc.)
│   ├── assets/                   # Images, logos
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── api/                  # API endpoints
│   │   ├── core/                 # Core data structures
│   │   ├── db/                   # Database layer
│   │   ├── evm_indexer/          # EVM blockchain indexer
│   │   ├── indexer/              # General blockchain indexer
│   │   ├── sync/                 # Synchronization logic
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── capabilities/             # Tauri capabilities
│   ├── icons/                    # App icons
│   ├── migrations/               # Database migrations
│   ├── resources/                # Static resources
│   ├── Cargo.toml
│   └── tauri.conf.json
├── contracts/                    # Smart contracts
│   ├── MinimalERC20.sol
│   └── SimpleStorage.sol
├── ignition/                     # Hardhat deployment
│   └── modules/
├── scripts/                      # Development utilities
│   ├── convert-excel-to-json.cjs
│   └── inspect-excel.cjs
├── public/                       # Public assets
│   └── crypto-icons/
├── .github/
│   └── workflows/                # CI/CD workflows
│       ├── ci.yml
│       ├── release.yml
│       └── security.yml
├── tests/                        # Test suites
├── docs/                         # Basic documentation
│   ├── README.md
│   ├── ARCHITECTURE.md
│   └── API.md
├── .gitignore
├── .gitleaks.toml                # Security scanning
├── CODEOWNERS
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE-MIT
├── LICENSE-APACHE
├── README.md
├── SECURITY.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── hardhat.config.js
├── eslint.config.js
├── .prettierrc
├── .prettierignore
├── .deepsource.toml
└── Makefile
```

**Key Features (Public):**
- ✅ Multi-chain blockchain tracking (Polkadot, Moonbeam, etc.)
- ✅ EVM indexer for transaction history
- ✅ Basic accounting (chart of accounts, transactions)
- ✅ Wallet integration (MetaMask, Polkadot.js)
- ✅ Local SQLite database
- ✅ Export to CSV/Excel
- ✅ Basic reporting
- ✅ Self-hosting capability

---

#### 2. **pacioli-plugins** (Plugin System)
**Purpose:** Community plugin development framework
**License:** MIT
**URL:** `github.com/<org>/pacioli-plugins`

**Contents:**
```
pacioli-plugins/
├── core/                         # Plugin framework
│   ├── src/
│   │   ├── loader.ts             # Plugin loader
│   │   ├── registry.ts           # Plugin registry
│   │   └── types.ts              # Plugin types
│   └── README.md
├── examples/                     # Example plugins
│   ├── hello-world/
│   ├── custom-report/
│   └── exchange-integration/
├── templates/                    # Plugin templates
│   ├── typescript-plugin/
│   └── rust-plugin/
├── plugins/                      # Community plugins
│   ├── binance-sync/
│   ├── coinbase-connector/
│   └── tax-calculator/
├── docs/
│   ├── plugin-development.md
│   ├── api-reference.md
│   └── submission-guidelines.md
├── .github/
│   └── workflows/
│       ├── plugin-validation.yml
│       └── publish.yml
├── PLUGIN_GUIDELINES.md
├── SUBMISSION_PROCESS.md
└── README.md
```

**Plugin Capabilities:**
- Custom data importers
- Exchange integrations
- Custom report generators
- Blockchain protocol adapters
- Tax calculation modules
- Notification systems

---

#### 3. **pacioli-docs** (Documentation Site)
**Purpose:** Comprehensive public documentation
**License:** CC BY 4.0 (Creative Commons)
**URL:** `github.com/<org>/pacioli-docs`
**Live Site:** `docs.pacioli.io`

**Contents:**
```
pacioli-docs/
├── user-guide/
│   ├── getting-started.md
│   ├── wallet-setup.md
│   ├── transaction-tracking.md
│   ├── reporting.md
│   └── faq.md
├── developer-guide/
│   ├── architecture.md
│   ├── local-development.md
│   ├── contributing.md
│   ├── plugin-development.md
│   └── api-reference.md
├── crypto-operations/
│   ├── polkadot-integration.md
│   ├── evm-chains.md
│   ├── wallet-connections.md
│   └── smart-contracts.md
├── tutorials/
│   ├── first-transaction.md
│   ├── multi-wallet-setup.md
│   ├── creating-reports.md
│   └── building-plugins.md
├── self-hosting/
│   ├── installation.md
│   ├── configuration.md
│   ├── database-setup.md
│   └── updates.md
├── api-reference/
│   ├── rest-api.md
│   ├── rust-api.md
│   └── plugin-api.md
├── implementation-guides/
│   ├── CRYPTO_ACCOUNTING_IMPLEMENTATION.md
│   ├── CURRENCY_ARCHITECTURE.md
│   └── CURRENCY_IMPLEMENTATION_GUIDE.md
├── _layouts/
├── _config.yml
├── Gemfile
├── index.md
└── README.md
```

---

### PRIVATE REPOSITORIES

#### 4. **pacioli-cloud** (Cloud Infrastructure)
**Purpose:** Managed cloud service infrastructure
**License:** Proprietary
**Access:** Internal team only

**Contents:**
```
pacioli-cloud/
├── infrastructure/
│   ├── terraform/                # Infrastructure as code
│   │   ├── aws/
│   │   ├── gcp/
│   │   └── k8s/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.worker
│   │   └── docker-compose.yml
│   └── helm/                     # Kubernetes charts
│       ├── pacioli-api/
│       └── pacioli-worker/
├── api/                          # Cloud API service
│   ├── src/
│   │   ├── auth/                 # Authentication
│   │   ├── billing/              # Billing integration
│   │   ├── sync/                 # Cloud sync
│   │   └── webhooks/             # Webhook handlers
│   ├── Cargo.toml
│   └── Dockerfile
├── workers/                      # Background workers
│   ├── indexer-worker/
│   ├── backup-worker/
│   └── notification-worker/
├── billing/
│   ├── stripe-integration/
│   ├── subscription-management/
│   └── usage-tracking/
├── monitoring/
│   ├── grafana/
│   ├── prometheus/
│   └── alerting/
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   └── migrate.sh
├── .env.example
├── README.md
└── DEPLOYMENT.md
```

**Features:**
- Multi-tenant architecture
- Cloud backup and sync
- Stripe billing integration
- Usage analytics
- Premium API rate limits
- Cloud-based indexing

---

#### 5. **pacioli-enterprise** (Premium Features)
**Purpose:** Enterprise and premium functionality
**License:** Proprietary
**Access:** Internal team + enterprise customers

**Contents:**
```
pacioli-enterprise/
├── premium-features/
│   ├── multi-entity/             # Multi-company management
│   ├── advanced-reporting/       # Advanced analytics
│   ├── audit-trail/              # Compliance features
│   ├── role-based-access/        # RBAC system
│   ├── api-integrations/         # Premium integrations
│   └── white-label/              # White-labeling
├── ml-models/
│   ├── transaction-categorization/
│   ├── fraud-detection/
│   ├── tax-optimization/
│   └── predictive-analytics/
├── enterprise-integrations/
│   ├── quickbooks/
│   ├── xero/
│   ├── sage/
│   ├── netsuite/
│   └── sap/
├── compliance/
│   ├── sox-compliance/
│   ├── gdpr/
│   ├── hipaa/
│   └── audit-exports/
├── tests/
├── docs/
│   ├── enterprise-features.md
│   ├── integration-guides.md
│   └── compliance.md
├── LICENSE
└── README.md
```

**Premium Features:**
- Multi-entity consolidation
- Advanced tax reporting
- ML-powered categorization
- Audit trails and compliance
- ERP integrations
- White-label deployments
- Priority support

---

#### 6. **pacioli-internal** (Business Documents)
**Purpose:** Business-sensitive documentation and credentials
**License:** Proprietary
**Access:** Core team only

**Contents:**
```
pacioli-internal/
├── business-docs/
│   ├── whitepaper.pdf
│   ├── business-plan.md
│   ├── roadmap.md
│   ├── pricing-strategy.md
│   └── competitive-analysis.md
├── legal/
│   ├── contracts/
│   │   ├── enterprise-agreement-template.pdf
│   │   └── partnership-agreements/
│   ├── terms-of-service.md
│   ├── privacy-policy.md
│   └── trademark/
├── marketing/
│   ├── brand-guidelines.pdf
│   ├── marketing-strategy.md
│   ├── press-releases/
│   └── media-kit/
├── credentials/
│   ├── .env.production
│   ├── api-keys.encrypted
│   ├── ssl-certificates/
│   └── service-accounts/
├── finances/
│   ├── budgets/
│   ├── revenue-projections/
│   └── investor-updates/
├── operations/
│   ├── runbooks/
│   ├── incident-response/
│   └── security-protocols/
├── .gitignore                    # Strict gitignore for secrets
├── .gitleaks.toml
└── README.md
```

---

## File Movement Matrix

| Current Location | Target Repository | Notes |
|-----------------|-------------------|-------|
| `src/` | `pacioli-core` | Entire frontend |
| `src-tauri/` | `pacioli-core` | Entire backend |
| `contracts/` | `pacioli-core` | Smart contracts |
| `scripts/` | `pacioli-core` | Dev utilities |
| `public/` | `pacioli-core` | Public assets |
| `docs/` | `pacioli-docs` | Move & expand |
| `*.md` (root) | `pacioli-docs` | Implementation guides |
| `.github/workflows/` | `pacioli-core` | CI/CD workflows |
| Config files | `pacioli-core` | package.json, vite.config.ts, etc. |
| Plugins (new) | `pacioli-plugins` | To be created |
| Cloud infra (new) | `pacioli-cloud` | To be created |
| Premium features (new) | `pacioli-enterprise` | To be created |
| Business docs (new) | `pacioli-internal` | To be created |

---

## Migration Strategy

### Phase 1: Prepare Core Repository (Week 1)
1. **Clean up current repo**
   - Remove any accidentally committed secrets
   - Run gitleaks scan
   - Review all files for business-sensitive content

2. **Create new documentation**
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md
   - SECURITY.md
   - CODEOWNERS

3. **Update branding**
   - Replace "Numbers" with "Pacioli" in all files
   - Update README with new repository structure
   - Add freemium model explanation

### Phase 2: Extract Documentation (Week 1)
1. **Create pacioli-docs repository**
   ```bash
   git clone git@github.com:civicmastery/Pacioli.git pacioli-docs-temp
   cd pacioli-docs-temp

   # Extract docs/ directory with history
   git filter-repo --path docs/ --path-rename docs/:./

   # Extract markdown guides from root
   git filter-repo --path-glob '*.md' --path-rename :docs/implementation-guides/
   ```

2. **Set up Jekyll/Docusaurus**
   - Configure documentation site generator
   - Add search functionality
   - Set up GitHub Pages

### Phase 3: Create Plugin System (Week 2)
1. **Design plugin API**
   - Define plugin interface
   - Create loader mechanism
   - Document plugin lifecycle

2. **Create pacioli-plugins repository**
   - Set up plugin framework
   - Create example plugins
   - Write plugin development guide

3. **Integrate with core**
   - Add plugin loading to pacioli-core
   - Create plugin registry

### Phase 4: Set Up Private Repositories (Week 2-3)
1. **Create pacioli-cloud**
   - Set up infrastructure templates
   - Create API service skeleton
   - Configure CI/CD for deployments

2. **Create pacioli-enterprise**
   - Identify premium features in current code
   - Extract and refactor for modularity
   - Create feature flags system

3. **Create pacioli-internal**
   - Move business documents
   - Encrypt credentials properly
   - Set up strict access controls

### Phase 5: Integration & Testing (Week 3-4)
1. **Set up cross-repo workflows**
   - GitHub Actions for coordinated releases
   - Automated version bumping
   - Integration tests across repos

2. **Create monorepo alternative**
   - Consider using git submodules
   - Or use npm workspaces for local dev
   - Document multi-repo development workflow

3. **Security hardening**
   - Configure branch protection
   - Set up CodeQL scanning
   - Enable Dependabot
   - Add pre-commit hooks

---

## Security Configuration

### .gitleaks.toml (All Repositories)
```toml
title = "Pacioli Security Scan"

[[rules]]
id = "private-key"
description = "Private key detected"
regex = '''-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----'''

[[rules]]
id = "api-key"
description = "API key detected"
regex = '''(?i)(api[_-]?key|apikey)['"]\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]'''

[[rules]]
id = "aws-key"
description = "AWS key detected"
regex = '''AKIA[0-9A-Z]{16}'''

[[rules]]
id = "password"
description = "Password in config"
regex = '''(?i)(password|passwd|pwd)['"]\s*[:=]\s*['"][^'"\s]{8,}['"]'''

[[rules]]
id = "ethereum-private-key"
description = "Ethereum private key"
regex = '''(0x)?[a-fA-F0-9]{64}'''
```

### CODEOWNERS (pacioli-core)
```
# Default owners for everything
* @core-maintainers

# Frontend
/src/ @frontend-team
/src/components/ @ui-team

# Backend
/src-tauri/ @rust-team @security-team

# Smart contracts
/contracts/ @blockchain-team @security-team

# Infrastructure
/.github/ @devops-team

# Documentation
/docs/ @docs-team

# Security-sensitive
/src-tauri/src/db/ @security-team
/src-tauri/src/api/ @security-team
```

### Branch Protection Rules
**pacioli-core (main branch):**
- Require pull request reviews (2 approvals)
- Require status checks to pass
- Require branches to be up to date
- Require linear history
- Include administrators

**pacioli-enterprise, pacioli-cloud (main branch):**
- Require pull request reviews (1 approval)
- Require status checks to pass
- Restrict push access to core team

---

## Development Workflow

### For Core Contributors

#### Initial Setup
```bash
# Clone all public repositories
git clone git@github.com:<org>/pacioli-core.git
git clone git@github.com:<org>/pacioli-plugins.git
git clone git@github.com:<org>/pacioli-docs.git

# Optional: Clone private repos if you have access
git clone git@github.com:<org>/pacioli-cloud.git
git clone git@github.com:<org>/pacioli-enterprise.git
git clone git@github.com:<org>/pacioli-internal.git
```

#### Using Submodules (Alternative)
Create a meta-repository:
```bash
mkdir pacioli-dev && cd pacioli-dev
git init
git submodule add git@github.com:<org>/pacioli-core.git core
git submodule add git@github.com:<org>/pacioli-plugins.git plugins
git submodule add git@github.com:<org>/pacioli-docs.git docs
```

#### Daily Development
```bash
cd pacioli-core
git checkout -b feature/my-feature
# Make changes
npm run test
git commit -m "feat: add my feature"
git push origin feature/my-feature
# Open PR on GitHub
```

### For Community Contributors

Only need to fork and clone `pacioli-core` and/or `pacioli-plugins`:

```bash
# Fork on GitHub first
git clone git@github.com:YOUR_USERNAME/pacioli-core.git
cd pacioli-core
npm install
npm run dev

# Make changes, commit, push, open PR
```

---

## Deployment Strategy

### Self-Hosted (pacioli-core)
Users can build and run locally:
```bash
git clone https://github.com/<org>/pacioli-core.git
cd pacioli-core
npm install
npm run tauri build
# Distributable app created
```

### Cloud Managed (pacioli-cloud + pacioli-enterprise)
Handled by internal team:
1. Core features deployed from pacioli-core
2. Premium features added from pacioli-enterprise
3. Infrastructure managed via pacioli-cloud
4. Continuous deployment via GitHub Actions

---

## Next Steps

1. **Review this plan** - Ensure all stakeholders agree
2. **Set up repositories** - Create on GitHub with proper settings
3. **Run security audit** - Check for accidentally committed secrets
4. **Execute migration** - Follow phase-by-phase plan
5. **Update documentation** - Document new structure
6. **Communicate changes** - Announce to community/users

---

## Questions to Resolve

1. **Organization name** - Which GitHub organization will host repos?
2. **Naming convention** - Confirm "pacioli-*" prefix for all repos
3. **Access control** - Who gets access to which private repos?
4. **CI/CD** - GitHub Actions, GitLab CI, or other?
5. **Documentation hosting** - GitHub Pages, ReadTheDocs, or custom domain?
6. **Plugin distribution** - npm registry, custom registry, or GitHub releases?
7. **Version sync** - How to coordinate versions across repos?

---

*This document is a living plan and will be updated as decisions are made and implementation proceeds.*
