import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },

  // Build optimizations
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Blockchain - Polkadot ecosystem
          polkadot: [
            '@polkadot/api',
            '@polkadot/extension-dapp',
            '@polkadot/extension-inject',
            '@polkadot/ui-keyring',
            '@polkadot/types',
            '@polkadot/util',
            '@polkadot/util-crypto',
          ],

          // Blockchain - Ethereum and wallet providers
          blockchain: [
            'ethers',
            '@metamask/detect-provider',
            '@walletconnect/web3-provider',
          ],

          // Wallet connection libraries
          'wallet-connect': ['@talismn/connect-ui', '@talismn/connect-wallets'],

          // UI Libraries
          ui: ['antd', '@ant-design/icons', 'lucide-react'],

          // Charts and data visualization
          charts: ['recharts'],

          // Data management and querying
          data: [
            '@tanstack/react-query',
            '@tanstack/react-table',
            '@reduxjs/toolkit',
            'react-redux',
          ],

          // Date and utility libraries
          utils: ['date-fns', 'dayjs', 'decimal.js', 'xlsx'],
        },
      },
    },
  },
}))
