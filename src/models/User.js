const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user table — only the columns
// the fetch jobs need. Never .update()/.create() this model; DriveInnovate's
// own server owns writes to this table.
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  status: { type: DataTypes.ENUM('active', 'inactive', 'deleted'), defaultValue: 'active' },
  // Per-customer entitlement, set by papa/dealer via DriveInnovate's admin UI
  // (client/src/pages/ClientDetail.jsx) — only accounts with the relevant flag
  // true are picked up by rtoFetchJob/challanFetchJob.
  ulipRtoEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  ulipChallanEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'di_user',
  underscored: true,
  timestamps: true,
});

module.exports = User;
