/**
 * rtoFetchJob.js
 *
 * Runs weekly, Monday 09:00 IST (RTO/insurance/tax data changes slowly — no
 * need for the challan job's 8h cadence). For every ACTIVE account that
 * holds the 'canViewRTO' Permission Catalog feature (the same permission
 * that gates the web read API — see permissionResolver.js), fetches VAHAN
 * data for its active vehicles and upserts rto_details
 * (src/services/rtoMapper.js — never lets a blank/not-found response
 * overwrite a row that already holds real data).
 *
 * Records one ulip_job_runs row per run and syncs ulip_failed_records per
 * client so retryFailedRecordsJob can pick up anything that failed.
 */

'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { User, Vehicle, RtoDetail } = require('../models');
const { getRtoDetails } = require('../services/vahanService');
const { runBatch } = require('../utils/batchRunner');
const { upsertRtoDetail, recordRtoFetchError } = require('../services/rtoMapper');
const { startRun, finishRun } = require('../services/jobRunTracker');
const { REQUEST_NAMES, syncFailedRecords, recordBatchFailure } = require('../services/failedRecordsService');
const { getAccountIdsWithFeature } = require('../services/permissionResolver');

const SCHEDULE = process.env.RTO_JOB_CRON || '0 9 * * 1'; // Monday 09:00
const TIMEZONE = process.env.ULIP_JOB_TZ || 'Asia/Kolkata';

async function runRtoFetchJob() {
  const run = await startRun('rtoFetchJob');
  let totalVehicles = 0, successCount = 0, failedCount = 0, quotaHit = false;

  try {
    const enabledIds = await getAccountIdsWithFeature('canViewRTO');
    const clients = enabledIds.size
      ? await User.findAll({ where: { status: 'active', id: { [Op.in]: [...enabledIds] } }, attributes: ['id'] })
      : [];
    console.log(`[RtoFetchJob] ${clients.length} active account(s) hold canViewRTO`);

    for (const client of clients) {
      if (quotaHit) break;

      // clientId = this exact account's id, NEVER a clientIds network-expansion
      // array (that's the read API's dealer/papa cross-account visibility
      // rule — irrelevant here). A dealer/papa only gets THEIR OWN directly
      // owned vehicles fetched; their downstream clients are fetched only via
      // their own separate row in `clients` above, each scoped to their own id.
      const vehicles = await Vehicle.findAll({ where: { clientId: client.id, status: 'active' }, attributes: ['id', 'vehicleNumber'] });
      const withNumbers = vehicles.filter((v) => v.vehicleNumber);
      if (!withNumbers.length) continue;
      totalVehicles += withNumbers.length;

      const byNumber = new Map(withNumbers.map((v) => [v.vehicleNumber, v]));
      let results;
      try {
        results = await runBatch(withNumbers.map((v) => v.vehicleNumber), getRtoDetails);
      } catch (err) {
        console.error(`[RtoFetchJob] Client ${client.id} batch error:`, err.message);
        await recordBatchFailure({ clientId: client.id, requestName: REQUEST_NAMES.RTO, vehicleNumbers: withNumbers.map((v) => v.vehicleNumber), error: err });
        failedCount += withNumbers.length;
        continue;
      }

      for (const result of results) {
        if (result.code === 'ULIP_QUOTA_EXCEEDED') { quotaHit = true; failedCount++; continue; }
        const vehicle = byNumber.get(result.vehicleNumber);
        if (!vehicle) continue;
        try {
          if (result.success) {
            const ok = await upsertRtoDetail(RtoDetail, vehicle, result.data);
            ok ? successCount++ : failedCount++;
          } else {
            await recordRtoFetchError(RtoDetail, vehicle, result.error);
            failedCount++;
          }
        } catch (err) {
          console.error(`[RtoFetchJob] DB upsert failed for ${result.vehicleNumber}:`, err.message);
          // Flip this result to failed (it started as success — the ULIP
          // fetch worked, only the DB write didn't) so the syncFailedRecords
          // call below persists it to ulip_failed_records instead of
          // silently only logging to console. Without this, a write error
          // (bad data, schema mismatch, etc.) was invisible outside this
          // process's own stdout and any RETRY of a stale record for this
          // vehicle would have been wrongly cleared as "now succeeded".
          result.success = false;
          result.error = `DB upsert failed: ${err.message}`;
          failedCount++;
        }
      }
      await syncFailedRecords({ clientId: client.id, requestName: REQUEST_NAMES.RTO, results });
    }

    console.log(`[RtoFetchJob] Completed. success=${successCount} failed=${failedCount} quotaHit=${quotaHit}`);
    await finishRun(run, { status: 'success', totalVehicles, successCount, failedCount, quotaHit });
  } catch (err) {
    console.error('[RtoFetchJob] Job error:', err);
    await finishRun(run, { status: `failed: ${err.message}`, totalVehicles, successCount, failedCount, quotaHit });
  }
}

function startRtoFetchJob() {
  cron.schedule(SCHEDULE, runRtoFetchJob, { timezone: TIMEZONE });
  console.log(`[RtoFetchJob] scheduled: ${SCHEDULE} (${TIMEZONE})`);
}

module.exports = { startRtoFetchJob, runRtoFetchJob };

if (require.main === module) {
  runRtoFetchJob().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
