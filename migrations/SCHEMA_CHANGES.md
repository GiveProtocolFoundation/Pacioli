# Schema Changes and Improvements

## Summary

This document explains the changes made to the wallet system database schema to fix identified issues and add important improvements.

## Critical Fixes Applied

### 1. ✅ Account Address Uniqueness
**Problem:** Original constraint didn't handle same address on multiple chains or formats.

**Fix:**
```sql
-- OLD: UNIQUE(wallet_id, account_address)
-- NEW:
UNIQUE(wallet_id, account_address, account_format)
```

**Why:** Same EVM address can exist on Moonbeam and Moonriver with different account_format entries.

### 2. ✅ Account-Transaction Junction Table
**Problem:** No direct link between accounts and transactions (only string addresses).

**Fix:** Added `account_transactions` table:
```sql
CREATE TABLE account_transactions (
    account_id INTEGER REFERENCES accounts(id),
    transaction_id INTEGER REFERENCES transactions(id),
    direction TEXT CHECK(direction IN ('from', 'to', 'both', 'internal')),
    UNIQUE(account_id, transaction_id)
);
```

**Why:** Enables fast queries like "show all transactions for this account" without string comparisons.

### 3. ✅ GAAP Transaction Type Integration
**Problem:** Simple transaction types didn't align with comprehensive GAAP/IFRS system.

**Fix:** Added fields to `transactions` table:
```sql
ALTER TABLE transactions ADD COLUMN basic_transaction_type TEXT;
ALTER TABLE transactions ADD COLUMN gaap_category TEXT;
ALTER TABLE transactions ADD COLUMN gaap_subcategory TEXT;
ALTER TABLE transactions ADD COLUMN gaap_type_code TEXT;
```

**Why:** Bridges blockchain-level classification with accounting-level categorization.

### 4. ✅ Removed Public Key Storage
**Problem:** Schema had `public_key TEXT -- Encrypted` which is a security risk.

**Fix:** Removed field entirely.

**Why:**
- Public keys don't need encryption (they're public)
- Private keys should NEVER be stored in application database
- Wallet extensions handle all key management

### 5. ✅ Asset UID Format Validation
**Problem:** No documented format for `asset_uid`.

**Fix:**
```sql
-- Format: {chain_id}:{type}:{identifier}
CHECK(asset_uid GLOB '*:*:*')

-- Examples:
-- polkadot:native:DOT
-- moonbeam:erc20:0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b
```

**Why:** Ensures consistency and enables parsing.

### 6. ✅ Token Transfer Redundancy Fix
**Problem:** `token_transfers` had both `transaction_id` and `event_id`.

**Fix:**
```sql
CHECK((transaction_id IS NOT NULL AND event_id IS NULL) OR
      (transaction_id IS NULL AND event_id IS NOT NULL))
```

**Why:** Ensures exactly one link is set (XOR constraint).

### 7. ✅ Soft Delete Strategy
**Problem:** Aggressive `ON DELETE CASCADE` could lose important data.

**Fix:**
- Added `archived_at` and `archived_reason` to critical tables
- Changed critical FKs to `ON DELETE RESTRICT`
- Keep CASCADE only for truly expendable data (sessions, cache)

**Why:** Prevents accidental data loss while maintaining referential integrity.

### 8. ✅ Balance Calculation View
**Problem:** `total_balance` computed field could get out of sync.

**Fix:** Created view instead of stored field:
```sql
CREATE VIEW v_account_balances_with_total AS
SELECT
    *,
    CAST(free_balance AS REAL) +
    CAST(reserved_balance AS REAL) +
    CAST(misc_frozen_balance AS REAL) AS total_balance_numeric
FROM account_balances;
```

**Why:** Always accurate, no maintenance needed.

## Important Additions

### 1. 🆕 Schema Migration Tracking
```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT
);
```

**Why:** Track which migrations have been applied and when.

### 2. 🆕 Wallet Session Management
```sql
CREATE TABLE wallet_sessions (
    wallet_id INTEGER REFERENCES wallets(id),
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
```

**Why:** Manage active wallet connections with timeout support.

### 3. 🆕 Wallet Events Audit Trail
```sql
CREATE TABLE wallet_events (
    wallet_id INTEGER REFERENCES wallets(id),
    event_type TEXT CHECK(event_type IN (
        'connected', 'disconnected', 'account_added',
        'account_removed', 'chain_changed', 'error'
    )),
    event_data JSON
);
```

**Why:** Track all wallet connection lifecycle events for debugging.

### 4. 🆕 RPC Endpoint Health Tracking
```sql
CREATE TABLE rpc_endpoint_health (
    chain_id INTEGER REFERENCES chains(id),
    endpoint_url TEXT NOT NULL,
    latency_ms INTEGER,
    is_available BOOLEAN DEFAULT TRUE,
    consecutive_failures INTEGER DEFAULT 0,
    last_checked_at TIMESTAMP
);
```

