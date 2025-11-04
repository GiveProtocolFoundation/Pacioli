/**
 * Comprehensive Transaction Type System for Cryptocurrency Accounting
 * Based on GAAP/IFRS compliant categorization
 */

// Basic transaction types from the core accounting system
export enum BasicTransactionType {
  Purchase = 'purchase',
  Sale = 'sale',
  TransferIn = 'transfer_in',
  TransferOut = 'transfer_out',
  Stake = 'stake',
  Unstake = 'unstake',
  Reward = 'reward',
  Fee = 'fee',
  SwapIn = 'swap_in',
  SwapOut = 'swap_out',
  LPDeposit = 'lp_deposit',
  LPWithdraw = 'lp_withdraw',
  Airdrop = 'airdrop',
  GiftReceived = 'gift_received',
  GiftSent = 'gift_sent',
  Donation = 'donation',
  Other = 'other'
}

export enum TransactionCategory {
  Acquisition = 'Acquisition Transactions',
  Disposal = 'Disposal Transactions',
  DeFiProtocol = 'DeFi Protocol Transactions',
  NFT = 'NFT Transactions',
  Derivatives = 'Derivatives and Complex Instruments',
  BusinessOps = 'Business Operations (SMEs & NFPs)',
  NFPSpecific = 'NFP Specific Transactions',
  ForeignExchange = 'Foreign Exchange & Valuation',
  Fees = 'Fees and Transaction Costs',
  Losses = 'Losses and Write-offs',
  Governance = 'Governance and Protocol Participation',
  WrappedAssets = 'Wrapped and Bridged Assets',
  DeferredTax = 'Deferred Tax Implications'
}

export interface TransactionTypeDefinition {
  category: TransactionCategory
  subcategory: string
  transactionType: string
  debitAccounts: string
  creditAccounts: string
  code: string
  basicTransactionType: BasicTransactionType
}

