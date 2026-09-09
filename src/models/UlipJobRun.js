const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A NEW table this service owns outright (not shared with driveinnovate/server).
// Schema mirrors smartchallan/sc-server's di_scheduled_job_records.
const UlipJobRun = sequelize.define('UlipJobRun', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  jobName: { type: DataTypes.STRING(50), allowNull: false },
  status: { type: DataTypes.STRING(255), allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
  totalVehicles: { type: DataTypes.INTEGER, allowNull: true },
  successCount: { type: DataTypes.INTEGER, allowNull: true },
  failedCount: { type: DataTypes.INTEGER, allowNull: true },
  quotaHit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'ulip_job_runs',
  timestamps: false,
});

module.exports = UlipJobRun;
