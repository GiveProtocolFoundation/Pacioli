use crate::db::Database;
use std::path::PathBuf;
use anyhow::Result;
use csv::Writer;
use serde_json;

#[tauri::command]
pub async fn export_transactions_csv(
    db: tauri::State<'_, Database>,
    path: String,
    profile_id: String,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<(), String> {
    let transactions = db.get_transactions(&profile_id, start_date, end_date)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut writer = Writer::from_path(path)
        .map_err(|e| e.to_string())?;
    
    // Write headers
    writer.write_record(&[
        "Date", "Chain", "Hash", "From", "To", "Value", 
        "Token", "Type", "Fee", "Status"
    ]).map_err(|e| e.to_string())?;
    
    // Write transactions
    for tx in transactions {
        writer.write_record(&[
            tx.timestamp.to_string(),
            tx.chain,
            tx.hash,
            tx.from_address,
            tx.to_address.unwrap_or_default(),
            tx.value.to_string(),
            tx.token_symbol,
            tx.transaction_type,
            tx.fee.map(|f| f.to_string()).unwrap_or_default(),
            tx.status,
        ]).map_err(|e| e.to_string())?;
    }
    
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_tax_report(
    db: tauri::State<'_, Database>,
    profile_id: String,
    year: i32,
) -> Result<serde_json::Value, String> {
    // Generate tax report data
    let report = generate_tax_report(&db, &profile_id, year)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(report)
}

async fn generate_tax_report(
    db: &Database,
    profile_id: &str,
    year: i32,
) -> Result<serde_json::Value> {
    // Implementation for tax report generation
    // This would calculate capital gains/losses, income, etc.
    Ok(serde_json::json!({
        "year": year,
        "capital_gains": {},
        "income": {},
        "fees": {}
    }))
}