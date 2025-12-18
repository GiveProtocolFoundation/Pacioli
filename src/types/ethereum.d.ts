interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  send(method: string, params: unknown[]): Promise<unknown>
  on(event: string, callback: (data: unknown) => void): void
  removeListener(event: string, callback: (data: unknown) => void): void
  isMetaMask?: boolean
  selectedAddress?: string
  networkVersion?: string
  chainId?: string
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export {}
