/**
 * Tauri Detection Utility
 * Provides helpers for detecting if the app is running in Tauri or browser
 */

/**
 * Check if the app is running inside the Tauri desktop environment
 */
export function isTauriAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window &&
    window.__TAURI_INTERNALS__ !== undefined
  )
}

/**
 * Environment type
 */
export type AppEnvironment = 'tauri' | 'browser'

/**
 * Get the current app environment
 */
export function getAppEnvironment(): AppEnvironment {
  return isTauriAvailable() ? 'tauri' : 'browser'
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV
}

/**
 * Log a warning when Tauri is not available (only in development)
 */
export function warnIfNotTauri(serviceName: string): void {
  if (!isTauriAvailable() && isDevelopment()) {
    console.warn(
      `[${serviceName}] Tauri is not available. Using mock implementation for browser development. ` +
        `Run 'npm run tauri:dev' to use the full application.`
    )
  }
}
