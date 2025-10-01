interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  send(method: string, params: any[]): Promise<any>;
  on(event: string, callback: (data: any) => void): void;
  removeListener(event: string, callback: (data: any) => void): void;
  isMetaMask?: boolean;
  selectedAddress?: string;
  networkVersion?: string;
  chainId?: string;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};