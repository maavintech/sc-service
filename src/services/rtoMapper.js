const { parseUlipDate } = require('../utils/ulipDate');

/** Extract the RtoDetail date/owner columns from a normalized VAHAN VehicleDetails object. */
function extractFields(vd) {
  return {
    insuranceExpiry: parseUlipDate(vd.rc_insurance_upto),
    roadTaxExpiry: parseUlipDate(vd.rc_tax_upto),
    fitnessExpiry: parseUlipDate(vd.rc_fit_upto),
    pollutionExpiry: parseUlipDate(vd.rc_pucc_upto),
    ownerName: vd.rc_owner_name || null,
  };
}

/** True when VehicleDetails only carries the "not found" placeholder key. */
function isBlank(vd) {
  return Object.keys(vd || {}).every((k) => k === 'stautsMessage');
}

/**
 * Upsert one RtoDetail row from a successful VAHAN response, never letting a
 * blank/not-found response overwrite a row that already holds real data (a
 * blank response with existing real data on file is far more likely a
 * transient ULIP hiccup than a genuine change). Returns true when the row now
 * reflects usable data (success or a genuine not-found), false when the
 * update was skipped/errored.
 */
async function upsertRtoDetail(RtoDetail, vehicle, data) {
  const vd = data?.VehicleDetails || {};
  const existing = await RtoDetail.findOne({ where: { vehicleId: vehicle.id } });

  if (isBlank(vd)) {
    const existingHasRealData = existing && !isBlank(existing.rawData?.VehicleDetails);
    if (existingHasRealData) {
      await existing.update({ lastFetchedAt: new Date(), fetchStatus: 'error', fetchError: 'ULIP returned blank; kept existing data' });
      return false;
    }
    const payload = { rawData: data, lastFetchedAt: new Date(), fetchStatus: 'not_found', fetchError: null };
    if (existing) await existing.update(payload);
    else await RtoDetail.create({ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, ...payload });
    return true;
  }

  const payload = { ...extractFields(vd), rawData: data, lastFetchedAt: new Date(), fetchStatus: 'success', fetchError: null };
  if (existing) await existing.update(payload);
  else await RtoDetail.create({ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, ...payload });
  return true;
}

/** Records a failed fetch attempt against an existing/new RtoDetail row. */
async function recordRtoFetchError(RtoDetail, vehicle, errorMessage) {
  const existing = await RtoDetail.findOne({ where: { vehicleId: vehicle.id } });
  const payload = { lastFetchedAt: new Date(), fetchStatus: 'error', fetchError: errorMessage || 'Unknown error' };
  if (existing) await existing.update(payload);
  else await RtoDetail.create({ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, ...payload });
}

module.exports = { upsertRtoDetail, recordRtoFetchError };
