const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user_package_grant table —
// see src/services/permissionResolver.js.
const UserPackageGrant = sequelize.define('UserPackageGrant', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  packageId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'di_user_package_grant',
  underscored: true,
  timestamps: true,
  updatedAt: false,
});

module.exports = UserPackageGrant;
