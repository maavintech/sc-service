const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// READ-ONLY mirror of driveinnovate/server's di_user_vehicle table — only the
// columns the fetch jobs need. Never write to this model.
const Vehicle = sequelize.define('Vehicle', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  vehicleNumber: { type: DataTypes.STRING(100), allowNull: true },
  clientId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'inactive', 'deleted'), defaultValue: 'active' },
}, {
  tableName: 'di_user_vehicle',
  underscored: true,
  timestamps: true,
});

module.exports = Vehicle;
