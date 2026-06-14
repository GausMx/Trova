import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { ShieldAlert, Building2, User, Mail, KeyRound, ArrowRight } from 'lucide-react';

export default function Register() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: '',
      industry: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'owner',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await api.post('/auth/register', data);
      if (response.data.success) {
        const { token, refreshToken, user } = response.data.data;
        setAuth(user, token, refreshToken);
        navigate('/dashboard');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Registration failed. Please check input parameters.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-8">
        {/* Branding header banner */}
        <div className="bg-forest-900 p-8 text-white text-center">
          <div className="w-12 h-12 bg-white text-forest-900 rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-3">
            T
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Create Corporate Account</h2>
          <p className="text-forest-100/80 text-sm mt-1">Register your company profile on Trova</p>
        </div>

        {/* Register Form */}
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section: Company Profile */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                Company Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Company Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp Nigeria"
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                        errors.companyName
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                          : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('companyName', { required: 'Company name is required' })}
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-red-600 text-xs mt-1">{errors.companyName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Technology"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                    {...register('industry')}
                  />
                </div>
              </div>
            </div>

            {/* Section: Owner administrator details */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                Administrator Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Chidi"
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                        errors.firstName
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                          : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('firstName', { required: 'First name is required' })}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="text-red-600 text-xs mt-1">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="Okonkwo"
                    className={`w-full px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                      errors.lastName
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                        : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                    }`}
                    {...register('lastName', { required: 'Last name is required' })}
                  />
                  {errors.lastName && (
                    <p className="text-red-600 text-xs mt-1">{errors.lastName.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Company Role</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                    {...register('role', { required: 'Role is required' })}
                  >
                    <option value="owner">Company Owner (Full Access)</option>
                    <option value="admin">System Admin (Full Access except Billing Upgrades)</option>
                    <option value="hr">HR Manager (Staff Controls & Compliance)</option>
                    <option value="finance">Finance Manager (Payroll & Compliance)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Email & Password */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Admin Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="admin@company.com"
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                      errors.email
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                        : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                    }`}
                    {...register('email', {
                      required: 'Email address is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                      errors.password
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                        : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                    }`}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters long' },
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Action button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-2 focus:ring-2 focus:ring-forest-100 focus:outline-none disabled:opacity-50"
            >
              <span>{isLoading ? 'Creating Account...' : (selectedRole === 'owner' ? 'Register Company' : 'Register')}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Direct link back to login */}
          <div className="mt-8 text-center text-sm border-t border-slate-100 pt-6">
            <span className="text-slate-500">Already registered? </span>
            <Link to="/login" className="text-forest-700 font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
