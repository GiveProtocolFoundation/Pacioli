//! Bitcoin-specific types
//!
//! Types for Bitcoin transaction data from Mempool.space API.

use serde::{Deserialize, Serialize};

/// Bitcoin transaction input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinInput {
    /// Previous transaction ID
    pub txid: String,
    /// Output index in previous transaction
    pub vout: u32,
    /// Previous output details
    #[serde(default)]
    pub prevout: Option<BitcoinPrevout>,
    /// Script signature (hex)
    #[serde(default)]
    pub scriptsig: String,
    /// Script signature ASM
    #[serde(default)]
    pub scriptsig_asm: String,
    /// Witness data
    #[serde(default)]
    pub witness: Vec<String>,
    /// Is this a coinbase input?
    #[serde(default)]
    pub is_coinbase: bool,
    /// Sequence number
    pub sequence: u32,
}

/// Previous output details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinPrevout {
    /// Script public key (hex)
    pub scriptpubkey: String,
    /// Script public key ASM
    pub scriptpubkey_asm: String,
    /// Script type (p2pkh, p2sh, p2wpkh, etc.)
    pub scriptpubkey_type: String,
    /// Output address (if available)
    #[serde(default)]
    pub scriptpubkey_address: Option<String>,
    /// Value in satoshis
    pub value: u64,
}

/// Bitcoin transaction output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinOutput {
    /// Script public key (hex)
    pub scriptpubkey: String,
    /// Script public key ASM
    pub scriptpubkey_asm: String,
    /// Script type (p2pkh, p2sh, p2wpkh, etc.)
    pub scriptpubkey_type: String,
    /// Output address (if available)
    #[serde(default)]
    pub scriptpubkey_address: Option<String>,
    /// Value in satoshis
    pub value: u64,
}

/// Bitcoin transaction status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTxStatus {
    /// Whether transaction is confirmed
    pub confirmed: bool,
    /// Block height (if confirmed)
    #[serde(default)]
    pub block_height: Option<u64>,
    /// Block hash (if confirmed)
    #[serde(default)]
    pub block_hash: Option<String>,
    /// Block time (if confirmed)
    #[serde(default)]
    pub block_time: Option<i64>,
}

/// Bitcoin transaction from Mempool.space API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MempoolTransaction {
    /// Transaction ID (hash)
    pub txid: String,
    /// Transaction version
    pub version: i32,
    /// Lock time
    pub locktime: u32,
    /// Transaction inputs
    pub vin: Vec<BitcoinInput>,
    /// Transaction outputs
    pub vout: Vec<BitcoinOutput>,
    /// Transaction size in bytes
    pub size: u32,
    /// Transaction weight
    pub weight: u32,
    /// Transaction fee in satoshis
    pub fee: u64,
    /// Transaction status
    pub status: BitcoinTxStatus,
}

/// Normalized Bitcoin transaction for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTransaction {
    /// Transaction ID (hash)
    pub txid: String,
    /// Block height (None if unconfirmed)
    pub block_height: Option<u64>,
    /// Block time as Unix timestamp (None if unconfirmed)
    pub timestamp: Option<i64>,
    /// Transaction inputs with addresses and values
    pub inputs: Vec<BitcoinTxInput>,
    /// Transaction outputs with addresses and values
    pub outputs: Vec<BitcoinTxOutput>,
    /// Transaction fee in satoshis
    pub fee: u64,
    /// Number of confirmations
    pub confirmations: u64,
    /// Whether this is a coinbase transaction
    pub is_coinbase: bool,
    /// Total input value in satoshis
    pub total_input: u64,
    /// Total output value in satoshis
    pub total_output: u64,
}

/// Simplified input for normalized transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTxInput {
    /// Address that spent the input
    pub address: Option<String>,
    /// Value in satoshis
    pub value: u64,
    /// Previous transaction ID
    pub prev_txid: String,
    /// Previous output index
    pub prev_vout: u32,
}

/// Simplified output for normalized transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTxOutput {
    /// Recipient address
    pub address: Option<String>,
    /// Value in satoshis
    pub value: u64,
    /// Output index
    pub index: u32,
    /// Script type
    pub script_type: String,
}

/// Unspent Transaction Output (UTXO)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinUtxo {
    /// Transaction ID
    pub txid: String,
    /// Output index
    pub vout: u32,
    /// Value in satoshis
    pub value: u64,
    /// Transaction status
    pub status: BitcoinTxStatus,
}

/// Bitcoin address balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinBalance {
    /// Address
    pub address: String,
    /// Total balance in satoshis (confirmed + unconfirmed)
    pub balance: u64,
    /// Confirmed balance in satoshis
    pub confirmed_balance: u64,
    /// Unconfirmed balance in satoshis
    pub unconfirmed_balance: u64,
    /// Number of UTXOs
    pub utxo_count: usize,
    /// Total received in satoshis
    pub total_received: u64,
    /// Total sent in satoshis
    pub total_sent: u64,
    /// Number of transactions
    pub tx_count: u64,
}

