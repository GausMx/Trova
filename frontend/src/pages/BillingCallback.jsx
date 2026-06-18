import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function BillingCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth, accessToken, refreshToken } = useAuthStore();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const reference = searchParams.get('reference');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        setStatus('error');
        setErrorMsg('No payment reference found. Please try again.');
        return;
      }

      try {
        // Call backend verification
        const response = await api.get(`/billing/verify/${reference}`);
        if (response.data.success) {
          // Fetch updated profile to ensure Zustand store is in sync
          const meResponse = await api.get('/auth/me');
          if (meResponse.data.success && meResponse.data.data.user) {
            setAuth(meResponse.data.data.user, accessToken, refreshToken);
          }
          setStatus('success');
          setTimeout(() => {
            navigate('/billing', { state: { paymentSuccess: true } });
          }, 2000);
        } else {
          setStatus('error');
          setErrorMsg(response.data.message || 'Payment verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.response?.data?.message || 'A network error occurred while verifying payment.');
      }
    };

    verifyPayment();
  }, [reference, navigate, setAuth, accessToken, refreshToken]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
        {status === 'verifying' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-forest-50 text-forest-700 rounded-2xl flex items-center justify-center border border-forest-100 shadow-inner">
              <RefreshCw className="w-8 h-8 animate-spin text-forest-900" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Verifying Payment</h3>
            <p className="text-slate-500 text-sm">
              We are verifying your transaction with Paystack. Please do not close or refresh this page.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-inner">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Payment Successful!</h3>
            <p className="text-slate-500 text-sm">
              Your transaction has been verified. Activating your subscription and redirecting you...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center border border-rose-100 shadow-inner">
              <XCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Verification Failed</h3>
            <p className="text-rose-600 text-sm font-medium">
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/billing')}
              className="mt-4 px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Back to Billing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
