/// Accounting module for chart of accounts, journal entries, ledger queries, and transaction classification.
pub mod accounting;
/// Authentication module containing functionality and types for user authentication and authorization.
pub mod auth;
/// Bank & card account/transaction capture (GIV-825, Phase 1 file-import).
pub mod bank;
/// Provides functionality for creating and restoring
/// backups of application data, including serialization
/// and storage management.
pub mod backup;
/// Cost basis engine: FIFO lot tracking, realized gain/loss, and
/// non-realizing own-wallet transfers (GIV-689, Phase 7).
pub mod cost_basis;
/// The `entities` module contains definitions for the core data entities used by the API.
pub mod entities;
/// Module responsible for handling export operations, including data serialization and file output.
pub mod export;
/// Fair-value measurement engine: ASU 2023-08 remeasurement, PriceSource
/// trait, and draft adjusting entries (GIV-690, Phase 8).
pub mod fair_value;
/// Module for handling data persistence, including storing, retrieving, and managing application data.
pub mod persistence;
/// Module for fetching and managing price feeds from various data providers.
pub mod price_feeds;
/// The `prices` module provides functionality for retrieving and managing price data.
pub mod prices;
/// Classification rules engine: CRUD, starter pack, and rule-based auto-classify
/// (GIV-726, Phase 1.5).
pub mod rules;
/// Financial statement generation: balance sheet, income statement, trial balance,
/// tie verification, and CSV export (GIV-688, Phase 6).
pub mod statements;
/// Provides functionality for wallet-based authentication, including
/// signing in users through their wallets and verifying credentials.
pub mod wallet_auth;

/// Property-based invariant tests (proptest) pinning SCOPE.md invariants
/// against real engine paths. Phase 9, GIV-691.
#[cfg(test)]
mod proptest_invariants;
