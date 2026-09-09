// ULIP dates show up in a handful of formats depending on endpoint/state:
// 'DD-MMM-YYYY' (26-Jun-2026), 'DD-MM-YYYY', 'DD-MM-YYYY HH:mm:ss', or plain
// ISO. Dependency-free rather than pulling in a date library for one file.
const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

/**
 * Parse a ULIP date string into a Date, or null if unparseable/empty.
 * Values with no digits (e.g. 'LTT') are treated as non-dates.
 */
function parseUlipDate(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || !/\d/.test(s)) return null;

  // DD-MMM-YYYY or DD-MMM-YY, optionally with a trailing time
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2].toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (month === undefined) return null;
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY [HH:mm:ss]
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
    const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, +ss));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or full ISO
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { parseUlipDate };
