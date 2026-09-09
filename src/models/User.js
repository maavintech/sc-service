const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user table — only the columns
// the fetch jobs need. Never .update()/.create() this model; DriveInnovate's
// own server owns writes to this table.
//
// Whether an account is fetched is decided by the Permission Catalog (the
// same 'canViewRTO'/'canViewChallans' features that gate the web read API —
// see src/services/permissionResolver.js), not a column on this table.
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'inactive', 'deleted'), defaultValue: 'active' },
}, {
  tableName: 'di_user',
  underscored: true,
  timestamps: true,
});

module.exports = User;
