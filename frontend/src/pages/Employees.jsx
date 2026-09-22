import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, X, Trash2, CheckCircle2, UserCheck, RotateCcw, AlertTriangle, Layers, Edit2, Lock } from 'lucide-react';

// 36 Nigerian States + FCT (Abuja) for SIRS PAYE Tax Jurisdiction Routing
const ALL_NIGERIAN_STATES = [
  { code: 'Abia', label: 'Abia (ABIRS)' },
  { code: 'Adamawa', label: 'Adamawa (ADIRS)' },
  { code: 'Akwa Ibom', label: 'Akwa Ibom (AKIRS)' },
  { code: 'Anambra', label: 'Anambra (AIRS)' },
  { code: 'Bauchi', label: 'Bauchi (BASIRS)' },
  { code: 'Bayelsa', label: 'Bayelsa (BYIRS)' },
  { code: 'Benue', label: 'Benue (BIRS)' },
  { code: 'Borno', label: 'Borno (BOIRS)' },
  { code: 'Cross River', label: 'Cross River (CRIRS)' },
  { code: 'Delta', label: 'Delta (DBIR)' },
  { code: 'Ebonyi', label: 'Ebonyi (EBSIRS)' },
  { code: 'Edo', label: 'Edo (EIRS)' },
  { code: 'Ekiti', label: 'Ekiti (EKIRS)' },
  { code: 'Enugu', label: 'Enugu (ESIRS)' },
  { code: 'FCT', label: 'Abuja (FCT-IRS)' },
  { code: 'Gombe', label: 'Gombe (GROIRS)' },
  { code: 'Imo', label: 'Imo (IIRS)' },
  { code: 'Jigawa', label: 'Jigawa (JIRS)' },
  { code: 'Kaduna', label: 'Kaduna (KADIRS)' },
  { code: 'Kano', label: 'Kano (KIRS)' },
  { code: 'Katsina', label: 'Katsina (KATIRS)' },
  { code: 'Kebbi', label: 'Kebbi (KBIRS)' },
  { code: 'Kogi', label: 'Kogi (KGIRS)' },
  { code: 'Kwara', label: 'Kwara (KWIRS)' },
  { code: 'Lagos', label: 'Lagos (LIRS)' },
  { code: 'Nasarawa', label: 'Nasarawa (NSBIR)' },
  { code: 'Niger', label: 'Niger (NGSIRS)' },
  { code: 'Ogun', label: 'Ogun (OGIRS)' },
  { code: 'Ondo', label: 'Ondo (ODIRS)' },
  { code: 'Osun', label: 'Osun (OSIRS)' },
  { code: 'Oyo', label: 'Oyo (OYIRS)' },
  { code: 'Plateau', label: 'Plateau (PSIRS)' },
  { code: 'Rivers', label: 'Rivers (RIRS)' },
  { code: 'Sokoto', label: 'Sokoto (SOIRS)' },
  { code: 'Zamfara', label: 'Zamfara (ZIRS)' }
];

// PenCom Registered Pension Fund Administrators (PFAs)
const ALL_PFAS = [
  { name: 'Stanbic IBTC Pension Managers', code: '021' },
  { name: 'Leadway Pensure PFA', code: '001' },
  { name: 'ARM Pension Managers', code: '003' },
  { name: 'Premium Pension Limited', code: '004' },
  { name: 'FCMB Pensions Limited', code: '005' },
  { name: 'Trustfund Pensions Limited', code: '006' },
  { name: 'Access Pensions', code: '007' },
  { name: 'Tangerine APT Pensions', code: '008' },
  { name: 'NLPC PFA Limited', code: '009' },
  { name: 'Veritas Glanvills Pensions', code: '010' }
];

