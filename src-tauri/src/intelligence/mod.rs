//! Provider-agnostic model-intelligence layer (Stage 2 foundation — skeleton only).
//!
//! This module defines the abstraction through which Pacioli will eventually draft
//! journal entries and classifications via a user-configured LLM provider
//! (Anthropic, OpenAI, or a local OpenAI-compatible server). No concrete provider
//! client is implemented yet; only the trait, types, and a stub exist so the shape
//! is compile-checked and later backends are purely additive.
//!
//! # Hard architectural boundaries (non-negotiable)
//!
//! 1. **This layer may never post to the ledger directly.** Model output is a
//!    *proposal* surfaced to the approval queue; only a human-approved action,
//!    executed by the deterministic accounting engine, may touch journal entries
//!    or the general ledger. "AI proposes; the ledger disposes."
//! 2. **No user financial data is ever sent anywhere except to the user's own
//!    configured provider.** There is no Pacioli-operated inference, telemetry,
//!    or proxy. If no provider is configured, this layer does nothing.
//!
//! # Configuration and API keys
//!
//! Provider selection and credentials follow the existing price-feed pattern
//! (see `api/prices.rs` and the frontend's persisted settings such as
//! `price_feed_api_key` / `price_feed_base_url` saved via the persistence
//! service): the frontend reads persisted settings and passes them into Tauri
//! commands as optional parameters, and the Rust side may fall back to an
//! environment variable. Keys are never hardcoded and never stored in this module.

// Skeleton is intentionally unwired (see module docs); nothing references it yet.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Which backend the user has configured. Adding a provider is additive: extend
/// this enum, implement [`ChatCompletionProvider`] for the new client, and add a
/// match arm in [`select_provider`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    /// Anthropic Messages API (not implemented yet).
    Anthropic,
    /// OpenAI Chat Completions API (not implemented yet).
    OpenAi,
    /// Any local or self-hosted OpenAI-compatible server, e.g. Ollama/vLLM
    /// (not implemented yet).
    LocalOpenAiCompatible,
    /// Deterministic stub for tests and unwired skeleton state.
    Stub,
}

/// Runtime configuration for a provider, resolved by the caller from persisted
/// settings (frontend) with optional environment-variable fallback (backend),
/// mirroring the price-feed key-sourcing pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// The provider kind (backend) to use.
    pub provider: ProviderKind,
    /// Model identifier as understood by the provider (e.g. "claude-opus-4-6").
    pub model: String,
    /// API key from persisted settings; `None` is valid for local servers.
    pub api_key: Option<String>,
    /// Override base URL (required for `LocalOpenAiCompatible`).
    pub base_url: Option<String>,
}

/// Chat message role, following the standard system/user/assistant convention
/// used by all major LLM providers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Instructions that frame the model's behaviour for the conversation.
    System,
    /// A message from the human operator or upstream caller.
    User,
    /// A message produced by the model.
    Assistant,
}

/// A single message in a chat conversation, pairing a [`Role`] with its text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Who produced this message.
    pub role: Role,
    /// The textual content of the message.
    pub content: String,
}

/// Parameters for a chat-completion call sent to a [`ChatCompletionProvider`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Ordered conversation history to send to the model.
    pub messages: Vec<ChatMessage>,
    /// Optional cap on the number of tokens the model may generate.
    pub max_tokens: Option<u32>,
    /// Sampling temperature; lower values are more deterministic.
    pub temperature: Option<f32>,
}

/// The result of a non-streaming chat-completion call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// The model's generated text.
    pub content: String,
    /// Provider-reported input token usage, when available.
    pub input_tokens: Option<u64>,
    /// Provider-reported output token usage, when available.
    pub output_tokens: Option<u64>,
}

/// One incremental chunk of a streamed completion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChunk {
    /// The incremental text fragment produced by the model in this chunk.
    pub delta: String,
    /// `true` when the model has finished generating and this is the final chunk.
    pub done: bool,
}

