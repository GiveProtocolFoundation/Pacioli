/// CoinGecko API client for cryptocurrency price data.
pub mod coingecko;
/// Fixer.io API client for fiat currency exchange rates.
#[allow(dead_code)]
pub mod fixer;

pub use coingecko::CoinGeckoClient;
