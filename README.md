# Pacioli

**Open-Source, Currency-Agnostic (Fiat & Crypto) Accounting Platform**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

A multi-chain blockchain and fiat accounting application built with Tauri, React, TypeScript, and Rust. Pacioli runs as a local-first desktop app and as a web app, with the same core code powering both.

**Website**: [pacioli.io](https://pacioli.io) (coming soon)
**Documentation**: [docs.pacioli.io](https://docs.pacioli.io)
**Community**: [community.pacioli.io](https://community.pacioli.io)

---

## Features

### Core Accounting
- **Double-Entry Accounting** — Professional-grade chart of accounts
- **Multi-Currency** — Fiat and crypto, with configurable price sources and persisted API keys
- **Cost Basis Reporting** — FIFO, LIFO, HIFO, and Specific-ID methods
- **Compliance Tooling** — Compliance service for jurisdictional reporting
- **Import / Export** — Round-trip CSV/JSON for transactions and ledger data

### Blockchain Integration
- **EVM Indexer (Rust)** — High-throughput indexer for Moonbeam, Moonriver, and Astar, with dedicated ERC-20 and DeFi modules
- **Substrate / Polkadot** — Native Polkadot.js integration plus Subscan data
- **Bitcoin & Solana** — First-class services for both ecosystems
- **XCM Correlation** — Cross-chain message correlation for accurate multi-chain bookkeeping
- **Real-Time Sync** — `subscribeNewBlocks()` for live transaction and balance updates
- **Smart Contracts** — Hardhat + PolkaVM toolchain targeting the Paseo TestNet

### Wallets
- MetaMask
- Polkadot.js extension
- Talisman
- WalletConnect v2

### User Experience
- **Modern UI** — React 19, Ant Design, Tailwind CSS 4
- **Desktop App** — Cross-platform via Tauri 2
- **Web App** — Same codebase, deployed as an SPA via [pacioli-web](https://github.com/GiveProtocolFoundation/pacioli-web)
- **Conditional Router** — Same code adapts between Tauri (native) and web (browser) runtimes
- **Local-First** — Your data stays on your device by default
- **Dual Persistence** — `TauriPersistence` (SQLite) on desktop, `IndexedDBPersistence` in the browser

---

## Repository Structure

Pacioli is split across the following repositories:

| Repository | Purpose | Status |
|------------|---------|--------|
| **[Pacioli](https://github.com/GiveProtocolFoundation/Pacioli)** (this repo) | Core application (desktop + web frontend, Rust backend, contracts) | Active |
| **[pacioli-web](https://github.com/GiveProtocolFoundation/pacioli-web)** | Web deployment of the Pacioli app | Active |
| **[pacioli-docs](https://github.com/GiveProtocolFoundation/pacioli-docs)** | Documentation site | Active |

---

## Quick Start

### Prerequisites

- **Node.js** 22+ and **pnpm**
- **Rust** (latest stable) — required for desktop builds
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/GiveProtocolFoundation/Pacioli.git pacioli
cd pacioli

# Install dependencies
pnpm install

# Web dev server
pnpm dev

# Desktop dev (Tauri)
pnpm tauri:dev
```

The web dev server runs at `http://localhost:1420`. The Tauri command launches the same UI inside a native window.

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite 7** — Build tool and dev server
- **Tailwind CSS 4** + **Ant Design 5**
- **Redux Toolkit** + **TanStack Query** + **TanStack Table**
- **Polkadot.js API**, **Ethers**, **@solana/web3.js**, **bitcoinjs-lib**
- **WalletConnect v2**, Talisman Connect, MetaMask provider detection

### Backend (Desktop)
- **Tauri 2** — Native shell and platform APIs
- **Rust** — EVM indexer, chain fetchers, sync engine, storage layer
- **SQLite** via `sqlx`

### Smart Contracts
- **Hardhat** with **PolkaVM** support
- **Solidity 0.8.x**
- Target: **Paseo TestNet** (Polkadot Hub)

### Testing
- **Vitest** — Unit tests
- **Playwright** — End-to-end test suite with a dedicated CI job

---

## Supported Networks

| Network | Chain ID | Type | Native Token |
|---------|----------|------|--------------|
| Moonbeam | 1284 | EVM Parachain | GLMR |
| Moonriver | 1285 | EVM Parachain | MOVR |
| Astar | 592 | EVM Parachain | ASTR |
| Paseo TestNet | 420420422 | Test Network | PAS |
| Bitcoin | — | UTXO | BTC |
| Solana | — | SVM | SOL |

---

## Development

### Frontend

```bash
pnpm dev            # Vite dev server (web)
pnpm build          # Production web build
pnpm preview        # Preview production build
pnpm tauri:dev      # Tauri desktop dev
pnpm tauri:build    # Tauri desktop release build
pnpm lint           # ESLint
pnpm type-check     # tsc --noEmit
pnpm format         # Prettier
pnpm test           # Vitest
pnpm test:e2e       # Playwright
```

### Backend (Rust)

```bash
cd src-tauri
cargo check
cargo build
cargo test
cargo clippy
cargo fmt
```

### Smart Contracts

```bash
npx hardhat compile
npx hardhat test
npx hardhat ignition deploy ignition/modules/<module>.ts
```

---

## Project Status

### Shipped
- Multi-chain transaction tracking (EVM, Substrate, Bitcoin, Solana)
- Rust EVM indexer with ERC-20 and DeFi modules
- XCM correlation for cross-chain transactions
- Real-time block subscription and balance sync
- Cost Basis Report (FIFO / LIFO / HIFO / Specific-ID)
- Unified `PersistenceService` (SQLite on desktop, IndexedDB on web)
- Configurable price source with persisted API key
- Conditional router for Tauri vs. web runtimes
- Web SPA deployment via [pacioli-web](https://github.com/GiveProtocolFoundation/pacioli-web)
- Playwright E2E suite wired into CI

### In Progress
- Lot-selection UI for Specific-ID cost basis
- Expanded reporting and analytics
- Documentation site build-out

### Planned
- Plugin system
- Tax calculation helpers
- Multi-entity support
- Cloud sync (optional)
- ERP integrations
- AI-assisted categorization

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/<name>`)
3. Commit using conventional commits (`feat:`, `fix:`, `chore:`, …)
4. Push to your fork and open a PR
5. Ensure lint, type-check, and tests pass

Project-specific coding standards (Rust doc requirements, TypeScript conventions) are in [.claude/CLAUDE.md](.claude/CLAUDE.md).

---

## Security

See [SECURITY.md](SECURITY.md) for the disclosure policy and supported versions.

Report vulnerabilities to **security@pacioli.io**.

---

## License

Pacioli is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

- Free to use, modify, and distribute
- Modifications deployed as a service must publish source
- Derivative works must remain AGPL-3.0

See [LICENSE](LICENSE) for the full text.

---

## Why Pacioli?

Named after **Luca Pacioli**, the father of double-entry bookkeeping, the project brings professional accounting standards to the multi-chain world — without surrendering custody of data.

- **Open-source** — Transparent, community-driven
- **Privacy-first** — Local-first by default
- **Multi-chain native** — EVM, Substrate, Bitcoin, Solana
- **Self-hostable** — Run your own instance, end-to-end

---

## Community & Support

- **Issues** — [github.com/GiveProtocolFoundation/Pacioli/issues](https://github.com/GiveProtocolFoundation/Pacioli/issues)
- **Discussions** — [github.com/GiveProtocolFoundation/Pacioli/discussions](https://github.com/GiveProtocolFoundation/Pacioli/discussions)
- **Forum** — [community.pacioli.io](https://community.pacioli.io)
- **Email** — support@pacioli.io

---

## Acknowledgments

Built on top of [Tauri](https://tauri.app/), [React](https://react.dev/), [Rust](https://www.rust-lang.org/), [Polkadot.js](https://polkadot.js.org/), [Vite](https://vitejs.dev/), [Ant Design](https://ant.design/), and the broader Web3 ecosystem.

---

![GitHub Stars](https://img.shields.io/github/stars/GiveProtocolFoundation/Pacioli?style=social)
![GitHub Forks](https://img.shields.io/github/forks/GiveProtocolFoundation/Pacioli?style=social)
![GitHub Issues](https://img.shields.io/github/issues/GiveProtocolFoundation/Pacioli)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/GiveProtocolFoundation/Pacioli)

**Current Version**: 0.1.0
**Status**: Active Development
