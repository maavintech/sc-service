const { callUlipWithRetry } = require('../utils/callUlip');

// VAHAN/04 returns JSON with camelCase keys (rcRegnNo, rcInsuranceUpto, ...).
// VAHAN/01 (older) returned XML which downstream consumers parsed into
// snake_case keys (rc_regn_no, rc_insurance_upto, ...). We normalize every
// VAHAN/04 response into BOTH key styles so any consumer reading either
// convention finds the field it expects.
function camelToSnake(str) {
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function deepConvertKeys(input) {
  if (Array.isArray(input)) return input.map(deepConvertKeys);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[camelToSnake(k)] = deepConvertKeys(v);
    }
    return out;
  }
  return input;
}

function mapVahan04ToVehicleDetails(obj) {
  const snake = deepConvertKeys(obj);
  return { ...snake, ...obj };
}

/**
 * Fetch RTO/VAHAN details for one vehicle number.
 * Resolves to { VehicleDetails: {...} } — either real data or a minimal
 * { stautsMessage: '...' } record when the vehicle isn't found in VAHAN.
 * Throws (not resolves) on ULIP-side errors so the caller can distinguish
 * "genuinely not found" from "ULIP hiccupped, try again later".
 */
async function getRtoDetails(vehicleNumber) {
  const url = process.env.ULIP_VAHAN_DETAILS_URL || 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0/VAHAN/04';

  const response = await callUlipWithRetry(url, { vehiclenumber: vehicleNumber });

  if (
    !response.data ||
    !Array.isArray(response.data.response) ||
    response.data.response.length === 0 ||
    !response.data.response[0]
  ) {
    throw new Error(`ULIP returned unexpected structure for ${vehicleNumber}. Full response: ${JSON.stringify(response.data)}`);
  }

  const inner = response.data.response[0];
  const payload = inner.response;

  if (payload && typeof payload === 'object') {
    return { VehicleDetails: mapVahan04ToVehicleDetails(payload) };
  }

  const msgText = inner.message && (inner.message.text || inner.message);
  const msgCode = inner.message && inner.message.code;

  // Some "no payload" responses are ULIP's OWN backend failing (its VAHAN
  // adapter couldn't parse/format the upstream state response), not "this
  // vehicle doesn't exist" — surface those as errors so the caller retries
  // later instead of recording a false not-found.
  const ULIP_SIDE_ERROR_SIGNALS = ['MAPPING_ERROR'];
  if (ULIP_SIDE_ERROR_SIGNALS.includes(msgText) || ULIP_SIDE_ERROR_SIGNALS.includes(msgCode)) {
    const err = new Error(`ULIP-side error: ${msgCode || ''} ${msgText || ''}`.trim() + ` (${vehicleNumber})`);
    err.code = 'ULIP_SIDE_ERROR';
    throw err;
  }

  const notFound = msgText || 'Vehicle Data Not Found';
  return { VehicleDetails: { stautsMessage: typeof notFound === 'string' ? notFound : 'Vehicle Data Not Found' } };
}

module.exports = { getRtoDetails };
