const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A NEW table this service owns outright (not shared with driveinnovate/server).
// Schema mirrors smartchallan/sc-server's di_failed_records. One row per
// (clientId, requestName, vehicleNumber) — dedup is done in application code
// (services/failedRecordsService.js), same as sc-server's approach, since
// there's no unique constraint to lean on.
const UlipFailedRecord = sequelize.define('UlipFailedRecord', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  clientId: { type: DataTypes.INTEGER, allowNull: false },
  requestName: { type: DataTypes.STRING(20), allowNull: false }, // 'rto_fetch' | 'challan_fetch'
  vehicleNumber: { type: DataTypes.STRING(32), allowNull: false },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'failed' },
  retryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastFailedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'ulip_failed_records',
  timestamps: true,
});

module.exports = UlipFailedRecord;
