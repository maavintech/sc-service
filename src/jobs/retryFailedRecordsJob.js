/**
 * retryFailedRecordsJob.js
 *
 * Retries rows left behind by rtoFetchJob/challanFetchJob, ported from
 * smartchallan/sc-server/jobs/retryFailedRecordsJob.js.
 *
 *   - Picks up every ulip_failed_records row with status='failed'.
 *   - Re-runs the same fetch + upsert (rtoMapper/challanMapper — the same
 *     helpers the main jobs use) so a success here writes to
 *     rto_details/challans exactly like a normal fetch would.
 *   - On success: delete the row (no history kept for recovered records).
 *   - On repeat failure: bump retryCount and lastFailedAt, keep the row.
 *
 * Runs sequentially (not batched) since retry volume should be small
 * relative to a full run, and ULIP calls are already globally rate-limited
 * regardless (utils/ulipRateLimiter.js).
 */

'use strict';

const cron = require('node-cron');
const { UlipFailedRecord, Vehicle, RtoDetail, Challan } = require('../models');
const { getRtoDetails } = require('../services/vahanService');
const { getChallanDetails } = require('../services/echallanService');
const { upsertRtoDetail } = require('../services/rtoMapper');
const { syncVehicleChallans } = require('../services/challanMapper');
const { REQUEST_NAMES } = require('../services/failedRecordsService');
const { startRun, finishRun } = require('../services/jobRunTracker');

const SCHEDULE = process.env.RETRY_JOB_CRON || '30 */3 * * *'; // every 3h by default
const TIMEZONE = process.env.ULIP_JOB_TZ || 'Asia/Kolkata';

const HANDLERS = {
  [REQUEST_NAMES.RTO]: async (vehicle) => upsertRtoDetail(RtoDetail, vehicle, await getRtoDetails(vehicle.vehicleNumber)),
  [REQUEST_NAMES.CHALLAN]: async (vehicle) => syncVehicleChallans(Challan, vehicle, await getChallanDetails(vehicle.vehicleNumber)),
};

async function runRetryFailedRecordsJob() {
  const run = await startRun('retryFailedRecordsJob');
  let recovered = 0, stillFailing = 0, skipped = 0;

  try {
    const pending = await UlipFailedRecord.findAll({ where: { status: 'failed' } });
    console.log(`[RetryFailedRecords] Picked up ${pending.length} failed record(s).`);

    for (const row of pending) {
      const handler = HANDLERS[row.requestName];
      if (!handler) { skipped++; continue; }
      const vehicle = await Vehicle.findOne({ where: { vehicleNumber: row.vehicleNumber, clientId: row.clientId } });
      if (!vehicle) { skipped++; continue; }
      try {
        await handler(vehicle);
        await row.destroy();
        recovered++;
      } catch (err) {
        stillFailing++;
        await row.update({ errorMessage: (err.message || String(err)).slice(0, 2000), retryCount: row.retryCount + 1, lastFailedAt: new Date() });
      }
    }

    console.log(`[RetryFailedRecords] Completed. recovered=${recovered} stillFailing=${stillFailing} skipped=${skipped}`);
    await finishRun(run, { status: 'success', totalVehicles: pending.length, successCount: recovered, failedCount: stillFailing, quotaHit: false });
  } catch (err) {
    console.error('[RetryFailedRecords] Job error:', err);
    await finishRun(run, { status: `failed: ${err.message}`, totalVehicles: 0, successCount: recovered, failedCount: stillFailing, quotaHit: false });
  }
}

function startRetryFailedRecordsJob() {
  cron.schedule(SCHEDULE, runRetryFailedRecordsJob, { timezone: TIMEZONE });
  console.log(`[RetryFailedRecords] scheduled: ${SCHEDULE} (${TIMEZONE})`);
}

module.exports = { startRetryFailedRecordsJob, runRetryFailedRecordsJob };

if (require.main === module) {
  runRetryFailedRecordsJob().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
