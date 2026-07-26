use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

use super::persistence::DatabaseState;

/// A classification rule stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationRule {
    /// Unique identifier.
    pub id: String,
    /// Human-readable rule name.
    pub name: String,
    /// Rule description.
    pub description: String,
    /// Comma-separated transaction types to match.
    pub match_tx_types: String,
    /// Comma-separated chain IDs to match.
    pub match_chains: String,
    /// Self-transfer match mode: "true", "false", or "any".
    pub match_self_transfer: String,
    /// GL account to debit.
    pub debit_account: String,
    /// GL account to credit.
    pub credit_account: String,
    /// Description for the debit line.
    pub debit_line_desc: String,
    /// Description for the credit line.
    pub credit_line_desc: String,
    /// Description for the generated journal entry.
    pub je_description: String,
    /// Whether to use the transaction fee as the entry amount.
    pub use_fee_amount: bool,
    /// Evaluation priority (lower = higher priority).
    pub priority: i64,
    /// Whether this rule is active.
    pub enabled: bool,
    /// Origin: "builtin" or "user".
    pub source: String,
    /// ISO 8601 creation timestamp.
    pub created_at: String,
    /// ISO 8601 last-update timestamp.
    pub updated_at: String,
}

/// Input for creating a new classification rule.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRuleInput {
    /// Human-readable rule name.
    pub name: String,
    /// Optional rule description.
    pub description: Option<String>,
    /// Comma-separated transaction types to match.
    pub match_tx_types: String,
    /// Comma-separated chain IDs to match.
    pub match_chains: Option<String>,
    /// Self-transfer match mode.
    pub match_self_transfer: Option<String>,
    /// GL account to debit.
    pub debit_account: String,
    /// GL account to credit.
    pub credit_account: String,
    /// Description for the debit line.
    pub debit_line_desc: Option<String>,
    /// Description for the credit line.
    pub credit_line_desc: Option<String>,
    /// Description for the generated journal entry.
    pub je_description: Option<String>,
    /// Whether to use the transaction fee as the entry amount.
    pub use_fee_amount: Option<bool>,
    /// Evaluation priority (lower = higher priority).
    pub priority: Option<i64>,
}

/// Input for updating an existing classification rule (all fields optional).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleInput {
    /// Human-readable rule name.
    pub name: Option<String>,
    /// Rule description.
    pub description: Option<String>,
    /// Comma-separated transaction types to match.
    pub match_tx_types: Option<String>,
    /// Comma-separated chain IDs to match.
    pub match_chains: Option<String>,
    /// Self-transfer match mode.
    pub match_self_transfer: Option<String>,
    /// GL account to debit.
    pub debit_account: Option<String>,
    /// GL account to credit.
    pub credit_account: Option<String>,
    /// Description for the debit line.
    pub debit_line_desc: Option<String>,
    /// Description for the credit line.
    pub credit_line_desc: Option<String>,
    /// Description for the generated journal entry.
    pub je_description: Option<String>,
    /// Whether to use the transaction fee as the entry amount.
    pub use_fee_amount: Option<bool>,
    /// Evaluation priority.
    pub priority: Option<i64>,
    /// Whether this rule is active.
    pub enabled: Option<bool>,
}

