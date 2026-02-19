//! Solana-specific types
//!
//! Types for Solana transaction data from Helius API and standard Solana JSON-RPC.

use serde::{Deserialize, Serialize};

// =============================================================================
// WELL-KNOWN PROGRAM IDS
// =============================================================================

/// System Program
pub const SYSTEM_PROGRAM: &str = "11111111111111111111111111111111";
/// SPL Token Program
pub const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/// SPL Token-2022 Program
pub const TOKEN_2022_PROGRAM: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/// Stake Program
pub const STAKE_PROGRAM: &str = "Stake11111111111111111111111111111111111111";
/// Jupiter Aggregator v6
pub const JUPITER_V6: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
/// Marinade Finance
pub const MARINADE_FINANCE: &str = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
/// Raydium AMM
pub const RAYDIUM_AMM: &str = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
/// Orca Whirlpool
pub const ORCA_WHIRLPOOL: &str = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

// =============================================================================
// SOLANA TRANSACTION TYPE CLASSIFICATION
// =============================================================================

/// Solana transaction type classification
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SolanaTransactionType {
    Transfer,
    TokenTransfer,
    Swap,
    Stake,
    Unstake,
    Mint,
    Burn,
    NftSale,
    CreateAccount,
    CloseAccount,
    Unknown,
}

/// Solana transaction status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SolanaTransactionStatus {
    Success,
    Failed,
}

// =============================================================================
// HELIUS API TYPES (enriched transaction data)
// =============================================================================

/// Helius parsed transaction (from /v0/addresses/{address}/transactions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeliusTransaction {
    /// Transaction signature
    pub signature: String,
    /// Slot number
    pub slot: u64,
    /// Block timestamp (Unix seconds)
    pub timestamp: i64,
    /// Transaction fee in lamports
    pub fee: u64,
    /// Fee payer address
    #[serde(default, rename = "feePayer")]
    pub fee_payer: String,
    /// Helius-classified transaction type (e.g. "TRANSFER", "SWAP")
    #[serde(default, rename = "type")]
    pub tx_type: String,
    /// Source protocol (e.g. "JUPITER", "MARINADE", "SYSTEM_PROGRAM")
    #[serde(default)]
    pub source: String,
    /// Human-readable transaction description
    #[serde(default)]
    pub description: String,
    /// Native SOL transfers
    #[serde(default, rename = "nativeTransfers")]
    pub native_transfers: Vec<HeliusNativeTransfer>,
    /// SPL token transfers
    #[serde(default, rename = "tokenTransfers")]
    pub token_transfers: Vec<HeliusTokenTransfer>,
    /// DeFi events (swaps, etc.)
    #[serde(default)]
    pub events: HeliusEvents,
    /// Transaction error (null if success)
    #[serde(default, rename = "transactionError")]
    pub transaction_error: Option<serde_json::Value>,
}

/// Native SOL transfer within a Helius transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeliusNativeTransfer {
    /// Sender address
    #[serde(default, rename = "fromUserAccount")]
    pub from_user_account: String,
    /// Recipient address
    #[serde(default, rename = "toUserAccount")]
    pub to_user_account: String,
    /// Amount in lamports
    #[serde(default)]
    pub amount: u64,
}

/// SPL token transfer within a Helius transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeliusTokenTransfer {
    /// Sender address
    #[serde(default, rename = "fromUserAccount")]
    pub from_user_account: String,
    /// Recipient address
    #[serde(default, rename = "toUserAccount")]
    pub to_user_account: String,
    /// Token mint address
    #[serde(default)]
    pub mint: String,
    /// Transfer amount (raw, as float from Helius)
    #[serde(default, rename = "tokenAmount")]
    pub token_amount: f64,
    /// Token standard (e.g. "Fungible")
    #[serde(default, rename = "tokenStandard")]
    pub token_standard: String,
}

/// Container for Helius DeFi events
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HeliusEvents {
    /// Swap events
    #[serde(default)]
    pub swap: Option<HeliusSwapEvent>,
}

