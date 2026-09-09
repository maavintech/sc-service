/**
 * Runs `fn(item)` over `items` with N in flight at once (ULIP_BATCH_CONCURRENCY,
 * default 4) and a pause between waves (ULIP_BATCH_DELAY_MS, default 1000) —
 * on top of, not instead of, the hard per-second rate limiter in
 * ulipRateLimiter.js which every ULIP call still goes through individually.
 *
 * Quota short-circuit: once any call in the run reports ULIP_QUOTA_EXCEEDED,
 * no further ULIP calls are made for the remaining items — they are marked
 * failed with the same code immediately, instead of burning more calls that
 * are guaranteed to fail once the account's daily quota is gone.
 */
async function runBatch(items, fn, {
  batchSize = parseInt(process.env.ULIP_BATCH_CONCURRENCY, 10) || 4,
  delayMs = parseInt(process.env.ULIP_BATCH_DELAY_MS, 10) || 1000,
} = {}) {
  const results = new Array(items.length);
  let quotaExceeded = false;

  let i = 0;
  while (i < items.length) {
    if (quotaExceeded) {
      for (let j = i; j < items.length; j++) {
        results[j] = {
          vehicleNumber: items[j],
          success: false,
          error: 'ULIP daily quota reached — skipped without calling ULIP',
          code: 'ULIP_QUOTA_EXCEEDED',
        };
      }
      break;
    }

    const wave = items.slice(i, i + batchSize).map((item, idx) =>
      fn(item).then(
        (data) => { results[i + idx] = { vehicleNumber: item, success: true, data }; },
        (err) => {
          results[i + idx] = {
            vehicleNumber: item,
            success: false,
            error: err.message,
            ...(err.code ? { code: err.code } : {}),
          };
          if (err.code === 'ULIP_QUOTA_EXCEEDED') quotaExceeded = true;
        }
      )
    );
    await Promise.all(wave);

    i += batchSize;
    if (i < items.length && !quotaExceeded) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

module.exports = { runBatch };
