const { Sequelize } = require('sequelize');

// This service connects to DriveInnovate's OWN MySQL database — not a
// database of its own. It reads di_user/di_user_vehicle (read-only, to decide
// which accounts/vehicles to fetch for) and writes rto_details/challans (the
// same tables DriveInnovate's read API serves) plus two tables it owns
// outright: ulip_job_runs and ulip_failed_records. Point DB_HOST/DB_NAME/etc
// at the SAME database driveinnovate/server/.env uses.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    timezone: '+00:00',
    dialectOptions: { timezone: '+00:00' },
    logging: false,
    pool: { max: 5, min: 0, acquire: 15000, idle: 30000 },
  }
);

module.exports = sequelize;
