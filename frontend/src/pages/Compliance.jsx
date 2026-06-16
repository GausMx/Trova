import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { ShieldCheck, Calendar, Bell, AlertCircle, FileText, CheckCircle2, RefreshCw, X } from 'lucide-react';

export default function Compliance() {
  const { user } = useAuthStore();
  const canMarkComplete = ['owner', 'admin', 'finance'].includes(user?.role);

  // Modal states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [cacModalOpen, setCacModalOpen] = useState(false);
  const [selectedOb, setSelectedOb] = useState(null);
  const [completing, setCompleting] = useState(false);

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

  const handleMarkCompleteClick = (ob) => {
    setSelectedOb(ob);
    if (ob.remittanceType === 'CAC Annual Return') {
      setCacModalOpen(true);
    } else {
      setConfirmModalOpen(true);
    }
  };

  const handleConfirmComplete = async () => {
    if (!selectedOb?.complianceRecordId) return;
    setCompleting(true);
    try {
      await api.patch(`/compliance/records/${selectedOb.complianceRecordId}/complete`);
      refetchSummary();
      refetchCalendar();
      setConfirmModalOpen(false);
      setSelectedOb(null);
    } catch (error) {
      console.error('Error completing compliance record:', error);
      alert(error?.response?.data?.message || 'Error updating compliance status');
    } finally {
      setCompleting(false);
    }
  };

  const deadlines = calendarRes?.data?.deadlines || [];
  const obligations = summaryRes?.data?.obligations || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative">
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
                  let statusBadgeStyles = 'bg-slate-50 text-slate-500 border border-slate-200';
                  if (ob.status === 'completed') {
                    statusBadgeStyles = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  } else if (ob.status === 'due-soon' || ob.status === 'due_soon' || ob.status === 'action-required') {
                    statusBadgeStyles = 'bg-amber-50 text-amber-700 border border-amber-200';
                  } else if (ob.status === 'overdue') {
                    statusBadgeStyles = 'bg-rose-50 text-rose-700 border border-rose-200';
                  }

                  const showMarkCompleteButton = ob.status !== 'completed' && canMarkComplete;

                  return (
                    <div
                      key={ob.id || ob.remittanceType}
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
                          Authority: <span className="font-medium">{ob.authority}</span> — Due by {ob.dueDayLabel || '10th'} of next month
                        </p>
                        {ob.status === 'completed' ? (
                          <div className="text-xs text-emerald-600 flex items-center space-x-1 mt-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{ob.details}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1">{ob.details}</p>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${statusBadgeStyles}`}>
                          {ob.status?.replace(/-/g, ' ')}
                        </span>
                        {showMarkCompleteButton && (
                          <button
                            onClick={() => handleMarkCompleteClick(ob)}
                            className="px-3 py-1.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            {ob.remittanceType === 'CAC Annual Return' ? 'Mark as Filed' : 'Mark as Remitted'}
                          </button>
                        )}
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

      {/* CAC Annual Return Info Modal */}
      {cacModalOpen && selectedOb && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4 flex flex-col relative">
            <button
              onClick={() => setCacModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-800 pr-8">CAC Annual Returns Filing</h3>
            <p className="text-sm text-slate-600">
              Annual returns filing cannot be processed automatically through Trova and must be completed externally on the Corporate Affairs Commission portal (cac.gov.ng).
            </p>
            <p className="text-sm text-slate-600">
              Please complete the filing on the portal, then click "Mark as Filed" below to log this action in Trova.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="https://cac.gov.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Go to CAC Portal →
              </a>
              <button
                onClick={() => {
                  setCacModalOpen(false);
                  setConfirmModalOpen(true);
                }}
                className="flex-1 px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Mark as Filed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedOb && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4 relative flex flex-col">
            <button
              onClick={() => setConfirmModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              disabled={completing}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-forest-50 text-forest-700 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Confirm Statutory Remittance</h3>
            <p className="text-sm text-slate-600">
              Confirm you have remitted <span className="font-semibold">{selectedOb.title}</span> to <span className="font-semibold">{selectedOb.authority}</span>. This action will be logged with today's date and your name.
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                disabled={completing}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                className="flex-1 px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-2"
                disabled={completing}
              >
                {completing ? <span>Confirming...</span> : <span>Confirm</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
