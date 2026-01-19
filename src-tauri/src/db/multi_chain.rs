//! Multi-Chain Transaction Storage
//!
//! Provides database storage and retrieval for transactions across multiple
//! blockchain networks including EVM, Substrate, Solana, and Bitcoin chains.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, SqlitePool};

// =============================================================================
// MODELS
// =============================================================================

/// Transaction type classification for accounting purposes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TxType {
    /// Simple token or native currency transfer.
    Transfer,
    /// Token swap on a DEX.
    Swap,
    /// Cross-chain bridge transaction.
    Bridge,
    /// Staking tokens in a protocol.
    Stake,
    /// Unstaking tokens from a protocol.
    Unstake,
    /// Claiming rewards or airdrops.
    Claim,
    /// Minting new tokens (e.g., NFTs).
    Mint,
    /// Burning tokens.
    Burn,
    /// ERC20 token approval.
    Approve,
    /// Generic smart contract interaction.
    ContractCall,
    /// Unclassified transaction type.
    Unknown,
}

impl TxType {
    /// Converts to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            TxType::Transfer => "transfer",
            TxType::Swap => "swap",
            TxType::Bridge => "bridge",
            TxType::Stake => "stake",
            TxType::Unstake => "unstake",
            TxType::Claim => "claim",
            TxType::Mint => "mint",
            TxType::Burn => "burn",
            TxType::Approve => "approve",
            TxType::ContractCall => "contract_call",
            TxType::Unknown => "unknown",
        }
    }

    /// Parses from database string representation.
    pub fn from_str(s: &str) -> Self {
        match s {
            "transfer" => TxType::Transfer,
            "swap" => TxType::Swap,
            "bridge" => TxType::Bridge,
            "stake" => TxType::Stake,
            "unstake" => TxType::Unstake,
            "claim" => TxType::Claim,
            "mint" => TxType::Mint,
            "burn" => TxType::Burn,
            "approve" => TxType::Approve,
            "contract_call" => TxType::ContractCall,
            _ => TxType::Unknown,
        }
    }
}

/// Transaction status on the blockchain.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TxStatus {
    /// Transaction completed successfully.
    Success,
    /// Transaction failed or reverted.
    Failed,
    /// Transaction is pending confirmation.
    Pending,
}

impl TxStatus {
    /// Converts to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            TxStatus::Success => "success",
            TxStatus::Failed => "failed",
            TxStatus::Pending => "pending",
        }
    }

    /// Parses from database string representation.
    pub fn from_str(s: &str) -> Self {
        match s {
            "success" => TxStatus::Success,
            "failed" => TxStatus::Failed,
            "pending" => TxStatus::Pending,
            _ => TxStatus::Pending,
        }
    }
}

/// Token type/standard classification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    /// ERC-20 fungible token standard.
    Erc20,
    /// ERC-721 non-fungible token standard.
    Erc721,
    /// ERC-1155 multi-token standard.
    Erc1155,
    /// PSP-22 Substrate fungible token standard.
    Psp22,
    /// PSP-34 Substrate non-fungible token standard.
    Psp34,
    /// Native chain token (ETH, DOT, etc.).
    Native,
    /// Unknown or unrecognized token standard.
    Unknown,
}

impl TokenType {
    /// Converts to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            TokenType::Erc20 => "erc20",
            TokenType::Erc721 => "erc721",
            TokenType::Erc1155 => "erc1155",
            TokenType::Psp22 => "psp22",
            TokenType::Psp34 => "psp34",
            TokenType::Native => "native",
            TokenType::Unknown => "unknown",
        }
    }

    /// Parses from database string representation.
    pub fn from_str(s: &str) -> Self {
        match s {
            "erc20" => TokenType::Erc20,
            "erc721" => TokenType::Erc721,
            "erc1155" => TokenType::Erc1155,
            "psp22" => TokenType::Psp22,
            "psp34" => TokenType::Psp34,
            "native" => TokenType::Native,
            _ => TokenType::Unknown,
        }
    }
}

/// Wallet type classification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WalletType {
    /// Ethereum Virtual Machine compatible wallet (secp256k1).
    Evm,
    /// Substrate/Polkadot ecosystem wallet (sr25519/ed25519).
    Substrate,
    /// Solana wallet (ed25519).
    Solana,
    /// Bitcoin wallet (secp256k1).
    Bitcoin,
}

