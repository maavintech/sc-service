require('dotenv').config();
require('console.table');

const fs = require('fs');
const http = require('http');
const https = require('https');
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

const { SSL_KEY, SSL_CERT, SSL_CA } = process.env;

function loadSslOptions() {
  if (!SSL_KEY || !SSL_CERT) return null;
  try {
    const options = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT),
    };
    if (SSL_CA) options.ca = fs.readFileSync(SSL_CA);
    return options;
  } catch (err) {
    console.error('[ssl] failed to load certificates, falling back to HTTP:', err.message);
    return null;
  }
}

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

  const sslOptions = loadSslOptions();

  if (sslOptions) {
    https.createServer(sslOptions, app)
      .listen(PORT, () => console.log(`[ulip-service] listening on ${PORT} (https)`));
  } else {
    http.createServer(app)
      .listen(PORT, () => console.log(`[ulip-service] listening on ${PORT} (http)`));
  }
}

start().catch((err) => {
  console.error('[ulip-service] Failed to start:', err);
  process.exit(1);
});
