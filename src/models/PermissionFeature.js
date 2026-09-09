const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_permission_feature table —
// see src/services/permissionResolver.js.
const PermissionFeature = sequelize.define('PermissionFeature', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  moduleId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'di_permission_feature',
  underscored: true,
  timestamps: true,
});

module.exports = PermissionFeature;
