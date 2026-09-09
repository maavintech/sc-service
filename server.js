require('dotenv').config();
require('console.table');

const express = require('express');
const helmet = require('helmet');

const apiKeyAuth = require('./src/middleware/apiKeyAuth');
const rtoRoutes = require('./src/routes/rto.routes');
const challanRoutes = require('./src/routes/challan.routes');
const { sequelize, ensureOwnTables } = require('./src/models');
const { startRtoFetchJob } = require('./src/jobs/rtoFetchJob');
const { startChallanFetchJob } = require('./src/jobs/challanFetchJob');
const { startRetryFailedRecordsJob } = require('./src/jobs/retryFailedRecordsJob');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// No auth — uptime checks.
app.get('/health', (req, res) => res.json({ success: true, service: 'ulip-service', time: new Date().toISOString() }));

// Stateless on-demand endpoints (kept from before the cron jobs existed) —
// still useful for a manual/ad-hoc fetch outside the scheduled runs.
app.use('/api/rto', apiKeyAuth, rtoRoutes);
app.use('/api/challan', apiKeyAuth, challanRoutes);

const PORT = process.env.PORT || 4501;

async function start() {
  if (!process.env.ULIP_USERNAME || !process.env.ULIP_PASSWORD) {
    console.warn('[ulip-service] ULIP_USERNAME/ULIP_PASSWORD are not set — every ULIP call will fail at login.');
  }

  await sequelize.authenticate();
  console.log('[ulip-service] Connected to database:', process.env.DB_NAME);
  await ensureOwnTables();
  console.log('[ulip-service] ulip_job_runs / ulip_failed_records ready');

  startRtoFetchJob();
  startChallanFetchJob();
  startRetryFailedRecordsJob();

  app.listen(PORT, () => console.log(`[ulip-service] listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[ulip-service] Failed to start:', err);
  process.exit(1);
});
