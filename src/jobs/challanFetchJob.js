/**
 * challanFetchJob.js
 *
 * Runs every 8h. For every ACTIVE account that holds the 'canViewChallans'
 * Permission Catalog feature (the same permission that gates the web read
 * API — see permissionResolver.js), fetches challan data for its active
 * vehicles and upserts challans (src/services/challanMapper.js — one row per
 * pending/disposed item, keyed on challanNumber, cancellation sweep for
 * challans withdrawn at source). Only ever touches rows this job itself
 * created (source:'ulip').
 */

'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { User, Vehicle, Challan } = require('../models');
const { getChallanDetails } = require('../services/echallanService');
const { runBatch } = require('../utils/batchRunner');
const { syncVehicleChallans } = require('../services/challanMapper');
const { startRun, finishRun } = require('../services/jobRunTracker');
const { REQUEST_NAMES, syncFailedRecords, recordBatchFailure } = require('../services/failedRecordsService');
const { getAccountIdsWithFeature } = require('../services/permissionResolver');

const SCHEDULE = process.env.CHALLAN_JOB_CRON || '0 */8 * * *';
const TIMEZONE = process.env.ULIP_JOB_TZ || 'Asia/Kolkata';

async function runChallanFetchJob() {
  const run = await startRun('challanFetchJob');
  let totalVehicles = 0, successCount = 0, failedCount = 0, quotaHit = false;

  try {
    const enabledIds = await getAccountIdsWithFeature('canViewChallans');
    const clients = enabledIds.size
      ? await User.findAll({ where: { status: 'active', id: { [Op.in]: [...enabledIds] } }, attributes: ['id'] })
      : [];
    console.log(`[ChallanFetchJob] ${clients.length} active account(s) hold canViewChallans`);

    for (const client of clients) {
      if (quotaHit) break;

      const vehicles = await Vehicle.findAll({ where: { clientId: client.id, status: 'active' }, attributes: ['id', 'vehicleNumber'] });
      const withNumbers = vehicles.filter((v) => v.vehicleNumber);
      if (!withNumbers.length) continue;
      totalVehicles += withNumbers.length;

      const byNumber = new Map(withNumbers.map((v) => [v.vehicleNumber, v]));
      let results;
      try {
        results = await runBatch(withNumbers.map((v) => v.vehicleNumber), getChallanDetails);
      } catch (err) {
        console.error(`[ChallanFetchJob] Client ${client.id} batch error:`, err.message);
        await recordBatchFailure({ clientId: client.id, requestName: REQUEST_NAMES.CHALLAN, vehicleNumbers: withNumbers.map((v) => v.vehicleNumber), error: err });
        failedCount += withNumbers.length;
        continue;
      }

      for (const result of results) {
        if (result.code === 'ULIP_QUOTA_EXCEEDED') { quotaHit = true; failedCount++; continue; }
        const vehicle = byNumber.get(result.vehicleNumber);
        if (!vehicle || !result.success) { failedCount++; continue; }
        try {
          await syncVehicleChallans(Challan, vehicle, result.data || {});
          successCount++;
        } catch (err) {
          console.error(`[ChallanFetchJob] DB sync failed for ${result.vehicleNumber}:`, err.message);
          failedCount++;
        }
      }
      await syncFailedRecords({ clientId: client.id, requestName: REQUEST_NAMES.CHALLAN, results });
    }

    console.log(`[ChallanFetchJob] Completed. success=${successCount} failed=${failedCount} quotaHit=${quotaHit}`);
    await finishRun(run, { status: 'success', totalVehicles, successCount, failedCount, quotaHit });
  } catch (err) {
    console.error('[ChallanFetchJob] Job error:', err);
    await finishRun(run, { status: `failed: ${err.message}`, totalVehicles, successCount, failedCount, quotaHit });
  }
}

function startChallanFetchJob() {
  cron.schedule(SCHEDULE, runChallanFetchJob, { timezone: TIMEZONE });
  console.log(`[ChallanFetchJob] scheduled: ${SCHEDULE} (${TIMEZONE})`);
}

module.exports = { startChallanFetchJob, runChallanFetchJob };

if (require.main === module) {
  require('dotenv').config();
  runChallanFetchJob().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