impl WalletType {
    /// Converts to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            WalletType::Evm => "evm",
            WalletType::Substrate => "substrate",
            WalletType::Solana => "solana",
            WalletType::Bitcoin => "bitcoin",
        }
    }

    /// Parses from database string representation.
    pub fn from_str(s: &str) -> Self {
        match s {
            "evm" => WalletType::Evm,
            "substrate" => WalletType::Substrate,
            "solana" => WalletType::Solana,
            "bitcoin" => WalletType::Bitcoin,
            _ => WalletType::Evm,
        }
    }
}

/// Multi-chain transaction record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    /// Composite ID: chain_id + "_" + hash
    pub id: String,
    /// Chain identifier (e.g., "ethereum", "polygon", "1", "137")
    pub chain_id: String,
    /// Transaction hash
    pub hash: String,
    /// Sender address
    pub from_address: String,
    /// Recipient address (None for contract creation)
    pub to_address: Option<String>,
    /// Transaction value in native units (string for precision)
    pub value: String,
    /// Transaction fee in native units
    pub fee: Option<String>,
    /// Unix timestamp
    pub timestamp: i64,
    /// Block number
    pub block_number: Option<i64>,
    /// Transaction type classification
    pub tx_type: TxType,
    /// Transaction status
    pub status: TxStatus,
    /// Raw transaction data as JSON
    pub raw_data: Option<String>,
    /// Record creation timestamp
    pub created_at: Option<i64>,
    /// Record update timestamp
    pub updated_at: Option<i64>,
}

impl Transaction {
    /// Creates a new transaction with composite ID.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        chain_id: String,
        hash: String,
        from_address: String,
        to_address: Option<String>,
        value: String,
        fee: Option<String>,
        timestamp: i64,
        block_number: Option<i64>,
        tx_type: TxType,
        status: TxStatus,
        raw_data: Option<String>,
    ) -> Self {
        let id = format!("{}_{}", chain_id, hash);
        Self {
            id,
            chain_id,
            hash,
            from_address,
            to_address,
            value,
            fee,
            timestamp,
            block_number,
            tx_type,
            status,
            raw_data,
            created_at: None,
            updated_at: None,
        }
    }
}

/// Database row representation for Transaction.
#[derive(Debug, FromRow)]
struct TransactionRow {
    id: String,
    chain_id: String,
    hash: String,
    from_address: String,
    to_address: Option<String>,
    value: String,
    fee: Option<String>,
    timestamp: i64,
    block_number: Option<i64>,
    tx_type: String,
    status: String,
    raw_data: Option<String>,
    created_at: Option<i64>,
    updated_at: Option<i64>,
}