/// Address statistics from Mempool.space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MempoolAddressStats {
    /// Funded transaction count
    pub funded_txo_count: u64,
    /// Funded transaction sum in satoshis
    pub funded_txo_sum: u64,
    /// Spent transaction count
    pub spent_txo_count: u64,
    /// Spent transaction sum in satoshis
    pub spent_txo_sum: u64,
    /// Number of transactions
    pub tx_count: u64,
}

/// Address info from Mempool.space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MempoolAddressInfo {
    /// Address
    pub address: String,
    /// Chain statistics (confirmed)
    pub chain_stats: MempoolAddressStats,
    /// Mempool statistics (unconfirmed)
    pub mempool_stats: MempoolAddressStats,
}

impl MempoolTransaction {
    /// Convert to normalized BitcoinTransaction
    pub fn to_bitcoin_transaction(&self, current_height: Option<u64>) -> BitcoinTransaction {
        let inputs: Vec<BitcoinTxInput> = self
            .vin
            .iter()
            .map(|input| BitcoinTxInput {
                address: input
                    .prevout
                    .as_ref()
                    .and_then(|p| p.scriptpubkey_address.clone()),
                value: input.prevout.as_ref().map(|p| p.value).unwrap_or(0),
                prev_txid: input.txid.clone(),
                prev_vout: input.vout,
            })
            .collect();

        let outputs: Vec<BitcoinTxOutput> = self
            .vout
            .iter()
            .enumerate()
            .map(|(i, output)| BitcoinTxOutput {
                address: output.scriptpubkey_address.clone(),
                value: output.value,
                index: i as u32,
                script_type: output.scriptpubkey_type.clone(),
            })
            .collect();

        let total_input: u64 = inputs.iter().map(|i| i.value).sum();
        let total_output: u64 = outputs.iter().map(|o| o.value).sum();

        let is_coinbase = self.vin.first().map(|i| i.is_coinbase).unwrap_or(false);

        let confirmations = match (self.status.block_height, current_height) {
            (Some(block_height), Some(current)) if current >= block_height => {
                current - block_height + 1
            }
            _ => 0,
        };

        BitcoinTransaction {
            txid: self.txid.clone(),
            block_height: self.status.block_height,
            timestamp: self.status.block_time,
            inputs,
            outputs,
            fee: self.fee,
            confirmations,
            is_coinbase,
            total_input,
            total_output,
        }
    }
}

impl MempoolAddressInfo {
    /// Convert to BitcoinBalance
    pub fn to_bitcoin_balance(&self, utxo_count: usize) -> BitcoinBalance {
        let confirmed_balance = self.chain_stats.funded_txo_sum - self.chain_stats.spent_txo_sum;
        let unconfirmed_balance = self
            .mempool_stats
            .funded_txo_sum
            .saturating_sub(self.mempool_stats.spent_txo_sum);

        BitcoinBalance {
            address: self.address.clone(),
            balance: confirmed_balance + unconfirmed_balance,
            confirmed_balance,
            unconfirmed_balance,
            utxo_count,
            total_received: self.chain_stats.funded_txo_sum + self.mempool_stats.funded_txo_sum,
            total_sent: self.chain_stats.spent_txo_sum + self.mempool_stats.spent_txo_sum,
            tx_count: self.chain_stats.tx_count + self.mempool_stats.tx_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mempool_transaction_deserialization() {
        let json = r#"{
            "txid": "abc123",
            "version": 2,
            "locktime": 0,
            "vin": [],
            "vout": [],
            "size": 200,
            "weight": 800,
            "fee": 1000,
            "status": {
                "confirmed": true,
                "block_height": 800000,
                "block_hash": "000000000000000000xyz",
                "block_time": 1700000000
            }
        }"#;

        let tx: MempoolTransaction = serde_json::from_str(json).unwrap();
        assert_eq!(tx.txid, "abc123");
        assert_eq!(tx.fee, 1000);
        assert!(tx.status.confirmed);
        assert_eq!(tx.status.block_height, Some(800000));
    }

    #[test]
    fn test_address_info_to_balance() {
        let info = MempoolAddressInfo {
            address: "bc1qtest".to_string(),
            chain_stats: MempoolAddressStats {
                funded_txo_count: 10,
                funded_txo_sum: 1_000_000,
                spent_txo_count: 5,
                spent_txo_sum: 500_000,
                tx_count: 15,
            },
            mempool_stats: MempoolAddressStats {
                funded_txo_count: 1,
                funded_txo_sum: 50_000,
                spent_txo_count: 0,
                spent_txo_sum: 0,
                tx_count: 1,
            },
        };

        let balance = info.to_bitcoin_balance(5);
        assert_eq!(balance.confirmed_balance, 500_000);
        assert_eq!(balance.unconfirmed_balance, 50_000);
        assert_eq!(balance.balance, 550_000);
        assert_eq!(balance.utxo_count, 5);
    }
}