/// Helius swap event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeliusSwapEvent {
    /// Input token info
    #[serde(default, rename = "tokenInputs")]
    pub token_inputs: Vec<HeliusSwapToken>,
    /// Output token info
    #[serde(default, rename = "tokenOutputs")]
    pub token_outputs: Vec<HeliusSwapToken>,
    /// Native SOL input (in lamports)
    #[serde(default, rename = "nativeFees")]
    pub native_fees: Vec<HeliusNativeTransfer>,
    /// Inner swaps
    #[serde(default, rename = "innerSwaps")]
    pub inner_swaps: Vec<serde_json::Value>,
}

/// Token in a swap event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeliusSwapToken {
    /// Token mint address
    #[serde(default)]
    pub mint: String,
    /// Raw amount
    #[serde(default, rename = "rawTokenAmount")]
    pub raw_token_amount: HeliusRawAmount,
}

/// Raw token amount from Helius
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HeliusRawAmount {
    /// Token amount as string
    #[serde(default, rename = "tokenAmount")]
    pub token_amount: String,
    /// Token decimals
    #[serde(default)]
    pub decimals: u8,
}

// =============================================================================
// DAS API TYPES (Digital Asset Standard - token balances)
// =============================================================================

/// DAS getAssetsByOwner response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasAssetList {
    /// Total number of assets
    #[serde(default)]
    pub total: u64,
    /// Current page
    #[serde(default)]
    pub page: u64,
    /// List of assets
    #[serde(default)]
    pub items: Vec<DasAsset>,
}

/// Individual asset from DAS API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasAsset {
    /// Asset ID (mint address for tokens)
    #[serde(default)]
    pub id: String,
    /// Interface type (e.g. "FungibleToken", "FungibleAsset")
    #[serde(default)]
    pub interface: String,
    /// Token info
    #[serde(default)]
    pub token_info: Option<DasTokenInfo>,
    /// Content metadata
    #[serde(default)]
    pub content: Option<DasContent>,
}

/// Token info from DAS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasTokenInfo {
    /// Token symbol
    #[serde(default)]
    pub symbol: String,
    /// Token decimals
    #[serde(default)]
    pub decimals: u8,
    /// Token balance (raw string)
    #[serde(default)]
    pub balance: String,
    /// Price info
    #[serde(default)]
    pub price_info: Option<DasPriceInfo>,
}

/// Price info from DAS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasPriceInfo {
    /// Price per token in USD
    #[serde(default)]
    pub price_per_token: f64,
    /// Total value in USD
    #[serde(default)]
    pub total_price: f64,
    /// Currency
    #[serde(default)]
    pub currency: String,
}

/// Content metadata from DAS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasContent {
    /// Metadata
    #[serde(default)]
    pub metadata: Option<DasMetadata>,
}

/// Metadata from DAS content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DasMetadata {
    /// Token name
    #[serde(default)]
    pub name: String,
    /// Token symbol
    #[serde(default)]
    pub symbol: String,
}

// =============================================================================
// STANDARD RPC TYPES (fallback without Helius key)
// =============================================================================

/// JSON-RPC 2.0 response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse<T> {
    pub jsonrpc: String,
    pub result: Option<T>,
    pub error: Option<RpcError>,
    pub id: u64,
}

/// JSON-RPC error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i64,
    pub message: String,
}

/// getBalance response value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcBalanceResult {
    pub value: u64,
}

/// getTokenAccountsByOwner response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcTokenAccountsResult {
    pub value: Vec<RpcTokenAccountEntry>,
}

/// Token account entry from RPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcTokenAccountEntry {
    /// Account public key
    pub pubkey: String,
    /// Account data
    pub account: RpcTokenAccountData,
}

/// Token account data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcTokenAccountData {
    /// Parsed account data
    pub data: RpcParsedData,
}

/// Parsed data envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcParsedData {
    /// Parsed info
    pub parsed: RpcParsedInfo,
}

/// Parsed token account info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcParsedInfo {
    pub info: RpcTokenInfo,
    #[serde(rename = "type")]
    pub account_type: String,
}

/// Token info from RPC parsed response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcTokenInfo {
    /// Token mint address
    pub mint: String,
    /// Token owner
    pub owner: String,
    /// Token amount
    #[serde(rename = "tokenAmount")]
    pub token_amount: RpcTokenAmount,
}

