const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Writes into the SAME table driveinnovate/server/src/models/RtoDetail.js
// reads — column set must stay in sync with that file. No `underscored`: this
// table's columns are camelCase, unlike di_user/di_user_vehicle.
const RtoDetail = sequelize.define('RtoDetail', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  vehicleId: { type: DataTypes.INTEGER, allowNull: false },
  vehicleNumber: { type: DataTypes.STRING(100), allowNull: false },
  bodyType: { type: DataTypes.STRING(50), allowNull: true },
  insuranceExpiry: { type: DataTypes.DATE, allowNull: true },
  insuranceCompany: { type: DataTypes.STRING(100), allowNull: true },
  insurancePolicyNumber: { type: DataTypes.STRING(50), allowNull: true },
  roadTaxExpiry: { type: DataTypes.DATE, allowNull: true },
  fitnessExpiry: { type: DataTypes.DATE, allowNull: true },
  pollutionExpiry: { type: DataTypes.DATE, allowNull: true },
  nationalPermitExpiry: { type: DataTypes.DATE, allowNull: true },
  nationalPermitNumber: { type: DataTypes.STRING(50), allowNull: true },
  registrationExpiry: { type: DataTypes.DATE, allowNull: true },
  ownerName: { type: DataTypes.STRING(100), allowNull: true },
  rawData: { type: DataTypes.JSON, allowNull: true },
  lastFetchedAt: { type: DataTypes.DATE, allowNull: true },
  fetchStatus: { type: DataTypes.STRING(20), allowNull: true },
  fetchError: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'rto_details',
  timestamps: true,
});

module.exports = RtoDetail;
