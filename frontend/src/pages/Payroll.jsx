import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { CreditCard, Calendar, Plus, ChevronRight, CheckCircle, Wallet, Download, Upload, Save, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function Payroll() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [detailsTab, setDetailsTab] = useState('breakdown'); // 'breakdown' or 'attendance'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [isCsvUploading, setIsCsvUploading] = useState(false);

  // Manual attendance edits state
  const [attendanceEdits, setAttendanceEdits] = useState({});

  const canCompute = ['owner', 'admin', 'finance'].includes(user?.role);
  const canApprove = ['owner', 'admin', 'finance'].includes(user?.role);
  const canPay = ['owner', 'finance'].includes(user?.role);

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
                    <button
                      onClick={() => approveMutation.mutate(selectedRunDetails._id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve Run</span>
                    </button>
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
              </div>

              {/* Sub-tab: Compensation Breakdown */}
              {detailsTab === 'breakdown' && (
                <div className="space-y-3">
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
                            <th className="px-4 py-3 text-forest-700">Net Pay</th>
                            <th className="px-4 py-3 text-right">Payslip</th>
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
                              <td className="px-4 py-3 font-semibold text-forest-700">₦{Number(record.netSalary).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleDownloadPayslip(selectedRunDetails._id, record.employeeId, record.name)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-forest-50 text-forest-700 rounded hover:bg-forest-100 font-medium transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>PDF</span>
                                </button>
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
              {detailsTab === 'attendance' && (
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
    </div>
  );
}
