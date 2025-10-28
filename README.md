# Pacioli

**Open-Source Crypto Accounting Platform for Polkadot Ecosystem**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

A comprehensive blockchain accounting application built with Tauri, React, TypeScript, and Rust. Designed specifically for the Polkadot ecosystem with support for Moonbeam, Moonriver, Astar, and other parachains.

🌐 **Website**: [pacioli.io](https://pacioli.io) (coming soon)
📚 **Documentation**: [docs.pacioli.io](https://docs.pacioli.io)
💬 **Community**: [community.pacioli.io](https://community.pacioli.io)

---

## 🚀 Features

### Core Accounting
- ✅ **Multi-Chain Support** - Track transactions across Polkadot parachains
- ✅ **Double-Entry Accounting** - Professional-grade chart of accounts
- ✅ **Multi-Currency** - Support for fiat and crypto currencies
- ✅ **Real-Time Indexing** - Rust-based blockchain indexer for fast sync
- ✅ **ERC20 Tokens** - Full support for token tracking and categorization

### Blockchain Integration
- ✅ **EVM Indexer** - Efficient indexing for Moonbeam, Moonriver, Astar
- ✅ **Wallet Integration** - MetaMask, Polkadot.js, Talisman
- ✅ **Smart Contracts** - PolkaVM-enabled Hardhat for Paseo TestNet
- ✅ **Transaction History** - Complete historical data with categorization

### User Experience
- ✅ **Modern UI** - React 19 with Tailwind CSS
- ✅ **Dark Mode** - Beautiful light and dark themes
- ✅ **Desktop App** - Cross-platform with Tauri
- ✅ **Local-First** - Your data stays on your device
- ✅ **Self-Hosted** - Full control over your financial data

---

## 📦 Repository Structure

Pacioli uses a multi-repository architecture:

| Repository | Purpose | Status |
|------------|---------|--------|
| **[pacioli-core](https://github.com/GiveProtocol/pacioli-core)** (this repo) | Main application | ✅ Active |
| **[pacioli-docs](https://github.com/GiveProtocol/pacioli-docs)** | Documentation site | ✅ Active |
| **[pacioli-plugins](https://github.com/GiveProtocol/pacioli-plugins)** | Plugin system | 🚧 Coming Soon |

---

## 🏁 Quick Start

### Prerequisites

- **Node.js** v18+ and **pnpm**
- **Rust** (latest stable)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/GiveProtocol/pacioli-core.git
cd pacioli-core

# Install dependencies
pnpm install

# Install Rust tools
cargo install tauri-cli
cargo install sqlx-cli --no-default-features --features sqlite

# Start development server
pnpm run tauri dev
```

The application will launch in development mode with hot-reloading enabled.

---

## 🛠️ Tech Stack

### Frontend
- **Tauri 2.0** - Cross-platform desktop framework
- **React 19** - Modern React with TypeScript
- **Tailwind CSS 4** - Utility-first styling
- **Vite 7** - Lightning-fast build tool
- **Polkadot.js API** - Substrate integration
- **Ethers.js 6** - Ethereum interaction

### Backend
- **Rust** - High-performance, memory-safe backend
- **Tauri** - Native desktop APIs
- **SQLite** - Local database with sqlx
- **Ethers-rs** - Ethereum library for Rust
- **Tokio** - Async runtime

### Smart Contracts
- **Hardhat** - Development environment with PolkaVM
- **Solidity 0.8.28** - Smart contract language
- **Paseo TestNet** - Polkadot Hub TestNet

---

## 🌐 Supported Networks

| Network | Chain ID | Type | Native Token |
|---------|----------|------|--------------|
| Moonbeam | 1284 | EVM Parachain | GLMR |
| Moonriver | 1285 | EVM Parachain | MOVR |
| Astar | 592 | EVM Parachain | ASTR |
| Paseo TestNet | 420420422 | Test Network | PAS |

---

## 📖 Documentation

Comprehensive documentation is available in the [pacioli-docs](https://github.com/GiveProtocol/pacioli-docs) repository:

- **[Getting Started](https://docs.pacioli.io/user-guide/getting-started)** - Installation and first steps
- **[User Guide](https://docs.pacioli.io/user-guide/)** - How to use Pacioli
- **[Developer Guide](https://docs.pacioli.io/developer-guide/)** - Contributing and architecture
- **[API Reference](https://docs.pacioli.io/api-reference/)** - Complete API documentation
- **[Self-Hosting](https://docs.pacioli.io/self-hosting/)** - Deploy your own instance

---

## 🔧 Development

### Frontend Development

```bash
pnpm run dev          # Vite dev server (web only)
pnpm run build        # Production build
pnpm run tauri dev    # Tauri dev mode (full app)
pnpm run lint         # ESLint
pnpm run format       # Prettier formatting
```

### Backend Development

```bash
cargo check           # Fast syntax check
cargo build           # Build Rust backend
cargo test            # Run tests
cargo clippy          # Linting
cargo fmt             # Formatting
```

### Smart Contract Development

```bash
npx hardhat compile   # Compile Solidity contracts
npx hardhat test      # Run contract tests
npx hardhat deploy    # Deploy contracts
```

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting pull requests.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'feat: add amazing feature'`)
4. **Push to your fork** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Contribution Guidelines

- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- Write clear commit messages (conventional commits)
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## 🔒 Security

Security is a top priority. Please review our [Security Policy](SECURITY.md) for:

- Reporting vulnerabilities
- Security best practices
- Supported versions

**Report security issues to**: security@pacioli.io

---

## 📜 License

Pacioli is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- You can use, modify, and distribute Pacioli freely
- If you modify and deploy Pacioli as a service (including web apps), you **must** make your source code available
- Any derivative works must also be licensed under AGPL-3.0
- This ensures the software and its derivatives remain free and open-source

See [LICENSE](LICENSE) for the full license text.

---

## 🗺️ Roadmap

### Current (v0.1)
- ✅ Multi-chain transaction tracking
- ✅ Basic accounting (chart of accounts)
- ✅ Wallet integration
- ✅ EVM indexer

### Coming Soon (v0.2)
- 🚧 Advanced reporting and analytics
- 🚧 Plugin system
- 🚧 Tax calculation helpers
- 🚧 Multi-entity support

### Future
- 📋 Mobile app (React Native + Tauri Mobile)
- 📋 Cloud sync (optional premium feature)
- 📋 ERP integrations
- 📋 AI-powered categorization

---

## 🌟 Why Pacioli?

Named after **Luca Pacioli**, the father of double-entry bookkeeping, this project brings professional accounting to the decentralized world.

### Benefits
- **Open Source** - Full transparency and community-driven
- **Privacy-First** - Your data stays local by default
- **Polkadot Native** - Built specifically for the Polkadot ecosystem
- **Self-Hosted** - Deploy on your own infrastructure
- **Free Forever** - Core features always free and open-source

---

## 💬 Community & Support

- **GitHub Issues** - [Report bugs](https://github.com/GiveProtocol/pacioli-core/issues)
- **GitHub Discussions** - [Ask questions](https://github.com/GiveProtocol/pacioli-core/discussions)
- **Community Forum** - [community.pacioli.io](https://community.pacioli.io)
- **Email** - support@pacioli.io

---

## 🙏 Acknowledgments

Built with amazing open-source technologies:
- [Tauri](https://tauri.app/) - Desktop framework
- [React](https://react.dev/) - UI library
- [Rust](https://www.rust-lang.org/) - Systems language
- [Polkadot.js](https://polkadot.js.org/) - Substrate integration
- [Vite](https://vitejs.dev/) - Build tool

Special thanks to the Polkadot and Web3 Foundation communities.

---

## 📊 Project Status

![GitHub Stars](https://img.shields.io/github/stars/GiveProtocol/pacioli-core?style=social)
![GitHub Forks](https://img.shields.io/github/forks/GiveProtocol/pacioli-core?style=social)
![GitHub Issues](https://img.shields.io/github/issues/GiveProtocol/pacioli-core)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/GiveProtocol/pacioli-core)

**Current Version**: 0.1.0
**Status**: Active Development
**Maintained**: ✅ Yes

---

**Made with ❤️ by the Pacioli community**
