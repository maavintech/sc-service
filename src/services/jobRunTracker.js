const { UlipJobRun } = require('../models');

/** Record the start of a job run. Returns the row so the caller can finish() it. */
async function startRun(jobName) {
  return UlipJobRun.create({ jobName, status: 'started', startedAt: new Date() });
}

/**
 * Finish a job run: stamps completedAt/durationSeconds and the final counts.
 * `status` should already include an error message when applicable
 * (e.g. "failed: <message>"), matching sc-server's convention.
 */
async function finishRun(run, { status, totalVehicles, successCount, failedCount, quotaHit }) {
  const completedAt = new Date();
  const durationSeconds = Math.floor((completedAt - run.startedAt) / 1000);
  await run.update({ status, completedAt, durationSeconds, totalVehicles, successCount, failedCount, quotaHit: !!quotaHit });
}

module.exports = { startRun, finishRun };
