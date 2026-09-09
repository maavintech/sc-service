/**
 * ULIP API rate limiter.
 *
 * Enforces a max of ULIP_RATE_LIMIT_PER_SECOND calls per second across ALL
 * ULIP calls in this process (RTO + Challan). ULIP does not publish an
 * official per-second cap, so this is a conservative, configurable ceiling
 * rather than a documented limit.
 *
 * Slot-pool algorithm: N slots, each reusable after 1000ms. Node is
 * single-threaded so the slot read+write below is atomic between awaits.
 */

const MAX_PER_SECOND = parseInt(process.env.ULIP_RATE_LIMIT_PER_SECOND, 10) || 8;

// Each slot holds the earliest timestamp at which it may be reused.
const slots = Array(MAX_PER_SECOND).fill(0);

/**
 * Acquire a rate-limit slot before making a ULIP API call. Waits until a
 * slot is free within the per-second budget, then reserves it.
 */
async function acquireSlot() {
  let minIdx = 0;
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] < slots[minIdx]) minIdx = i;
  }

  const now = Date.now();
  const availableAt = slots[minIdx];
  const waitMs = Math.max(0, availableAt - now);

  slots[minIdx] = Math.max(now, availableAt) + 1000;

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

module.exports = { acquireSlot, MAX_PER_SECOND };
