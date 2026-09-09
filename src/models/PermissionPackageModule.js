const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_permission_package_module
// join table — see src/services/permissionResolver.js.
const PermissionPackageModule = sequelize.define('PermissionPackageModule', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  packageId: { type: DataTypes.INTEGER, allowNull: false },
  moduleId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'di_permission_package_module',
  underscored: true,
  timestamps: false,
});

module.exports = PermissionPackageModule;
