/**
 * Shared ulip_failed_records helper for rtoFetchJob/challanFetchJob, ported
 * near-verbatim from smartchallan/sc-server/services/failedRecordsService.js.
 *
 * One row per (clientId, requestName, vehicleNumber). No unique constraint on
 * the table, so dedup happens here: syncFailedRecords loads the client's
 * existing 'failed' rows for this request name once, then for each
 * per-vehicle result either creates/updates (still failing) or deletes (now
 * succeeded) the matching row.
 */
const { UlipFailedRecord } = require('../models');

const REQUEST_NAMES = {
  RTO: 'rto_fetch',
  CHALLAN: 'challan_fetch',
};

/**
 * @param {number} clientId
 * @param {string} requestName - one of REQUEST_NAMES
 * @param {Array<{vehicleNumber: string, success: boolean, error?: string}>} results
 */
async function syncFailedRecords({ clientId, requestName, results }) {
  if (!Array.isArray(results) || results.length === 0) return;

  const existingRows = await UlipFailedRecord.findAll({
    where: { clientId, requestName, status: 'failed' },
  });
  const byVehicle = new Map(existingRows.map((row) => [row.vehicleNumber, row]));

  const now = new Date();
  for (const r of results) {
    if (!r || !r.vehicleNumber) continue;
    const existing = byVehicle.get(r.vehicleNumber);
    if (r.success) {
      if (existing) await existing.destroy();
    } else {
      const errorMessage = (r.error || 'Unknown error').toString().slice(0, 2000);
      if (existing) {
        await existing.update({ errorMessage, retryCount: existing.retryCount + 1, lastFailedAt: now });
      } else {
        await UlipFailedRecord.create({
          clientId, requestName, vehicleNumber: r.vehicleNumber,
          errorMessage, status: 'failed', retryCount: 0, lastFailedAt: now,
        });
      }
    }
  }
}

/**
 * Fallback for when the whole batch call threw before producing per-vehicle
 * results (e.g. a network-level failure) — records every vehicle in the
 * attempted batch as failed so nothing silently disappears.
 */
async function recordBatchFailure({ clientId, requestName, vehicleNumbers, error }) {
  await syncFailedRecords({
    clientId, requestName,
    results: (vehicleNumbers || []).map((vn) => ({ vehicleNumber: vn, success: false, error: error?.message || String(error) })),
  });
}

module.exports = { REQUEST_NAMES, syncFailedRecords, recordBatchFailure };
