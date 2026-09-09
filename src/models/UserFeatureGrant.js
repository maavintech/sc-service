const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user_feature_grant table —
// see src/services/permissionResolver.js.
const UserFeatureGrant = sequelize.define('UserFeatureGrant', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  featureId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'di_user_feature_grant',
  underscored: true,
  timestamps: true,
  updatedAt: false,
});

module.exports = UserFeatureGrant;
