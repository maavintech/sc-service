const sequelize = require('../config/database');
const User = require('./User');
const Vehicle = require('./Vehicle');
const RtoDetail = require('./RtoDetail');
const Challan = require('./Challan');
const UlipJobRun = require('./UlipJobRun');
const UlipFailedRecord = require('./UlipFailedRecord');
const PermissionFeature = require('./PermissionFeature');
const PermissionPackageModule = require('./PermissionPackageModule');
const UserFeatureGrant = require('./UserFeatureGrant');
const UserModuleGrant = require('./UserModuleGrant');
const UserPackageGrant = require('./UserPackageGrant');

/**
 * Creates ulip_job_runs/ulip_failed_records if they don't exist yet (safe —
 * these are new tables this service owns outright, nothing else writes to
 * them). Deliberately does NOT sync any other model: every other table here
 * is owned by driveinnovate/server (read-only, or altered only via that
 * server's own migrate.js) — syncing them here could race a schema change
 * made from the other service.
 */
async function ensureOwnTables() {
  await UlipJobRun.sync();
  await UlipFailedRecord.sync();
}

module.exports = {
  sequelize, User, Vehicle, RtoDetail, Challan, UlipJobRun, UlipFailedRecord,
  PermissionFeature, PermissionPackageModule, UserFeatureGrant, UserModuleGrant, UserPackageGrant,
  ensureOwnTables,
};
