# Deployment Guide for Numbers App

## Prerequisites

1. Install dependencies:

```bash
npm install --save-dev @parity/hardhat-polkadot solc@0.8.28
npm install --force @nomicfoundation/hardhat-toolbox
```

2. Initialize Polkadot plugin:

```bash
npx hardhat-polkadot init
```

3. Set your private key securely:

```bash
npx hardhat vars set PRIVATE_KEY
# Enter your private key without 0x prefix
```

## Getting Test Tokens

### Paseo TestNet (PAS)

1. Visit https://faucet.polkadot.io/?parachain=1111
2. Enter your wallet address
3. Request PAS tokens

### Other Networks

- **Moonbeam**: Use GLMR from exchanges or bridge
- **Moonriver**: Use MOVR from exchanges or bridge
- **Astar**: Use ASTR from exchanges or bridge

## Deployment Steps

### 1. Compile Contracts

```bash
npx hardhat compile
```

### 2. Deploy to Paseo TestNet

```bash
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.js --network passetHub
```

### 3. Deploy ERC20 Token

```bash
npx hardhat ignition deploy ./ignition/modules/MinimalERC20.js --network passetHub
```

### 4. Verify Deployment

Check your contract on the block explorer:
https://blockscout-passet-hub.parity-testnet.parity.io

## Contract Size Optimization

Paseo has a ~100KB bytecode limit. To optimize:

1. **Avoid OpenZeppelin**: Use minimal implementations
2. **Remove unused functions**: Keep only essential features
3. **Use custom implementations**: See `contracts/MinimalERC20.sol`
4. **Check size after compile**: Look for warnings

## Troubleshooting

### "CodeRejected" Error

- Ensure `polkavm: true` in hardhat.config.js
- Check resolc configuration is present

### "initcode is too big" Error

- Contract exceeds 100KB limit
- Remove dependencies and optimize code

### Clean Deployment State

```bash
rm -rf ignition/deployments/
npx hardhat clean
```

## Network Details

| Network   | Chain ID  | RPC URL                                        | Symbol |
| --------- | --------- | ---------------------------------------------- | ------ |
| Paseo     | 420420422 | https://testnet-passet-hub-eth-rpc.polkadot.io | PAS    |
| Moonbeam  | 1284      | https://rpc.api.moonbeam.network               | GLMR   |
| Moonriver | 1285      | https://rpc.api.moonriver.moonbeam.network     | MOVR   |
| Astar     | 592       | https://evm.astar.network                      | ASTR   |

## Frontend Integration

Use the `useNetworkConfig` hook:

```typescript
import { useNetworkConfig } from './hooks/useNetworkConfig'

const { switchNetwork, connectWallet } = useNetworkConfig()

// Switch to Paseo
await switchNetwork('paseo')

// Connect wallet
const account = await connectWallet()
```
