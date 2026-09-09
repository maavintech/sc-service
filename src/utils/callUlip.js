const axios = require('axios');
const { getValidToken, refreshToken } = require('./ulipTokenManager');
const { acquireSlot } = require('./ulipRateLimiter');

// A ULIP 403 can mean either "daily quota exhausted" or "not authorized for
// this endpoint/subscription". Only quota is non-retryable and should stop
// the whole batch — matching on known wordings so a quota 403 is never
// misread as an auth failure (which would trigger a useless re-login on
// every remaining vehicle and hammer the login endpoint).
function isQuotaMessage(msg) {
  const m = (msg || '').toLowerCase();
  return m.includes('daily usage limit') || m.includes('usage limit') ||
         m.includes('quota') || m.includes('limit exceeded') || m.includes('exceeded your');
}

/**
 * POST to a ULIP endpoint under the shared rate limiter, with token
 * refresh-and-retry-once on 401/403, and a non-retryable ULIP_QUOTA_EXCEEDED
 * error when the 403 body indicates the daily quota is exhausted.
 */
async function callUlipWithRetry(url, data) {
  const makeRequest = (token) => axios.post(url, data, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20_000,
  });

  await acquireSlot();

  let token = await getValidToken();
  try {
    return await makeRequest(token);
  } catch (err) {
    const status = err.response?.status;
    const errBody = err.response?.data;
    const errMsg = errBody?.message || '';

    if (status === 401 || status === 403) {
      console.error(`[ULIP ${status}] ${url} body:`, JSON.stringify(errBody));
    }

    if (status === 403 && isQuotaMessage(errMsg)) {
      const quotaErr = new Error(`ULIP daily quota reached for ${url}. ${errMsg}`);
      quotaErr.code = 'ULIP_QUOTA_EXCEEDED';
      throw quotaErr;
    }

    if (status === 401 || status === 403) {
      console.table({ action: `ULIP ${status} — forcing token refresh`, url });
      token = await refreshToken();
      try {
        return await makeRequest(token);
      } catch (retryErr) {
        const rStatus = retryErr.response?.status;
        const rBody = retryErr.response?.data;
        console.error(`[ULIP ${rStatus} on retry] ${url} body:`, JSON.stringify(rBody));
        if (rStatus === 403 && isQuotaMessage(rBody?.message)) {
          const quotaErr = new Error(`ULIP daily quota reached for ${url}. ${rBody?.message || ''}`);
          quotaErr.code = 'ULIP_QUOTA_EXCEEDED';
          throw quotaErr;
        }
        throw retryErr;
      }
    }

    throw err;
  }
}

module.exports = { callUlipWithRetry };