// Premium loader spinner for button transitions
const ConcentricSpinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default function Employees() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const hasFeature = useAuthStore((state) => state.hasFeature);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'grades'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Employee modal states
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  // Grade modal states
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isStaffManager = ['owner', 'admin', 'hr'].includes(user?.role);

  // 1. Fetch Employees
  const { data: employeesRes, isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((res) => res.data),
  });

  // 2. Fetch Salary Grades
  const { data: gradesRes, isLoading: loadingGrades } = useQuery({
    queryKey: ['grades'],
    queryFn: () => api.get('/grades').then((res) => res.data),
  });

  // Fetch Banks
  const { data: banksRes } = useQuery({
    queryKey: ['banks'],
    queryFn: () => api.get('/constants/banks').then((res) => res.data),
  });

  // 3. Create/Update Employee mutations
  const createEmpMutation = useMutation({
    mutationFn: (newEmployee) => api.post('/employees', newEmployee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails'] });
      setIsEmpModalOpen(false);
      empFormReset();
      showSuccess('Employee registered successfully.');
    },
    onError: (err) => {
      showError(err.response?.data?.message || 'Failed to register employee.');
    }
  });

  const updateEmpMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails'] });
      setIsEmpModalOpen(false);
      setEditingEmployee(null);
      empFormReset();
      showSuccess('Employee updated successfully.');
    },
    onError: (err) => {
      showError(err.response?.data?.message || 'Failed to update employee.');
    }
  });

  // 4. Reset Employee Salary Mutation
  const resetSalaryMutation = useMutation({
    mutationFn: (id) => api.put(`/employees/${id}/reset-salary`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails'] });
      showSuccess('Employee salary reset to grade figures successfully.');
    },
    onError: (err) => {
      showError(err.response?.data?.message || 'Failed to reset salary.');
    }
  });

  // 5. Delete Employee Mutation
  const deleteEmpMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showSuccess('Employee soft-deleted successfully.');
    },
  });

  // 6. Create/Update Grade mutations
  const createGradeMutation = useMutation({
    mutationFn: (newGrade) => api.post('/grades', newGrade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setIsGradeModalOpen(false);
      gradeFormReset();
      showSuccess('Salary grade created successfully.');
    },
    onError: (err) => {
      showError(err.response?.data?.message || 'Failed to create salary grade.');
    }
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/grades/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] }); // Invalidate employees since they inherit
      setIsGradeModalOpen(false);
      setEditingGrade(null);
      gradeFormReset();
      showSuccess('Salary grade updated successfully.');
    },
    onError: (err) => {
      showError(err.response?.data?.message || 'Failed to update salary grade.');
    }
  });

  const deleteGradeMutation = useMutation({
    mutationFn: (id) => api.delete(`/grades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showSuccess('Salary grade deleted successfully.');
    },
  });

  // Forms setup
  const {
    register: registerEmp,
    handleSubmit: handleEmpSubmit,
    reset: empFormReset,
    setValue: setEmpValue,
    watch: watchEmp,
    formState: { errors: empErrors },
  } = useForm();

  const {
    register: registerGrade,
    handleSubmit: handleGradeSubmit,
    reset: gradeFormReset,
    setValue: setGradeValue,
    formState: { errors: gradeErrors },
  } = useForm();

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const onEmpSubmit = (data) => {
    const formatted = {
      ...data,
      basicSalary: data.basicSalary ? Number(data.basicSalary) : undefined,
      housingAllowance: data.housingAllowance ? Number(data.housingAllowance) : undefined,
      transportAllowance: data.transportAllowance ? Number(data.transportAllowance) : undefined,
      otherAllowances: data.otherAllowances ? Number(data.otherAllowances) : undefined,
      gradeId: data.gradeId || undefined,
      nhfOptIn: !!data.nhfOptIn,
      nhisOptIn: !!data.nhisOptIn,
      annualRentPaid: data.annualRentPaid ? Number(data.annualRentPaid) : 0,
      annualLifeInsurance: data.annualLifeInsurance ? Number(data.annualLifeInsurance) : 0
    };

    if (editingEmployee) {
      updateEmpMutation.mutate({ id: editingEmployee._id, data: formatted });
    } else {
      createEmpMutation.mutate(formatted);
    }
  };

  const onGradeSubmit = (data) => {
    const formatted = {
      ...data,
      level: Number(data.level || 1),
      basicSalary: Number(data.basicSalary),
      housingAllowance: Number(data.housingAllowance || 0),
      transportAllowance: Number(data.transportAllowance || 0),
      otherAllowances: Number(data.otherAllowances || 0),
      nhfOptIn: !!data.nhfOptIn,
      nhisOptIn: !!data.nhisOptIn,
      annualRentPaid: data.annualRentPaid ? Number(data.annualRentPaid) : 0,
      annualLifeInsurance: data.annualLifeInsurance ? Number(data.annualLifeInsurance) : 0
    };

    if (editingGrade) {
      updateGradeMutation.mutate({ id: editingGrade._id, data: formatted });
    } else {
      createGradeMutation.mutate(formatted);
    }
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setEmpValue('firstName', emp.firstName);
    setEmpValue('lastName', emp.lastName);
    setEmpValue('email', emp.email || '');
    setEmpValue('phone', emp.phone || '');
    setEmpValue('basicSalary', emp.basicSalary);
    setEmpValue('housingAllowance', emp.housingAllowance);
    setEmpValue('transportAllowance', emp.transportAllowance);
    setEmpValue('otherAllowances', emp.otherAllowances);
    setEmpValue('bankName', emp.bankName || '');
    setEmpValue('bankCode', emp.bankCode || '');
    setEmpValue('accountNumber', emp.accountNumber || '');
    setEmpValue('accountName', emp.accountName || '');
    setEmpValue('gradeId', emp.gradeId?._id || emp.gradeId || '');
    setEmpValue('stateOfWork', emp.stateOfWork || 'Lagos');
    setEmpValue('nhfOptIn', !!emp.nhfOptIn);
    setEmpValue('nhisOptIn', !!emp.nhisOptIn);
    setEmpValue('pfaName', emp.pfaName || '');
    setEmpValue('pensionPin', emp.pensionPin || '');
    setEmpValue('tin', emp.tin || '');
    setEmpValue('annualRentPaid', emp.annualRentPaid || 0);
    setEmpValue('annualLifeInsurance', emp.annualLifeInsurance || 0);
    setIsEmpModalOpen(true);
  };

  const handleEditGrade = (grade) => {
    setEditingGrade(grade);
    setGradeValue('name', grade.name);
    setGradeValue('level', grade.level);
    setGradeValue('basicSalary', grade.basicSalary);
    setGradeValue('housingAllowance', grade.housingAllowance);
    setGradeValue('transportAllowance', grade.transportAllowance);
    setGradeValue('otherAllowances', grade.otherAllowances);
    setGradeValue('description', grade.description || '');
    setGradeValue('stateOfWork', grade.stateOfWork || 'Lagos');
    setGradeValue('nhfOptIn', !!grade.nhfOptIn);
    setGradeValue('nhisOptIn', !!grade.nhisOptIn);
    setGradeValue('pfaName', grade.pfaName || '');
    setGradeValue('annualRentPaid', grade.annualRentPaid || 0);
    setGradeValue('annualLifeInsurance', grade.annualLifeInsurance || 0);
    setIsGradeModalOpen(true);
  };

  // Watch gradeId inside employee form to show alert or dynamically prefill if creating
  const selectedGradeId = watchEmp('gradeId');
  const grades = gradesRes?.data?.grades || [];
  const selectedGrade = grades.find(g => g._id === selectedGradeId);

  const employees = employeesRes?.data?.employees || [];

  const selectedBankName = watchEmp('bankName');
  const banks = banksRes?.data || [];
  const selectedBank = banks.find(b => b.name === selectedBankName);

  React.useEffect(() => {
    if (selectedBank) {
      setEmpValue('bankCode', selectedBank.code);
    } else if (selectedBankName === '') {
      setEmpValue('bankCode', '');
    }
  }, [selectedBankName, selectedBank, setEmpValue]);

  React.useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId && employees.length > 0) {
      const empToEdit = employees.find(e => e._id === editId);
      if (empToEdit) {
        handleEditEmployee(empToEdit);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [employees]);

  // Dynamically pre-fill compliance defaults from the selected grade
  React.useEffect(() => {
    if (selectedGrade) {
      const currentWorkState = watchEmp('stateOfWork');
      if (!currentWorkState || currentWorkState === 'Lagos') {
        setEmpValue('stateOfWork', selectedGrade.stateOfWork || 'Lagos');
      }
      setEmpValue('nhfOptIn', !!selectedGrade.nhfOptIn);
      setEmpValue('nhisOptIn', !!selectedGrade.nhisOptIn);
      
      const currentPfa = watchEmp('pfaName');
      if (!currentPfa) {
        setEmpValue('pfaName', selectedGrade.pfaName || '');
      }
      
      const currentRent = watchEmp('annualRentPaid');
      if (!currentRent || Number(currentRent) === 0) {
        setEmpValue('annualRentPaid', selectedGrade.annualRentPaid || 0);
      }
      
      const currentLife = watchEmp('annualLifeInsurance');
      if (!currentLife || Number(currentLife) === 0) {
        setEmpValue('annualLifeInsurance', selectedGrade.annualLifeInsurance || 0);
      }
    }
  }, [selectedGradeId, selectedGrade, setEmpValue]);
  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff & Compensation</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage employee records, bank settings, and tenant salary grades</p>
        </div>
        
        {isStaffManager && (
          <div className="flex space-x-2 self-start sm:self-auto">
            {activeTab === 'directory' ? (
              <button
                onClick={() => {
                  setEditingEmployee(null);
                  empFormReset();
                  setIsEmpModalOpen(true);
                }}
                className="flex items-center space-x-2 px-4 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            ) : hasFeature('salary_grades') ? (
              <button
                onClick={() => {
                  setEditingGrade(null);
                  gradeFormReset();
                  setIsGradeModalOpen(true);
                }}
                className="flex items-center space-x-2 px-4 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Salary Grade</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'directory'
              ? 'border-forest-800 text-forest-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Staff Directory</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('grades')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'grades'
              ? 'border-forest-800 text-forest-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center space-x-2">
            <Layers className="w-4 h-4" />
            <span>Salary Grades</span>
            {!hasFeature('salary_grades') && <Lock className="w-3.5 h-3.5 text-slate-400" />}
          </span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab Content: Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {loadingEmployees ? (
              <div className="p-8 text-center text-slate-500">Loading staff records...</div>
            ) : employeesError ? (
              <div className="p-8 text-center text-red-500">Failed to load employee list.</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium">No employees found</p>
                <p className="text-xs text-slate-400 mt-1">Try refining your search or add a new record.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Salary Grade</th>
                      <th className="px-6 py-4">Monthly Salary</th>
                      <th className="px-6 py-4">Compliance & Reliefs</th>
                      <th className="px-6 py-4">Bank Details</th>
                      {isStaffManager && <th className="px-6 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => {
                      const empGrade = grades.find(g => g._id === (emp.gradeId?._id || emp.gradeId));

                      return (
                        <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800 block">{emp.firstName} {emp.lastName}</span>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase mt-0.5">{emp.staffId}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{emp.email || 'N/A'}</td>
                          <td className="px-6 py-4">
                            {empGrade ? (
                              <div className="space-y-1">
                                <span className="inline-block px-2.5 py-0.5 bg-forest-50 text-forest-800 rounded-md font-semibold text-xs border border-forest-100">
                                  {empGrade.name}
                                </span>
                                {emp.salaryOverridden ? (
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider rounded border border-amber-200">
                                      Overridden
                                    </span>
                                    {isStaffManager && (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Reset ${emp.firstName}'s salary components back to ${empGrade.name} defaults?`)) {
                                            resetSalaryMutation.mutate(emp._id);
                                          }
                                        }}
                                        title="Reset to grade defaults"
                                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-forest-700 rounded transition-colors"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="block text-[10px] text-slate-400 font-medium italic">Grade Bound</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold italic">Individual</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800">₦{Number(emp.basicSalary).toLocaleString()}</span>
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Gross: ₦{Number(emp.basicSalary + emp.housingAllowance + emp.transportAllowance + emp.otherAllowances).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center flex-wrap gap-1">
                                <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase tracking-wider border border-blue-150">
                                  {emp.stateOfWork || 'Lagos'}
                                </span>
                                {emp.nhfOptIn && (
                                  <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wider border border-emerald-150">
                                    NHF
                                  </span>
                                )}
                                {emp.nhisOptIn && (
                                  <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-wider border border-indigo-150">
                                    NHIS
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-450 leading-tight">
                                {emp.annualRentPaid > 0 && (
                                  <p>Rent: ₦{Number(emp.annualRentPaid).toLocaleString()}/yr</p>
                                )}
                                {emp.annualLifeInsurance > 0 && (
                                  <p>Life Ins: ₦{Number(emp.annualLifeInsurance).toLocaleString()}/yr</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {emp.bankName ? (
                              <div>
                                <p className="font-semibold text-slate-800">{emp.bankName}</p>
                                <p>{emp.accountNumber}</p>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          {isStaffManager && (
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => handleEditEmployee(emp)}
                                className="p-1.5 text-slate-400 hover:text-forest-700 hover:bg-slate-50 rounded-lg transition-colors inline-block"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to terminate/delete employee ${emp.firstName} ${emp.lastName}?`)) {
                                    deleteEmpMutation.mutate(emp._id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg transition-colors inline-block"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Grades */}
      {activeTab === 'grades' && (
        !hasFeature('salary_grades') ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
            <div className="w-16 h-16 bg-forest-50 text-forest-700 rounded-2xl flex items-center justify-center mb-4 border border-forest-100 shadow-inner">
              <Lock className="w-8 h-8 text-forest-900" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Salary Grades is locked</h3>
            <p className="text-slate-500 text-sm max-w-md mt-2">
              Upgrade to the Growth or Enterprise plan to structure salary levels, allowances, and manage compensation automatically across your workforce.
            </p>
            <Link
              to="/billing"
              className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <span>Upgrade Subscription</span>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {loadingGrades ? (
              <div className="p-8 text-center text-slate-500">Loading salary grades...</div>
            ) : grades.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Layers className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium">No Salary Grades defined</p>
                <p className="text-xs text-slate-400 mt-1">Configure structural salary tiers for bulk employee management.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
                      <th className="px-6 py-4">Grade Name</th>
                      <th className="px-6 py-4">Level</th>
                      <th className="px-6 py-4">Basic Salary</th>
                      <th className="px-6 py-4">Allowances</th>
                      <th className="px-6 py-4">Gross Salary</th>
                      {isStaffManager && <th className="px-6 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grades.map((grade) => (
                      <tr key={grade._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800 block">{grade.name}</span>
                          <span className="text-xs text-slate-450 block truncate max-w-xs">{grade.description || 'No description'}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-655">Level {grade.level}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">₦{Number(grade.basicSalary).toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          <p>Housing: ₦{Number(grade.housingAllowance).toLocaleString()}</p>
                          <p>Transport: ₦{Number(grade.transportAllowance).toLocaleString()}</p>
                          <p>Other: ₦{Number(grade.otherAllowances).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-forest-800">₦{Number(grade.grossSalary || (grade.basicSalary + grade.housingAllowance + grade.transportAllowance + grade.otherAllowances)).toLocaleString()}</td>
                        {isStaffManager && (
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleEditGrade(grade)}
                              className="p-1.5 text-slate-400 hover:text-forest-700 hover:bg-slate-50 rounded-lg transition-colors inline-block"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Soft delete salary grade ${grade.name}? Existing employees will retain current figures but won't be reassigned.`)) {
                                  deleteGradeMutation.mutate(grade._id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg transition-colors inline-block"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* Modal Overlay: Add/Edit Employee */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
              </h3>
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmpSubmit(onEmpSubmit)} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Section: Personal Info */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Personal Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        empErrors.firstName ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...registerEmp('firstName', { required: 'First name is required' })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        empErrors.lastName ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...registerEmp('lastName', { required: 'Last name is required' })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="employee@company.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('email')}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Grade & Salary */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Compensation & Salary Grade
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned Salary Grade (Optional)</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('gradeId')}
                    >
                      <option value="">No Grade (Custom Salary Structure)</option>
                      {grades.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.name} — Level {g.level} (Gross: ₦{Number(g.basicSalary + g.housingAllowance + g.transportAllowance + g.otherAllowances).toLocaleString()})
                        </option>
                      ))}
                    </select>
                    {selectedGrade && (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs mt-2 space-y-1">
                        <p className="font-semibold text-forest-800">Selected Grade defaults will be inherited:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-650">
                          <p>Basic: ₦{selectedGrade.basicSalary.toLocaleString()}</p>
                          <p>Housing: ₦{selectedGrade.housingAllowance.toLocaleString()}</p>
                          <p>Transport: ₦{selectedGrade.transportAllowance.toLocaleString()}</p>
                          <p>Other: ₦{selectedGrade.otherAllowances.toLocaleString()}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mt-1.5">Note: Entering figures below will trigger an "Overridden" status, taking priority over grade definitions.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Basic Salary</label>
                      <input
                        type="number"
                        placeholder={selectedGrade ? String(selectedGrade.basicSalary) : "0"}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerEmp('basicSalary')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Housing Allowance</label>
                      <input
                        type="number"
                        placeholder={selectedGrade ? String(selectedGrade.housingAllowance) : "0"}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerEmp('housingAllowance')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Transport Allowance</label>
                      <input
                        type="number"
                        placeholder={selectedGrade ? String(selectedGrade.transportAllowance) : "0"}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerEmp('transportAllowance')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Other Allowances</label>
                      <input
                        type="number"
                        placeholder={selectedGrade ? String(selectedGrade.otherAllowances) : "0"}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerEmp('otherAllowances')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Statutory Compliance & Relief Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Statutory Compliance & Reliefs
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">State of Work (for SIRS PAYE)</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('stateOfWork')}
                    >
                      {ALL_NIGERIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tax Identification Number (TIN)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1002345678-0001"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('tin')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Pension PFA Name</label>
                    <input
                      type="text"
                      list="pfa-list"
                      placeholder="Select or type PFA name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('pfaName')}
                    />
                    <datalist id="pfa-list">
                      {ALL_PFAS.map((pfa) => (
                        <option key={pfa.code} value={pfa.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Pension PIN</label>
                    <input
                      type="text"
                      placeholder="PENXXXXXXXXXXXXX"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('pensionPin')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Annual Rent Paid (for Rent Relief)</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('annualRentPaid')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Annual Life Insurance Premiums</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('annualLifeInsurance')}
                    />
                  </div>

                  <div className="flex flex-col space-y-2 mt-4 justify-center md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="nhfOptIn"
                        className="rounded text-forest-900 focus:ring-forest-800 h-4 w-4"
                        {...registerEmp('nhfOptIn')}
                      />
                      <label htmlFor="nhfOptIn" className="text-xs font-semibold text-slate-700">
                        Opt-in to National Housing Fund (NHF - 2.5% basic salary deduction)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="nhisOptIn"
                        className="rounded text-forest-900 focus:ring-forest-800 h-4 w-4"
                        {...registerEmp('nhisOptIn')}
                      />
                      <label htmlFor="nhisOptIn" className="text-xs font-semibold text-slate-700">
                        Opt-in to National Health Insurance Scheme (NHIS - 5% basic salary deduction)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Banking info */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Payment Routing & Bank Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Name</label>
                    <input
                      type="text"
                      list="bank-list"
                      placeholder="Select or type bank name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('bankName')}
                    />
                    <datalist id="bank-list">
                      {banks.map((b) => (
                        <option key={b.code} value={b.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Code</label>
                    <input
                      type="text"
                      readOnly={!!selectedBank}
                      placeholder={selectedBank ? "Auto-filled" : "Enter bank code manually"}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        selectedBank
                          ? 'border-slate-200 bg-slate-50 text-slate-505 cursor-not-allowed focus:outline-none'
                          : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...registerEmp('bankCode')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Account Number (10 digits)</label>
                    <input
                      type="text"
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        empErrors.accountNumber ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...registerEmp('accountNumber', {
                        pattern: {
                          value: /^\d{10}$/,
                          message: 'Account number must be exactly 10 digits',
                        },
                      })}
                    />
                    {empErrors.accountNumber && (
                      <p className="text-red-650 text-xs mt-1">{empErrors.accountNumber.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Account Name</label>
                    <input
                      type="text"
                      placeholder="Name on bank account"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerEmp('accountName')}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEmpMutation.isPending || updateEmpMutation.isPending}
                  className="px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-75 flex items-center justify-center space-x-1.5"
                >
                  {createEmpMutation.isPending || updateEmpMutation.isPending ? (
                    <>
                      <ConcentricSpinner className="text-white w-4 h-4" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>{editingEmployee ? 'Save Changes' : 'Register Employee'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Overlay: Add/Edit Salary Grade */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingGrade ? 'Edit Salary Grade Tier' : 'Define New Salary Grade'}
              </h3>
              <button
                onClick={() => setIsGradeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGradeSubmit(onGradeSubmit)} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Grade Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Staff"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      gradeErrors.name ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                    }`}
                    {...registerGrade('name', { required: 'Grade name is required' })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Grade Level (Hierarchical Order)</label>
                  <input
                    type="number"
                    placeholder="1"
                    min={1}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                    {...registerGrade('level')}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Basic Salary (Monthly NGN)</label>
                    <input
                      type="number"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        gradeErrors.basicSalary ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...registerGrade('basicSalary', { required: 'Basic salary is required', min: 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Housing Allowance (Monthly NGN)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerGrade('housingAllowance')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Transport Allowance (Monthly NGN)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerGrade('transportAllowance')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Other Allowances (Monthly NGN)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...registerGrade('otherAllowances')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Grade Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of duties/benefits associated with this grade level"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                    {...registerGrade('description')}
                  />
                </div>

                {/* Grade compliance default overrides */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-forest-700">
                    Grade Default Compliance Settings
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Default State of Work</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-350 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerGrade('stateOfWork')}
                      >
                        {ALL_NIGERIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Default Pension PFA Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Stanbic IBTC Pension"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerGrade('pfaName')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Default Annual Rent (₦)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerGrade('annualRentPaid')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Default Annual Life Insurance (₦)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                        {...registerGrade('annualLifeInsurance')}
                      />
                    </div>

                    <div className="flex flex-col space-y-2 mt-4 justify-center md:col-span-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="gradeNhf"
                          className="rounded text-forest-900 focus:ring-forest-800 h-4 w-4"
                          {...registerGrade('nhfOptIn')}
                        />
                        <label htmlFor="gradeNhf" className="text-xs font-semibold text-slate-700">
                          Opt-in to NHF by default
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="gradeNhis"
                          className="rounded text-forest-900 focus:ring-forest-800 h-4 w-4"
                          {...registerGrade('nhisOptIn')}
                        />
                        <label htmlFor="gradeNhis" className="text-xs font-semibold text-slate-700">
                          Opt-in to NHIS by default
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGradeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGradeMutation.isPending || updateGradeMutation.isPending}
                  className="px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-75 flex items-center justify-center space-x-1.5"
                >
                  {createGradeMutation.isPending || updateGradeMutation.isPending ? (
                    <>
                      <ConcentricSpinner className="text-white w-4 h-4" />
                      <span>Saving Grade...</span>
                    </>
                  ) : (
                    <span>{editingGrade ? 'Save Changes' : 'Create Salary Grade'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