/// Token amount from RPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcTokenAmount {
    /// Amount as string
    pub amount: String,
    /// Decimals
    pub decimals: u8,
    /// UI amount (float)
    #[serde(rename = "uiAmount")]
    pub ui_amount: Option<f64>,
    /// UI amount string
    #[serde(rename = "uiAmountString")]
    pub ui_amount_string: String,
}

/// Signature info from getSignaturesForAddress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcSignatureInfo {
    /// Transaction signature
    pub signature: String,
    /// Slot
    pub slot: u64,
    /// Block time
    #[serde(rename = "blockTime")]
    pub block_time: Option<i64>,
    /// Error (null if success)
    pub err: Option<serde_json::Value>,
    /// Memo
    pub memo: Option<String>,
}

// =============================================================================
// NORMALIZED APP TYPES
// =============================================================================

/// Normalized Solana transaction for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTransaction {
    /// Transaction signature
    pub signature: String,
    /// Slot number
    pub slot: u64,
    /// Block timestamp (Unix seconds)
    pub timestamp: i64,
    /// Transaction fee in lamports
    pub fee: u64,
    /// Transaction status
    pub status: SolanaTransactionStatus,
    /// Transaction type classification
    pub tx_type: SolanaTransactionType,
    /// Native SOL transfers
    pub native_transfers: Vec<SolanaNativeTransfer>,
    /// SPL token transfers
    pub token_transfers: Vec<SolanaTokenTransfer>,
    /// Human-readable description (from Helius or generated)
    pub description: String,
    /// Source program/protocol
    pub source_program: String,
    /// Fee payer address
    pub fee_payer: String,
}

/// Normalized native SOL transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaNativeTransfer {
    pub from: String,
    pub to: String,
    /// Amount in lamports
    pub amount: u64,
}

/// Normalized SPL token transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTokenTransfer {
    pub from: String,
    pub to: String,
    pub mint: String,
    pub amount: f64,
    pub token_standard: String,
}

/// Solana address balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaBalance {
    /// Address
    pub address: String,
    /// Balance in lamports
    pub balance: u64,
    /// Token accounts
    pub token_accounts: Vec<SolanaTokenAccount>,
}

/// Token account for balance display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTokenAccount {
    /// Token mint address
    pub mint: String,
    /// Token symbol (if known)
    pub symbol: Option<String>,
    /// Token name (if known)
    pub name: Option<String>,
    /// Raw balance as string
    pub balance: String,
    /// Token decimals
    pub decimals: u8,
    /// UI balance (human-readable)
    pub ui_balance: String,
}

// =============================================================================
// CONVERSIONS
// =============================================================================

/// Classify a Helius transaction source string to our type
pub fn classify_transaction_type(tx_type: &str) -> SolanaTransactionType {
    match tx_type.to_uppercase().as_str() {
        "TRANSFER" => SolanaTransactionType::Transfer,
        "TOKEN_TRANSFER" => SolanaTransactionType::TokenTransfer,
        "SWAP" => SolanaTransactionType::Swap,
        "STAKE" | "STAKE_SOL" => SolanaTransactionType::Stake,
        "UNSTAKE" | "UNSTAKE_SOL" | "DEACTIVATE_STAKE" => SolanaTransactionType::Unstake,
        "TOKEN_MINT" | "MINT" => SolanaTransactionType::Mint,
        "BURN" | "TOKEN_BURN" => SolanaTransactionType::Burn,
        "NFT_SALE" | "NFT_LISTING" | "NFT_BID" => SolanaTransactionType::NftSale,
        "CREATE_ACCOUNT" | "INIT_ACCOUNT" => SolanaTransactionType::CreateAccount,
        "CLOSE_ACCOUNT" => SolanaTransactionType::CloseAccount,
        _ => SolanaTransactionType::Unknown,
    }
}