export const TRANSACTION_TYPE_DEFINITIONS: TransactionTypeDefinition[] = [
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Purchase of Cryptocurrency',
    transactionType: 'Fiat to Crypto Purchase (Exchange)',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Bank - Current Account',
    code: 'ACQ_FIAT_CRYPTO',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Purchase of Cryptocurrency',
    transactionType: 'Crypto to Crypto Trade',
    debitAccounts: 'Cryptocurrency Holdings (acquired), Realised Losses - Crypto (if loss)',
    creditAccounts: 'Cryptocurrency Holdings (disposed), Realised Gains - Crypto (if gain)',
    code: 'ACQ_CRYPTO_TRADE',
    basicTransactionType: BasicTransactionType.SwapIn
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Purchase of Cryptocurrency',
    transactionType: 'P2P or OTC Purchase',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Bank / Cash',
    code: 'ACQ_P2P_OTC',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Native Staking Rewards - Direct Nomination',
    debitAccounts: 'Native Protocol Tokens',
    creditAccounts: 'Staking Rewards',
    code: 'ACQ_STAKE_DIRECT',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Native Staking Rewards - Nomination Pool',
    debitAccounts: 'Native Protocol Tokens',
    creditAccounts: 'Staking Rewards',
    code: 'ACQ_STAKE_POOL',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Validator Block Rewards',
    debitAccounts: 'Native Protocol Tokens',
    creditAccounts: 'Protocol Revenue - Validation',
    code: 'ACQ_VALIDATOR_REWARDS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Liquid Staking Rewards (Auto-compound)',
    debitAccounts: 'Liquid Staking Derivatives',
    creditAccounts: 'Staking Rewards',
    code: 'ACQ_LIQUID_STAKE_AUTO',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Liquid Staking Rewards (Claimable)',
    debitAccounts: 'Native Protocol Tokens, Unclaimed DeFi Rewards (if not)',
    creditAccounts: 'Staking Rewards',
    code: 'ACQ_LIQUID_STAKE_CLAIM',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Staking and Validation Rewards',
    transactionType: 'Collator Rewards',
    debitAccounts: 'Native Protocol Tokens',
    creditAccounts: 'Protocol Revenue - Collator Rewards',
    code: 'ACQ_COLLATOR_REWARDS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Omnipool Liquidity Mining',
    debitAccounts: 'Native Protocol Tokens, Governance Tokens',
    creditAccounts: 'Liquidity Mining Rewards',
    code: 'ACQ_OMNIPOOL_MINING',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Farm Staking Rewards',
    debitAccounts: 'Native Protocol Tokens, Governance Tokens',
    creditAccounts: 'Yield Farming Income',
    code: 'ACQ_FARM_REWARDS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Single-Asset Staking',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'Protocol Revenue Sharing',
    code: 'ACQ_SINGLE_STAKE',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Dual Rewards Farming',
    debitAccounts: 'Governance Tokens (multiple tokens)',
    creditAccounts: 'Liquidity Mining Rewards',
    code: 'ACQ_DUAL_REWARDS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Liquid Staked Derivative Farming',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'Yield Farming Income',
    code: 'ACQ_LSD_FARMING',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'DeFi Protocol Staking Rewards',
    transactionType: 'Protocol Governance Staking',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'Governance Participation Rewards',
    code: 'ACQ_GOV_STAKE',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Mining Rewards',
    transactionType: 'Mining Rewards (Individual)',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Business/Self-Employment Income',
    code: 'ACQ_MINING_INDIVIDUAL',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Mining Rewards',
    transactionType: 'Mining Rewards (Business)',
    debitAccounts: 'Cryptocurrency - Long-term Holdings',
    creditAccounts: 'Protocol Revenue - Transaction Fees',
    code: 'ACQ_MINING_BUSINESS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Airdrops and Forks',
    transactionType: 'Airdrop Receipt',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Airdrops and Token Distributions',
    code: 'ACQ_AIRDROP',
    basicTransactionType: BasicTransactionType.Airdrop
  },
  {
    category: TransactionCategory.Acquisition,
    subcategory: 'Airdrops and Forks',
    transactionType: 'Hard Fork - New Chain Token',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Airdrops and Token Distributions',
    code: 'ACQ_HARD_FORK',
    basicTransactionType: BasicTransactionType.Airdrop
  },
  {
    category: TransactionCategory.Disposal,
    subcategory: 'Sale of Cryptocurrency',
    transactionType: 'Crypto to Fiat Sale',
    debitAccounts: 'Bank - Current Account, Realised Losses - Crypto (if loss)',
    creditAccounts: 'Cryptocurrency Holdings, Realised Gains - Crypto (if gain)',
    code: 'DSP_CRYPTO_FIAT',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.Disposal,
    subcategory: 'Sale of Cryptocurrency',
    transactionType: 'Crypto Used for Goods/Services',
    debitAccounts: 'Groceries (or relevant expense), Realised Losses - Crypto (if loss)',
    creditAccounts: 'Cryptocurrency Holdings, Realised Gains - Crypto (if gain)',
    code: 'DSP_CRYPTO_GOODS',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.Disposal,
    subcategory: 'Sale of Cryptocurrency',
    transactionType: 'Crypto Donation (Charity)',
    debitAccounts: 'Charitable Donations',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'DSP_DONATION',
    basicTransactionType: BasicTransactionType.Donation
  },
  {
    category: TransactionCategory.Disposal,
    subcategory: 'Gifts and Transfers',
    transactionType: 'Gift to Individual',
    debitAccounts: 'No entry (or Retained Earnings if significant)',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'DSP_GIFT',
    basicTransactionType: BasicTransactionType.GiftSent
  },
  {
    category: TransactionCategory.Disposal,
    subcategory: 'Gifts and Transfers',
    transactionType: 'Transfer Between Own Wallets',
    debitAccounts: 'Gas Fees - (if applicable)',
    creditAccounts: 'Bank / Stablecoins',
    code: 'DSP_TRANSFER_OWN',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Deposit to Lending Protocol (Aave, Compound)',
    debitAccounts: 'Lending Protocol Deposits',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'DEFI_LEND_DEPOSIT',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Interest Earned on Lending',
    debitAccounts: 'Lending Protocol Deposits (if auto-compound), Unclaimed DeFi Rewards (if not)',
    creditAccounts: 'DeFi Yield and Interest',
    code: 'DEFI_LEND_INTEREST',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Borrow Against Collateral',
    debitAccounts: 'Stablecoins (borrowed), Cryptocurrency (locked collateral - memo)',
    creditAccounts: 'Collateralized Debt - Protocol',
    code: 'DEFI_BORROW',
    basicTransactionType: BasicTransactionType.TransferIn
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Interest Expense on Borrowing',
    debitAccounts: 'DeFi Interest Expense',
    creditAccounts: 'Collateralized Debt (if accruing), Stablecoins (if paid)',
    code: 'DEFI_BORROW_INTEREST',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Repayment of Loan',
    debitAccounts: 'Collateralized Debt - Protocol',
    creditAccounts: 'Stablecoins',
    code: 'DEFI_LOAN_REPAY',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Lending and Borrowing',
    transactionType: 'Liquidation of Collateral',
    debitAccounts: 'Collateralized Debt, Liquidation Losses, Gas Fees',
    creditAccounts: 'Cryptocurrency Holdings (collateral)',
    code: 'DEFI_LIQUIDATION',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Liquidity Provision (AMM Pools)',
    transactionType: 'Add Liquidity to Pool',
    debitAccounts: 'Liquidity Pool Tokens - LP Tokens',
    creditAccounts: 'Cryptocurrency Holdings (both assets)',
    code: 'DEFI_LP_ADD',
    basicTransactionType: BasicTransactionType.LPDeposit
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Liquidity Provision (AMM Pools)',
    transactionType: 'Earn Trading Fees (LP)',
    debitAccounts: 'Liquidity Pool Tokens (value increase), Unclaimed DeFi Rewards (if claimable)',
    creditAccounts: 'Trading Fees Earned',
    code: 'DEFI_LP_FEES',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Liquidity Provision (AMM Pools)',
    transactionType: 'Liquidity Mining Rewards',
    debitAccounts: 'Governance Tokens, Unclaimed DeFi Rewards',
    creditAccounts: 'Liquidity Mining Rewards',
    code: 'DEFI_LP_MINING',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Liquidity Provision (AMM Pools)',
    transactionType: 'Remove Liquidity from Pool',
    debitAccounts: 'Cryptocurrency Holdings (received back), Impermanent Loss Realised (if loss), Realised Losses',
    creditAccounts: 'Liquidity Pool Tokens, Realised Gains - Crypto (if gain)',
    code: 'DEFI_LP_REMOVE',
    basicTransactionType: BasicTransactionType.LPWithdraw
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Liquidity Provision (AMM Pools)',
    transactionType: 'Impermanent Loss - Mark to Market (Estimate)',
    debitAccounts: 'Impermanent Loss Liability (if material and estimable)',
    creditAccounts: 'Liquidity Pool Tokens (or recognize in OCI)',
    code: 'DEFI_IL_MTM',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Staking',
    transactionType: 'Stake Assets (Native Staking)',
    debitAccounts: 'Staked Assets - Native Staking',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'DEFI_STAKE_NATIVE',
    basicTransactionType: BasicTransactionType.Stake
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Staking',
    transactionType: 'Liquid Staking',
    debitAccounts: 'Staked Assets - Liquid Staking',
    creditAccounts: 'Cryptocurrency',
    code: 'DEFI_STAKE_LIQUID',
    basicTransactionType: BasicTransactionType.Stake
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Staking',
    transactionType: 'Staking Rewards Received',
    debitAccounts: 'Staked Assets (if auto-compound), Crypto (if distributed)',
    creditAccounts: 'Staking Rewards',
    code: 'DEFI_STAKE_REWARDS',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Staking',
    transactionType: 'Unstake Assets',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Staked Assets',
    code: 'DEFI_UNSTAKE',
    basicTransactionType: BasicTransactionType.Unstake
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Staking',
    transactionType: 'Slashing Penalty',
    debitAccounts: 'Smart Contract Failures, Crypto Impairment Losses',
    creditAccounts: 'Staked Assets',
    code: 'DEFI_SLASHING',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Yield Farming',
    transactionType: 'Deploy to Yield Strategy',
    debitAccounts: 'Yield Farming Positions',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'DEFI_YIELD_DEPLOY',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Yield Farming',
    transactionType: 'Harvest Yield Farming Rewards',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'Yield Farming Income',
    code: 'DEFI_YIELD_HARVEST',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.DeFiProtocol,
    subcategory: 'Yield Farming',
    transactionType: 'Auto-Compounding Yield',
    debitAccounts: 'Yield Farming Positions',
    creditAccounts: 'Yield Farming Income',
    code: 'DEFI_YIELD_AUTO',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'Purchase NFT with Crypto',
    debitAccounts: 'NFTs, Gas Fees',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'NFT_PURCHASE',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'Mint NFT (Create)',
    debitAccounts: 'NFTs',
    creditAccounts: 'Stablecoins (if paid mint fee), Gas Fees (if using own crypto)',
    code: 'NFT_MINT',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'Sell NFT',
    debitAccounts: 'Cryptocurrency (proceeds), Realised Losses (if loss)',
    creditAccounts: 'NFTs, Realised Gains - NFT Sales (if gain)',
    code: 'NFT_SELL',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'Receive NFT Airdrop',
    debitAccounts: 'NFTs',
    creditAccounts: 'Airdrops and Token Distributions',
    code: 'NFT_AIRDROP',
    basicTransactionType: BasicTransactionType.Airdrop
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'NFT Royalty Income (Creator)',
    debitAccounts: 'Cryptocurrency',
    creditAccounts: 'NFT Royalty Income',
    code: 'NFT_ROYALTY',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.NFT,
    subcategory: 'NFT Acquisition and Disposal',
    transactionType: 'NFT Impairment',
    debitAccounts: 'NFT Impairment Losses',
    creditAccounts: 'NFTs',
    code: 'NFT_IMPAIRMENT',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Purchase Call/Put Option',
    debitAccounts: 'Options - DeFi Protocols',
    creditAccounts: 'Cryptocurrency (premium paid)',
    code: 'DERIV_OPT_PURCHASE',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Option Exercise (Call)',
    debitAccounts: 'Cryptocurrency (underlying), Realised Losses',
    creditAccounts: 'Cryptocurrency (strike price), Options, Realised Gains',
    code: 'DERIV_OPT_EXERCISE',
    basicTransactionType: BasicTransactionType.SwapIn
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Option Expiry (Worthless)',
    debitAccounts: 'Realised Losses - Cryptocurrency',
    creditAccounts: 'Options - DeFi Protocols',
    code: 'DERIV_OPT_EXPIRE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Perpetual Futures - Open Position',
    debitAccounts: 'Perpetual Futures (if long)',
    creditAccounts: 'Stablecoins (margin)',
    code: 'DERIV_PERP_OPEN',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Perpetual Futures - Funding Rate Payments',
    debitAccounts: 'DeFi Interest Expense (if negative), Stablecoins',
    creditAccounts: 'DeFi Yield and Interest (if positive)',
    code: 'DERIV_PERP_FUNDING',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Options and Futures',
    transactionType: 'Close Perpetual Futures Position',
    debitAccounts: 'Stablecoins (if profit), Realised Losses (if loss)',
    creditAccounts: 'Perpetual Futures, Realised Gains - Crypto (if profit)',
    code: 'DERIV_PERP_CLOSE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Synthetic Assets',
    transactionType: 'Mint Synthetic Asset (e.g., Synthetix)',
    debitAccounts: 'Synthetic Assets',
    creditAccounts: 'Governance Tokens (SNX collateral locked)',
    code: 'DERIV_SYNTH_MINT',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Synthetic Assets',
    transactionType: 'Synthetic Asset Price Movement',
    debitAccounts: 'Synthetic Assets (if gain), Unrealised Losses - Crypto (if loss)',
    creditAccounts: 'Unrealised Gains - Crypto (if gain), Synthetic Assets (if loss)',
    code: 'DERIV_SYNTH_REVALUE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Derivatives,
    subcategory: 'Synthetic Assets',
    transactionType: 'Burn Synthetic / Unlock Collateral',
    debitAccounts: 'Governance Tokens (collateral), Realised Losses (if loss)',
    creditAccounts: 'Synthetic Assets, Realised Gains (if gain)',
    code: 'DERIV_SYNTH_BURN',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Accepting Crypto Payments',
    transactionType: 'Sale of Goods for Crypto',
    debitAccounts: 'Crypto Receivables, Cryptocurrency',
    creditAccounts: 'Cryptocurrency Payment Revenue',
    code: 'BIZ_SALE_GOODS',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Accepting Crypto Payments',
    transactionType: 'Service Revenue in Crypto',
    debitAccounts: 'Cryptocurrency',
    creditAccounts: 'Cryptocurrency Payment Revenue',
    code: 'BIZ_SALE_SERVICE',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Accepting Crypto Payments',
    transactionType: 'Crypto Payment to Supplier',
    debitAccounts: 'Trade Payables, Realised Losses (if applicable)',
    creditAccounts: 'Cryptocurrency, Realised Gains (if applicable)',
    code: 'BIZ_PAY_SUPPLIER',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Employee Compensation',
    transactionType: 'Salary Paid in Crypto',
    debitAccounts: 'Salaries and Wages, Social Security Costs',
    creditAccounts: 'Cryptocurrency, Payroll Tax Payable',
    code: 'BIZ_SALARY_CRYPTO',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Employee Compensation',
    transactionType: 'Token-Based Compensation (Equity-Settled)',
    debitAccounts: 'Token-based Compensation',
    creditAccounts: 'Share Premium (or Token Reserve)',
    code: 'BIZ_TOKEN_COMP',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Employee Compensation',
    transactionType: 'Token Grant Vesting',
    debitAccounts: 'No entry (already expensed during vesting)',
    creditAccounts: 'Digital Tokens (issue new tokens)',
    code: 'BIZ_TOKEN_VEST',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'NFT Business Operations',
    transactionType: 'Create NFT for Sale (Inventory)',
    debitAccounts: 'Digital Asset Inventory',
    creditAccounts: 'Stablecoins (mint & gas costs)',
    code: 'BIZ_NFT_CREATE',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'NFT Business Operations',
    transactionType: 'Sell NFT from Inventory',
    debitAccounts: 'Cryptocurrency',
    creditAccounts: 'NFT Sales Revenue',
    code: 'BIZ_NFT_SELL',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'NFT Business Operations',
    transactionType: 'Cost of NFT Sold',
    debitAccounts: 'Cost of Digital Assets Sold',
    creditAccounts: 'Digital Asset Inventory',
    code: 'BIZ_NFT_COGS',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Treasury Management',
    transactionType: 'Convert Cash to Stablecoin',
    debitAccounts: 'Corporate Stablecoin Holdings',
    creditAccounts: 'Bank - Current Account',
    code: 'BIZ_TREASURY_STABLE',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Treasury Management',
    transactionType: 'Deploy Treasury to DeFi Yield',
    debitAccounts: 'DeFi Treasury Yield Positions',
    creditAccounts: 'Corporate Stablecoin Holdings',
    code: 'BIZ_TREASURY_DEPLOY',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.BusinessOps,
    subcategory: 'Treasury Management',
    transactionType: 'Treasury Yield Income',
    debitAccounts: 'DeFi Treasury Yield Positions',
    creditAccounts: 'DeFi Yield Income',
    code: 'BIZ_TREASURY_YIELD',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Crypto Donations',
    transactionType: 'Receive Crypto Donation (Unrestricted)',
    debitAccounts: 'Donated Cryptocurrency - Unrestricted',
    creditAccounts: 'Crypto Donations - Unrestricted',
    code: 'NFP_DONATE_UNRESTRICTED',
    basicTransactionType: BasicTransactionType.Donation
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Crypto Donations',
    transactionType: 'Receive Crypto Donation (Restricted)',
    debitAccounts: 'Donated Cryptocurrency - Restricted',
    creditAccounts: 'Crypto Donations - Restricted',
    code: 'NFP_DONATE_RESTRICTED',
    basicTransactionType: BasicTransactionType.Donation
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Crypto Donations',
    transactionType: 'Receive NFT Donation',
    debitAccounts: 'Donated NFTs',
    creditAccounts: 'NFT Donations',
    code: 'NFP_DONATE_NFT',
    basicTransactionType: BasicTransactionType.Donation
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Crypto Donations',
    transactionType: 'Convert Donated Crypto to Fiat',
    debitAccounts: 'Bank - Unrestricted Funds, Realised Losses (if loss)',
    creditAccounts: 'Donated Cryptocurrency, Realised Gains (if gain)',
    code: 'NFP_CONVERT_DONATION',
    basicTransactionType: BasicTransactionType.Sale
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Crypto Donations',
    transactionType: 'Use Restricted Crypto Donation',
    debitAccounts: 'Restricted - Programme A (net assets)',
    creditAccounts: 'General Fund',
    code: 'NFP_USE_RESTRICTED',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Endowment Management',
    transactionType: 'Invest Endowment in Crypto',
    debitAccounts: 'Cryptocurrency Endowment Holdings',
    creditAccounts: 'Bank - Endowment Funds',
    code: 'NFP_ENDOW_INVEST',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Endowment Management',
    transactionType: 'Stake Endowment Assets',
    debitAccounts: 'Staked Assets - Endowment',
    creditAccounts: 'Cryptocurrency Endowment Holdings',
    code: 'NFP_ENDOW_STAKE',
    basicTransactionType: BasicTransactionType.Stake
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Endowment Management',
    transactionType: 'Endowment Staking Income',
    debitAccounts: 'Staked Assets - Endowment',
    creditAccounts: 'Staking Rewards - Endowment',
    code: 'NFP_ENDOW_INCOME',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.NFPSpecific,
    subcategory: 'Endowment Management',
    transactionType: 'Endowment Revaluation (Crypto)',
    debitAccounts: 'Cryptocurrency Endowment Holdings (if gain), Unrealised Crypto Losses (if loss)',
    creditAccounts: 'Unrealised Crypto Gains (if gain), Crypto Asset Reserve - Endowment (may use OCI)',
    code: 'NFP_ENDOW_REVALUE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.ForeignExchange,
    subcategory: 'Revaluation and Impairment',
    transactionType: 'Year-End Revaluation (Gain)',
    debitAccounts: 'Cryptocurrency Holdings',
    creditAccounts: 'Unrealised Gains - Cryptocurrency',
    code: 'FX_REVALUE_GAIN',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.ForeignExchange,
    subcategory: 'Revaluation and Impairment',
    transactionType: 'Year-End Revaluation (Loss)',
    debitAccounts: 'Unrealised Losses - Cryptocurrency',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'FX_REVALUE_LOSS',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.ForeignExchange,
    subcategory: 'Revaluation and Impairment',
    transactionType: 'Impairment of Crypto (IAS 38)',
    debitAccounts: 'Crypto Impairment Losses',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'FX_IMPAIRMENT',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.ForeignExchange,
    subcategory: 'Multi-Currency and FX',
    transactionType: 'Crypto Held in Non-Functional Currency',
    debitAccounts: 'Cryptocurrency',
    creditAccounts: 'Bank (purchase)',
    code: 'FX_NONFUNC_HOLD',
    basicTransactionType: BasicTransactionType.Purchase
  },
  {
    category: TransactionCategory.ForeignExchange,
    subcategory: 'Multi-Currency and FX',
    transactionType: 'FX Gain on Crypto (Reporting)',
    debitAccounts: 'Cryptocurrency (functional currency increase)',
    creditAccounts: 'Foreign Exchange Gains',
    code: 'FX_GAIN_CRYPTO',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Gas and Network Fees',
    transactionType: 'Gas Fee on Purchase',
    debitAccounts: 'Cryptocurrency (capitalize to cost basis)',
    creditAccounts: 'Stablecoins / Crypto',
    code: 'FEE_GAS_PURCHASE',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Gas and Network Fees',
    transactionType: 'Gas Fee on Sale',
    debitAccounts: 'Gas Fees - Ethereum (or reduce proceeds)',
    creditAccounts: 'Stablecoins / Crypto',
    code: 'FEE_GAS_SALE',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Gas and Network Fees',
    transactionType: 'Gas Fee on Non-Trading Activity',
    debitAccounts: 'Gas Fees - Ethereum',
    creditAccounts: 'Ethereum',
    code: 'FEE_GAS_OTHER',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Platform and Protocol Fees',
    transactionType: 'DEX Trading Fee',
    debitAccounts: 'DEX Trading Fees (or capitalize)',
    creditAccounts: 'Cryptocurrency (portion of trade)',
    code: 'FEE_DEX',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Platform and Protocol Fees',
    transactionType: 'Protocol Performance Fee',
    debitAccounts: 'Protocol Fees',
    creditAccounts: 'Yield Farming Positions (reduction)',
    code: 'FEE_PROTOCOL',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Fees,
    subcategory: 'Platform and Protocol Fees',
    transactionType: 'Bridge Fee (Cross-Chain)',
    debitAccounts: 'Bridge Fees',
    creditAccounts: 'Cryptocurrency',
    code: 'FEE_BRIDGE',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Theft and Loss of Access',
    transactionType: 'Theft of Crypto (Hack)',
    debitAccounts: 'Smart Contract Failures / Loss Event',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'LOSS_THEFT',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Theft and Loss of Access',
    transactionType: 'Lost Private Keys',
    debitAccounts: 'Crypto Impairment Losses',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'LOSS_KEYS',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Theft and Loss of Access',
    transactionType: 'Smart Contract Exploit Loss',
    debitAccounts: 'Smart Contract Failures',
    creditAccounts: 'Liquidity Pool Tokens / Yield Farming',
    code: 'LOSS_EXPLOIT',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Theft and Loss of Access',
    transactionType: 'Rug Pull (Scam Project)',
    debitAccounts: 'Realised Losses - Cryptocurrency',
    creditAccounts: 'Cryptocurrency Holdings',
    code: 'LOSS_RUG_PULL',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Failed Transactions',
    transactionType: 'Failed Transaction (Out of Gas)',
    debitAccounts: 'Gas Fees',
    creditAccounts: 'Ethereum',
    code: 'LOSS_FAILED_TXN',
    basicTransactionType: BasicTransactionType.Fee
  },
  {
    category: TransactionCategory.Losses,
    subcategory: 'Failed Transactions',
    transactionType: 'Slippage Loss (Excessive)',
    debitAccounts: 'Slippage Losses',
    creditAccounts: 'Realised Gains (reduction) or increase',
    code: 'LOSS_SLIPPAGE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Governance,
    subcategory: 'Governance Tokens',
    transactionType: 'Receive Governance Token Airdrop',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'Airdrops and Token Distributions',
    code: 'GOV_AIRDROP',
    basicTransactionType: BasicTransactionType.Airdrop
  },
  {
    category: TransactionCategory.Governance,
    subcategory: 'Governance Tokens',
    transactionType: 'Use Governance Token to Vote',
    debitAccounts: 'No entry (or memo)',
    creditAccounts: 'No entry',
    code: 'GOV_VOTE',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.Governance,
    subcategory: 'Governance Tokens',
    transactionType: 'Governance Participation Reward',
    debitAccounts: 'Governance Tokens',
    creditAccounts: 'DeFi Governance Rewards',
    code: 'GOV_REWARD',
    basicTransactionType: BasicTransactionType.Reward
  },
  {
    category: TransactionCategory.Governance,
    subcategory: 'Governance Tokens',
    transactionType: 'Stake Governance Tokens',
    debitAccounts: 'Memo - Tokens Locked',
    creditAccounts: 'Memo',
    code: 'GOV_STAKE',
    basicTransactionType: BasicTransactionType.Stake
  },
  {
    category: TransactionCategory.WrappedAssets,
    subcategory: 'Wrapping and Unwrapping',
    transactionType: 'Wrap Asset (Currency to WCurrency)',
    debitAccounts: 'Wrapped Tokens',
    creditAccounts: 'Ethereum (Crypto)',
    code: 'WRAP_WRAP',
    basicTransactionType: BasicTransactionType.SwapIn
  },
  {
    category: TransactionCategory.WrappedAssets,
    subcategory: 'Wrapping and Unwrapping',
    transactionType: 'Unwrap Asset (WCurrency to Currency)',
    debitAccounts: 'Ethereum',
    creditAccounts: 'Wrapped Tokens',
    code: 'WRAP_UNWRAP',
    basicTransactionType: BasicTransactionType.SwapOut
  },
  {
    category: TransactionCategory.WrappedAssets,
    subcategory: 'Wrapping and Unwrapping',
    transactionType: 'Bridge Asset Cross-Chain',
    debitAccounts: 'Cryptocurrency (destination chain), Bridge Fees',
    creditAccounts: 'Cryptocurrency (source chain)',
    code: 'WRAP_BRIDGE',
    basicTransactionType: BasicTransactionType.TransferOut
  },
  {
    category: TransactionCategory.DeferredTax,
    subcategory: 'Temporary Differences',
    transactionType: 'Deferred Tax Asset - Unrealized Losses',
    debitAccounts: 'Deferred Tax Assets',
    creditAccounts: 'Deferred Tax Income',
    code: 'TAX_DTA_LOSS',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.DeferredTax,
    subcategory: 'Temporary Differences',
    transactionType: 'Deferred Tax Liability - Unrealized Gains',
    debitAccounts: 'Deferred Tax Expense',
    creditAccounts: 'Deferred Tax Liabilities',
    code: 'TAX_DTL_GAIN',
    basicTransactionType: BasicTransactionType.Other
  },
  {
    category: TransactionCategory.DeferredTax,
    subcategory: 'Temporary Differences',
    transactionType: 'Tax Loss Carryforward (Crypto Losses)',
    debitAccounts: 'Deferred Tax Assets',
    creditAccounts: 'Deferred Tax Income',
    code: 'TAX_LOSS_CARRYFORWARD',
    basicTransactionType: BasicTransactionType.Other
  }
]

export function getTransactionTypesByCategory(category: TransactionCategory): TransactionTypeDefinition[] {
  return TRANSACTION_TYPE_DEFINITIONS.filter(t => t.category === category)
}

export function getTransactionTypeByCode(code: string): TransactionTypeDefinition | undefined {
  return TRANSACTION_TYPE_DEFINITIONS.find(t => t.code === code)
}

export function getTransactionTypesBySubcategory(subcategory: string): TransactionTypeDefinition[] {
  return TRANSACTION_TYPE_DEFINITIONS.filter(t => t.subcategory === subcategory)
}

export function getAllCategories(): TransactionCategory[] {
  return Object.values(TransactionCategory)
}

export function getAllSubcategories(category: TransactionCategory): string[] {
  const types = getTransactionTypesByCategory(category)
  return Array.from(new Set(types.map(t => t.subcategory)))
}
