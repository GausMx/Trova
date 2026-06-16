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

module.exports = router;
