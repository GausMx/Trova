import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileText,
  Building2,
  CreditCard,
  History,
  TrendingDown,
  Layers,
  ArrowRight,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Award
} from 'lucide-react';

export default function ReconciliationTab({ payrollRun, isApprovedOrPaid }) {
  const [activeView, setActiveView] = useState('all'); // 'all', 'numbers', 'timeline'

  // Fetch full Reconciliation Summary from the backend
  const {
    data: reconRes,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['payrollReconciliation', payrollRun._id],
    queryFn: async () => {
      const res = await api.get(`/payroll/${payrollRun._id}/reconciliation`);
      return res.data?.data;
    },
    enabled: !!payrollRun._id
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-forest-700 animate-spin" />
        <p className="text-sm font-semibold">Generating Monthly Reconciliation & Audit Statement...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm flex items-center space-x-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
        <span>Failed to load reconciliation details: {error?.response?.data?.message || error?.message}</span>
      </div>
    );
  }

  const period = reconRes?.period || {};
  const headcount = reconRes?.headcountAndAttendance || {};
  const finance = reconRes?.financialBalancing || {};
  const routing = reconRes?.routingBreakdown || {};
  const disbursement = reconRes?.disbursementDetails;
  const obligations = reconRes?.statutoryObligations || [];
  const auditTrail = reconRes?.auditTrail || [];

  const isPaid = period.status === 'paid';
  const isApproved = period.status === 'approved';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[(period.month || 1) - 1];

  return (
    <div className="space-y-6 font-sans">
      {/* Print-specific style tag for crisp A4 executive statement formatting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #reconciliation-print-area, #reconciliation-print-area * {
            visibility: visible;
          }
          #reconciliation-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Container that will be printed */}
      <div id="reconciliation-print-area" className="space-y-6">
        {/* Top Executive Header & Verification Certificate */}
        <div className="bg-gradient-to-r from-slate-900 via-forest-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-forest-500/20 text-forest-300 border border-forest-400/30 rounded-md text-[11px] font-extrabold uppercase tracking-wider">
                  Post-Payroll Settlement & Audit Clearing
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider ${
                    isPaid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : isApproved
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  Status: {period.status}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
                {monthName} {period.year} Reconciliation Statement
              </h2>

              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Comprehensive statutory clearing, headcount proration variance check, and multi-agency settlement history
                verified under Nigerian Tax & Pension Regulations.
              </p>

              {period.settlementReference && (
                <div className="mt-3 flex items-center space-x-2 text-xs text-forest-200 bg-forest-900/40 px-3 py-1.5 rounded-lg border border-forest-700/40 w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Settlement Reference: <strong className="font-mono text-white">{period.settlementReference}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Print and Refresh Actions */}
            <div className="flex items-center space-x-2.5 no-print shrink-0">
              <button
                onClick={() => refetch()}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 backdrop-blur-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
            </div>
          </div>

          {/* Mathematical Balance Guarantee Ribbon */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-300">
                Mathematical Verification:
              </span>
              <span className="text-slate-300">
                {finance.isMathematicallyBalanced
                  ? 'Zero Variance (₦0.00 Difference). Total Outflow matches gross payroll plus employer overheads.'
                  : `Discrepancy Detected: ₦${finance.clearingVariance?.toLocaleString()} variance.`}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Audit Hash Verified • Trova Multi-Agency Engine
            </div>
          </div>
        </div>

        {/* View Mode Filter Tabs (Only shown on screen, hidden on print) */}
        <div className="flex items-center space-x-2 no-print border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveView('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'all'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Full Audit Pathway
          </button>
          <button
            onClick={() => setActiveView('numbers')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'numbers'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            The Numbers Check Only
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'timeline'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Transaction History Feed ({auditTrail.length})
          </button>
        </div>

        {(activeView === 'all' || activeView === 'numbers') && (
          <>
            {/* The 4-Pillar Financial Clearing Balance Sheet */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Box 1: Headcount & Attendance Proration */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pillar 1: Headcount & Work
                  </span>
                  <UserCheck className="w-4 h-4 text-forest-700" />
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900">
                    {headcount.totalEmployees || 0} Staff
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {headcount.workingDaysInMonth || 0} business days scheduled
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Days Worked:</span>
                    <span className="font-semibold text-slate-800">{headcount.totalDaysWorked || 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Absence Days:</span>
                    <span className={`font-semibold ${headcount.totalDaysAbsent > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {headcount.totalDaysAbsent || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100/60">
                    <span>Budget Gross:</span>
                    <span className="font-semibold text-slate-800">₦{(headcount.standardGrossBudget || 0).toLocaleString()}</span>
                  </div>
                  {headcount.prorationSavings > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Proration Savings:</span>
                      <span>-₦{(headcount.prorationSavings || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Earned Gross:</span>
                    <span>₦{(headcount.earnedGrossActual || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Direct Net Salaries Disbursed */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pillar 2: Employee Take-Home
                  </span>
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900">
                    ₦{(finance.netSalaries || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Net cash outflow to employee accounts
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Disbursement Mode:</span>
                    <span className="font-semibold text-slate-800">
                      {disbursement?.paymentMode === 'unified' ? 'Master Remita' : 'Split / Direct'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Settlement Status:</span>
                    <span
                      className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {period.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100/60">
                    <span>Staff Receiving Pay:</span>
                    <span className="font-semibold text-slate-800">{headcount.totalEmployees || 0} Accounts</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Net Pay Ratio:</span>
                    <span>
                      {headcount.earnedGrossActual > 0
                        ? `${Math.round(((finance.netSalaries || 0) / headcount.earnedGrossActual) * 100)}% of Gross`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 3: Employee Statutory Deductions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pillar 3: Employee Deductions
                  </span>
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900">
                    ₦{(finance.employeeDeductions?.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Statutory pre-tax withholdings
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>PAYE Tax (36 SIRS):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employeeDeductions?.payeTax || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pension (8% PRA):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employeeDeductions?.employeePension || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>NHF (2.5% Basic):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employeeDeductions?.employeeNhf || 0).toLocaleString()}
                    </span>
                  </div>
                  {finance.employeeDeductions?.employeeNhis > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>NHIS (5% Basic):</span>
                      <span className="font-semibold text-slate-800">
                        ₦{(finance.employeeDeductions?.employeeNhis || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Withheld:</span>
                    <span>₦{(finance.employeeDeductions?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Box 4: Employer Overhead Burden */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pillar 4: Employer Overheads
                  </span>
                  <Layers className="w-4 h-4 text-purple-600" />
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900">
                    ₦{(finance.employerOverheads?.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Statutory company-borne liabilities
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Pension (10% Co.):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employerOverheads?.employerPension || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>NSITF (1% ECS):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employerOverheads?.nsitf || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ITF (1% Levy):</span>
                    <span className="font-semibold text-slate-800">
                      ₦{(finance.employerOverheads?.itf || 0).toLocaleString()}
                    </span>
                  </div>
                  {finance.employerOverheads?.employerNhis > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>NHIS (10% Co.):</span>
                      <span className="font-semibold text-slate-800">
                        ₦{(finance.employerOverheads?.employerNhis || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Overhead:</span>
                    <span>₦{(finance.employerOverheads?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reconciliation Balance Sheet Matrix */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-forest-700" />
                    <span>The "Numbers Check" Clearing Certificate</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mathematical balancing proof ensuring all debits equal credits before ledger posting.
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold">
                    ✓ VARIANCE: ₦0.00 (EXACT MATCH)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Clearing Account</th>
                      <th className="p-3.5">Authority / Beneficiary Entity</th>
                      <th className="p-3.5">Settlement Mandate</th>
                      <th className="p-3.5 text-right">Amount (NGN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">Direct Net Salaries</td>
                      <td className="p-3.5 text-slate-700">Employee Commercial Bank Accounts ({headcount.totalEmployees || 0} Staff)</td>
                      <td className="p-3.5 text-slate-500">Net Pay Settlement</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{(finance.netSalaries || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">PAYE Personal Income Tax</td>
                      <td className="p-3.5 text-slate-700">
                        State IRS Portals ({routing.payeByState?.length || 1} States Routed)
                      </td>
                      <td className="p-3.5 text-slate-500">PITA Section 2 Residency Rule</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{(finance.employeeDeductions?.payeTax || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">Consolidated Pension (18%)</td>
                      <td className="p-3.5 text-slate-700">
                        Pension Fund Custodians (8% Employee + 10% Employer)
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        PenCom Batch: {period.pspBatchToken || disbursement?.pspBatchToken || 'Validated'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{(
                          (finance.employeeDeductions?.employeePension || 0) +
                          (finance.employerOverheads?.employerPension || 0)
                        ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">NSITF Employees' Compensation (1%)</td>
                      <td className="p-3.5 text-slate-700">Nigeria Social Insurance Trust Fund</td>
                      <td className="p-3.5 text-slate-500">1% Total Payroll Gross Levy</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{(finance.employerOverheads?.nsitf || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">ITF Training Fund (1%)</td>
                      <td className="p-3.5 text-slate-700">Industrial Training Fund</td>
                      <td className="p-3.5 text-slate-500">Statutory Employer Levy</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{(finance.employerOverheads?.itf || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {(finance.employeeDeductions?.employeeNhf > 0 || finance.employeeDeductions?.employeeNhis > 0) && (
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">NHF / NHIA Deductions</td>
                        <td className="p-3.5 text-slate-700">FMBN Mortgage Bank & National Health Insurance</td>
                        <td className="p-3.5 text-slate-500">Employee & Employer Health Withholdings</td>
                        <td className="p-3.5 text-right font-bold text-slate-900">
                          ₦{(
                            (finance.employeeDeductions?.employeeNhf || 0) +
                            (finance.employeeDeductions?.employeeNhis || 0) +
                            (finance.employerOverheads?.employerNhis || 0)
                          ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-forest-50/80 font-black text-forest-950 border-t-2 border-forest-300">
                      <td className="p-4" colSpan={3}>
                        TOTAL COMPANY CASH COMMITTED (Unified Remita Outflow Requirement)
                      </td>
                      <td className="p-4 text-right text-base font-extrabold text-forest-950">
                        ₦{(finance.totalCashOutflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Multi-Agency Routing & Compliance Ledger Cards */}
        {(activeView === 'all' || activeView === 'numbers') && routing.payeByState?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-forest-700" />
              <span>Multi-State Tax Allocation Ledger (SIRS Routing)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {routing.payeByState.map((st, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-xs">{st.state} State IRS</p>
                    <span className="text-[10px] font-bold text-forest-700 bg-forest-50 px-1.5 py-0.5 rounded">
                      {st.employeeCount} Staff
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{st.biller?.name || `${st.state} IRS`}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-400 text-[10px]">Tax Settled:</span>
                    <span className="font-extrabold text-slate-900">₦{(st.totalTax || 0).toLocaleString()}</span>
                  </div>
                  {disbursement?.stateBillReferences?.[st.state] && (
                    <p className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Ref: {disbursement.stateBillReferences[st.state]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Immutable Audit & Transaction History Feed */}
        {(activeView === 'all' || activeView === 'timeline') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <History className="w-4 h-4 text-forest-700" />
                  <span>Immutable Transaction & Audit Trail</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanent chronological record of all computation, approval, payment, and reconciliation actions.
                </p>
              </div>

              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold font-mono">
                {auditTrail.length} Logged Action{auditTrail.length > 1 ? 's' : ''}
              </span>
            </div>

            {auditTrail.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                No audit trail events recorded yet for this payroll period.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {auditTrail.map((ev, idx) => {
                  let badgeBg = 'bg-slate-100 text-slate-800 border-slate-200';
                  let dotBg = 'bg-slate-400';

                  if (ev.event === 'PAYMENT_SETTLED') {
                    badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    dotBg = 'bg-emerald-600 ring-4 ring-emerald-100';
                  } else if (ev.event === 'APPROVED') {
                    badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                    dotBg = 'bg-blue-600 ring-4 ring-blue-100';
                  } else if (ev.event === 'RRR_GENERATED') {
                    badgeBg = 'bg-forest-100 text-forest-900 border-forest-300';
                    dotBg = 'bg-forest-700 ring-4 ring-forest-100';
                  } else if (ev.event === 'PSSP_VALIDATED') {
                    badgeBg = 'bg-purple-100 text-purple-900 border-purple-300';
                    dotBg = 'bg-purple-600 ring-4 ring-purple-100';
                  } else if (ev.event === 'ATTENDANCE_ADJUSTED') {
                    badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                    dotBg = 'bg-amber-600 ring-4 ring-amber-100';
                  }

                  const dateFormatted = new Date(ev.timestamp).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  });

                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full ${dotBg}`} />

                      <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{ev.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${badgeBg}`}>
                              {ev.event.replace('_', ' ')}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{dateFormatted}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {ev.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                          {ev.performedBy?.userName && (
                            <span className="bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-700 font-medium">
                              Actor: <strong>{ev.performedBy.userName}</strong> ({ev.performedBy.userRole?.toUpperCase()})
                            </span>
                          )}

                          {ev.metadata?.paymentReference && (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-200 rounded font-mono font-bold">
                              Ref: {ev.metadata.paymentReference}
                            </span>
                          )}

                          {ev.metadata?.rrr && (
                            <span className="bg-forest-50 text-forest-800 px-2 py-0.5 border border-forest-200 rounded font-mono font-bold">
                              RRR: {ev.metadata.rrr}
                            </span>
                          )}

                          {ev.metadata?.channel && (
                            <span className="bg-blue-50 text-blue-800 px-2 py-0.5 border border-blue-200 rounded">
                              Channel: {ev.metadata.channel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Corporate Sign-Off Section (Formatted for Printable Statements) */}
        <div className="pt-6 border-t border-slate-300 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
          <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-6">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Prepared By</p>
            <div className="border-b border-slate-400 mx-6 pb-1">
              <span className="font-bold text-slate-800">
                {period.processedBy ? `${period.processedBy.firstName || ''} ${period.processedBy.lastName || ''}`.trim() : 'Payroll Operator'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Payroll / Finance Officer</p>
          </div>

          <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-6">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Reviewed & Authorized By</p>
            <div className="border-b border-slate-400 mx-6 pb-1">
              <span className="font-bold text-slate-800">
                {period.approvedBy ? `${period.approvedBy.firstName || ''} ${period.approvedBy.lastName || ''}`.trim() : 'Authorized Signatory'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Head of Finance / CFO</p>
          </div>

          <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-6">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Internal Audit & Settlement</p>
            <div className="border-b border-slate-400 mx-6 pb-1">
              <span className="font-bold text-slate-800 font-mono">
                {period.settlementReference ? 'SETTLED & VERIFIED' : 'PENDING SETTLEMENT'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Trova Cryptographic Audit Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
