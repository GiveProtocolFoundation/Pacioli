import { useState, useCallback, useEffect } from 'react';
import { EVMService, EVM_CHAINS } from '../services/evmService';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../types/errors';

export interface EVMAccount {
  address: string;
  chain: string;
  chainId: number;
}

export interface TokenBalance {
  address: string;
  balance: string;
  symbol?: string;
  decimals?: number;
}

export const useEVMService = () => {
  const [service] = useState(() => new EVMService());
  const [currentAccount, setCurrentAccount] = useState<EVMAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const connectMetaMask = useCallback(async () => {
    setIsConnecting(true);
    try {
      const account = await service.importFromMetaMask();
      setCurrentAccount(account);
      toast.success(`Connected to ${EVM_CHAINS[account.chain]?.name || account.chain}`);
      return account;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to connect to MetaMask');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [service]);

  const switchNetwork = useCallback(async (chainId: number) => {
    try {
      await service.switchNetwork(chainId);
      
      // Update current account with new chain
      if (currentAccount) {
        const chainKey = Object.keys(EVM_CHAINS).find(
          key => EVM_CHAINS[key].chainId === chainId
        );
        if (chainKey) {
          setCurrentAccount({
            ...currentAccount,
            chain: chainKey,
            chainId,
          });
        }
      }
      
      const chainName = Object.values(EVM_CHAINS).find(c => c.chainId === chainId)?.name;
      toast.success(`Switched to ${chainName || `Chain ${chainId}`}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to switch network');
      throw error;
    }
  }, [service, currentAccount]);

  const connectToChain = useCallback(async (chain: string) => {
    try {
      await service.connectToChain(chain);
      toast.success(`Backend connected to ${EVM_CHAINS[chain]?.name || chain}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || `Failed to connect to ${chain}`);
      throw error;
    }
  }, [service]);

  const loadBalances = useCallback(async (chain?: string, address?: string) => {
    if (!chain || !address) {
      if (!currentAccount) return null;
      chain = currentAccount.chain;
      address = currentAccount.address;
    }

    setIsLoadingBalances(true);
    try {
      // Get native token balance
      const nativeBalance = await service.getBalance(chain, address);
      const nativeToken = EVM_CHAINS[chain]?.nativeToken;

      // Get ERC20 token balances
      const tokenBalances = await service.getTokenBalances(chain, address);

      const allBalances: TokenBalance[] = [
        {
          address: 'native',
          balance: nativeBalance,
          symbol: nativeToken?.symbol,
          decimals: nativeToken?.decimals,
        },
        ...tokenBalances.map(([addr, balance]) => ({
          address: addr,
          balance,
        })),
      ];

      setBalances(allBalances);
      return allBalances;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to load balances');
      throw error;
    } finally {
      setIsLoadingBalances(false);
    }
  }, [service, currentAccount]);

  const syncTransactions = useCallback(async (chain?: string, address?: string) => {
    if (!chain || !address) {
      if (!currentAccount) return null;
      chain = currentAccount.chain;
      address = currentAccount.address;
    }

    try {
      const result = await service.syncEVMTransactions(chain, address);
      toast.success(result);
      return result;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to sync transactions');
      throw error;
    }
  }, [service, currentAccount]);

  const scanDeFiPositions = useCallback(async (chain?: string, address?: string) => {
    if (!chain || !address) {
      if (!currentAccount) return [];
      chain = currentAccount.chain;
      address = currentAccount.address;
    }

    try {
      const positions = await service.scanDeFiPositions(chain, address);
      return positions.map(pos => JSON.parse(pos));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to scan DeFi positions');
      throw error;
    }
  }, [service, currentAccount]);

  const getTransactions = useCallback(async (
    chain?: string, 
    address?: string,
    fromBlock?: number,
    toBlock?: number
  ) => {
    if (!chain || !address) {
      if (!currentAccount) return [];
      chain = currentAccount.chain;
      address = currentAccount.address;
    }

    try {
      const transactions = await service.getTransactions(chain, address, fromBlock, toBlock);
      return transactions.map(tx => JSON.parse(tx));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to get transactions');
      throw error;
    }
  }, [service, currentAccount]);

  // Auto-connect to backend when account changes
  useEffect(() => {
    if (currentAccount) {
      connectToChain(currentAccount.chain);
      loadBalances();
    }
  }, [currentAccount, connectToChain, loadBalances]);

  return {
    service,
    currentAccount,
    isConnecting,
    balances,
    isLoadingBalances,
    connectMetaMask,
    switchNetwork,
    connectToChain,
    loadBalances,
    syncTransactions,
    scanDeFiPositions,
    getTransactions,
    supportedChains: EVM_CHAINS,
  };
};