impl From<TransactionRow> for Transaction {
    fn from(row: TransactionRow) -> Self {
        Transaction {
            id: row.id,
            chain_id: row.chain_id,
            hash: row.hash,
            from_address: row.from_address,
            to_address: row.to_address,
            value: row.value,
            fee: row.fee,
            timestamp: row.timestamp,
            block_number: row.block_number,
            tx_type: TxType::from_str(&row.tx_type),
            status: TxStatus::from_str(&row.status),
            raw_data: row.raw_data,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

/// Token transfer within a transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransfer {
    /// Database ID
    pub id: Option<i64>,
    /// Parent transaction ID
    pub transaction_id: String,
    /// Token contract address
    pub contract_address: String,
    /// Token symbol
    pub token_symbol: Option<String>,
    /// Token name
    pub token_name: Option<String>,
    /// Token decimals
    pub token_decimals: Option<i32>,
    /// Sender address
    pub from_address: String,
    /// Recipient address
    pub to_address: String,
    /// Transfer value (string for precision)
    pub value: String,
    /// Log index in transaction
    pub log_index: Option<i32>,
    /// Token type/standard
    pub token_type: Option<TokenType>,
    /// NFT token ID
    pub token_id: Option<String>,
    /// Record creation timestamp
    pub created_at: Option<i64>,
}

/// Database row representation for TokenTransfer.
#[derive(Debug, FromRow)]
struct TokenTransferRow {
    id: i64,
    transaction_id: String,
    contract_address: String,
    token_symbol: Option<String>,
    token_name: Option<String>,
    token_decimals: Option<i32>,
    from_address: String,
    to_address: String,
    value: String,
    log_index: Option<i32>,
    token_type: Option<String>,
    token_id: Option<String>,
    created_at: Option<i64>,
}

impl From<TokenTransferRow> for TokenTransfer {
    fn from(row: TokenTransferRow) -> Self {
        TokenTransfer {
            id: Some(row.id),
            transaction_id: row.transaction_id,
            contract_address: row.contract_address,
            token_symbol: row.token_symbol,
            token_name: row.token_name,
            token_decimals: row.token_decimals,
            from_address: row.from_address,
            to_address: row.to_address,
            value: row.value,
            log_index: row.log_index,
            token_type: row.token_type.map(|s| TokenType::from_str(&s)),
            token_id: row.token_id,
            created_at: row.created_at,
        }
    }
}

/// Sync status for a chain/address pair.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncStatus {
    /// Database ID
    pub id: i64,
    /// Chain identifier
    pub chain_id: String,
    /// Wallet address
    pub address: String,
    /// Last successfully synced block number
    pub last_block_synced: i64,
    /// Unix timestamp of last sync
    pub last_sync_timestamp: Option<i64>,
    /// Current sync state
    pub sync_state: Option<String>,
    /// Error message if sync failed
    pub error_message: Option<String>,
    /// Record creation timestamp
    pub created_at: Option<i64>,
    /// Record update timestamp
    pub updated_at: Option<i64>,
}

/// User wallet record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    /// Database ID
    pub id: Option<i64>,
    /// Wallet address
    pub address: String,
    /// Chain identifier
    pub chain_id: String,
    /// User-provided label
    pub label: Option<String>,
    /// Wallet type
    pub wallet_type: WalletType,
    /// Watch-only flag
    pub is_watch_only: bool,
    /// Associated profile ID
    pub profile_id: Option<String>,
    /// Record creation timestamp
    pub created_at: Option<i64>,
    /// Record update timestamp
    pub updated_at: Option<i64>,
}

/// Database row representation for Wallet.
#[derive(Debug, FromRow)]
struct WalletRow {
    id: i64,
    address: String,
    chain_id: String,
    label: Option<String>,
    wallet_type: String,
    is_watch_only: i32,
    profile_id: Option<String>,
    created_at: Option<i64>,
    updated_at: Option<i64>,
}