/// Errors that can occur during provider resolution or chat completion.
#[derive(Debug, thiserror::Error)]
pub enum IntelligenceError {
    /// The requested [`ProviderKind`] has no concrete implementation yet.
    #[error("provider not implemented yet: {0:?}")]
    NotImplemented(ProviderKind),
    /// The supplied [`ProviderConfig`] is invalid (e.g. missing required fields).
    #[error("provider configuration invalid: {0}")]
    InvalidConfig(String),
    /// The provider does not support the streaming completion path.
    #[error("streaming is not supported by this provider")]
    StreamingUnsupported,
    /// A network or provider-side error during the completion request.
    #[error("provider request failed: {0}")]
    Request(String),
}

/// Provider-agnostic chat-completion interface.
///
/// Streaming is optional: providers that do not support it keep the default
/// [`ChatCompletionProvider::complete_streaming`], which returns
/// [`IntelligenceError::StreamingUnsupported`].
///
/// Note: this trait is deliberately crate-private and dyn-free for now; provider
/// selection happens through the [`Provider`] enum so async methods stay simple.
/// Revisit explicit `Send` bounds when a real provider is spawned onto tasks.
#[allow(async_fn_in_trait)]
pub trait ChatCompletionProvider {
    async fn complete(&self, request: &ChatRequest) -> Result<ChatResponse, IntelligenceError>;

    /// Streamed variant; `on_chunk` receives incremental deltas. Optional.
    async fn complete_streaming(
        &self,
        _request: &ChatRequest,
        _on_chunk: &mut dyn FnMut(ChatChunk),
    ) -> Result<(), IntelligenceError> {
        Err(IntelligenceError::StreamingUnsupported)
    }
}

/// Deterministic stub. Exists so the skeleton compiles and so future unit tests
/// of approval-queue plumbing never need a network.
#[derive(Debug)]
pub struct StubProvider;

impl ChatCompletionProvider for StubProvider {
    async fn complete(&self, _request: &ChatRequest) -> Result<ChatResponse, IntelligenceError> {
        Ok(ChatResponse {
            content: "stub-response".to_string(),
            input_tokens: None,
            output_tokens: None,
        })
    }
}

/// Enum dispatch over configured providers. Adding a real backend later means
/// adding a variant here plus its match arms — nothing existing changes.
#[derive(Debug)]
pub enum Provider {
    Stub(StubProvider),
}

impl Provider {
    /// Dispatch a chat-completion request to whichever backend this provider wraps.
    pub async fn complete(&self, request: &ChatRequest) -> Result<ChatResponse, IntelligenceError> {
        match self {
            Provider::Stub(p) => p.complete(request).await,
        }
    }
}

/// Resolve a [`Provider`] from configuration. Real backends return
/// [`IntelligenceError::NotImplemented`] until Stage 2 implements them.
pub fn select_provider(config: &ProviderConfig) -> Result<Provider, IntelligenceError> {
    match config.provider {
        ProviderKind::Stub => Ok(Provider::Stub(StubProvider)),
        other => Err(IntelligenceError::NotImplemented(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stub_provider_completes() {
        let provider = select_provider(&ProviderConfig {
            provider: ProviderKind::Stub,
            model: "stub".into(),
            api_key: None,
            base_url: None,
        })
        .expect("stub provider must resolve");
        let response = provider
            .complete(&ChatRequest {
                messages: vec![ChatMessage {
                    role: Role::User,
                    content: "hello".into(),
                }],
                max_tokens: None,
                temperature: None,
            })
            .await
            .expect("stub completion must succeed");
        assert_eq!(response.content, "stub-response");
    }

    #[test]
    fn real_providers_not_implemented_yet() {
        let err = select_provider(&ProviderConfig {
            provider: ProviderKind::Anthropic,
            model: "claude-opus-4-6".into(),
            api_key: Some("key-from-persisted-settings".into()),
            base_url: None,
        })
        .unwrap_err();
        assert!(matches!(err, IntelligenceError::NotImplemented(_)));
    }
}
