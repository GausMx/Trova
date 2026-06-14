const Company = require('../models/Company');
const User = require('../models/User');
const paystackService = require('../utils/paystackService');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { SUBSCRIPTION_TIERS, COMPANY_STATUS } = require('../config/constants');

/**
 * Initializes a subscription checkout on Paystack.
 * Returns the payment gateway checkout authorization URL.
 */
exports.initializeSubscription = catchAsync(async (req, res) => {
  const { tier } = req.body;

  if (![SUBSCRIPTION_TIERS.GROWTH, SUBSCRIPTION_TIERS.ENTERPRISE].includes(tier)) {
    return sendError(res, 'Invalid subscription tier selected', 400);
  }

  // 1. Determine price amount and plan code
  let amount = 15000; // N15,000/month default for growth
  let planCode = process.env.PAYSTACK_PLAN_GROWTH || 'PLN_mock_growth';

  if (tier === SUBSCRIPTION_TIERS.ENTERPRISE) {
    amount = 50000; // N50,000/month for enterprise
    planCode = process.env.PAYSTACK_PLAN_ENTERPRISE || 'PLN_mock_enterprise';
  }

  // 2. Prepare metadata payload for webhook matching
  const metadata = {
    companyId: req.companyId.toString(),
    tier
  };

  // 3. Initialize transaction
  const checkoutData = await paystackService.initializeTransaction(
    req.user.email,
    amount,
    planCode,
    metadata
  );

  return sendSuccess(res, 'Subscription checkout initialized successfully', checkoutData, 200);
});

/**
 * Processes incoming Paystack webhook events.
 * Enforces HMAC SHA512 signature checking.
 */
exports.handleWebhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  // 1. Verify HMAC Signature using raw body buffer
  const isVerified = paystackService.verifySignature(signature, req.rawBody);
  if (!isVerified) {
    console.error('✖ Webhook Signature Verification Failed');
    return sendError(res, 'Invalid signature headers', 401);
  }

  // 2. Parse event payload
  const { event, data } = req.body;
  console.log(`✔ Webhook Verified. Event Received: ${event}`);

  // 3. Handle specific subscription billing events
  if (event === 'charge.success') {
    // Upgrade company subscription using metadata
    const companyId = data.metadata ? data.metadata.companyId : null;
    const tier = data.metadata ? data.metadata.tier : null;

    if (companyId && tier) {
      const company = await Company.findById(companyId);
      if (company) {
        company.subscriptionTier = tier;
        company.status = COMPANY_STATUS.ACTIVE;
        await company.save();
        console.log(`[Billing Webhook] Upgraded Company ${company.name} (${companyId}) to tier: ${tier}`);
      }
    }
  } else if (event === 'subscription.disable') {
    // Downgrade company subscription to free
    let companyId = data.metadata ? data.metadata.companyId : null;

    // Fallback: If metadata is missing in the disable event, look up company by user email
    if (!companyId && data.customer && data.customer.email) {
      const user = await User.findOne({ email: data.customer.email.toLowerCase() });
      if (user) {
        companyId = user.companyId;
      }
    }

    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        company.subscriptionTier = SUBSCRIPTION_TIERS.FREE;
        await company.save();
        console.log(`[Billing Webhook] Downgraded Company ${company.name} (${companyId}) to tier: free due to cancellation/failure`);
      }
    }
  }

  // 4. Return 200 OK to acknowledge event delivery
  return sendSuccess(res, 'Webhook event processed successfully', {}, 200);
});

/**
 * Retrieves billing and subscription status of the company.
 */
exports.getBillingStatus = catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId);
  if (!company) {
    return sendError(res, 'Company profile not found', 404);
  }

  return sendSuccess(res, 'Billing status retrieved successfully', {
    subscriptionTier: company.subscriptionTier,
    status: company.status
  });
});
