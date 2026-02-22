/// Authentication module containing functionality and types for user authentication and authorization.
pub mod auth;
/// Provides functionality for creating and restoring
/// backups of application data, including serialization
/// and storage management.
pub mod backup;
/// The `entities` module contains definitions for the core data entities used by the API.
pub mod entities;
/// Module responsible for handling export operations, including data serialization and file output.
pub mod export;
/// Module for handling data persistence, including storing, retrieving, and managing application data.
pub mod persistence;
/// Module for fetching and managing price feeds from various data providers.
pub mod price_feeds;
/// The `prices` module provides functionality for retrieving and managing price data.
pub mod prices;
/// Provides functionality for wallet-based authentication, including
/// signing in users through their wallets and verifying credentials.
pub mod wallet_auth;