/// Classify a source program string
pub fn classify_transaction_source(source: &str) -> &str {
    match source.to_uppercase().as_str() {
        "JUPITER" => "Jupiter",
        "MARINADE" | "MARINADE_FINANCE" => "Marinade",
        "RAYDIUM" => "Raydium",
        "ORCA" | "ORCA_WHIRLPOOLS" => "Orca",
        "SYSTEM_PROGRAM" => "System",
        "SOLEND" => "Solend",
        "MARGINFI" => "MarginFi",
        _ => source,
    }
}

impl HeliusTransaction {
    /// Convert a Helius enriched transaction to our normalized format
    pub fn to_solana_transaction(&self) -> SolanaTransaction {
        let tx_type = classify_transaction_type(&self.tx_type);

        let status = if self.transaction_error.is_some() {
            SolanaTransactionStatus::Failed
        } else {
            SolanaTransactionStatus::Success
        };

        let native_transfers = self
            .native_transfers
            .iter()
            .map(|t| SolanaNativeTransfer {
                from: t.from_user_account.clone(),
                to: t.to_user_account.clone(),
                amount: t.amount,
            })
            .collect();

        let token_transfers = self
            .token_transfers
            .iter()
            .map(|t| SolanaTokenTransfer {
                from: t.from_user_account.clone(),
                to: t.to_user_account.clone(),
                mint: t.mint.clone(),
                amount: t.token_amount,
                token_standard: t.token_standard.clone(),
            })
            .collect();

        SolanaTransaction {
            signature: self.signature.clone(),
            slot: self.slot,
            timestamp: self.timestamp,
            fee: self.fee,
            status,
            tx_type,
            native_transfers,
            token_transfers,
            description: self.description.clone(),
            source_program: classify_transaction_source(&self.source).to_string(),
            fee_payer: self.fee_payer.clone(),
        }
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_helius_transaction_deserialization() {
        let json = r#"{
            "signature": "5UfDuX...",
            "slot": 250000000,
            "timestamp": 1700000000,
            "fee": 5000,
            "feePayer": "Abc123...",
            "type": "TRANSFER",
            "source": "SYSTEM_PROGRAM",
            "description": "Abc123 transferred 1 SOL to Def456",
            "nativeTransfers": [
                {
                    "fromUserAccount": "Abc123...",
                    "toUserAccount": "Def456...",
                    "amount": 1000000000
                }
            ],
            "tokenTransfers": [],
            "events": {},
            "transactionError": null
        }"#;

        let tx: HeliusTransaction = serde_json::from_str(json).unwrap();
        assert_eq!(tx.signature, "5UfDuX...");
        assert_eq!(tx.slot, 250000000);
        assert_eq!(tx.fee, 5000);
        assert_eq!(tx.tx_type, "TRANSFER");
        assert_eq!(tx.native_transfers.len(), 1);
        assert_eq!(tx.native_transfers[0].amount, 1000000000);
    }

    #[test]
    fn test_helius_swap_deserialization() {
        let json = r#"{
            "signature": "SwapSig...",
            "slot": 250000001,
            "timestamp": 1700000100,
            "fee": 5000,
            "feePayer": "SwapUser...",
            "type": "SWAP",
            "source": "JUPITER",
            "description": "SwapUser swapped 1 SOL for 100 USDC",
            "nativeTransfers": [],
            "tokenTransfers": [
                {
                    "fromUserAccount": "SwapUser...",
                    "toUserAccount": "Pool...",
                    "mint": "So11111111111111111111111111111111111111112",
                    "tokenAmount": 1.0,
                    "tokenStandard": "Fungible"
                }
            ],
            "events": {
                "swap": {
                    "tokenInputs": [],
                    "tokenOutputs": [],
                    "nativeFees": [],
                    "innerSwaps": []
                }
            },
            "transactionError": null
        }"#;

