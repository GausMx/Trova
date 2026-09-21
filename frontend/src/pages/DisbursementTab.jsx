import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import {
  CreditCard,
  Download,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';

export default function DisbursementTab({ payrollRun, isApprovedOrPaid }) {
  const queryClient = useQueryClient();
  const [paymentMode, setPaymentMode] = useState('unified'); // 'unified' or 'split'
  const [activeSubView, setActiveSubView] = useState('remita'); // 'remita' or 'manual'
  const [copySuccess, setCopySuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // 1. Fetch Disbursement Summary & Multi-Agency Routing Metadata
  const { data: summaryRes, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['disbursementSummary', payrollRun._id],
    queryFn: async () => {
      const res = await api.get(`/disbursements/payroll/${payrollRun._id}/summary`);
      return res.data?.data;
    },
    enabled: !!payrollRun._id
  });

  // 2. RRR Generation Mutation
  const generateRrrMutation = useMutation({
    mutationFn: async (mode) => {
      const res = await api.post(`/disbursements/payroll/${payrollRun._id}/generate-rrr`, {
        paymentMode: mode
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disbursementSummary', payrollRun._id] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', payrollRun._id] });
    },
    onError: (err) => {
      setActionError(err.response?.data?.message || err.message);
    }
  });

  const summary = summaryRes?.summary || {};
  const routing = summaryRes?.routing || {};
  const existingDisbursement = summaryRes?.existingDisbursement;
  const rrrs = existingDisbursement?.rrrs || [];

  const handleCopy = (rrrText) => {
    navigator.clipboard.writeText(rrrText);
    setCopySuccess(rrrText);
    setTimeout(() => setCopySuccess(''), 3000);
  };

  const handleDownloadFile = async (url, filename) => {
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  if (isSummaryLoading) {
    return (
      <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
        <Clock className="w-8 h-8 text-forest-600 animate-spin" />
        <p className="text-sm font-medium">Loading Disbursement & Multi-Agency Routing Metadata...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary Sub-Tab Switcher: Remita Automated RRR vs Manual Bank Upload */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubView('remita')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
              activeSubView === 'remita'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-forest-700" />
            <span>Remita API Disbursement & RRR</span>
          </button>
          <button
            onClick={() => setActiveSubView('manual')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
              activeSubView === 'manual'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-slate-600" />
            <span>Alternative: Manual Bank Upload</span>
          </button>
        </div>

        {existingDisbursement && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Disbursement Status:</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                existingDisbursement.status === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : existingDisbursement.status === 'partially_paid'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {existingDisbursement.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {copySuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>RRR copied to clipboard: <strong>{copySuccess}</strong></span>
        </div>
      )}

      {activeSubView === 'remita' ? (
        <div className="space-y-6">
          {/* Total Cash Outflow Summary Banner */}
          <div className="bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forest-200">
                  Total Cash Outflow Summary
                </p>
                <h3 className="text-3xl font-extrabold mt-1 tracking-tight">
                  ₦{(summary.totalOutflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-forest-300 mt-1">
                  Unified Funding Required = Total Net Salaries (₦{(summary.netSalaries || 0).toLocaleString()}) + Total Statutory Remittances (₦{(summary.totalStatutory || 0).toLocaleString()})
                </p>
              </div>

              {!isApprovedOrPaid && (
                <div className="bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs px-3 py-2 rounded-xl backdrop-blur-sm max-w-xs">
                  ⚠️ Payroll run is in <strong>DRAFT</strong> status. Approve payroll to generate Remita RRR funding codes.
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-forest-700" />
                <span>Financial Breakdown Summary</span>
              </h4>
              <span className="text-xs text-slate-500 font-medium">Nigerian Regulatory Compliant</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Component / Authority</th>
                    <th className="p-3.5">Covered Parties</th>
                    <th className="p-3.5 text-right">Amount (NGN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">Direct Salaries</td>
                    <td className="p-3.5 font-medium text-slate-700">Net Pay Disbursement</td>
                    <td className="p-3.5 text-slate-500">All Active Employees</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₦{(summary.netSalaries || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">PAYE Tax</td>
                    <td className="p-3.5 font-medium text-slate-700">
                      State IRS ({routing.payeByState?.length || 1} States Routed)
                    </td>
                    <td className="p-3.5 text-slate-500">Employee Deductions</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₦{(summary.payeTax || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">Pension (18%)</td>
                    <td className="p-3.5 font-medium text-slate-700">
                      PFAs / PFCs ({routing.pensionByPfa?.length || 1} Registered PFAs)
                    </td>
                    <td className="p-3.5 text-slate-500">
                      8% Employee (₦{(summary.pensionBreakdown?.employeeShare || 0).toLocaleString()}) + 10% Employer (₦{(summary.pensionBreakdown?.employerShare || 0).toLocaleString()})
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₦{(summary.pension || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">NSITF (1%)</td>
                    <td className="p-3.5 font-medium text-slate-700">Nigeria Social Insurance Trust Fund</td>
                    <td className="p-3.5 text-slate-500">1% Employer Overhead Contribution</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₦{(summary.nsitf || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">ITF (1%)</td>
                    <td className="p-3.5 font-medium text-slate-700">Industrial Training Fund</td>
                    <td className="p-3.5 text-slate-500">1% Employer Overhead Levy (5+ Staff / N50M+ Turnover)</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₦{(summary.itf || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {(summary.nhf > 0 || summary.nhis > 0) && (
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">NHF / NHIS</td>
                      <td className="p-3.5 font-medium text-slate-700">FMBN / NHIA</td>
                      <td className="p-3.5 text-slate-500">Opt-in / Statutory Staff Deductions</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₦{((summary.nhf || 0) + (summary.nhis || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}

                  <tr className="bg-forest-50/60 font-extrabold text-forest-950 border-t-2 border-forest-200">
                    <td className="p-4" colSpan={3}>
                      TOTAL CASH REQUIRED (Unified RRR Funding Amount)
                    </td>
                    <td className="p-4 text-right text-base text-forest-900">
                      ₦{(summary.totalOutflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* RRR Payment Mode Selector & Generator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-forest-700" />
              <span>Cash Flow Flexibility (RRR Generation Mode)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: One-Click Master RRR */}
              <div
                onClick={() => setPaymentMode('unified')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMode === 'unified'
                    ? 'border-forest-600 bg-forest-50/40 ring-2 ring-forest-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm">Option A: Master Unified RRR</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Pay Net Salaries + All Statutory Deductions in one single master payment.
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="rrrMode"
                    checked={paymentMode === 'unified'}
                    onChange={() => setPaymentMode('unified')}
                    className="mt-1 accent-forest-700"
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Single Payment Total:</span>
                  <span className="font-bold text-slate-900">₦{(summary.totalOutflow || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Option B: Split RRRs */}
              <div
                onClick={() => setPaymentMode('split')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMode === 'split'
                    ? 'border-forest-600 bg-forest-50/40 ring-2 ring-forest-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm">Option B: Split RRRs (Salaries vs Tax)</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Pay Net Salaries today (RRR #1), and delay statutory remittances until statutory deadlines (RRR #2).
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="rrrMode"
                    checked={paymentMode === 'split'}
                    onChange={() => setPaymentMode('split')}
                    className="mt-1 accent-forest-700"
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Salaries RRR: ₦{(summary.netSalaries || 0).toLocaleString()}</span>
                  <span className="text-slate-500 font-medium">Statutory RRR: ₦{(summary.totalStatutory || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {isApprovedOrPaid && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => generateRrrMutation.mutate(paymentMode)}
                  disabled={generateRrrMutation.isPending}
                  className="px-5 py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  {generateRrrMutation.isPending ? (
                    <span>Generating Remita RRR...</span>
                  ) : (
                    <>
                      <span>Generate Remita RRR ({paymentMode === 'unified' ? 'Master' : 'Split'})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Active Generated RRR Cards */}
          {rrrs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Generated Remita Retrieval Reference (RRR) Funding Details</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rrrs.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-forest-100 text-forest-800">
                        {item.category.replace('_', ' ')} RRR
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 font-medium">{item.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xl font-extrabold text-slate-900 font-mono">{item.rrr}</span>
                        <button
                          onClick={() => handleCopy(item.rrr)}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Copy RRR"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">Amount Required</p>
                        <p className="font-bold text-slate-800">₦{(item.amount || 0).toLocaleString()}</p>
                      </div>

                      {item.beneficiaryDetails?.paymentUrl && (
                        <a
                          href={item.beneficiaryDetails.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-forest-700 hover:bg-forest-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1"
                        >
                          <span>Pay via Remita</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dual-Track Bridge: Download Compliance Schedules Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-forest-700" />
                  <span>The "Dual-Track" Bridge: Download Regulatory Compliance Schedules</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Remita moves the money, but agencies require data schedules! Download pre-formatted statutory schedule files for direct upload to TaxPro Max and PenCom.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <button
                onClick={() =>
                  handleDownloadFile(
                    `/disbursements/payroll/${payrollRun._id}/schedules/taxpro-max`,
                    `taxpro_max_paye_${payrollRun.month}_${payrollRun.year}.csv`
                  )
                }
                className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">TaxPro Max PAYE CSV</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">FIRS & State e-Tax Portal</p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleDownloadFile(
                    `/disbursements/payroll/${payrollRun._id}/schedules/pencom`,
                    `pencom_pension_schedule_${payrollRun.month}_${payrollRun.year}.xlsx`
                  )
                }
                className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">PenCom Pension Excel</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">PFA & PFC Portals (8%+10%)</p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleDownloadFile(
                    `/disbursements/payroll/${payrollRun._id}/schedules/nsitf`,
                    `nsitf_ecs_schedule_${payrollRun.month}_${payrollRun.year}.csv`
                  )
                }
                className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">NSITF 1% ECS CSV</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">NSITF Portal Upload</p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleDownloadFile(
                    `/disbursements/payroll/${payrollRun._id}/schedules/nhf`,
                    `nhf_fmbn_schedule_${payrollRun.month}_${payrollRun.year}.csv`
                  )
                }
                className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">FMBN NHF 2.5% CSV</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Federal Mortgage Bank</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Alternative: Manual Commercial Bank Upload Fallback View */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <span>Alternative: Commercial Bank Bulk Payment Exports</span>
            </h4>
            <p className="text-xs text-slate-500">
              For employers using traditional corporate banking web portals (GTBank, Zenith, Access, First Bank, UBA, etc.) instead of automated Remita RRR.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-800 text-xs">Standard NIBSS / CBN Format Payment Files</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Contains Account Number, Beneficiary Name, Bank Name, Bank Code, Net Amount, and Narration.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    handleDownloadFile(
                      `/payroll/${payrollRun._id}/payment-file/excel`,
                      `trova-salary-${payrollRun.month}-${payrollRun.year}.xlsx`
                    )
                  }
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() =>
                    handleDownloadFile(
                      `/payroll/${payrollRun._id}/payment-file/csv`,
                      `trova-salary-${payrollRun.month}-${payrollRun.year}.csv`
                    )
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
