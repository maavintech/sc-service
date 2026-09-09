const express = require('express');
const router = express.Router();
const { getRtoDetails } = require('../services/vahanService');
const { runBatch } = require('../utils/batchRunner');

// POST /api/rto
// Body: { vehicleNumber } or { vehicleNumbers: [...] }
router.post('/', async (req, res) => {
  const { vehicleNumber, vehicleNumbers } = req.body || {};
  const list = Array.isArray(vehicleNumbers) && vehicleNumbers.length
    ? vehicleNumbers
    : (vehicleNumber ? [vehicleNumber] : []);

  if (!list.length) {
    return res.status(400).json({ success: false, message: 'vehicleNumber or vehicleNumbers is required' });
  }

  try {
    const results = await runBatch(list, getRtoDetails);
    res.json({ success: true, results });
  } catch (err) {
    console.error('[RTO batch] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
