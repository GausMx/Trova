const express = require('express');
const { BANK_CODES } = require('../config/constants');
const router = express.Router();

// GET /banks -> Returns list of banks (no auth required)
router.get('/banks', (req, res) => {
  const banks = Object.entries(BANK_CODES).map(([name, code]) => ({
    name,
    code
  }));
  
  return res.status(200).json({
    success: true,
    data: banks
  });
});

// GET /states -> Returns list of 36 Nigerian States + FCT
router.get('/states', (req, res) => {
  const { NIGERIAN_STATES } = require('../config/constants');
  return res.status(200).json({
    success: true,
    data: NIGERIAN_STATES
  });
});

module.exports = router;
