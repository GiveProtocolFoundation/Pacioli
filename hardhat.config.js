require('@nomicfoundation/hardhat-toolbox')
require('@parity/hardhat-polkadot')
const { vars } = require('hardhat/config')

module.exports = {
  solidity: '0.8.28',
  resolc: {
    version: '0.3.0',
    compilerSource: 'npm',
  },
  networks: {
    hardhat: {
      polkavm: true,
    },
    localNode: {
      polkavm: true,
      url: 'http://127.0.0.1:8545',
    },
    passetHub: {
      polkavm: true,
      url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
      accounts: [vars.get('PRIVATE_KEY')],
    },
    // Additional Polkadot parachains
    moonbeam: {
      url: 'https://rpc.api.moonbeam.network',
      accounts: [vars.get('PRIVATE_KEY')],
      chainId: 1284,
    },
    moonriver: {
      url: 'https://rpc.api.moonriver.moonbeam.network',
      accounts: [vars.get('PRIVATE_KEY')],
      chainId: 1285,
    },
    astar: {
      url: 'https://evm.astar.network',
      accounts: [vars.get('PRIVATE_KEY')],
      chainId: 592,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}
