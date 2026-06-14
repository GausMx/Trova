import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Users, Search, Plus, X, Trash2, CheckCircle2, UserCheck } from 'lucide-react';

export default function Employees() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isStaffManager = ['owner', 'admin', 'hr'].includes(user?.role);

  // Fetch employees
  const { data: employeesRes, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((res) => res.data),
  });

  // Create employee mutation
  const createMutation = useMutation({
    mutationFn: (newEmployee) => api.post('/employees', newEmployee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      reset();
      setSuccessMsg('Employee registered successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
  });

  // Delete employee mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      otherAllowances: 0,
      bankName: '',
      accountNumber: '',
    },
  });

  const onSubmit = (data) => {
    // Convert numbers from strings
    const formattedData = {
      ...data,
      basicSalary: Number(data.basicSalary),
      housingAllowance: Number(data.housingAllowance || 0),
      transportAllowance: Number(data.transportAllowance || 0),
      otherAllowances: Number(data.otherAllowances || 0),
    };
    createMutation.mutate(formattedData);
  };

  const employees = employeesRes?.data?.employees || [];
  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Employee Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage and view your company staff profiles</p>
        </div>
        {isStaffManager && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

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
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading staff records...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">Failed to load employee list.</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Users className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium">No employees found</p>
            <p className="text-xs text-slate-400 mt-1">Try refining your search or add a new record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Salary (Monthly)</th>
                  <th className="px-6 py-4">Bank Details</th>
                  <th className="px-6 py-4">Status</th>
                  {isStaffManager && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{emp.email || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      ₦{Number(emp.basicSalary).toLocaleString()}
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
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    </td>
                    {isStaffManager && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this employee?')) {
                              deleteMutation.mutate(emp._id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
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

      {/* Add Employee Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Add New Employee</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
                        errors.firstName ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('firstName', { required: 'First name is required' })}
                    />
                    {errors.firstName && (
                      <p className="text-red-600 text-xs mt-1">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        errors.lastName ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('lastName', { required: 'Last name is required' })}
                    />
                    {errors.lastName && (
                      <p className="text-red-600 text-xs mt-1">{errors.lastName.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="employee@company.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...register('email')}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Compensation details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Salary & Allowances (Monthly NGN)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Basic Salary</label>
                    <input
                      type="number"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        errors.basicSalary ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('basicSalary', { required: 'Basic salary is required', min: 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Housing Allowance</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...register('housingAllowance')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Transport Allowance</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...register('transportAllowance')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Other Allowances</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...register('otherAllowances')}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Banking details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3 border-b border-slate-100 pb-1">
                  Payment Routing details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Zenith Bank"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-100 focus:border-forest-700"
                      {...register('bankName')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Account Number (10 digits)</label>
                    <input
                      type="text"
                      placeholder="10-digit number"
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        errors.accountNumber ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-forest-100 focus:border-forest-700'
                      }`}
                      {...register('accountNumber', {
                        pattern: {
                          value: /^\d{10}$/,
                          message: 'Account number must be exactly 10 digits',
                        },
                      })}
                    />
                    {errors.accountNumber && (
                      <p className="text-red-600 text-xs mt-1">{errors.accountNumber.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Registering...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
