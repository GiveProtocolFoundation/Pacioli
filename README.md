# Numbers
**Open-Source Ledger - Tauri + React + TypeScript**

A comprehensive blockchain transaction tracking application built with Tauri, React, TypeScript, and Rust. Features multi-chain support for Polkadot ecosystem including Moonbeam, Moonriver, Astar, Acala EVM+, and Paseo TestNet.

## Features

- **Multi-Chain Support**: Track transactions across Polkadot parachains
- **EVM Indexer**: Rust-based backend for efficient blockchain data indexing
- **ERC20 Token Support**: Comprehensive token balance and transfer tracking
- **Smart Contract Development**: PolkaVM-enabled Hardhat setup for Paseo deployment
- **Modern Frontend**: React + TypeScript with Ant Design UI components
- **Real-time Data**: Live balance updates and transaction monitoring

## Tech Stack

### Frontend
- **Tauri** - Cross-platform desktop app framework
- **React 19** - Modern React with TypeScript
- **Redux Toolkit** - State management
- **Ant Design** - UI component library
- **Ethers.js v5** - Ethereum interaction
- **Polkadot.js API** - Polkadot ecosystem integration

### Backend
- **Rust** - High-performance backend with Tauri
- **Ethers-rs** - Ethereum library for Rust
- **SQLite** - Local database for transaction storage
- **WebSocket** - Real-time blockchain data streaming

### Smart Contracts
- **Hardhat** - Development environment with PolkaVM support
- **Solidity 0.8.28** - Smart contract language
- **Paseo TestNet** - Polkadot Hub TestNet deployment target

## Supported Networks

| Network | Chain ID | RPC URL | Native Token |
|---------|----------|---------|--------------|
| Paseo TestNet | 420420422 | https://testnet-passet-hub-eth-rpc.polkadot.io | PAS |
| Moonbeam | 1284 | https://rpc.api.moonbeam.network | GLMR |
| Moonriver | 1285 | https://rpc.api.moonriver.moonbeam.network | MOVR |
| Astar | 592 | https://evm.astar.network | ASTR |

## Quick Start

### Prerequisites
- **Node.js** v18+ 
- **Rust** (latest stable)
- **pnpm** package manager

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/civicmastery/Numbers.git
cd Numbers
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Install Rust dependencies**
```bash
cargo install tauri-cli
cargo install sqlx-cli --no-default-features --features sqlite
```

4. **Start development server**
```bash
pnpm run tauri dev
```

## Smart Contract Development

### Setup Hardhat for Polkadot

1. **Install Polkadot dependencies**
```bash
npm install --save-dev @parity/hardhat-polkadot solc@0.8.28
npm install --force @nomicfoundation/hardhat-toolbox
```

2. **Initialize Polkadot plugin**
```bash
npx hardhat-polkadot init
```

3. **Set private key securely**
```bash
npx hardhat vars set PRIVATE_KEY
```

4. **Get test tokens from Paseo faucet**
Visit: https://faucet.polkadot.io/?parachain=1111

### Deploy to Paseo TestNet

```bash
# Compile contracts
npx hardhat compile

# Deploy SimpleStorage contract
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.js --network passetHub

# Deploy ERC20 token
npx hardhat ignition deploy ./ignition/modules/MinimalERC20.js --network passetHub
```

## Project Structure

```
Numbers/
├── src/                    # React frontend
│   ├── hooks/             # Custom React hooks
│   └── components/        # UI components
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── core/          # Core data types
│   │   └── evm_indexer/   # Blockchain indexing
│   └── Cargo.toml
├── contracts/             # Smart contracts
├── ignition/             # Deployment scripts
├── hardhat.config.js     # Hardhat configuration
└── package.json
```

## Development

### Frontend Development
```bash
pnpm run dev          # Start Vite dev server
pnpm run build        # Build for production
pnpm run tauri dev    # Start Tauri development mode
```

### Backend Development
```bash
cargo check           # Check Rust code
cargo build           # Build Rust backend
cargo test            # Run tests
```

### Smart Contract Development
```bash
npx hardhat compile   # Compile contracts
npx hardhat test      # Run contract tests
npx hardhat clean     # Clean build artifacts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
