import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { CreditCard, Check, Sparkles, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function Billing() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch current subscription status
  const { data: statusRes, isLoading, error } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: () => api.get('/billing/status').then((res) => res.data),
  });

  // 2. Initialize subscription checkout mutation
  const upgradeMutation = useMutation({
    mutationFn: (tier) => api.post('/billing/initialize', { tier }),
    onSuccess: (res) => {
      if (res.data?.data?.authorization_url) {
        // Redirect operator to Paystack payment gateway
        window.location.href = res.data.data.authorization_url;
      }
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to initialize checkout. Please try again.');
    },
  });

  const subscriptionTier = statusRes?.data?.subscriptionTier || 'growth';
  const accountStatus = statusRes?.data?.status || 'active';
  const isTrial = statusRes?.data?.isTrial;
  const trialEndsAt = statusRes?.data?.trialEndsAt;
  const isOwner = user?.role === 'owner';

  const handleUpgrade = (tier) => {
    if (!isOwner) return;
    setErrorMsg('');
    upgradeMutation.mutate(tier);
  };

  // Compute remaining trial days
  let daysRemaining = 0;
  if (isTrial && trialEndsAt) {
    const msDiff = new Date(trialEndsAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  }

  const planTiers = [
    {
      id: 'starter',
      name: 'Starter Tier',
      price: '₦25,000',
      period: 'month',
      employeeLimitLabel: 'Up to 20 active employees',
      description: 'Standard HR and employee tracking for small teams.',
      features: [
        'Up to 20 active employees',
        'Basic payroll calculations',
        'Standard employee records database',
        'Email support',
      ],
    },
    {
      id: 'growth',
      name: 'Growth Tier',
      price: '₦55,000',
      period: 'month',
      employeeLimitLabel: 'Up to 100 active employees',
      description: 'Full PAYE computation, pension and NHF automation, PDF payslip generation, and compliance calendar',
      features: [
        'Up to 100 active employees',
        'Nigerian PITA tax reliefs & consolidated allowances',
        'Statutory Compliance Calendar Integration',
        'Automated monthly compliance obligation statuses',
        'PDF Payslips generation (via Puppeteer)',
        'Priority email & chat support',
      ],
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise Tier',
      price: '₦100,000',
      period: 'month',
      employeeLimitLabel: 'Unlimited active employees',
      description: 'Everything in Growth plus dedicated account manager, custom onboarding, priority support, and SLA guarantee',
      features: [
        'Unlimited active employees',
        'Custom PITA tax calculations & reliefs configuration',
        'Dedicated compliance consultant & annual filing audits',
        'Custom reporting & accounting integrations',
        '24/7 Phone support & SLAs',
      ],
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Subscription & Billing</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your corporate billing, view active plan features, or upgrade your subscription.</p>
      </div>

      {isTrial && (
        <div className="bg-forest-900 text-white p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-forest-805">
          <div>
            <h3 className="font-bold text-lg">You are on a 30-day free trial — {daysRemaining} days remaining</h3>
            <p className="text-forest-100 text-xs mt-1">Upgrade anytime to keep access and configure automated payroll runs.</p>
          </div>
          <span className="bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg self-start sm:self-auto">
            Trial Mode
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current Subscription Status Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        {isLoading ? (
          <div className="text-slate-500 text-sm">Loading billing status...</div>
        ) : error ? (
          <div className="text-red-500 text-sm">Unable to retrieve billing status profile.</div>
        ) : (
          <>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-forest-50 text-forest-700 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Subscription Plan</p>
                <div className="flex items-center space-x-2 mt-0.5">
                  <h3 className="font-bold text-lg text-slate-855 capitalize">{subscriptionTier} Plan</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isTrial
                      ? 'bg-amber-50 text-amber-700 border-amber-205'
                      : accountStatus === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {isTrial ? 'Trial' : accountStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Role Notice */}
            {!isOwner && (
              <div className="max-w-xs md:text-right text-xs bg-slate-50 border border-slate-100 p-3 rounded-lg text-slate-500">
                Only the company **Owner** can update subscription plans or billing details.
              </div>
            )}
          </>
        )}
      </div>

      {/* Plans Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {planTiers.map((plan) => {
          // If the user is on trial, they must be allowed to click Upgrade on any tier (including their trial tier) to pay.
          const isCurrentPlan = !isTrial && subscriptionTier === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border p-8 flex flex-col justify-between shadow-sm relative transition-all duration-200 hover:shadow-md ${
                plan.popular ? 'border-forest-700 ring-2 ring-forest-50/50' : 'border-slate-200'
              } ${isCurrentPlan ? 'bg-forest-50/10 border-forest-600/30' : ''}`}
            >
              {/* Top Banner Tag */}
              {plan.popular && (
                <span className="absolute top-0 right-6 -translate-y-1/2 bg-forest-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 fill-white" />
                  <span>Recommended</span>
                </span>
              )}

              {isCurrentPlan && (
                <span className="absolute top-0 left-6 -translate-y-1/2 bg-slate-800 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full">
                  Current Active Plan
                </span>
              )}

              {/* Plan Header */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">{plan.name}</h4>
                  <p className="text-slate-400 text-xs mt-1 min-h-[32px]">{plan.description}</p>
                </div>

                <div>
                  <div className="flex items-baseline text-slate-800">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    <span className="ml-1 text-sm font-semibold text-slate-400">/{plan.period}</span>
                  </div>
                  <div className="text-xs font-bold text-forest-800 bg-forest-50 border border-forest-100 px-2.5 py-1 rounded-md mt-1.5 inline-block">
                    {plan.employeeLimitLabel}
                  </div>
                </div>

                {/* Features Checklist */}
                <ul className="space-y-3 border-t border-slate-100 pt-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-slate-600 text-xs">
                      <span className="mr-2.5 mt-0.5 text-forest-700 shrink-0 bg-forest-50 rounded p-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Upgrade/Pricing Buttons */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-lg text-sm font-semibold border border-slate-200 cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span>Plan Active</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!isOwner || upgradeMutation.isPending}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center space-x-2 focus:ring-2 focus:ring-forest-100 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                      plan.popular
                        ? 'bg-forest-900 hover:bg-forest-800 text-white shadow-sm'
                        : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {upgradeMutation.isPending && upgradeMutation.variables === plan.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <span>{isOwner ? `Subscribe to ${plan.name.replace(' Plan', '')}` : 'Owner Account Only'}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
