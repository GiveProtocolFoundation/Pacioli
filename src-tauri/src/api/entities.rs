use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

use super::persistence::DatabaseState;

// ============================================================================
// Types
// ============================================================================

/// Represents an entity stored in the system with its full attributes and metadata.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Entity {
    /// Unique identifier for the entity.
    pub id: String,
    /// Identifier of the profile that owns this entity.
    pub profile_id: String,
    /// Classification or category of the entity.
    pub entity_type: String,
    /// Official name of the entity.
    pub name: String,
    /// Optional human-readable display name for the entity.
    pub display_name: Option<String>,
    /// Optional contact email address for the entity.
    pub email: Option<String>,
    /// Optional contact phone number for the entity.
    pub phone: Option<String>,
    /// Optional website URL for the entity.
    pub website: Option<String>,
    /// Optional JSON string representing the entity's address.
    pub address: Option<String>,
    /// Optional country code in ISO format.
    pub country_code: Option<String>,
    /// Optional tax identification number for the entity.
    pub tax_identifier: Option<String>,
    /// Optional type of the tax identifier.
    pub tax_identifier_type: Option<String>,
    /// Optional default wallet address associated with the entity.
    pub default_wallet_address: Option<String>,
    /// Optional category label for the entity.
    pub category: Option<String>,
    /// Optional JSON array string of tags associated with the entity.
    pub tags: Option<String>,
    /// Optional default payment terms (in days) for the entity.
    pub default_payment_terms: Option<i32>,
    /// Optional default currency code for transactions.
    pub default_currency: Option<String>,
    /// Indicates if the entity is a reportable payee.
    pub reportable_payee: bool,
    /// Current status of the entity's tax documentation.
    pub tax_documentation_status: String,
    /// Optional date when tax documentation was completed.
    pub tax_documentation_date: Option<String>,
    /// Optional JSON string detailing tax compliance information.
    pub tax_compliance: Option<String>,
    /// Optional additional notes about the entity.
    pub notes: Option<String>,
    /// Whether the entity is active in the system.
    pub is_active: bool,
    /// Timestamp when the entity record was created.
    pub created_at: DateTime<Utc>,
    /// Timestamp when the entity record was last updated.
    pub updated_at: DateTime<Utc>,
}

/// Input parameters required to create a new entity in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityInput {
    /// Identifier of the profile that will own the new entity.
    pub profile_id: String,
    /// Classification or category of the new entity.
    pub entity_type: String,
    /// Official name of the new entity.
    pub name: String,
    /// Optional human-readable display name for the new entity.
    pub display_name: Option<String>,
    /// Optional contact email address for the new entity.
    pub email: Option<String>,
    /// Optional contact phone number for the new entity.
    pub phone: Option<String>,
    /// Optional website URL for the new entity.
    pub website: Option<String>,
    /// Optional JSON string representing the entity's address.
    pub address: Option<String>,
    /// Optional country code in ISO format.
    pub country_code: Option<String>,
    /// Optional tax identification number for the new entity.
    pub tax_identifier: Option<String>,
    /// Optional type of the tax identifier.
    pub tax_identifier_type: Option<String>,
    /// Optional default wallet address for the new entity.
    pub default_wallet_address: Option<String>,
    /// Optional category label for the new entity.
    pub category: Option<String>,
    /// Optional JSON array string of tags for the new entity.
    pub tags: Option<String>,
    /// Optional default payment terms (in days) for the new entity.
    pub default_payment_terms: Option<i32>,
    /// Optional default currency code for transactions.
    pub default_currency: Option<String>,
    /// Whether the new entity should be marked as a reportable payee.
    pub reportable_payee: Option<bool>,
    /// Optional initial status of tax documentation.
    pub tax_documentation_status: Option<String>,
    /// Optional date when tax documentation was completed.
    pub tax_documentation_date: Option<String>,
    /// Optional JSON string detailing tax compliance information.
    pub tax_compliance: Option<String>,
    /// Optional additional notes for the new entity.
    pub notes: Option<String>,
}

