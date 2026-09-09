const { callUlipWithRetry } = require('../utils/callUlip');

/**
 * Fetch challan details for one vehicle number.
 * Resolves to { Pending_data: [...], Disposed_data: [...] } (either array
 * may be empty). This service is stateless — it does NOT diff against any
 * previous run, so it never reports cancellations; the caller (which
 * persists results) is the one that knows what it saw last time and can
 * detect a pending challan that has disappeared.
 */
async function getChallanDetails(vehicleNumber) {
  const url = process.env.ULIP_ECHALLAN_DETAILS_URL;

  const response = await callUlipWithRetry(url, { vehicleNumber });

  // A "no challans" response can come back "lean" — missing the nested
  // `.response.data` node entirely — which would throw on a naive access.
  const ulipData = response?.data?.response?.[0]?.response?.data ?? null;

  const pendingArr = Array.isArray(ulipData?.Pending_data) ? ulipData.Pending_data : [];
  const disposedArr = Array.isArray(ulipData?.Disposed_data) ? ulipData.Disposed_data : [];

  return { Pending_data: pendingArr, Disposed_data: disposedArr };
}

module.exports = { getChallanDetails };