**Why:** Monitor RPC endpoints and automatically failover to healthy ones.

### 5. 🆕 Enhanced Indexes
Added composite indexes for common queries:
```sql
CREATE INDEX idx_transactions_from_to ON transactions(from_address, to_address, timestamp DESC);
CREATE INDEX idx_staking_positions_active ON staking_positions(account_id, is_active, chain_id);
CREATE INDEX idx_defi_positions_active ON defi_positions(account_id, is_active, chain_id);
```

**Why:** Dramatically improve query performance for common operations.

### 6. 🆕 JSON Schema Validation
```sql
CHECK(json_valid(capabilities) AND json_type(capabilities) = 'object')
CHECK(json_valid(rpc_endpoints) AND json_type(rpc_endpoints) = 'array')
```

**Why:** Prevent invalid JSON from being stored.

### 7. 🆕 Comprehensive Views
Added materialized views for common queries:
- `v_account_portfolio` - Portfolio overview with USD values
- `v_transaction_history` - Transactions with categorization
- `v_xcm_transfers` - Cross-chain transfers with timeout detection
- `v_staking_positions` - Active stakes with returns
- `v_defi_positions` - DeFi positions with P&L
- `v_wallet_summary` - Wallet connection status

### 8. 🆕 Automatic Triggers
```sql
-- Auto-update timestamps
CREATE TRIGGER update_wallet_timestamp ...

-- Expire old sessions
CREATE TRIGGER expire_wallet_sessions ...

-- Track RPC failures
CREATE TRIGGER track_rpc_failures ...

-- Validate asset UIDs
CREATE TRIGGER validate_asset_uid_insert ...
```

**Why:** Automate common maintenance tasks.

## Data Seeding

The schema includes initial data for:
- ✅ Common wallet providers (MetaMask, Polkadot.js, Talisman, etc.)
- ✅ Major chains (Polkadot, Kusama, Moonbeam, Moonriver, Astar)
- ✅ Native assets for each chain
- ✅ Common transaction categories for accounting

## Schema Statistics

| Metric | Count |
|--------|-------|
| Tables | 31 |
| Views | 6 |
| Indexes | 65+ |
| Triggers | 7 |
| Constraints | 80+ |
| Foreign Keys | 50+ |

## Migration Path

### From Scratch
```bash
sqlite3 pacioli.db < migrations/001_wallet_system_schema.sql
```

### From Existing Schema
A migration script would need to:
1. Backup existing database
2. Create new tables
3. Migrate data with transformations
4. Drop old tables
5. Verify integrity

## Performance Considerations

### Optimized For:
- ✅ Fast account lookup by address
- ✅ Quick transaction history queries
- ✅ Efficient balance calculations
- ✅ Real-time sync status checks
- ✅ Portfolio aggregation
- ✅ Cross-chain transfer tracking

### Watch Out For:
- ⚠️ JSON field queries (not indexed)
- ⚠️ String number comparisons (use CAST)
- ⚠️ Large transaction history (use pagination)
- ⚠️ Complex view queries (may need materialization)

## Security Improvements

1. **No Private Key Storage** - Keys never leave wallet extension
2. **Session Token Expiry** - Automatic timeout of inactive sessions
3. **Audit Trail** - All changes tracked in `audit_log`
4. **Soft Deletes** - Critical data archived, not deleted
5. **Foreign Key Protection** - RESTRICT prevents accidental cascades
6. **Input Validation** - CHECK constraints on enums and formats

## Next Steps

### Phase 1: Implementation
1. Run migration to create schema
2. Implement Rust structs matching schema
3. Create Tauri commands for wallet operations
4. Build frontend wallet connection UI

### Phase 2: Testing
1. Unit tests for all database operations
2. Integration tests for wallet connections
3. Performance tests with large datasets
4. Backup/restore testing

### Phase 3: Monitoring
1. Set up RPC health checks
2. Monitor sync status
3. Track wallet connection events
4. Generate performance reports

## Questions?

Common questions and answers:

**Q: Why use TEXT for numbers instead of REAL?**
A: SQLite REAL has precision limits. Crypto amounts can be very large (e.g., 18 decimals). TEXT preserves exact values.

**Q: Why so many indexes?**
A: Wallet queries need to be instant. Each index targets a specific query pattern.

**Q: Why separate accounts and account_chains?**
A: One account (address) can exist on multiple chains. This models that relationship.

**Q: What's the difference between wallet_type and account_format?**
A: Wallet type is the extension type. Account format is the address encoding (SS58 vs Ethereum hex).

**Q: How do I query all transactions for an account?**
A: Use the `account_transactions` junction table:
```sql
SELECT t.* FROM transactions t
JOIN account_transactions at ON t.id = at.transaction_id
WHERE at.account_id = ?
```

**Q: How do I get current portfolio value?**
A: Use the `v_account_portfolio` view:
```sql
SELECT * FROM v_account_portfolio WHERE account_id = ?
```
