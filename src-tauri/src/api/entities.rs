use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

use super::persistence::DatabaseState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Entity {
    pub id: String,
    pub profile_id: String,
    pub entity_type: String,
    pub name: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub address: Option<String>, // JSON string
    pub country_code: Option<String>,
    pub tax_identifier: Option<String>,
    pub tax_identifier_type: Option<String>,
    pub default_wallet_address: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>, // JSON array string
    pub default_payment_terms: Option<i32>,
    pub default_currency: Option<String>,
    pub reportable_payee: bool,
    pub tax_documentation_status: String,
    pub tax_documentation_date: Option<String>,
    pub tax_compliance: Option<String>, // JSON string
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityInput {
    pub profile_id: String,
    pub entity_type: String,
    pub name: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub address: Option<String>,
    pub country_code: Option<String>,
    pub tax_identifier: Option<String>,
    pub tax_identifier_type: Option<String>,
    pub default_wallet_address: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub default_payment_terms: Option<i32>,
    pub default_currency: Option<String>,
    pub reportable_payee: Option<bool>,
    pub tax_documentation_status: Option<String>,
    pub tax_documentation_date: Option<String>,
    pub tax_compliance: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityUpdate {
    pub entity_type: Option<String>,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub address: Option<String>,
    pub country_code: Option<String>,
    pub tax_identifier: Option<String>,
    pub tax_identifier_type: Option<String>,
    pub default_wallet_address: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub default_payment_terms: Option<i32>,
    pub default_currency: Option<String>,
    pub reportable_payee: Option<bool>,
    pub tax_documentation_status: Option<String>,
    pub tax_documentation_date: Option<String>,
    pub tax_compliance: Option<String>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityAddress {
    pub id: String,
    pub entity_id: String,
    pub address: String,
    pub chain: String,
    pub address_type: Option<String>,
    pub label: Option<String>,
    pub is_verified: bool,
    pub verified_at: Option<String>,
    pub verification_method: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityAddressInput {
    pub entity_id: String,
    pub address: String,
    pub chain: String,
    pub address_type: Option<String>,
    pub label: Option<String>,
    pub is_verified: Option<bool>,
    pub verification_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct KnownAddress {
    pub address: String,
    pub chain: String,
    pub entity_name: String,
    pub entity_type: Option<String>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub country_code: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub confidence: String,
    pub source: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressMatch {
    pub address: String,
    pub chain: String,
    pub match_type: String, // 'entity' or 'known'
    pub entity_id: Option<String>,
    pub entity_name: String,
    pub entity_type: Option<String>,
    pub category: Option<String>,
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

#[tauri::command]
pub async fn update_entity(
    state: State<'_, DatabaseState>,
    id: String,
    update: EntityUpdate,
) -> Result<Entity, String> {
    // Build dynamic update query
    let mut updates = Vec::new();
    let mut bindings: Vec<String> = Vec::new();

    if let Some(ref v) = update.entity_type {
        updates.push("entity_type = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.name {
        updates.push("name = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.display_name {
        updates.push("display_name = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.email {
        updates.push("email = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.phone {
        updates.push("phone = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.website {
        updates.push("website = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.address {
        updates.push("address = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.country_code {
        updates.push("country_code = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tax_identifier {
        updates.push("tax_identifier = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tax_identifier_type {
        updates.push("tax_identifier_type = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.default_wallet_address {
        updates.push("default_wallet_address = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.category {
        updates.push("category = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tags {
        updates.push("tags = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.default_currency {
        updates.push("default_currency = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tax_documentation_status {
        updates.push("tax_documentation_status = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tax_documentation_date {
        updates.push("tax_documentation_date = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.tax_compliance {
        updates.push("tax_compliance = ?");
        bindings.push(v.clone());
    }
    if let Some(ref v) = update.notes {
        updates.push("notes = ?");
        bindings.push(v.clone());
    }

    if updates.is_empty() && update.default_payment_terms.is_none()
        && update.reportable_payee.is_none() && update.is_active.is_none()
    {
        // Nothing to update, just return the entity
        return get_entity_by_id(state, id)
            .await?
            .ok_or_else(|| "Entity not found".to_string());
    }

    let query = format!(
        "UPDATE entities SET {} WHERE id = ?",
        updates.join(", ")
    );

    let mut q = sqlx::query(&query);
    for binding in &bindings {
        q = q.bind(binding);
    }

    // Handle non-string fields separately with individual queries
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

    if !updates.is_empty() {
        q.bind(&id).execute(&state.pool).await.map_err(|e| e.to_string())?;
    }

    get_entity_by_id(state, id)
        .await?
        .ok_or_else(|| "Entity not found".to_string())
}

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

#[tauri::command]
pub async fn batch_lookup_addresses(
    state: State<'_, DatabaseState>,
    profile_id: String,
    addresses: Vec<(String, String)>, // Vec of (address, chain)
) -> Result<Vec<AddressMatch>, String> {
    let mut matches = Vec::new();

    for (address, chain) in addresses {
        if let Some(m) = lookup_address_internal(&state.pool, &profile_id, &address, &chain).await? {
            matches.push(m);
        }
    }

    Ok(matches)
}

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
        notes: Some(format!("Auto-created from known address. Source: {:?}", known.source)),
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
