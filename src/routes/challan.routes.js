const express = require('express');
const router = express.Router();
const { getChallanDetails } = require('../services/echallanService');
const { runBatch } = require('../utils/batchRunner');

// POST /api/challan
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
    const results = await runBatch(list, getChallanDetails);
    res.json({ success: true, results });
  } catch (err) {
    console.error('[Challan batch] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
