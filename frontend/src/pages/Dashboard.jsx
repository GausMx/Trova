import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, CreditCard, ShieldCheck, ArrowUpRight, Plus, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();

  // Queries for dashboard statistics
  const { data: employeesRes, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((res) => res.data),
  });

  const { data: payrollRes, isLoading: loadingPayroll } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => api.get('/payroll').then((res) => res.data),
  });

  const { data: complianceRes, isLoading: loadingCompliance } = useQuery({
    queryKey: ['complianceSummary'],
    queryFn: () => api.get('/compliance/summary').then((res) => res.data),
  });

  const employeeCount = employeesRes?.data?.employees?.length || 0;
  const recentPayroll = payrollRes?.data?.runs?.[0];
  const pendingComplianceCount = complianceRes?.data?.obligations?.filter(o => o.status !== 'completed')?.length || 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Welcome Message */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <span>Hello, {user?.firstName}</span>
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Here is your company summary for today. All compliance tracks are active.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/employees"
            className="flex items-center space-x-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </Link>
          <Link
            to="/payroll"
            className="flex items-center space-x-2 px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <span>Run Payroll</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Grid of Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Employees Metric Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-forest-50 text-forest-700 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Employees</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">
              {loadingEmployees ? '...' : employeeCount}
            </p>
          </div>
        </div>

        {/* Recent Payroll Metric Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-forest-50 text-forest-700 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Last Payroll Net</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5 truncate">
              {loadingPayroll ? '...' : recentPayroll ? `₦${Number(recentPayroll.totals?.net || 0).toLocaleString()}` : 'No runs yet'}
            </p>
          </div>
        </div>

        {/* Compliance Tasks Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-forest-50 text-forest-700 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Open Obligations</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">
              {loadingCompliance ? '...' : pendingComplianceCount}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Layout splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Recent Payroll History */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800">Recent Payroll Runs</h3>
            <Link to="/payroll" className="text-xs text-forest-700 font-semibold hover:underline">
              View All
            </Link>
          </div>
          {loadingPayroll ? (
            <p className="text-slate-400 text-sm">Loading payroll runs...</p>
          ) : !payrollRes?.data?.runs || payrollRes.data.runs.length === 0 ? (
            <p className="text-slate-400 text-sm">No payroll runs computed yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {payrollRes.data.runs.slice(0, 3).map((run) => (
                <div key={run._id} className="py-3.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">
                      Payroll {new Date(2000, run.month - 1).toLocaleString('default', { month: 'long' })} {run.year}
                    </p>
                    <p className="text-slate-400 text-xs">
                      Status: <span className="capitalize font-medium">{run.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">₦{Number(run.totals?.net || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-xs">Net Remitted</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Compliance Summary status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800">Statutory Compliance Status</h3>
            <Link to="/compliance" className="text-xs text-forest-700 font-semibold hover:underline">
              View Calendar
            </Link>
          </div>
          {loadingCompliance ? (
            <p className="text-slate-400 text-sm">Loading compliance info...</p>
          ) : complianceRes?.data?.obligations?.length === 0 ? (
            <p className="text-slate-400 text-sm">No compliance obligations pending.</p>
          ) : (
            <div className="space-y-3.5">
              {complianceRes?.data?.obligations?.slice(0, 4).map((ob) => (
                <div key={ob.remittanceType} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{ob.title}</p>
                    <p className="text-slate-400 text-xs">Authority: {ob.authority}</p>
                  </div>
                  <div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        ob.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ob.status === 'approved-pending-payment'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {ob.status?.replace('-', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
