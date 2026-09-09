const { parseUlipDate } = require('../utils/ulipDate');

const challanNoOf = (item) => item && (item.challan_no || item.challan_number);

function extractAmount(item) {
  const v = item.fine_imposed ?? item.fine_amount ?? item.penalty_amount ?? item.received_amount ?? item.amount_paid ?? item.paid_amount;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function extractOffense(item) {
  const arr = Array.isArray(item.offence_details) ? item.offence_details : [];
  const joined = arr.map((o) => o.name).filter(Boolean).join(' | ');
  return joined || item.offense || item.violation || 'Traffic Violation';
}

function extractLocation(item) {
  return item.challan_place || item.rto_distric_name || item.rto_district_name || item.state_code || null;
}

function paidAmountOf(item) {
  const v = item.received_amount ?? item.amount_paid ?? item.paid_amount;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Upsert one Challan row for a single pending/disposed ULIP item. Only ever
 * touches rows this job created (source:'ulip') — a hand-entered challan
 * (source:'manual') with a clashing challanNumber is left alone. Returns the
 * challanNumber on success, null when skipped (no number, or manual clash).
 */
async function upsertChallanItem(Challan, vehicle, item, disposition) {
  const challanNumber = challanNoOf(item);
  if (!challanNumber) return null;

  const existing = await Challan.findOne({ where: { challanNumber } });
  if (existing && existing.source !== 'ulip') return null;

  const status = disposition === 'pending' ? 'pending' : (paidAmountOf(item) > 0 ? 'paid' : 'disposed');

  const payload = {
    vehicleId: vehicle.id,
    vehicleNumber: vehicle.vehicleNumber,
    challanNumber,
    amount: extractAmount(item),
    challanType: item.department || item.challan_type || 'Traffic Violation',
    offense: extractOffense(item),
    challanDate: parseUlipDate(item.challan_date_time) || new Date(),
    dueDate: parseUlipDate(item.due_date || item.date_of_proceeding),
    location: extractLocation(item),
    status,
    paymentDate: status === 'paid' ? (parseUlipDate(item.payment_date) || new Date()) : null,
    source: 'ulip',
    rawData: item,
    lastSyncedAt: new Date(),
  };

  if (existing) await existing.update(payload); else await Challan.create(payload);
  return challanNumber;
}

/**
 * Upsert a vehicle's full pending+disposed set, then sweep: any
 * previously-pending ULIP-sourced challan for this vehicle whose number is
 * missing from the fresh set has been withdrawn at source → 'cancelled'.
 */
async function syncVehicleChallans(Challan, vehicle, data) {
  const pending = Array.isArray(data.Pending_data) ? data.Pending_data : [];
  const disposed = Array.isArray(data.Disposed_data) ? data.Disposed_data : [];

  const freshNos = new Set();
  for (const item of pending) {
    const no = await upsertChallanItem(Challan, vehicle, item, 'pending');
    if (no) freshNos.add(String(no));
  }
  for (const item of disposed) {
    const no = await upsertChallanItem(Challan, vehicle, item, 'disposed');
    if (no) freshNos.add(String(no));
  }

  const stillPending = await Challan.findAll({ where: { vehicleId: vehicle.id, source: 'ulip', status: 'pending' } });
  for (const row of stillPending) {
    if (!freshNos.has(String(row.challanNumber))) {
      await row.update({ status: 'cancelled', lastSyncedAt: new Date() });
    }
  }
}

module.exports = { syncVehicleChallans };
