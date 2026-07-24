/**
 * Token Storage
 * Shared localStorage-based token management used by all auth service implementations
 */

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'pacioli_access_token',
  REFRESH_TOKEN: 'pacioli_refresh_token',
  TOKEN_EXPIRES: 'pacioli_token_expires',
} as const

/**
 * Stores the access token, refresh token, and expiration time in local storage.
 *
 * @param accessToken The access token string to store.
 * @param refreshToken The refresh token string to store.
 * @param expiresAt The expiration timestamp when the access token expires.
 */
export function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken)
  localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken)
  localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, expiresAt)
}

/**
 * Clears stored authentication tokens from the browser's localStorage.
 *
 * @returns {void} No return value.
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.TOKEN_EXPIRES)
}

/**
 * Retrieves the access token from local storage.
 *
 * @returns {string | null} The stored access token, or null if not found.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
}

/**
 * Retrieves the refresh token from local storage.
 *
 * @returns The refresh token string if present, otherwise null.
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
}

/**
 * Checks if the stored token has expired.
 *
 * @returns {boolean} True if the token is expired or missing, otherwise false.
 */
export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.TOKEN_EXPIRES)
  if (!expiresAt) return true
  const expiry = new Date(expiresAt)
  const now = new Date()
  return now.getTime() >= expiry.getTime() - 60000
}

/**
 * Sets the access token in localStorage.
 *
 * @param token - The access token string to store.
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, token)
}
/**
 * Sets the token expiration time in localStorage.
 *
 * @param expiresAt - The expiration time as a string (e.g., ISO format).
 */
export function setTokenExpires(expiresAt: string): void {
  localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, expiresAt)
}
