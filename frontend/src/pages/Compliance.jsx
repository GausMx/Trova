import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { ShieldCheck, Calendar, Bell, AlertCircle, FileText, CheckCircle2, RefreshCw } from 'lucide-react';

export default function Compliance() {
  // 1. Fetch upcoming 30-day deadlines
  const { data: calendarRes, isLoading: loadingCalendar, refetch: refetchCalendar } = useQuery({
    queryKey: ['complianceCalendar'],
    queryFn: () => api.get('/compliance/calendar').then((res) => res.data),
  });

  // 2. Fetch current month's obligation statuses
  const { data: summaryRes, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['complianceSummary'],
    queryFn: () => api.get('/compliance/summary').then((res) => res.data),
  });

  const handleRefresh = () => {
    refetchCalendar();
    refetchSummary();
  };

  const deadlines = calendarRes?.data?.deadlines || [];
  const obligations = summaryRes?.data?.obligations || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Compliance Tracking</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track statutory deadlines and obligations for PAYE, PENCOM, NSITF, and ITF</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center space-x-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Obligations</span>
        </button>
      </div>

      {/* Grid: Calendar Deadlines vs Obligation summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Current Month Obligations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-forest-700" />
              <span>Current Month Obligations</span>
            </h3>

            {loadingSummary ? (
              <p className="text-slate-500 text-sm">Loading summary...</p>
            ) : obligations.length === 0 ? (
              <p className="text-slate-400 text-sm py-4">No obligations configured.</p>
            ) : (
              <div className="space-y-4">
                {obligations.map((ob) => {
                  let statusBadgeStyles = 'bg-slate-100 text-slate-700 border border-slate-200';
                  if (ob.status === 'completed') {
                    statusBadgeStyles = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  } else if (ob.status === 'approved-pending-payment') {
                    statusBadgeStyles = 'bg-amber-50 text-amber-700 border border-amber-200';
                  } else if (ob.status === 'draft-unapproved') {
                    statusBadgeStyles = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                  } else if (ob.status === 'pending-payroll-run') {
                    statusBadgeStyles = 'bg-rose-50 text-rose-700 border border-rose-200';
                  }

                  return (
                    <div
                      key={ob.remittanceType}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-sm">{ob.title}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-forest-50 text-forest-700 rounded-md border border-forest-100">
                            {ob.remittanceType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Authority: <span className="font-medium">{ob.authority}</span> — Due by {ob.dueDayLabel} of next month
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${statusBadgeStyles}`}>
                          {ob.status?.replace(/-/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 30-Day Upcoming Deadlines */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-fit">
          <h3 className="font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
            <Calendar className="w-5 h-5 text-forest-700" />
            <span>Upcoming (Next 30 Days)</span>
          </h3>

          {loadingCalendar ? (
            <p className="text-slate-500 text-sm">Loading calendar...</p>
          ) : deadlines.length === 0 ? (
            <div className="text-center text-slate-400 py-12 flex flex-col items-center justify-center">
              <Bell className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium">No deadlines due</p>
              <p className="text-xs text-slate-400 mt-1">There are no upcoming remittance deadlines in the next 30 days.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deadlines.map((dl, index) => {
                const daysLeft = dl.daysRemaining;
                const isUrgent = daysLeft <= 5;
                return (
                  <div key={index} className="flex items-start space-x-3 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      {isUrgent ? <AlertCircle className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-800 line-clamp-1">{dl.title}</p>
                      <p className="text-slate-400 text-xs">
                        Due: {new Date(dl.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className={`text-xs font-medium ${isUrgent ? 'text-red-600 font-bold' : 'text-forest-700'}`}>
                        {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days remaining`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