/// Fields for updating an existing entity's information in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityUpdate {
    /// Updated classification or category of the entity.
    pub entity_type: Option<String>,
    /// Updated official name of the entity.
    pub name: Option<String>,
    /// Updated human-readable display name for the entity.
    pub display_name: Option<String>,
    /// Updated contact email address for the entity.
    pub email: Option<String>,
    /// Updated contact phone number for the entity.
    pub phone: Option<String>,
    /// Updated website URL for the entity.
    pub website: Option<String>,
    /// Updated JSON string representing the entity's address.
    pub address: Option<String>,
    /// Updated country code in ISO format.
    pub country_code: Option<String>,
    /// Updated tax identification number for the entity.
    pub tax_identifier: Option<String>,
    /// Updated type of the tax identifier.
    pub tax_identifier_type: Option<String>,
    /// Updated default wallet address associated with the entity.
    pub default_wallet_address: Option<String>,
    /// Updated category label for the entity.
    pub category: Option<String>,
    /// Updated JSON array string of tags associated with the entity.
    pub tags: Option<String>,
    /// Updated default payment terms (in days) for the entity.
    pub default_payment_terms: Option<i32>,
    /// Updated default currency code for transactions.
    pub default_currency: Option<String>,
    /// Updated flag indicating if the entity is a reportable payee.
    pub reportable_payee: Option<bool>,
    /// Updated status of the entity's tax documentation.
    pub tax_documentation_status: Option<String>,
    /// Updated date when tax documentation was completed.
    pub tax_documentation_date: Option<String>,
    /// Updated JSON string detailing tax compliance information.
    pub tax_compliance: Option<String>,
    /// Updated additional notes for the entity.
    pub notes: Option<String>,
    /// Updated active status of the entity.
    pub is_active: Option<bool>,
}

/// Represents an address record associated with an entity, including verification metadata.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityAddress {
    /// Unique identifier for this address record.
    pub id: String,
    /// Identifier of the entity this address belongs to.
    pub entity_id: String,
    /// The blockchain address string.
    pub address: String,
    /// The blockchain network or chain name.
    pub chain: String,
    /// Optional type label for the address (e.g., "withdrawal").
    pub address_type: Option<String>,
    /// Optional human-readable label for the address.
    pub label: Option<String>,
    /// Whether this address has been verified.
    pub is_verified: bool,
    /// Optional timestamp when the address was verified.
    pub verified_at: Option<String>,
    /// Optional method used for address verification.
    pub verification_method: Option<String>,
    /// Timestamp when the address record was created.
    pub created_at: DateTime<Utc>,
}

/// Input parameters required to create a new entity address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityAddressInput {
    /// Identifier of the entity to associate with this address.
    pub entity_id: String,
    /// The blockchain address string to register.
    pub address: String,
    /// The blockchain network or chain name.
    pub chain: String,
    /// Optional type label for the address.
    pub address_type: Option<String>,
    /// Optional human-readable label for the address.
    pub label: Option<String>,
    /// Optional flag indicating if the address is verified.
    pub is_verified: Option<bool>,
    /// Optional method used for address verification.
    pub verification_method: Option<String>,
}

/// Information about a known address and its associated entity metadata.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct KnownAddress {
    /// The blockchain address string.
    pub address: String,
    /// The blockchain network or chain name.
    pub chain: String,
    /// Name of the entity associated with this address.
    pub entity_name: String,
    /// Optional classification or category of the associated entity.
    pub entity_type: Option<String>,
    /// Optional primary category label for the entity.
    pub category: Option<String>,
    /// Optional secondary category or subcategory label.
    pub subcategory: Option<String>,
    /// Optional country code in ISO format for the entity.
    pub country_code: Option<String>,
    /// Optional website URL for the entity.
    pub website: Option<String>,
    /// Optional URL to the entity's logo image.
    pub logo_url: Option<String>,
    /// Confidence score indicating the reliability of this address mapping.
    pub confidence: String,
    /// Optional source identifier for this known address data.
    pub source: Option<String>,
    /// Whether this known address is currently active.
    pub is_active: bool,
    /// Timestamp when the known address record was created.
    pub created_at: DateTime<Utc>,
    /// Timestamp when the known address record was last updated.
    pub updated_at: DateTime<Utc>,
}

