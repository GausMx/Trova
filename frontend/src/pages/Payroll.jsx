import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { CreditCard, Calendar, Plus, ChevronRight, CheckCircle, Wallet, Download, Upload, Save, AlertCircle, FileText, CheckCircle2, Lock } from 'lucide-react';

export default function Payroll() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const hasFeature = useAuthStore((state) => state.hasFeature);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [detailsTab, setDetailsTab] = useState('breakdown'); // 'breakdown' or 'attendance'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [isCsvUploading, setIsCsvUploading] = useState(false);

  // Manual attendance edits state
  const [attendanceEdits, setAttendanceEdits] = useState({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Compliance preview modal states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const [modStateOfWork, setModStateOfWork] = useState('Lagos');
  const [modNhfOptIn, setModNhfOptIn] = useState(false);
  const [modNhisOptIn, setModNhisOptIn] = useState(false);
  const [modPfaName, setModPfaName] = useState('');
  const [modPensionPin, setModPensionPin] = useState('');
  const [modAnnualRent, setModAnnualRent] = useState(0);
  const [modLifeIns, setModLifeIns] = useState(0);

  const handleOpenPreview = (record) => {
    setPreviewRecord(record);
    const emp = record.employeeId || {};
    setModStateOfWork(emp.stateOfWork || 'Lagos');
    setModNhfOptIn(emp.nhfOptIn !== undefined ? !!emp.nhfOptIn : false);
    setModNhisOptIn(emp.nhisOptIn !== undefined ? !!emp.nhisOptIn : false);
    setModPfaName(emp.pfaName || '');
    setModPensionPin(emp.pensionPin || '');
    setModAnnualRent(emp.annualRentPaid || 0);
    setModLifeIns(emp.annualLifeInsurance || 0);
    setIsPreviewOpen(true);
  };

  const handleSaveAndRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const empId = previewRecord.employeeId?._id || previewRecord.employeeId;
      // 1. Update employee compliance details
      await api.put(`/employees/${empId}`, {
        stateOfWork: modStateOfWork,
        nhfOptIn: modNhfOptIn,
        nhisOptIn: modNhisOptIn,
        pfaName: modPfaName,
        pensionPin: modPensionPin,
        annualRentPaid: Number(modAnnualRent),
        annualLifeInsurance: Number(modLifeIns)
      });

      // 2. Trigger payroll compute to recalculate draft
      await api.post('/payroll/compute', {
        month: selectedRunDetails.month,
        year: selectedRunDetails.year
      });

      // 3. Refresh data
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      
      setSuccessMsg('Employee compliance updated and payroll recalculated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsPreviewOpen(false);
    } catch (err) {
      alert(`Recalculation failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  const getLivePreview = () => {
    if (!previewRecord) return null;
    const basic = previewRecord.basicSalary || 0;
    const housing = previewRecord.housingAllowance || 0;
    const transport = previewRecord.transportAllowance || 0;
    const other = previewRecord.otherAllowances || 0;
    const gross = basic + housing + transport + other;
    const annualGross = gross * 12;

    const empPension = (basic + housing + transport) * 0.08;
    const empNhf = modNhfOptIn ? (basic * 0.025) : 0;
    
    // Check if company has >= 10 employees
    const empCount = selectedRunDetails.employees?.length || 0;
    const empNhis = (modNhisOptIn && empCount >= 10) ? (basic * 0.05) : 0;
    
    const rentRelief = Math.min(modAnnualRent * 0.20, 500000);
    const lifeIns = Number(modLifeIns) || 0;

    const totalReliefs = (empPension * 12) + (empNhf * 12) + (empNhis * 12) + rentRelief + lifeIns;
    const taxable = Math.max(0, annualGross - totalReliefs);

    // 2026 progressive bands
    const taxBands = [
      { limit: 800000, rate: 0.00 },
      { limit: 2200000, rate: 0.15 },
      { limit: 9000000, rate: 0.18 },
      { limit: 13000000, rate: 0.21 },
      { limit: 25000000, rate: 0.23 },
      { limit: Infinity, rate: 0.25 }
    ];

    let remaining = taxable;
    let annualTax = 0;
    for (const band of taxBands) {
      if (remaining <= 0) break;
      const amountInBand = Math.min(remaining, band.limit);
      annualTax += amountInBand * band.rate;
      remaining -= amountInBand;
    }

    const monthlyTax = annualTax / 12;
    const net = gross - (empPension + empNhf + empNhis + monthlyTax);

    // Employer Overhead
    const employerPension = (basic + housing + transport) * 0.10;
    const employerNhis = (modNhisOptIn && empCount >= 10) ? (basic * 0.10) : 0;
    const nsitf = gross * 0.01;
    const itf = (empCount >= 5 || annualGross > 50000) ? (gross * 0.01) : 0;

    return {
      gross,
      empPension,
      empNhf,
      empNhis,
      rentRelief: rentRelief / 12,
      lifeIns: lifeIns / 12,
      totalReliefs: totalReliefs / 12,
      taxable: taxable / 12,
      tax: monthlyTax,
      net,
      employerPension,
      employerNhis,
      nsitf,
      itf
    };
  };

  const canCompute = ['owner', 'admin', 'finance'].includes(user?.role);
  const canApprove = ['owner', 'admin', 'finance'].includes(user?.role);
  const canPay = ['owner', 'finance'].includes(user?.role);
  const canDownload = ['owner', 'admin', 'finance'].includes(user?.role);

  // 1. Fetch payroll history list
  const { data: runsRes, isLoading } = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: () => api.get('/payroll').then((res) => res.data),
  });

  // 2. Fetch specific payroll run details
  const { data: selectedRunRes, isLoading: loadingDetails } = useQuery({
    queryKey: ['payrollRunDetails', selectedRunId],
    queryFn: () => api.get(`/payroll/${selectedRunId}`).then((res) => res.data),
    enabled: !!selectedRunId,
  });

  // 3. Compute new payroll mutation
  const computeMutation = useMutation({
    mutationFn: (payload) => api.post('/payroll/compute', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      setSelectedRunId(res.data.data.run._id);
      setErrorMsg('');
      setAttendanceEdits({});
      setSuccessMsg('Payroll run draft computed successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to compute payroll. Ensure employees exist.');
    },
  });

  // 4. Approve payroll mutation
  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/payroll/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
      setSuccessMsg('Payroll run approved successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
  });

  // 5. Pay payroll mutation
  const payMutation = useMutation({
    mutationFn: (id) => api.post(`/payroll/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
      setSuccessMsg('Payroll processed as paid successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
  });

  const { register, handleSubmit } = useForm({
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
  });

  const onCompute = (data) => {
    computeMutation.mutate({
      month: Number(data.month),
      year: Number(data.year),
    });
  };

  const handleDownloadPayslip = async (runId, employeeId, name) => {
    try {
      const response = await api.get(`/payroll/${runId}/payslip/${employeeId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let errMsg = err.message;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch (_) {}
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      alert(`Unable to generate payslip PDF: ${errMsg}`);
    }
  };

  const handleDownloadAllPayslips = async (runDetails) => {
    if (!runDetails || !runDetails.employees || runDetails.employees.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (const record of runDetails.employees) {
        await handleDownloadPayslip(runDetails._id, record.employeeId, record.name);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleAttendanceChange = (employeeId, field, val) => {
    const parsedVal = val === '' ? 0 : Number(val);
    setAttendanceEdits(prev => {
      const current = prev[employeeId] || {
        employeeId,
        daysAbsent: 0,
        halfDays: 0
      };
      return {
        ...prev,
        [employeeId]: {
          ...current,
          [field]: parsedVal
        }
      };
    });
  };

  const handleSaveAttendance = async () => {
    const updates = Object.values(attendanceEdits);
    if (updates.length === 0) return;
    
    try {
      const res = await api.post(`/payroll/${selectedRunId}/attendance`, { attendance: updates });
      if (res.data.success) {
        queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
        queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
        setAttendanceEdits({});
        setSuccessMsg('Attendance updated and payroll figures recalculated.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(`Failed to save attendance updates: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsCsvUploading(true);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.post(`/payroll/${selectedRunId}/attendance/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
        queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
        setCsvFile(null);
        const stats = res.data.data.summary;
        setSuccessMsg(`CSV uploaded successfully! Updated: ${stats.updated.length} employee records. Errors: ${stats.errors.length}.`);
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      alert(`Failed to upload attendance CSV: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsCsvUploading(false);
    }
  };

  const runs = runsRes?.data?.runs || [];
  const selectedRunDetails = selectedRunRes?.data?.run;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payroll & Attendance Workspace</h2>
          <p className="text-slate-500 text-sm mt-0.5">Calculate monthly salaries, record absences, review proration percentages, and print payslips</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center space-x-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-750 rounded-lg text-sm flex items-center space-x-2 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Compute Form & Run History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Compute Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
          <h3 className="font-bold text-slate-800 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-forest-700" />
            <span>Run New Payroll</span>
          </h3>

          {canCompute ? (
            <form onSubmit={handleSubmit(onCompute)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Month</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                  {...register('month')}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                  {...register('year')}
                />
              </div>

              <button
                type="submit"
                disabled={computeMutation.isPending}
                className="w-full py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{computeMutation.isPending ? 'Computing...' : 'Calculate Draft'}</span>
              </button>
            </form>
          ) : (
            <p className="text-slate-400 text-xs leading-relaxed">
              Subscription payroll calculation rights are restricted to the Company Owner, Admins, and Finance Manager roles.
            </p>
          )}
        </div>

        {/* Right Side: History List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[300px]">
          <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Payroll History</h3>

          {isLoading ? (
            <div className="text-slate-500 text-sm py-4">Loading history...</div>
          ) : runs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <CreditCard className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-medium">No payroll runs recorded</p>
              <p className="text-xs text-slate-400 mt-1">Compute a month above to start.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
              {runs.map((run) => (
                <div
                  key={run._id}
                  onClick={() => {
                    setSelectedRunId(run._id);
                    setAttendanceEdits({});
                  }}
                  className={`py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 px-2 rounded-xl transition-colors ${
                    selectedRunId === run._id ? 'bg-forest-50/50 hover:bg-forest-50' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800">
                      Payroll {new Date(2000, run.month - 1).toLocaleString('default', { month: 'long' })} {run.year}
                    </p>
                    <div className="flex items-center space-x-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px] ${
                          run.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                            : run.status === 'approved'
                            ? 'bg-amber-50 text-amber-750 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-bold text-slate-800">₦{Number(run.totals?.net || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Payouts</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Section for Selected Run */}
      {selectedRunId && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {loadingDetails ? (
            <div className="text-slate-500 text-sm py-4">Fetching run details...</div>
          ) : !selectedRunDetails ? (
            <div className="text-slate-500 text-sm py-4">Failed to fetch run details.</div>
          ) : (
            <>
              {/* Summary banner & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">
                    Payroll Run Details — {new Date(2000, selectedRunDetails.month - 1).toLocaleString('default', { month: 'long' })} {selectedRunDetails.year}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Status: <span className="capitalize font-bold text-forest-800">{selectedRunDetails.status}</span>
                  </p>
                </div>

                {/* Workflow buttons */}
                <div className="flex items-center space-x-3">
                  {selectedRunDetails.status === 'draft' && canApprove && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setSuccessMsg('Recalculating payroll figures...');
                            await api.post('/payroll/compute', {
                              month: selectedRunDetails.month,
                              year: selectedRunDetails.year
                            });
                            queryClient.invalidateQueries({ queryKey: ['payrollRunDetails', selectedRunId] });
                            queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
                            setSuccessMsg('Payroll run recalculated successfully.');
                            setTimeout(() => setSuccessMsg(''), 4000);
                          } catch (err) {
                            setErrorMsg(err.response?.data?.message || 'Failed to recalculate payroll.');
                            setTimeout(() => setErrorMsg(''), 4000);
                          }
                        }}
                        className="flex items-center space-x-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                      >
                        <Save className="w-4 h-4 text-forest-800" />
                        <span>Recalculate Run</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(selectedRunDetails._id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve Run</span>
                      </button>
                    </div>
                  )}

                  {selectedRunDetails.status === 'approved' && canPay && (
                    <button
                      onClick={() => payMutation.mutate(selectedRunDetails._id)}
                      disabled={payMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Process Payouts</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Totals panel */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gross Payroll</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">₦{Number(selectedRunDetails.totals?.gross || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PAYE Tax Deductions</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5 text-rose-700">₦{Number(selectedRunDetails.totals?.tax || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pension Deductions</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5 text-rose-700">₦{Number(selectedRunDetails.totals?.pension || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Payouts</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5 text-forest-700">₦{Number(selectedRunDetails.totals?.net || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Bulk Payment File Download Section */}
              {hasFeature('bulk_payment_file') && (selectedRunDetails.status === 'approved' || selectedRunDetails.status === 'paid') && canDownload && (() => {
                const missingDetailsEmployees = selectedRunDetails.employees?.filter(
                  pe => pe.employeeStatus === 'active' && (!pe.accountNumber || !pe.bankName)
                ) || [];

                const handleDownload = (format) => {
                  const ext = format === 'excel' ? 'xlsx' : 'csv';
                  const mimeType = format === 'excel' 
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                    : 'text/csv';
                  const filename = `trova-salary-${selectedRunDetails.month}-${selectedRunDetails.year}.${ext}`;
                  api.get(`/payroll/${selectedRunDetails._id}/payment-file/${format}`, { responseType: 'blob' })
                    .then(response => {
                      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
                      const link = document.createElement('a');
                      link.href = url;
                      const disposition = response.headers['content-disposition'];
                      let matchFilename = filename;
                      if (disposition && disposition.indexOf('attachment') !== -1) {
                        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                        const matches = filenameRegex.exec(disposition);
                        if (matches != null && matches[1]) { 
                          matchFilename = matches[1].replace(/['"]/g, '');
                        }
                      }
                      link.setAttribute('download', matchFilename);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    })
                    .catch(err => {
                      setErrorMsg(err.response?.data?.message || 'Failed to download payment file.');
                    });
                };

                return (
                  <div className="space-y-4 border border-slate-200 bg-slate-50/30 p-5 rounded-2xl">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Download Payment Files</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Upload this file to your corporate internet banking portal to pay all employees in one transaction. Supported by GTBank, Access, Zenith, First Bank, UBA, and most Nigerian banks.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleDownload('csv')}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all hover:shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download CSV</span>
                      </button>

                      <button
                        onClick={() => handleDownload('excel')}
                        className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-350 hover:bg-slate-100 text-slate-700 bg-white rounded-lg text-sm font-semibold transition-all hover:shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Excel</span>
                      </button>
                    </div>

                    {missingDetailsEmployees.length > 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                        <p className="font-semibold flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1.5 text-amber-700 shrink-0" />
                          <span>
                            ⚠️ {missingDetailsEmployees.length} employee{missingDetailsEmployees.length > 1 ? 's are' : ' is'} missing bank details and will not appear in the payment file. Update their profiles before downloading.
                          </span>
                        </p>
                        <div className="pl-5 flex flex-wrap gap-x-2 gap-y-1">
                          {missingDetailsEmployees.map((emp, idx) => (
                            <React.Fragment key={emp.employeeId}>
                              <Link
                                to={`/employees?edit=${emp.employeeId}`}
                                className="underline font-semibold hover:text-amber-950 transition-colors"
                              >
                                {emp.name}
                              </Link>
                              {idx < missingDetailsEmployees.length - 1 && <span className="mx-1 text-amber-300">•</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sub-tab selection */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setDetailsTab('breakdown')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                    detailsTab === 'breakdown'
                      ? 'border-forest-800 text-forest-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Compensation Breakdown</span>
                  </span>
                </button>
                {hasFeature('attendance_proration') && (
                  <button
                    onClick={() => setDetailsTab('attendance')}
                    className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                      detailsTab === 'attendance'
                        ? 'border-forest-800 text-forest-800'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <Upload className="w-4 h-4" />
                      <span>Attendance & Proration Sheet</span>
                    </span>
                  </button>
                )}
              </div>

              {/* Sub-tab: Compensation Breakdown */}
              {detailsTab === 'breakdown' && (
                <div className="space-y-3">
                  {hasFeature('pdf_payslips') && selectedRunDetails.employees?.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDownloadAllPayslips(selectedRunDetails)}
                        disabled={isDownloadingAll}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isDownloadingAll ? 'Downloading...' : 'Download All Payslips'}</span>
                      </button>
                    </div>
                  )}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Gross Salary</th>
                            <th className="px-4 py-3 text-rose-600">PAYE Tax</th>
                            <th className="px-4 py-3 text-rose-600">Pension</th>
                            <th className="px-4 py-3 text-rose-600">NHF</th>
                            <th className="px-4 py-3 text-rose-600">NHIS</th>
                            <th className="px-4 py-3 text-forest-700">Net Pay</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRunDetails.employees?.map((record) => (
                            <tr key={record.employeeId} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                <p>{record.name}</p>
                                {record.workingDaysInMonth > 0 && record.daysWorked < record.workingDaysInMonth && (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded font-bold uppercase tracking-wide">Prorated</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold">₦{Number(record.proratedGross !== undefined ? record.proratedGross : record.grossSalary).toLocaleString()}</p>
                                {record.workingDaysInMonth > 0 && record.daysWorked < record.workingDaysInMonth && (
                                  <span className="text-[9px] text-slate-400 block">Base: ₦{Number(record.grossSalary).toLocaleString()}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-rose-700">₦{Number(record.taxDeduction || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-rose-700">₦{Number(record.pensionDeduction || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-rose-700">₦{Number(record.nhfDeduction || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-rose-700">₦{Number(record.nhisDeduction || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 font-semibold text-forest-700">₦{Number(record.netSalary).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleOpenPreview(record)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors border border-slate-200"
                                >
                                  <span>{selectedRunDetails.status === 'draft' ? 'Review & Adjust' : 'View Details'}</span>
                                </button>
                                {hasFeature('pdf_payslips') ? (
                                  <button
                                    onClick={() => handleDownloadPayslip(selectedRunDetails._id, record.employeeId?._id || record.employeeId, record.name)}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-forest-50 text-forest-700 rounded hover:bg-forest-100 font-medium transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>PDF</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold flex items-center justify-end space-x-1">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Locked</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab: Attendance Sheet & Proration */}
              {hasFeature('attendance_proration') && detailsTab === 'attendance' && (
                <div className="space-y-4">
                  {/* CSV Upload & Manual Save Action Header */}
                  {selectedRunDetails.status === 'draft' && canCompute && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      {/* CSV upload form */}
                      <form onSubmit={handleCsvUpload} className="flex items-center space-x-2">
                        <label className="flex items-center space-x-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-650 hover:bg-slate-50 cursor-pointer shadow-sm">
                          <Upload className="w-3.5 h-3.5 text-forest-800" />
                          <span>{csvFile ? csvFile.name : 'Select Attendance CSV'}</span>
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => setCsvFile(e.target.files[0])}
                          />
                        </label>
                        {csvFile && (
                          <button
                            type="submit"
                            disabled={isCsvUploading}
                            className="px-3 py-1.5 bg-forest-900 text-white text-xs font-semibold rounded-lg hover:bg-forest-800 transition-all shadow-sm"
                          >
                            {isCsvUploading ? 'Uploading...' : 'Upload'}
                          </button>
                        )}
                      </form>

                      {/* Manual update save */}
                      {Object.keys(attendanceEdits).length > 0 && (
                        <button
                          onClick={handleSaveAttendance}
                          className="flex items-center space-x-1 px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Manual Changes ({Object.keys(attendanceEdits).length})</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Working Days in Month</th>
                            <th className="px-4 py-3 text-rose-600">Days Absent</th>
                            <th className="px-4 py-3 text-orange-600">Half Days</th>
                            <th className="px-4 py-3 text-forest-750">Days Worked</th>
                            <th className="px-4 py-3">Earned Gross Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRunDetails.employees?.map((record) => {
                            const isDraft = selectedRunDetails.status === 'draft';
                            const edits = attendanceEdits[record.employeeId] || {};
                            const daysAbsentVal = edits.daysAbsent !== undefined ? edits.daysAbsent : record.daysAbsent;
                            const halfDaysVal = edits.halfDays !== undefined ? edits.halfDays : record.halfDays;

                            const computedWorked = Math.max(0, record.workingDaysInMonth - daysAbsentVal - (halfDaysVal * 0.5));
                            const computedRate = record.workingDaysInMonth > 0 
                              ? Math.round((computedWorked / record.workingDaysInMonth) * 100) 
                              : 100;

                            return (
                              <tr key={record.employeeId} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-3 font-semibold text-slate-800">
                                  <p>{record.name}</p>
                                  <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{record.staffId}</span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-500">
                                  {record.workingDaysInMonth} Days
                                </td>
                                <td className="px-4 py-2">
                                  {isDraft && canCompute ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={record.workingDaysInMonth}
                                      value={daysAbsentVal}
                                      className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-forest-100 focus:outline-none"
                                      onChange={(e) => handleAttendanceChange(record.employeeId, 'daysAbsent', e.target.value)}
                                    />
                                  ) : (
                                    <span>{record.daysAbsent} Days</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {isDraft && canCompute ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={record.workingDaysInMonth * 2}
                                      value={halfDaysVal}
                                      className="w-16 px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-forest-100 focus:outline-none"
                                      onChange={(e) => handleAttendanceChange(record.employeeId, 'halfDays', e.target.value)}
                                    />
                                  ) : (
                                    <span>{record.halfDays} Days</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800">
                                  {isDraft ? computedWorked : record.daysWorked} Days
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    computedRate < 100 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {computedRate}% Rate
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* Compliance Review Modal */}
      {isPreviewOpen && previewRecord && (() => {
        const live = getLivePreview();
        const isDraft = selectedRunDetails.status === 'draft';
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
              
              {/* Left Column: Form Settings */}
              <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-h-[45vh] md:max-h-[90vh] border-b md:border-b-0 md:border-r border-slate-100">
                <div>
                  <span className="px-2 py-0.5 bg-forest-50 text-forest-750 border border-forest-100 text-[10px] font-bold uppercase rounded-md tracking-wider">
                    {isDraft ? 'Draft Stage' : 'Finalized'}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-800 mt-2">Compliance Review</h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">Adjust employee-specific reliefs & voluntary deductions</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1">State of Work (SIRS Jurisdiction)</label>
                    <select
                      disabled={!isDraft || isRecalculating}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-forest-100"
                      value={modStateOfWork}
                      onChange={(e) => setModStateOfWork(e.target.value)}
                    >
                      <option value="Lagos">Lagos (LIRS)</option>
                      <option value="FCT">Abuja (FCT-IRS)</option>
                      <option value="Rivers">Rivers (RIRS)</option>
                      <option value="Oyo">Oyo (OYIRS)</option>
                      <option value="Kano">Kano (KIRS)</option>
                      <option value="Kaduna">Kaduna (KADIRS)</option>
                      <option value="Ogun">Ogun (OGIRS)</option>
                      <option value="Delta">Delta (DIRS)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 mb-1">Pension PFA</label>
                      <input
                        type="text"
                        disabled={!isDraft || isRecalculating}
                        placeholder="PFA Name"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-forest-100"
                        value={modPfaName}
                        onChange={(e) => setModPfaName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 mb-1">Pension PIN</label>
                      <input
                        type="text"
                        disabled={!isDraft || isRecalculating}
                        placeholder="Pension PIN"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-forest-100"
                        value={modPensionPin}
                        onChange={(e) => setModPensionPin(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 mb-1">Annual Rent Paid (₦)</label>
                      <input
                        type="number"
                        disabled={!isDraft || isRecalculating}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-forest-100"
                        value={modAnnualRent}
                        onChange={(e) => setModAnnualRent(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 mb-1">Annual Life Insurance (₦)</label>
                      <input
                        type="number"
                        disabled={!isDraft || isRecalculating}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-forest-100"
                        value={modLifeIns}
                        onChange={(e) => setModLifeIns(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        id="modalNhf"
                        disabled={!isDraft || isRecalculating}
                        className="rounded text-forest-900 focus:ring-forest-800 h-4.5 w-4.5"
                        checked={modNhfOptIn}
                        onChange={(e) => setModNhfOptIn(e.target.checked)}
                      />
                      <label htmlFor="modalNhf" className="text-xs font-semibold text-slate-700">
                        Opt-in to Voluntary NHF (2.5% basic)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        id="modalNhis"
                        disabled={!isDraft || isRecalculating}
                        className="rounded text-forest-900 focus:ring-forest-800 h-4.5 w-4.5"
                        checked={modNhisOptIn}
                        onChange={(e) => setModNhisOptIn(e.target.checked)}
                      />
                      <label htmlFor="modalNhis" className="text-xs font-semibold text-slate-700">
                        Opt-in to NHIS (5% basic)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                  >
                    Close
                  </button>
                  {isDraft && (
                    <button
                      onClick={handleSaveAndRecalculate}
                      disabled={isRecalculating}
                      className="flex-1 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <span>{isRecalculating ? 'Recalculating...' : 'Save & Re-calculate'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Live Premium Summary */}
              <div className="flex-1 bg-slate-900 text-white p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-[90vh]">
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-white/5 pb-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Employee Name</p>
                      <h4 className="font-extrabold text-base text-white mt-0.5">{previewRecord.name}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gross Base</p>
                      <p className="font-extrabold text-sm text-emerald-400 mt-0.5">₦{Math.round(live.gross).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1">Monthly Deductions & Reliefs</p>
                    
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Pension Contribution (8% B+H+T)</span>
                      <span className="font-semibold text-rose-400">- ₦{Math.round(live.empPension).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">NHF Deduction (2.5% basic)</span>
                      <span className="font-semibold text-rose-450">
                        {live.empNhf > 0 ? `- ₦${Math.round(live.empNhf).toLocaleString()}` : 'Opted Out'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">NHIS Deduction (5% basic)</span>
                      <span className="font-semibold text-rose-450">
                        {live.empNhis > 0 ? `- ₦${Math.round(live.empNhis).toLocaleString()}` : 'Opted Out'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Rent Relief (20% rent, max ₦500k/yr)</span>
                      <span className="font-semibold text-emerald-400">₦{Math.round(live.rentRelief).toLocaleString()}/mo</span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-slate-400">Life Insurance premium</span>
                      <span className="font-semibold text-emerald-400">₦{Math.round(live.lifeIns).toLocaleString()}/mo</span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2 font-mono text-[11px]">
                      <span className="text-slate-400">Monthly Taxable Income</span>
                      <span className="font-semibold text-white">₦{Math.round(live.taxable).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-2 font-bold">
                      <span className="text-slate-400 text-rose-300">PAYE Tax Liability (2026 Bands)</span>
                      <span className="font-semibold text-rose-400">- ₦{Math.round(live.tax).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] bg-white/5 p-3 rounded-xl border border-white/5 mt-4">
                    <p className="font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-1">Employer-Paid Overheads (Out-of-Pocket)</p>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pension Match (10% emoluments):</span>
                      <span className="font-semibold text-slate-200">₦{Math.round(live.employerPension).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NHIS Match (10% basic):</span>
                      <span className="font-semibold text-slate-200">
                        {live.employerNhis > 0 ? `₦${Math.round(live.employerNhis).toLocaleString()}` : '₦0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NSITF (1% monthly gross):</span>
                      <span className="font-semibold text-slate-200">₦{Math.round(live.nsitf).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ITF (1% annual payroll rate):</span>
                      <span className="font-semibold text-slate-200">₦{Math.round(live.itf).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Estimated Net Take-home</span>
                    <span className="text-[10px] text-slate-455">Gross - (pension + NHF + NHIS + Tax)</span>
                  </div>
                  <span className="text-xl font-extrabold text-emerald-350 font-mono">
                    ₦{Math.round(live.net).toLocaleString()}
                  </span>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
