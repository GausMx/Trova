const crypto = require('crypto');

/**
 * Initializes a subscription transaction with Paystack.
 * Scopes user email, billing plan, and company metadata.
 * 
 * @param {string} email - Console operator email (customer email)
 * @param {number} amount - Amount in NGN (will be converted to kobo)
 * @param {string} planCode - Paystack plan code
 * @param {Object} metadata - Custom metadata (companyId and tier)
 * 
 * @returns {Promise<Object>} Object containing authorization_url and reference
 */
const initializeTransaction = async (email, amount, planCode, metadata) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Paystack secret key is missing in environment configurations');
  }



  const payload = {
    email,
    amount: Math.round(amount * 100), // Paystack operates in kobo
    metadata,
    callback_url: process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:5173/billing/callback'
  };

  // Only append plan if a valid plan code is provided
  // In mock/test environments, plan code can be omitted to test standard transactions
  if (planCode && !planCode.startsWith('PLN_mock_')) {
    payload.plan = planCode;
  }

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();
  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Failed to initialize transaction with Paystack');
  }

  return {
    authorization_url: resData.data.authorization_url,
    reference: resData.data.reference
  };
};

/**
 * Verifies the integrity of Paystack webhook signature using HMAC SHA512.
 * 
 * @param {string} signature - Hex signature from x-paystack-signature header
 * @param {Buffer|string} rawBody - Raw body buffer of the incoming request
 * 
 * @returns {boolean} True if signature matches, false otherwise
 */
const verifySignature = (signature, rawBody) => {
  if (!signature || !rawBody) return false;

  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('PAYSTACK_WEBHOOK_SECRET environment variable is required in production');
  }
  
  const hash = crypto
    .createHmac('sha512', secret || 'super_secret_paystack_webhook_12345!')
    .update(rawBody)
    .digest('hex');

  return hash === signature;
};

/**
 * Verifies a transaction status with Paystack.
 * 
 * @param {string} reference - Paystack transaction reference
 * @returns {Promise<Object>} Verification details
 */
const verifyTransaction = async (reference) => {
  if (reference && (reference.startsWith('REF_mock_') || reference === 'test_reference')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Verification of mock transaction references is not permitted in production');
    }
    return {
      status: 'success',
      amount: 2500000,
      metadata: {
        companyId: 'mock_company_id_123',
        tier: 'starter'
      }
    };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Paystack secret key is missing in environment configurations');
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`
    }
  });

  const resData = await response.json();
  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Failed to verify transaction with Paystack');
  }

  return resData.data;
};

module.exports = {
  initializeTransaction,
  verifySignature,
  verifyTransaction
};