/// Represents a matching result for an address lookup, either an entity or known address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressMatch {
    /// The blockchain address string being matched.
    pub address: String,
    /// The blockchain network or chain name.
    pub chain: String,
    /// Type of match: either 'entity' or 'known'.
    pub match_type: String,
    /// Optional identifier of the matched entity.
    pub entity_id: Option<String>,
    /// Name of the matched entity.
    pub entity_name: String,
    /// Optional classification or type of the matched entity.
    pub entity_type: Option<String>,
    /// Optional category label for the matched result.
    pub category: Option<String>,
    /// Confidence score for the match accuracy.
    pub confidence: String,
}

// ============================================================================
// Entity Commands
// ============================================================================

// Internal helper function for entity creation
async fn create_entity_internal(
    pool: &sqlx::SqlitePool,
    entity: EntityInput,
) -> Result<Entity, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let reportable = entity.reportable_payee.unwrap_or(false);
    let tax_status = entity
        .tax_documentation_status
        .unwrap_or_else(|| "none".to_string());

    sqlx::query(
        r#"
        INSERT INTO entities (
            id, profile_id, entity_type, name, display_name,
            email, phone, website, address, country_code,
            tax_identifier, tax_identifier_type, default_wallet_address,
            category, tags, default_payment_terms, default_currency,
            reportable_payee, tax_documentation_status, tax_documentation_date,
            tax_compliance, notes, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&entity.profile_id)
    .bind(&entity.entity_type)
    .bind(&entity.name)
    .bind(&entity.display_name)
    .bind(&entity.email)
    .bind(&entity.phone)
    .bind(&entity.website)
    .bind(&entity.address)
    .bind(&entity.country_code)
    .bind(&entity.tax_identifier)
    .bind(&entity.tax_identifier_type)
    .bind(&entity.default_wallet_address)
    .bind(&entity.category)
    .bind(&entity.tags)
    .bind(entity.default_payment_terms)
    .bind(&entity.default_currency)
    .bind(reportable)
    .bind(&tax_status)
    .bind(&entity.tax_documentation_date)
    .bind(&entity.tax_compliance)
    .bind(&entity.notes)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let created = sqlx::query_as::<_, Entity>("SELECT * FROM entities WHERE id = ?")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(created)
}

/// Create a new entity in the database
#[tauri::command]
pub async fn create_entity(
    state: State<'_, DatabaseState>,
    entity: EntityInput,
) -> Result<Entity, String> {
    create_entity_internal(&state.pool, entity).await
}

