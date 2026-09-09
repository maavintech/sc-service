# ulip-service

Owns the whole ULIP (DPIIT) integration for DriveInnovate: login/token caching,
rate limiting, daily-quota handling, and **scheduled fetching + persistence**.
It connects directly to DriveInnovate's own MySQL database (not a database of
its own) — same pattern as SmartChallan's own backend (`smartchallan/sc-server`)
being its own process against a shared schema.

## What it reads/writes in DriveInnovate's database

- **Reads only**: `di_user` (`status='active'`, `parent_id`), the Permission
  Catalog tables (`di_permission_feature`, `di_permission_package_module`,
  `di_user_feature_grant`, `di_user_module_grant`, `di_user_package_grant`),
  `di_user_vehicle` (which of an account's vehicles are `status='active'`).
- **Writes**: `rto_details`, `challans` — the SAME tables DriveInnovate's own
  API (`GET /api/rto`, `GET /api/challans`) reads, so there is one data shape,
  one source of truth.
- **Owns outright** (new tables, nothing else touches them): `ulip_job_runs`
  (one row per scheduled run — start/end/duration/counts/quota-hit) and
  `ulip_failed_records` (per-vehicle failures pending retry).

**Who gets fetched is decided by the Permission Catalog**, not a bespoke
account flag: `src/services/permissionResolver.js` resolves the same
`canViewRTO`/`canViewChallans` features DriveInnovate's read API already
gates on (direct feature grant, OR a grant of their module, OR a grant of any
package containing that module — papa holds every feature implicitly),
mirroring `driveinnovate/server/src/services/permission.service.js#
getFeatureKeySet`. Papa/dealer grants these from a client's **Permissions**
tab (Permission Catalog → "RTO & Challan" module) exactly like every other
feature — there is no separate ULIP-specific toggle anywhere. The same
Permission Catalog entry is therefore the single source of truth for both
"can this account's vehicles be fetched" (this service) and "can a logged-in
user of the account see the stored data" (DriveInnovate's `requirePermission`
on the read API).

## Scheduled jobs

- **`rtoFetchJob`** — weekly, Monday 09:00 IST (`RTO_JOB_CRON`). RTO/insurance/
  tax data changes slowly, so a weekly cadence is enough.
- **`challanFetchJob`** — every 8h (`CHALLAN_JOB_CRON`).
- **`retryFailedRecordsJob`** — every 3h (`RETRY_JOB_CRON`), re-attempts
  whatever is sitting in `ulip_failed_records`; a recovered row is deleted, a
  repeat failure bumps its retry count.

Each of `src/jobs/*.js` also exports its run function directly and can be
invoked manually: `node src/jobs/rtoFetchJob.js`.

## On-demand HTTP endpoints (optional)

Both require header `x-api-key: <ULIP_SERVICE_API_KEY>`. These predate the
cron jobs and are kept for ad-hoc/manual lookups — the scheduled jobs call
`vahanService`/`echallanService` directly in-process, not through these.

### `POST /api/rto`
Body: `{ "vehicleNumber": "KA01AB1234" }` or `{ "vehicleNumbers": ["KA01AB1234", "..."] }`

Response: `{ "success": true, "results": [{ "vehicleNumber", "success", "data" | "error", "code"? }] }`

### `POST /api/challan`
Same request shape. `data` is `{ Pending_data: [...], Disposed_data: [...] }`.

### `GET /health`
No auth. Liveness check.

## ULIP limitations this service handles

- **Token lifetime**: cached ~20h, single-flight login, forced refresh on a
  401/403 that looks like a rejected token.
- **Daily quota**: a 403 mentioning quota/usage-limit is non-retryable. Mid-run,
  once this happens, every remaining vehicle in that run is marked failed with
  `code: "ULIP_QUOTA_EXCEEDED"` without calling ULIP again, and the job stops
  moving on to further accounts (the quota is one shared account-wide cap).
- **Rate limit**: `ULIP_RATE_LIMIT_PER_SECOND` (default 8) across every call.
- **Batch pacing**: `ULIP_BATCH_CONCURRENCY`/`ULIP_BATCH_DELAY_MS`.

## Running

```
cp .env.example .env
# Fill in DB_* to point at driveinnovate/server's database,
# ULIP_USERNAME/ULIP_PASSWORD, and ULIP_SERVICE_API_KEY.
npm install
npm start
```