/// List all classification rules ordered by priority.
#[tauri::command]
pub async fn list_classification_rules(
    state: State<'_, DatabaseState>,
) -> Result<Vec<ClassificationRule>, String> {
    sqlx::query_as::<_, ClassificationRule>(
        "SELECT id, name, description, match_tx_types, match_chains, match_self_transfer, \
         debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
         use_fee_amount, priority, enabled, source, created_at, updated_at \
         FROM classification_rules ORDER BY priority ASC, created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Create a new user classification rule and return the persisted row.
#[tauri::command]
pub async fn create_classification_rule(
    state: State<'_, DatabaseState>,
    input: NewRuleInput,
) -> Result<ClassificationRule, String> {
    let id = Uuid::new_v4().to_string();
    let priority = input.priority.unwrap_or(1000);

    sqlx::query(
        "INSERT INTO classification_rules \
         (id, name, description, match_tx_types, match_chains, match_self_transfer, \
          debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
          use_fee_amount, priority, enabled, source) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'user')",
    )
    .bind(&id)
    .bind(input.name)
    .bind(input.description.as_deref().unwrap_or(""))
    .bind(input.match_tx_types)
    .bind(input.match_chains.as_deref().unwrap_or(""))
    .bind(input.match_self_transfer.as_deref().unwrap_or("any"))
    .bind(input.debit_account)
    .bind(input.credit_account)
    .bind(input.debit_line_desc.as_deref().unwrap_or(""))
    .bind(input.credit_line_desc.as_deref().unwrap_or(""))
    .bind(input.je_description.as_deref().unwrap_or(""))
    .bind(input.use_fee_amount.unwrap_or(false))
    .bind(priority)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ClassificationRule>(
        "SELECT id, name, description, match_tx_types, match_chains, match_self_transfer, \
         debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
         use_fee_amount, priority, enabled, source, created_at, updated_at \
         FROM classification_rules WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Update an existing classification rule by ID.
#[tauri::command]
pub async fn update_classification_rule(
    state: State<'_, DatabaseState>,
    id: String,
    input: UpdateRuleInput,
) -> Result<ClassificationRule, String> {
    let existing = sqlx::query_as::<_, ClassificationRule>(
        "SELECT id, name, description, match_tx_types, match_chains, match_self_transfer, \
         debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
         use_fee_amount, priority, enabled, source, created_at, updated_at \
         FROM classification_rules WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Rule {id} not found"))?;

    sqlx::query(
        "UPDATE classification_rules SET \
         name = ?, description = ?, match_tx_types = ?, match_chains = ?, \
         match_self_transfer = ?, debit_account = ?, credit_account = ?, \
         debit_line_desc = ?, credit_line_desc = ?, je_description = ?, \
         use_fee_amount = ?, priority = ?, enabled = ?, updated_at = datetime('now') \
         WHERE id = ?",
    )
    .bind(input.name.as_deref().unwrap_or(&existing.name))
    .bind(
        input
            .description
            .as_deref()
            .unwrap_or(&existing.description),
    )
    .bind(
        input
            .match_tx_types
            .as_deref()
            .unwrap_or(&existing.match_tx_types),
    )
    .bind(
        input
            .match_chains
            .as_deref()
            .unwrap_or(&existing.match_chains),
    )
    .bind(
        input
            .match_self_transfer
            .as_deref()
            .unwrap_or(&existing.match_self_transfer),
    )
    .bind(
        input
            .debit_account
            .as_deref()
            .unwrap_or(&existing.debit_account),
    )
    .bind(
        input
            .credit_account
            .as_deref()
            .unwrap_or(&existing.credit_account),
    )
    .bind(
        input
            .debit_line_desc
            .as_deref()
            .unwrap_or(&existing.debit_line_desc),
    )
    .bind(
        input
            .credit_line_desc
            .as_deref()
            .unwrap_or(&existing.credit_line_desc),
    )
    .bind(
        input
            .je_description
            .as_deref()
            .unwrap_or(&existing.je_description),
    )
    .bind(input.use_fee_amount.unwrap_or(existing.use_fee_amount))
    .bind(input.priority.unwrap_or(existing.priority))
    .bind(input.enabled.unwrap_or(existing.enabled))
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ClassificationRule>(
        "SELECT id, name, description, match_tx_types, match_chains, match_self_transfer, \
         debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
         use_fee_amount, priority, enabled, source, created_at, updated_at \
         FROM classification_rules WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Enable or disable a classification rule.
#[tauri::command]
pub async fn toggle_classification_rule(
    state: State<'_, DatabaseState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let result = sqlx::query(
        "UPDATE classification_rules SET enabled = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(enabled)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err(format!("Rule {id} not found"));
    }
    Ok(())
}

/// Reorder classification rules by setting priorities from the given ID list.
#[tauri::command]
pub async fn reorder_classification_rules(
    state: State<'_, DatabaseState>,
    rule_ids: Vec<String>,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    for (idx, rule_id) in rule_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE classification_rules SET priority = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(idx as i64 + 1)
        .bind(rule_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a classification rule by ID.
#[tauri::command]
pub async fn delete_classification_rule(
    state: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM classification_rules WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err(format!("Rule {id} not found"));
    }
    Ok(())
}

/// Install the built-in starter rule pack (idempotent — skips if already installed).
#[tauri::command]
pub async fn install_starter_rules(state: State<'_, DatabaseState>) -> Result<i64, String> {
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM classification_rules WHERE source = 'builtin'")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

    if count.0 > 0 {
        return Ok(0);
    }

    let rules = starter_rules();
    let mut installed = 0i64;

    for r in &rules {
        sqlx::query(
            "INSERT INTO classification_rules \
             (id, name, description, match_tx_types, match_chains, match_self_transfer, \
              debit_account, credit_account, debit_line_desc, credit_line_desc, je_description, \
              use_fee_amount, priority, enabled, source) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'builtin')",
        )
        .bind(r.id)
        .bind(r.name)
        .bind(r.description)
        .bind(r.match_tx_types)
        .bind(r.match_chains)
        .bind(r.match_self_transfer)
        .bind(r.debit_account)
        .bind(r.credit_account)
        .bind(r.debit_line_desc)
        .bind(r.credit_line_desc)
        .bind(r.je_description)
        .bind(r.use_fee_amount)
        .bind(r.priority)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        installed += 1;
    }

    Ok(installed)
}

struct StarterRule {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    match_tx_types: &'static str,
    match_chains: &'static str,
    match_self_transfer: &'static str,
    debit_account: &'static str,
    credit_account: &'static str,
    debit_line_desc: &'static str,
    credit_line_desc: &'static str,
    je_description: &'static str,
    use_fee_amount: bool,
    priority: i64,
}

fn starter_rules() -> Vec<StarterRule> {
    vec![
        // --- Self-transfer detection (highest priority — must run before generic transfer) ---
        StarterRule {
            id: "builtin-self-transfer",
            name: "Self-Transfer (Own Wallets)",
            description: "Transfers between your own wallets — asset rebalance, no P&L impact",
            match_tx_types: "transfer",
            match_chains: "",
            match_self_transfer: "true",
            debit_account: "1200",
            credit_account: "1200",
            debit_line_desc: "Transfer received (own wallet)",
            credit_line_desc: "Transfer sent (own wallet)",
            je_description: "Self-transfer on {chain}",
            use_fee_amount: false,
            priority: 10,
        },
        // --- Staking rewards ---
        StarterRule {
            id: "builtin-staking-reward-claim",
            name: "Staking Reward (Claim)",
            description: "Claimed staking rewards — income recognition",
            match_tx_types: "claim",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "4100",
            debit_line_desc: "Staking reward received",
            credit_line_desc: "Staking reward income",
            je_description: "Staking reward on {chain}",
            use_fee_amount: false,
            priority: 20,
        },
        StarterRule {
            id: "builtin-staking-reward-stake",
            name: "Staking Reward (Auto-compound)",
            description: "Auto-compounded staking rewards — income recognition",
            match_tx_types: "stake",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "4100",
            debit_line_desc: "Staking reward received",
            credit_line_desc: "Staking reward income",
            je_description: "Staking reward on {chain}",
            use_fee_amount: false,
            priority: 30,
        },
        // --- Unstaking (return of principal) ---
        StarterRule {
            id: "builtin-unstake",
            name: "Unstake (Principal Return)",
            description: "Unstaking — return of bonded principal, no P&L impact",
            match_tx_types: "unstake",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "1200",
            debit_line_desc: "Unstaked tokens returned",
            credit_line_desc: "Bonded tokens released",
            je_description: "Unstake on {chain}",
            use_fee_amount: false,
            priority: 40,
        },
        // --- External transfer (inbound) ---
        StarterRule {
            id: "builtin-transfer-in",
            name: "Transfer Received (External)",
            description: "Incoming transfer from external address — uncategorized income",
            match_tx_types: "transfer",
            match_chains: "",
            match_self_transfer: "false",
            debit_account: "1200",
            credit_account: "4000",
            debit_line_desc: "Transfer received",
            credit_line_desc: "Uncategorized income — review and reclassify",
            je_description: "Transfer on {chain} ({hash})",
            use_fee_amount: false,
            priority: 50,
        },
        // --- Swap ---
        StarterRule {
            id: "builtin-swap",
            name: "Token Swap",
            description: "DEX or exchange swap — disposition of one token for another",
            match_tx_types: "swap",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "1200",
            debit_line_desc: "Token acquired via swap",
            credit_line_desc: "Token disposed via swap",
            je_description: "Swap on {chain} ({hash})",
            use_fee_amount: false,
            priority: 60,
        },
        // --- Bridge ---
        StarterRule {
            id: "builtin-bridge",
            name: "Bridge Transfer",
            description: "Cross-chain bridge — inter-chain asset rebalance",
            match_tx_types: "bridge",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "1200",
            debit_line_desc: "Bridged tokens received",
            credit_line_desc: "Bridged tokens sent",
            je_description: "Bridge on {chain} ({hash})",
            use_fee_amount: false,
            priority: 70,
        },
        // --- Mint ---
        StarterRule {
            id: "builtin-mint",
            name: "Token Mint",
            description: "Minting tokens — income recognition",
            match_tx_types: "mint",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "1200",
            credit_account: "4000",
            debit_line_desc: "Minted tokens received",
            credit_line_desc: "Minting income",
            je_description: "Mint on {chain} ({hash})",
            use_fee_amount: false,
            priority: 80,
        },
        // --- Burn ---
        StarterRule {
            id: "builtin-burn",
            name: "Token Burn",
            description: "Burning tokens — disposal / expense",
            match_tx_types: "burn",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "5100",
            credit_account: "1200",
            debit_line_desc: "Token burn expense",
            credit_line_desc: "Tokens burned",
            je_description: "Burn on {chain} ({hash})",
            use_fee_amount: false,
            priority: 90,
        },
        // --- Fee-only transactions (approve, contract_call) ---
        StarterRule {
            id: "builtin-fee-approve",
            name: "Contract Approval (Fee Only)",
            description: "Token approval tx — record network fee only",
            match_tx_types: "approve",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "5100",
            credit_account: "1200",
            debit_line_desc: "Network/gas fee",
            credit_line_desc: "Fee paid from crypto assets",
            je_description: "Approval fee on {chain} ({hash})",
            use_fee_amount: true,
            priority: 100,
        },
        StarterRule {
            id: "builtin-fee-contract-call",
            name: "Contract Call (Fee Only)",
            description: "Generic contract interaction — record network fee only",
            match_tx_types: "contract_call",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "5100",
            credit_account: "1200",
            debit_line_desc: "Network/gas fee",
            credit_line_desc: "Fee paid from crypto assets",
            je_description: "Contract call fee on {chain} ({hash})",
            use_fee_amount: true,
            priority: 110,
        },
        // --- Catch-all: unknown tx with fee ---
        StarterRule {
            id: "builtin-unknown-fee",
            name: "Unknown Transaction (Fee Only)",
            description: "Unrecognized tx type — record network fee if present",
            match_tx_types: "unknown",
            match_chains: "",
            match_self_transfer: "any",
            debit_account: "5100",
            credit_account: "1200",
            debit_line_desc: "Network/gas fee",
            credit_line_desc: "Fee paid from crypto assets",
            je_description: "{type} on {chain} ({hash})",
            use_fee_amount: true,
            priority: 900,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starter_rules_have_unique_ids() {
        let rules = starter_rules();
        let mut ids: Vec<&str> = rules.iter().map(|r| r.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), rules.len(), "duplicate starter rule IDs");
    }

    #[test]
    fn starter_rules_priorities_ascending() {
        let rules = starter_rules();
        for w in rules.windows(2) {
            assert!(
                w[0].priority <= w[1].priority,
                "rule '{}' (pri {}) should come before '{}' (pri {})",
                w[0].name,
                w[0].priority,
                w[1].name,
                w[1].priority,
            );
        }
    }

    #[test]
    fn self_transfer_has_highest_priority() {
        let rules = starter_rules();
        let st = rules
            .iter()
            .find(|r| r.id == "builtin-self-transfer")
            .unwrap();
        let external = rules
            .iter()
            .find(|r| r.id == "builtin-transfer-in")
            .unwrap();
        assert!(st.priority < external.priority);
    }
}
