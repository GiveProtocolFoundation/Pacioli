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
 * Stores the given access token, refresh token, and expiration time in localStorage.
 *
 * @param accessToken - The access token to store.
 * @param refreshToken - The refresh token to store.
 * @param expiresAt - The expiration timestamp of the token.
 * @returns void
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
 * Clears authentication tokens (access token, refresh token, and expiration) from localStorage.
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.TOKEN_EXPIRES)
}

/**
 * Retrieves the access token from local storage.
 *
 * @returns {string | null} The access token if present, otherwise null.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
}

/**
 * Retrieves the refresh token from localStorage.
 *
 * @returns The refresh token if present, otherwise null.
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
}

/**
 * Checks if the stored authentication token has expired.
 *
 * Retrieves the token expiration timestamp from localStorage, and determines
 * if the current time is past the expiration time minus a 1-minute buffer.
 *
 * @returns {boolean} True if the token is expired or no expiration is found, false otherwise.
 */
export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.TOKEN_EXPIRES)
  if (!expiresAt) return true
  const expiry = new Date(expiresAt)
  const now = new Date()
  return now.getTime() >= expiry.getTime() - 60000
}

/**
 * Stores the access token in local storage.
 * @param token The access token to store.
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, token)
}

/**
 * Sets the token expiration time in localStorage.
 *
 * @param expiresAt - The expiration time as a string.
 */
export function setTokenExpires(expiresAt: string): void {
  localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, expiresAt)
}
