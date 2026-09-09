const sequelize = require('../config/database');
const User = require('./User');
const Vehicle = require('./Vehicle');
const RtoDetail = require('./RtoDetail');
const Challan = require('./Challan');
const UlipJobRun = require('./UlipJobRun');
const UlipFailedRecord = require('./UlipFailedRecord');

/**
 * Creates ulip_job_runs/ulip_failed_records if they don't exist yet (safe —
 * these are new tables this service owns outright, nothing else writes to
 * them). Deliberately does NOT sync User/Vehicle/RtoDetail/Challan: those
 * tables are owned by driveinnovate/server (User/Vehicle read-only here;
 * RtoDetail/Challan altered only via driveinnovate's migrate.js) — syncing
 * them here could race a schema change made from the other service.
 */
async function ensureOwnTables() {
  await UlipJobRun.sync();
  await UlipFailedRecord.sync();
}

module.exports = { sequelize, User, Vehicle, RtoDetail, Challan, UlipJobRun, UlipFailedRecord, ensureOwnTables };
