const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user_module_grant table —
// see src/services/permissionResolver.js.
const UserModuleGrant = sequelize.define('UserModuleGrant', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  moduleId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'di_user_module_grant',
  underscored: true,
  timestamps: true,
  updatedAt: false,
});

module.exports = UserModuleGrant;