impl From<WalletRow> for Wallet {
    fn from(row: WalletRow) -> Self {
        Wallet {
            id: Some(row.id),
            address: row.address,
            chain_id: row.chain_id,
            label: row.label,
            wallet_type: WalletType::from_str(&row.wallet_type),
            is_watch_only: row.is_watch_only != 0,
            profile_id: row.profile_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

// =============================================================================
// REPOSITORY
// =============================================================================

/// Repository for multi-chain transaction database operations.
pub struct MultiChainRepository {
    pool: SqlitePool,
}

impl MultiChainRepository {
    /// Creates a new repository with the given connection pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    // =========================================================================
    // TRANSACTION OPERATIONS
    // =========================================================================

    /// Inserts multiple transactions with upsert semantics.
    ///
    /// Returns the number of successfully inserted/updated transactions.
    pub async fn insert_transactions(&self, txs: &[Transaction]) -> Result<usize, sqlx::Error> {
        let mut count = 0;

        for tx in txs {
            let result = sqlx::query(
                r#"
                INSERT INTO multi_chain_transactions (
                    id, chain_id, hash, from_address, to_address,
                    value, fee, timestamp, block_number, tx_type,
                    status, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(chain_id, hash) DO UPDATE SET
                    from_address = excluded.from_address,
                    to_address = excluded.to_address,
                    value = excluded.value,
                    fee = excluded.fee,
                    timestamp = excluded.timestamp,
                    block_number = excluded.block_number,
                    tx_type = excluded.tx_type,
                    status = excluded.status,
                    raw_data = excluded.raw_data
                "#,
            )
            .bind(&tx.id)
            .bind(&tx.chain_id)
            .bind(&tx.hash)
            .bind(&tx.from_address)
            .bind(&tx.to_address)
            .bind(&tx.value)
            .bind(&tx.fee)
            .bind(tx.timestamp)
            .bind(tx.block_number)
            .bind(tx.tx_type.as_str())
            .bind(tx.status.as_str())
            .bind(&tx.raw_data)
            .execute(&self.pool)
            .await;

            if result.is_ok() {
                count += 1;
            }
        }

        Ok(count)
    }

    /// Retrieves transactions for an address on a chain within a time range.
    pub async fn get_transactions(
        &self,
        chain_id: &str,
        address: &str,
        from_ts: Option<i64>,
        to_ts: Option<i64>,
    ) -> Result<Vec<Transaction>, sqlx::Error> {
        let address_lower = address.to_lowercase();

        let rows = match (from_ts, to_ts) {
            (Some(from), Some(to)) => {
                sqlx::query_as::<_, TransactionRow>(
                    r#"
                    SELECT * FROM multi_chain_transactions
                    WHERE chain_id = ?
                    AND (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                    AND timestamp >= ? AND timestamp <= ?
                    ORDER BY timestamp DESC
                    "#,
                )
                .bind(chain_id)
                .bind(&address_lower)
                .bind(&address_lower)
                .bind(from)
                .bind(to)
                .fetch_all(&self.pool)
                .await?
            }
            (Some(from), None) => {
                sqlx::query_as::<_, TransactionRow>(
                    r#"
                    SELECT * FROM multi_chain_transactions
                    WHERE chain_id = ?
                    AND (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                    AND timestamp >= ?
                    ORDER BY timestamp DESC
                    "#,
                )
                .bind(chain_id)
                .bind(&address_lower)
                .bind(&address_lower)
                .bind(from)
                .fetch_all(&self.pool)
                .await?
            }
            (None, Some(to)) => {
                sqlx::query_as::<_, TransactionRow>(
                    r#"
                    SELECT * FROM multi_chain_transactions
                    WHERE chain_id = ?
                    AND (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                    AND timestamp <= ?
                    ORDER BY timestamp DESC
                    "#,
                )
                .bind(chain_id)
                .bind(&address_lower)
                .bind(&address_lower)
                .bind(to)
                .fetch_all(&self.pool)
                .await?
            }
            (None, None) => {
                sqlx::query_as::<_, TransactionRow>(
                    r#"
                    SELECT * FROM multi_chain_transactions
                    WHERE chain_id = ?
                    AND (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                    ORDER BY timestamp DESC
                    "#,
                )
                .bind(chain_id)
                .bind(&address_lower)
                .bind(&address_lower)
                .fetch_all(&self.pool)
                .await?
            }
        };

        Ok(rows.into_iter().map(Transaction::from).collect())
    }

    /// Retrieves a transaction by its composite ID.
    pub async fn get_transaction_by_id(
        &self,
        id: &str,
    ) -> Result<Option<Transaction>, sqlx::Error> {
        let row = sqlx::query_as::<_, TransactionRow>(
            "SELECT * FROM multi_chain_transactions WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Transaction::from))
    }

    /// Retrieves transactions by hash across all chains.
    pub async fn get_transactions_by_hash(
        &self,
        hash: &str,
    ) -> Result<Vec<Transaction>, sqlx::Error> {
        let rows = sqlx::query_as::<_, TransactionRow>(
            "SELECT * FROM multi_chain_transactions WHERE hash = ? ORDER BY chain_id",
        )
        .bind(hash)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Transaction::from).collect())
    }

    /// Counts transactions for an address on a chain.
    pub async fn count_transactions(
        &self,
        chain_id: &str,
        address: &str,
    ) -> Result<i64, sqlx::Error> {
        let address_lower = address.to_lowercase();

        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM multi_chain_transactions
            WHERE chain_id = ?
            AND (LOWER(from_address) = ? OR LOWER(to_address) = ?)
            "#,
        )
        .bind(chain_id)
        .bind(&address_lower)
        .bind(&address_lower)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    // =========================================================================
    // TOKEN TRANSFER OPERATIONS
    // =========================================================================

    /// Inserts token transfers for a transaction.
    pub async fn insert_token_transfers(
        &self,
        transfers: &[TokenTransfer],
    ) -> Result<usize, sqlx::Error> {
        let mut count = 0;

        for transfer in transfers {
            let result = sqlx::query(
                r#"
                INSERT INTO token_transfers (
                    transaction_id, contract_address, token_symbol, token_name,
                    token_decimals, from_address, to_address, value,
                    log_index, token_type, token_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&transfer.transaction_id)
            .bind(&transfer.contract_address)
            .bind(&transfer.token_symbol)
            .bind(&transfer.token_name)
            .bind(transfer.token_decimals)
            .bind(&transfer.from_address)
            .bind(&transfer.to_address)
            .bind(&transfer.value)
            .bind(transfer.log_index)
            .bind(transfer.token_type.as_ref().map(|t| t.as_str()))
            .bind(&transfer.token_id)
            .execute(&self.pool)
            .await;

            if result.is_ok() {
                count += 1;
            }
        }

        Ok(count)
    }

    /// Retrieves token transfers for a transaction.
    pub async fn get_token_transfers(
        &self,
        transaction_id: &str,
    ) -> Result<Vec<TokenTransfer>, sqlx::Error> {
        let rows = sqlx::query_as::<_, TokenTransferRow>(
            "SELECT * FROM token_transfers WHERE transaction_id = ? ORDER BY log_index",
        )
        .bind(transaction_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(TokenTransfer::from).collect())
    }

    /// Retrieves token transfers for a contract address.
    pub async fn get_transfers_by_contract(
        &self,
        contract_address: &str,
    ) -> Result<Vec<TokenTransfer>, sqlx::Error> {
        let address_lower = contract_address.to_lowercase();

        let rows = sqlx::query_as::<_, TokenTransferRow>(
            "SELECT * FROM token_transfers WHERE LOWER(contract_address) = ? ORDER BY created_at DESC",
        )
        .bind(&address_lower)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(TokenTransfer::from).collect())
    }

    // =========================================================================
    // SYNC STATUS OPERATIONS
    // =========================================================================

    /// Retrieves sync status for a chain/address pair.
    pub async fn get_sync_status(
        &self,
        chain_id: &str,
        address: &str,
    ) -> Result<Option<SyncStatus>, sqlx::Error> {
        let address_lower = address.to_lowercase();

        sqlx::query_as::<_, SyncStatus>(
            "SELECT * FROM address_sync_status WHERE chain_id = ? AND LOWER(address) = ?",
        )
        .bind(chain_id)
        .bind(&address_lower)
        .fetch_optional(&self.pool)
        .await
    }

    /// Updates sync status for a chain/address pair (upsert).
    pub async fn update_sync_status(
        &self,
        chain_id: &str,
        address: &str,
        last_block: i64,
    ) -> Result<(), sqlx::Error> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO address_sync_status (chain_id, address, last_block_synced, last_sync_timestamp, sync_state)
            VALUES (?, ?, ?, ?, 'idle')
            ON CONFLICT(chain_id, address) DO UPDATE SET
                last_block_synced = excluded.last_block_synced,
                last_sync_timestamp = excluded.last_sync_timestamp,
                sync_state = 'idle',
                error_message = NULL
            "#,
        )
        .bind(chain_id)
        .bind(address)
        .bind(last_block)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Sets sync status to syncing state.
    pub async fn set_sync_started(&self, chain_id: &str, address: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO address_sync_status (chain_id, address, sync_state)
            VALUES (?, ?, 'syncing')
            ON CONFLICT(chain_id, address) DO UPDATE SET
                sync_state = 'syncing',
                error_message = NULL
            "#,
        )
        .bind(chain_id)
        .bind(address)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Sets sync status to error state.
    pub async fn set_sync_error(
        &self,
        chain_id: &str,
        address: &str,
        error_message: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE address_sync_status
            SET sync_state = 'error', error_message = ?
            WHERE chain_id = ? AND address = ?
            "#,
        )
        .bind(error_message)
        .bind(chain_id)
        .bind(address)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // =========================================================================
    // WALLET OPERATIONS
    // =========================================================================

    /// Adds a wallet (upsert).
    pub async fn add_wallet(
        &self,
        address: &str,
        chain_id: &str,
        label: Option<&str>,
        wallet_type: WalletType,
        is_watch_only: bool,
        profile_id: Option<&str>,
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            INSERT INTO user_wallets (address, chain_id, label, wallet_type, is_watch_only, profile_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain_id, address) DO UPDATE SET
                label = COALESCE(excluded.label, user_wallets.label),
                wallet_type = excluded.wallet_type,
                is_watch_only = excluded.is_watch_only,
                profile_id = COALESCE(excluded.profile_id, user_wallets.profile_id)
            RETURNING id
            "#,
        )
        .bind(address)
        .bind(chain_id)
        .bind(label)
        .bind(wallet_type.as_str())
        .bind(if is_watch_only { 1 } else { 0 })
        .bind(profile_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(result.get::<i64, _>("id"))
    }

    /// Retrieves all wallets.
    pub async fn get_wallets(&self) -> Result<Vec<Wallet>, sqlx::Error> {
        let rows =
            sqlx::query_as::<_, WalletRow>("SELECT * FROM user_wallets ORDER BY created_at DESC")
                .fetch_all(&self.pool)
                .await?;

        Ok(rows.into_iter().map(Wallet::from).collect())
    }

    /// Retrieves wallets by chain.
    pub async fn get_wallets_by_chain(&self, chain_id: &str) -> Result<Vec<Wallet>, sqlx::Error> {
        let rows = sqlx::query_as::<_, WalletRow>(
            "SELECT * FROM user_wallets WHERE chain_id = ? ORDER BY created_at DESC",
        )
        .bind(chain_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Wallet::from).collect())
    }

    /// Retrieves wallets by profile.
    pub async fn get_wallets_by_profile(
        &self,
        profile_id: &str,
    ) -> Result<Vec<Wallet>, sqlx::Error> {
        let rows = sqlx::query_as::<_, WalletRow>(
            "SELECT * FROM user_wallets WHERE profile_id = ? ORDER BY created_at DESC",
        )
        .bind(profile_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Wallet::from).collect())
    }

    /// Retrieves a wallet by address and chain.
    pub async fn get_wallet(
        &self,
        chain_id: &str,
        address: &str,
    ) -> Result<Option<Wallet>, sqlx::Error> {
        let address_lower = address.to_lowercase();

        let row = sqlx::query_as::<_, WalletRow>(
            "SELECT * FROM user_wallets WHERE chain_id = ? AND LOWER(address) = ?",
        )
        .bind(chain_id)
        .bind(&address_lower)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Wallet::from))
    }

    /// Deletes a wallet by ID.
    pub async fn delete_wallet(&self, id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM user_wallets WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Updates wallet label.
    pub async fn update_wallet_label(
        &self,
        id: i64,
        label: Option<&str>,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("UPDATE user_wallets SET label = ? WHERE id = ?")
            .bind(label)
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tx_type_conversion() {
        assert_eq!(TxType::Transfer.as_str(), "transfer");
        assert_eq!(TxType::from_str("swap"), TxType::Swap);
        assert_eq!(TxType::from_str("invalid"), TxType::Unknown);
    }

    #[test]
    fn test_tx_status_conversion() {
        assert_eq!(TxStatus::Success.as_str(), "success");
        assert_eq!(TxStatus::from_str("failed"), TxStatus::Failed);
        assert_eq!(TxStatus::from_str("invalid"), TxStatus::Pending);
    }

    #[test]
    fn test_wallet_type_conversion() {
        assert_eq!(WalletType::Evm.as_str(), "evm");
        assert_eq!(WalletType::from_str("substrate"), WalletType::Substrate);
    }

    #[test]
    fn test_transaction_id_generation() {
        let tx = Transaction::new(
            "ethereum".to_string(),
            "0x123".to_string(),
            "0xfrom".to_string(),
            Some("0xto".to_string()),
            "1000000000000000000".to_string(),
            None,
            1234567890,
            Some(12345),
            TxType::Transfer,
            TxStatus::Success,
            None,
        );

        assert_eq!(tx.id, "ethereum_0x123");
    }
}