/// Retrieve a list of entities for the specified profile, optionally filtering by entity type and active status.
#[tauri::command]
pub async fn get_entities(
    state: State<'_, DatabaseState>,
    profile_id: String,
    entity_type: Option<String>,
    is_active: Option<bool>,
) -> Result<Vec<Entity>, String> {
    let mut query = String::from("SELECT * FROM entities WHERE profile_id = ?");

    if entity_type.is_some() {
        query.push_str(" AND entity_type = ?");
    }
    if is_active.is_some() {
        query.push_str(" AND is_active = ?");
    }
    query.push_str(" ORDER BY name ASC");

    let mut q = sqlx::query_as::<_, Entity>(&query).bind(&profile_id);

    if let Some(ref et) = entity_type {
        q = q.bind(et);
    }
    if let Some(active) = is_active {
        q = q.bind(active);
    }

    let entities = q.fetch_all(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(entities)
}

/// Fetch an entity by its unique identifier, returning `None` if not found.
#[tauri::command]
pub async fn get_entity_by_id(
    state: State<'_, DatabaseState>,
    id: String,
) -> Result<Option<Entity>, String> {
    let entity = sqlx::query_as::<_, Entity>("SELECT * FROM entities WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(entity)
}

/// Update an existing entity with the provided fields
#[tauri::command]
pub async fn update_entity(
    state: State<'_, DatabaseState>,
    id: String,
    update: EntityUpdate,
) -> Result<Entity, String> {
    // Collect string field updates using a table-driven approach
    let string_fields: &[(&str, &Option<String>)] = &[
        ("entity_type", &update.entity_type),
        ("name", &update.name),
        ("display_name", &update.display_name),
        ("email", &update.email),
        ("phone", &update.phone),
        ("website", &update.website),
        ("address", &update.address),
        ("country_code", &update.country_code),
        ("tax_identifier", &update.tax_identifier),
        ("tax_identifier_type", &update.tax_identifier_type),
        ("default_wallet_address", &update.default_wallet_address),
        ("category", &update.category),
        ("tags", &update.tags),
        ("default_currency", &update.default_currency),
        ("tax_documentation_status", &update.tax_documentation_status),
        ("tax_documentation_date", &update.tax_documentation_date),
        ("tax_compliance", &update.tax_compliance),
        ("notes", &update.notes),
    ];

    let mut updates = Vec::new();
    let mut bindings: Vec<String> = Vec::new();

    for (column, value) in string_fields {
        if let Some(v) = value {
            updates.push(format!("{column} = ?"));
            bindings.push(v.clone());
        }
    }

    let has_non_string_updates = update.default_payment_terms.is_some()
        || update.reportable_payee.is_some()
        || update.is_active.is_some();

    if updates.is_empty() && !has_non_string_updates {
        return get_entity_by_id(state, id)
            .await?
            .ok_or_else(|| "Entity not found".to_string());
    }

    // Apply string field updates in a single query
    if !updates.is_empty() {
        let query = format!("UPDATE entities SET {} WHERE id = ?", updates.join(", "));
        let mut q = sqlx::query(&query);
        for binding in &bindings {
            q = q.bind(binding);
        }
        q.bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Apply non-string fields with individual queries
    if let Some(terms) = update.default_payment_terms {
        sqlx::query("UPDATE entities SET default_payment_terms = ? WHERE id = ?")
            .bind(terms)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(reportable) = update.reportable_payee {
        sqlx::query("UPDATE entities SET reportable_payee = ? WHERE id = ?")
            .bind(reportable)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(active) = update.is_active {
        sqlx::query("UPDATE entities SET is_active = ? WHERE id = ?")
            .bind(active)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    get_entity_by_id(state, id)
        .await?
        .ok_or_else(|| "Entity not found".to_string())
}

/// Deletes the entity with the specified ID from the database.
///
/// # Arguments
///
/// * `state` - The application state containing the database connection pool.
/// * `id` - The unique identifier of the entity to delete.
///
/// # Returns
///
/// * `Ok(())` if the deletion succeeds.
/// * `Err(String)` if an error occurs during deletion.
#[tauri::command]
pub async fn delete_entity(state: State<'_, DatabaseState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM entities WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Entity Address Commands
// ============================================================================

// Internal helper function for adding entity address
async fn add_entity_address_internal(
    pool: &sqlx::SqlitePool,
    address_input: EntityAddressInput,
) -> Result<EntityAddress, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let is_verified = address_input.is_verified.unwrap_or(false);
    let verified_at = if is_verified {
        Some(now.to_rfc3339())
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO entity_addresses (
            id, entity_id, address, chain, address_type, label,
            is_verified, verified_at, verification_method, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_id, address, chain) DO UPDATE SET
            address_type = excluded.address_type,
            label = excluded.label,
            is_verified = excluded.is_verified,
            verified_at = excluded.verified_at,
            verification_method = excluded.verification_method
        "#,
    )
    .bind(&id)
    .bind(&address_input.entity_id)
    .bind(&address_input.address)
    .bind(&address_input.chain)
    .bind(&address_input.address_type)
    .bind(&address_input.label)
    .bind(is_verified)
    .bind(&verified_at)
    .bind(&address_input.verification_method)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let saved = sqlx::query_as::<_, EntityAddress>(
        "SELECT * FROM entity_addresses WHERE entity_id = ? AND address = ? AND chain = ?",
    )
    .bind(&address_input.entity_id)
    .bind(&address_input.address)
    .bind(&address_input.chain)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(saved)
}

/// Add a blockchain address to an entity
#[tauri::command]
pub async fn add_entity_address(
    state: State<'_, DatabaseState>,
    address_input: EntityAddressInput,
) -> Result<EntityAddress, String> {
    add_entity_address_internal(&state.pool, address_input).await
}

/// Retrieve all blockchain addresses associated with the specified entity, ordered by creation time descending
#[tauri::command]
pub async fn get_entity_addresses(
    state: State<'_, DatabaseState>,
    entity_id: String,
) -> Result<Vec<EntityAddress>, String> {
    let addresses = sqlx::query_as::<_, EntityAddress>(
        "SELECT * FROM entity_addresses WHERE entity_id = ? ORDER BY created_at DESC",
    )
    .bind(&entity_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(addresses)
}

/// Delete a blockchain address record by its unique ID
#[tauri::command]
pub async fn delete_entity_address(
    state: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM entity_addresses WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Address Detection & Matching
// ============================================================================

// Internal helper function for address lookup
async fn lookup_address_internal(
    pool: &sqlx::SqlitePool,
    profile_id: &str,
    address: &str,
    chain: &str,
) -> Result<Option<AddressMatch>, String> {
    // First, check entity_addresses (user's own entities)
    let entity_match = sqlx::query_as::<_, (String, String, String, Option<String>)>(
        r#"
        SELECT e.id, e.name, e.entity_type, e.category
        FROM entities e
        INNER JOIN entity_addresses ea ON e.id = ea.entity_id
        WHERE e.profile_id = ? AND ea.address = ? AND ea.chain = ?
        LIMIT 1
        "#,
    )
    .bind(profile_id)
    .bind(address)
    .bind(chain)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((entity_id, name, entity_type, category)) = entity_match {
        return Ok(Some(AddressMatch {
            address: address.to_string(),
            chain: chain.to_string(),
            match_type: "entity".to_string(),
            entity_id: Some(entity_id),
            entity_name: name,
            entity_type: Some(entity_type),
            category,
            confidence: "high".to_string(),
        }));
    }

    // Then, check known_addresses (global reference data)
    let known_match = sqlx::query_as::<_, KnownAddress>(
        "SELECT * FROM known_addresses WHERE address = ? AND chain = ? AND is_active = 1",
    )
    .bind(address)
    .bind(chain)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(known) = known_match {
        return Ok(Some(AddressMatch {
            address: address.to_string(),
            chain: chain.to_string(),
            match_type: "known".to_string(),
            entity_id: None,
            entity_name: known.entity_name,
            entity_type: known.entity_type,
            category: known.category,
            confidence: known.confidence,
        }));
    }

    Ok(None)
}

/// Look up an address to find matching entities or known addresses
#[tauri::command]
pub async fn lookup_address(
    state: State<'_, DatabaseState>,
    profile_id: String,
    address: String,
    chain: String,
) -> Result<Option<AddressMatch>, String> {
    lookup_address_internal(&state.pool, &profile_id, &address, &chain).await
}

/// Look up multiple addresses in batch and return matching entities
#[tauri::command]
pub async fn batch_lookup_addresses(
    state: State<'_, DatabaseState>,
    profile_id: String,
    addresses: Vec<(String, String)>, // Vec of (address, chain)
) -> Result<Vec<AddressMatch>, String> {
    let mut matches = Vec::new();

    for (address, chain) in addresses {
        if let Some(m) = lookup_address_internal(&state.pool, &profile_id, &address, &chain).await?
        {
            matches.push(m);
        }
    }

    Ok(matches)
}

/// Fetch a list of known addresses from the database, optionally filtered by chain and entity type
#[tauri::command]
pub async fn get_known_addresses(
    state: State<'_, DatabaseState>,
    chain: Option<String>,
    entity_type: Option<String>,
) -> Result<Vec<KnownAddress>, String> {
    let mut query = String::from("SELECT * FROM known_addresses WHERE is_active = 1");

    if chain.is_some() {
        query.push_str(" AND chain = ?");
    }
    if entity_type.is_some() {
        query.push_str(" AND entity_type = ?");
    }
    query.push_str(" ORDER BY entity_name ASC");

    let mut q = sqlx::query_as::<_, KnownAddress>(&query);

    if let Some(ref c) = chain {
        q = q.bind(c);
    }
    if let Some(ref et) = entity_type {
        q = q.bind(et);
    }

    let known = q.fetch_all(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(known)
}

/// Create an entity from a known address in the reference database
#[tauri::command]
pub async fn create_entity_from_known(
    state: State<'_, DatabaseState>,
    profile_id: String,
    address: String,
    chain: String,
) -> Result<Entity, String> {
    // Look up the known address
    let known = sqlx::query_as::<_, KnownAddress>(
        "SELECT * FROM known_addresses WHERE address = ? AND chain = ? AND is_active = 1",
    )
    .bind(&address)
    .bind(&chain)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Known address not found".to_string())?;

    // Create entity from known address data
    let entity_input = EntityInput {
        profile_id: profile_id.clone(),
        entity_type: known.entity_type.unwrap_or_else(|| "other".to_string()),
        name: known.entity_name.clone(),
        display_name: None,
        email: None,
        phone: None,
        website: known.website.clone(),
        address: None,
        country_code: known.country_code.clone(),
        tax_identifier: None,
        tax_identifier_type: None,
        default_wallet_address: Some(address.clone()),
        category: known.category.clone(),
        tags: None,
        default_payment_terms: None,
        default_currency: None,
        reportable_payee: None,
        tax_documentation_status: None,
        tax_documentation_date: None,
        tax_compliance: None,
        notes: Some(format!(
            "Auto-created from known address. Source: {:?}",
            known.source
        )),
    };

    let entity = create_entity_internal(&state.pool, entity_input).await?;

    // Add the address to entity_addresses
    let address_input = EntityAddressInput {
        entity_id: entity.id.clone(),
        address: address.clone(),
        chain: chain.clone(),
        address_type: Some("primary".to_string()),
        label: Some("Main".to_string()),
        is_verified: Some(true),
        verification_method: Some("known_address_database".to_string()),
    };

    add_entity_address_internal(&state.pool, address_input).await?;

    Ok(entity)
}

// ============================================================================
// Search & Filter
// ============================================================================

/// Searches for entities matching the provided query and profile ID.
///
/// # Arguments
///
/// * `state` - Application state containing the database connection pool.
/// * `profile_id` - The profile identifier to scope the search.
/// * `query` - The search term to filter entity fields.
/// * `limit` - Optional maximum number of results; defaults to 20.
///
/// # Returns
///
/// A `Result` containing a vector of matching `Entity` objects on success, or an error message string on failure.
#[tauri::command]
pub async fn search_entities(
    state: State<'_, DatabaseState>,
    profile_id: String,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<Entity>, String> {
    let limit = limit.unwrap_or(20);
    let search_term = format!("%{}%", query);

    let entities = sqlx::query_as::<_, Entity>(
        r#"
        SELECT * FROM entities
        WHERE profile_id = ? AND is_active = 1
        AND (
            name LIKE ? OR
            display_name LIKE ? OR
            email LIKE ? OR
            category LIKE ? OR
            tax_identifier LIKE ?
        )
        ORDER BY name ASC
        LIMIT ?
        "#,
    )
    .bind(&profile_id)
    .bind(&search_term)
    .bind(&search_term)
    .bind(&search_term)
    .bind(&search_term)
    .bind(&search_term)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(entities)
}

/// Finds an entity associated with the given address and profile ID, optionally scoped to a specific blockchain chain.
///
/// # Arguments
///
/// * `state` - Application state containing the database connection pool.
/// * `profile_id` - The profile identifier to scope the search.
/// * `address` - The address to look up.
/// * `chain` - Optional blockchain chain identifier.
///
/// # Returns
///
/// A `Result` containing an `Option<Entity>` if found on success, or an error message string on failure.
#[tauri::command]
pub async fn find_entity_by_address(
    state: State<'_, DatabaseState>,
    profile_id: String,
    address: String,
    chain: Option<String>,
) -> Result<Option<Entity>, String> {
    let entity = if let Some(ref c) = chain {
        sqlx::query_as::<_, Entity>(
            r#"
            SELECT e.* FROM entities e
            INNER JOIN entity_addresses ea ON e.id = ea.entity_id
            WHERE e.profile_id = ? AND ea.address = ? AND ea.chain = ?
            LIMIT 1
            "#,
        )
        .bind(&profile_id)
        .bind(&address)
        .bind(c)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Entity>(
            r#"
            SELECT e.* FROM entities e
            INNER JOIN entity_addresses ea ON e.id = ea.entity_id
            WHERE e.profile_id = ? AND ea.address = ?
            LIMIT 1
            "#,
        )
        .bind(&profile_id)
        .bind(&address)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(entity)
}
