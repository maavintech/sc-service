const axios = require('axios');

// Centralized token cache (single ULIP account for this whole process).
let tokenCache = {
  token: null,
  expiresAt: 0,
};

// Ensures only one concurrent login is in flight at a time.
let loginPromise = null;

/**
 * Login to ULIP and get an authentication token.
 * @returns {Promise<string>}
 */
async function ulipLogin() {
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };

  console.table({ action: 'ULIP Login', url, username: payload.username });

  const response = await axios.post(url, payload, { headers });

  // ULIP v1 returns the token as a plain string in response.data.response.
  // Some environments wrap it in an object instead — handle both.
  const raw = response.data?.response;
  let token;
  if (typeof raw === 'string' && raw.length > 10) {
    token = raw;
  } else if (raw && typeof raw === 'object') {
    token = raw.id ?? raw.token ?? raw.access_token;
  } else {
    token = response.data?.token ?? response.data?.access_token ?? response.data?.id;
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    console.error('[ulipLogin] FAILED to extract token. Full response.data:', JSON.stringify(response.data));
    throw new Error(`ULIP login returned no usable token. Full body: ${JSON.stringify(response.data)}`);
  }

  // Store with a 20h expiry (ULIP tokens are documented as valid ~24h; refresh
  // early so callers never hit a stale-token 401 mid-request).
  tokenCache = {
    token,
    expiresAt: Date.now() + 20 * 60 * 60 * 1000,
  };

  console.table({
    action: 'Token Cached',
    expiresAt: new Date(tokenCache.expiresAt).toISOString(),
    validFor: '20 hours',
  });

  return token;
}

/**
 * Get a valid ULIP token (from cache or by logging in). Concurrent callers
 * share a single in-flight login so only one login request fires even when
 * many requests arrive at once with no cached token.
 * @returns {Promise<string>}
 */
async function getValidToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  if (loginPromise) return loginPromise;

  loginPromise = ulipLogin().finally(() => { loginPromise = null; });
  return loginPromise;
}

/**
 * Force refresh the token (call after a 401/403 that indicates a rejected token).
 * @returns {Promise<string>}
 */
async function refreshToken() {
  console.table({ action: 'Force Token Refresh', reason: 'Token rejected by server' });
  tokenCache = { token: null, expiresAt: 0 };
  return getValidToken();
}

module.exports = { getValidToken, refreshToken };