        let tx: HeliusTransaction = serde_json::from_str(json).unwrap();
        assert_eq!(tx.tx_type, "SWAP");
        assert_eq!(tx.source, "JUPITER");
        assert!(tx.events.swap.is_some());
    }

    #[test]
    fn test_classify_transaction_type() {
        assert_eq!(
            classify_transaction_type("TRANSFER"),
            SolanaTransactionType::Transfer
        );
        assert_eq!(
            classify_transaction_type("SWAP"),
            SolanaTransactionType::Swap
        );
        assert_eq!(
            classify_transaction_type("STAKE_SOL"),
            SolanaTransactionType::Stake
        );
        assert_eq!(
            classify_transaction_type("UNKNOWN_TYPE"),
            SolanaTransactionType::Unknown
        );
    }

    #[test]
    fn test_classify_transaction_source() {
        assert_eq!(classify_transaction_source("JUPITER"), "Jupiter");
        assert_eq!(classify_transaction_source("MARINADE"), "Marinade");
        assert_eq!(classify_transaction_source("SYSTEM_PROGRAM"), "System");
        assert_eq!(
            classify_transaction_source("SOME_NEW_PROTOCOL"),
            "SOME_NEW_PROTOCOL"
        );
    }

    #[test]
    fn test_helius_to_solana_transaction() {
        let helius_tx = HeliusTransaction {
            signature: "TestSig".to_string(),
            slot: 100,
            timestamp: 1700000000,
            fee: 5000,
            fee_payer: "Payer".to_string(),
            tx_type: "SWAP".to_string(),
            source: "JUPITER".to_string(),
            description: "Swapped SOL for USDC".to_string(),
            native_transfers: vec![HeliusNativeTransfer {
                from_user_account: "From".to_string(),
                to_user_account: "To".to_string(),
                amount: 1_000_000_000,
            }],
            token_transfers: vec![],
            events: HeliusEvents::default(),
            transaction_error: None,
        };

        let sol_tx = helius_tx.to_solana_transaction();
        assert_eq!(sol_tx.signature, "TestSig");
        assert_eq!(sol_tx.tx_type, SolanaTransactionType::Swap);
        assert_eq!(sol_tx.status, SolanaTransactionStatus::Success);
        assert_eq!(sol_tx.source_program, "Jupiter");
        assert_eq!(sol_tx.native_transfers.len(), 1);
    }

    #[test]
    fn test_failed_transaction() {
        let helius_tx = HeliusTransaction {
            signature: "FailSig".to_string(),
            slot: 100,
            timestamp: 1700000000,
            fee: 5000,
            fee_payer: "Payer".to_string(),
            tx_type: "TRANSFER".to_string(),
            source: "SYSTEM_PROGRAM".to_string(),
            description: "".to_string(),
            native_transfers: vec![],
            token_transfers: vec![],
            events: HeliusEvents::default(),
            transaction_error: Some(serde_json::json!({"InstructionError": [0, "InsufficientFunds"]})),
        };

        let sol_tx = helius_tx.to_solana_transaction();
        assert_eq!(sol_tx.status, SolanaTransactionStatus::Failed);
    }

    #[test]
    fn test_das_asset_deserialization() {
        let json = r#"{
            "total": 1,
            "page": 1,
            "items": [
                {
                    "id": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    "interface": "FungibleToken",
                    "token_info": {
                        "symbol": "USDC",
                        "decimals": 6,
                        "balance": "1000000",
                        "price_info": {
                            "price_per_token": 1.0,
                            "total_price": 1.0,
                            "currency": "USDC"
                        }
                    },
                    "content": null
                }
            ]
        }"#;

        let assets: DasAssetList = serde_json::from_str(json).unwrap();
        assert_eq!(assets.total, 1);
        assert_eq!(assets.items.len(), 1);
        assert_eq!(assets.items[0].interface, "FungibleToken");
        let token_info = assets.items[0].token_info.as_ref().unwrap();
        assert_eq!(token_info.symbol, "USDC");
        assert_eq!(token_info.decimals, 6);
    }

    #[test]
    fn test_rpc_signature_info_deserialization() {
        let json = r#"{
            "signature": "SigABC...",
            "slot": 200000000,
            "blockTime": 1700000000,
            "err": null,
            "memo": null
        }"#;

        let sig: RpcSignatureInfo = serde_json::from_str(json).unwrap();
        assert_eq!(sig.signature, "SigABC...");
        assert_eq!(sig.block_time, Some(1700000000));
        assert!(sig.err.is_none());
    }
}
