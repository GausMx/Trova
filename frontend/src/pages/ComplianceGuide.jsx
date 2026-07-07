import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Scale, Award, Landmark, HelpCircle, CheckCircle, Calculator, Percent } from 'lucide-react';

export default function ComplianceGuide() {
  const [basicSalary, setBasicSalary] = useState(333000);
  const [housingAllowance, setHousingAllowance] = useState(15050);
  const [transportAllowance, setTransportAllowance] = useState(5000);
  const [otherAllowances, setOtherAllowances] = useState(3000);
  const [annualRent, setAnnualRent] = useState(150000);
  const [annualLifeIns, setAnnualLifeIns] = useState(30000);
  const [nhfOptIn, setNhfOptIn] = useState(true);
  const [nhisOptIn, setNhisOptIn] = useState(true);
  const [empCount, setEmpCount] = useState(6);

  // 2026 Calculation simulation
  const monthlyGross = basicSalary + housingAllowance + transportAllowance + otherAllowances;
  const annualGross = monthlyGross * 12;

  // Pension (8% of B + H + T)
  const calcPension = (basicSalary + housingAllowance + transportAllowance) * 0.08 * 12;
  // NHF (2.5% of Basic)
  const calcNhf = nhfOptIn ? (basicSalary * 0.025 * 12) : 0;
  // NHIS (5% of Basic) - applies if company has 5+ employees or if opted in
  const nhisApplies = (empCount >= 5) || nhisOptIn;
  const calcNhis = nhisApplies ? (basicSalary * 0.05 * 12) : 0;
  // Rent Relief (20% of rent, max 500k)
  const calcRentRelief = Math.min(annualRent * 0.20, 500000);
  const calcLifeIns = annualLifeIns;

  const totalDeductions = calcPension + calcNhf + calcNhis + calcRentRelief + calcLifeIns;
  const taxableIncome = Math.max(0, annualGross - totalDeductions);

  // Progressive bands
  const bands = [
    { limit: 800000, rate: 0.00, label: 'First ₦800,000 (0%)' },
    { limit: 2200000, rate: 0.15, label: 'Next ₦2,200,000 (15%)' },
    { limit: 9000000, rate: 0.18, label: 'Next ₦9,000,000 (18%)' },
    { limit: 13000000, rate: 0.21, label: 'Next ₦13,000,000 (21%)' },
    { limit: 25000000, rate: 0.23, label: 'Next ₦25,000,000 (23%)' },
    { limit: Infinity, rate: 0.25, label: 'Above ₦50,000,000 (25%)' }
  ];

  let remaining = taxableIncome;
  let computedTax = 0;
  const breakdown = [];

  for (const b of bands) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, b.limit);
    const tax = taxable * b.rate;
    computedTax += tax;
    breakdown.push({ label: b.label, taxable, tax });
    remaining -= taxable;
  }

  const monthlyTax = computedTax / 12;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans pb-12">
      {/* Premium Header Banner */}
      <div className="bg-gradient-to-r from-forest-900 via-forest-800 to-emerald-800 rounded-3xl p-8 md:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-3xl">
          <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-emerald-300 border border-white/10 inline-flex items-center space-x-1.5">
            <Scale className="w-3.5 h-3.5" />
            <span>Statutory Compliance Guide</span>
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            2026 Nigerian Payroll & Taxation Rules
          </h2>
          <p className="text-forest-105 text-base md:text-lg max-w-2xl leading-relaxed">
            Trova calculates salary structures, deductions, and employer matches based on the current progressive tax laws. Here is a simplified breakdown of the calculations.
          </p>
        </div>
      </div>

      {/* Grid: 2026 Tax Bands & Allowable Deductions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: 2026 Marginal Brackets */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3.5">
              <Percent className="w-5 h-5 text-forest-700" />
              <span>2026 Progressive Marginal Bands</span>
            </h3>
            <p className="text-slate-500 text-xs mt-3 leading-relaxed">
              Consolidated Relief Allowance (CRA) and flat minimum taxes are fully abolished. Tax is applied progressively to <strong>Chargeable Income</strong>:
            </p>
            
            <div className="mt-5 space-y-3.5">
              {[
                { range: 'First ₦800,000', rate: '0% Tax', desc: 'Fully tax-free band', bg: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
                { range: 'Next ₦2,200,000', rate: '15% Tax', desc: 'Up to ₦3.0M cumulative', bg: 'bg-slate-50 text-slate-700 border-slate-100' },
                { range: 'Next ₦9,000,000', rate: '18% Tax', desc: 'Up to ₦12.0M cumulative', bg: 'bg-slate-50 text-slate-700 border-slate-100' },
                { range: 'Next ₦13,000,000', rate: '21% Tax', desc: 'Up to ₦25.0M cumulative', bg: 'bg-slate-50 text-slate-700 border-slate-100' },
                { range: 'Next ₦25,000,000', rate: '23% Tax', desc: 'Up to ₦50.0M cumulative', bg: 'bg-slate-50 text-slate-700 border-slate-100' },
                { range: 'Above ₦50,000,000', rate: '25% Tax', desc: 'All excess chargeable income', bg: 'bg-rose-50 text-rose-800 border-rose-100' },
              ].map((item, idx) => (
                <div key={idx} className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${item.bg}`}>
                  <div>
                    <span className="font-bold text-sm block">{item.range}</span>
                    <span className="text-[10px] text-slate-450 block font-medium mt-0.5">{item.desc}</span>
                  </div>
                  <span className="font-extrabold text-sm shrink-0 whitespace-nowrap">{item.rate}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            * Progressive tax applies the rates incrementally per bracket, not as a flat percentage on the total gross.
          </div>
        </div>

        {/* Right Side: Step-by-Step Allowable Deductions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3.5">
              <Calculator className="w-5 h-5 text-forest-700" />
              <span>Step-by-Step Taxable Income Logic</span>
            </h3>
            <p className="text-slate-500 text-xs mt-3 leading-relaxed">
              Before tax brackets are applied, pre-tax deductions are subtracted from the employee's Gross Income to determine the <strong>Chargeable Income</strong>:
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative pl-8 border-l border-slate-200 space-y-6">
              
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-11 top-0.5 w-6 h-6 rounded-full bg-forest-900 text-white flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Determine Pre-tax Deductions</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Allowable deductions are subtracted to lower the taxable base. In 2026, these include:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700 text-xs block">Pension (CPS)</span>
                      <span className="text-[11px] text-slate-550 mt-1 block">8% of qualifying salary (Basic + Housing + Transport). Mandatory.</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700 text-xs block">NHF (Housing Fund)</span>
                      <span className="text-[11px] text-slate-550 mt-1 block">2.5% of Basic salary. <strong>Voluntary toggle</strong> for private-sector employees.</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700 text-xs block">NHIS (Health Scheme)</span>
                      <span className="text-[11px] text-slate-550 mt-1 block">5% of Basic. Mandatory for companies with 5+ employees.</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700 text-xs block">Rent Relief & Life Insurance</span>
                      <span className="text-[11px] text-slate-555 mt-1 block">Rent relief: <strong>20% of annual rent paid</strong> (capped at ₦500,000). Life Insurance: actual premiums.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -left-11 top-0.5 w-6 h-6 rounded-full bg-forest-900 text-white flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Calculate Chargeable Income</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Subtract the sum of Step 1 deductions from the employee's annual Gross Income:
                  </p>
                  <div className="bg-slate-900 text-emerald-400 font-mono text-[11px] p-3 rounded-lg mt-2 inline-block">
                    Chargeable Income = Gross Income - (Pension + NHF + NHIS + Rent Relief + Life Insurance)
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -left-11 top-0.5 w-6 h-6 rounded-full bg-forest-900 text-white flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Apply Progressive Bands & Monthly Division</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Run the annual Chargeable Income through the brackets, compute the total annual PAYE liability, and divide by 12 to get the exact monthly deduction.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Grid: Employer Levies & Remittances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Employer funded overhead levies */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3.5">
            <Award className="w-5 h-5 text-forest-700" />
            <span>Employer-Funded Overheads</span>
          </h3>
          <p className="text-slate-500 text-xs leading-relaxed">
            These statutory contributions are paid out-of-pocket by the employer to cover workforce social safety, pension match, and training initiatives:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-800 text-sm block">Employer Pension Match</span>
              <span className="text-forest-800 font-extrabold text-xs block mt-1">Minimum 10% of Emoluments</span>
              <p className="text-slate-450 text-[10px] mt-1.5">Paid monthly alongside the employee's 8% contribution into their chosen PFA.</p>
            </div>
            
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-800 text-sm block">Employer NHIS Match</span>
              <span className="text-forest-800 font-extrabold text-xs block mt-1">10% of Employee Basic</span>
              <p className="text-slate-450 text-[10px] mt-1.5">Remitted monthly to the National Health Insurance Scheme to cover employee healthcare.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-800 text-sm block">NSITF (Compensation)</span>
              <span className="text-forest-800 font-extrabold text-xs block mt-1">1% of Monthly Gross Payroll</span>
              <p className="text-slate-450 text-[10px] mt-1.5">Remitted to the Nigeria Social Insurance Trust Fund to cover workplace accidents.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-800 text-sm block">ITF (Industrial Training)</span>
              <span className="text-forest-800 font-extrabold text-xs block mt-1">1% of Annual Payroll</span>
              <p className="text-slate-450 text-[10px] mt-1.5">Mandatory for companies with 5+ employees or turnover &gt; ₦50,000. Remitted annually.</p>
            </div>
          </div>
        </div>

        {/* Agency Remittance Calendar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2 border-b border-slate-100 pb-3.5">
            <Landmark className="w-5 h-5 text-forest-700" />
            <span>Remittance Deadlines & Target Bodies</span>
          </h3>
          <p className="text-slate-500 text-xs leading-relaxed">
            All payroll deductions and employer matches must be remitted to their respective regulatory bodies by the designated statutory dates:
          </p>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Obligation</th>
                  <th className="py-2.5">Recipient Body</th>
                  <th className="py-2.5 text-right">Statutory Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-655">
                <tr>
                  <td className="py-3 font-semibold text-slate-800">PAYE Tax</td>
                  <td className="py-3">Employee's State SIRS (e.g. LIRS, FCT-IRS)</td>
                  <td className="py-3 text-right font-bold text-forest-800">10th of following month</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">Pension (CPS)</td>
                  <td className="py-3">Chosen PFA (Pension Fund Administrator)</td>
                  <td className="py-3 text-right font-bold text-forest-800">7 working days after pay</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">NHF (Housing)</td>
                  <td className="py-3">Federal Mortgage Bank of Nigeria (FMBN)</td>
                  <td className="py-3 text-right font-bold text-forest-800">15th of following month</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">NHIS (Health)</td>
                  <td className="py-3">National Health Insurance Scheme</td>
                  <td className="py-3 text-right font-bold text-forest-800">15th of following month</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">NSITF (ECS)</td>
                  <td className="py-3">Nigeria Social Insurance Trust Fund</td>
                  <td className="py-3 text-right font-bold text-forest-800">16th of following month</td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">ITF Levy</td>
                  <td className="py-3">Industrial Training Fund (ITF)</td>
                  <td className="py-3 text-right font-bold text-forest-800">April 1st (Annually)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Interactive Simulation / Sandboxed Calculator */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl space-y-6">
        <div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-emerald-500/30">
            Interactive Visualizer
          </span>
          <h3 className="text-xl font-bold mt-2.5">Statutory Calculation Calculator (2026)</h3>
          <p className="text-slate-400 text-xs mt-1">
            Input figures to simulate the pre-tax deductions and marginal taxation band allocations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inputs */}
          <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5 overflow-y-auto max-h-[65vh]">
            <h4 className="font-bold text-xs text-slate-200">Adjust Component Figures</h4>
            
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Monthly Basic Salary (₦)</label>
              <input
                type="number"
                step="10000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Monthly Housing Allowance (₦)</label>
              <input
                type="number"
                step="5000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={housingAllowance}
                onChange={(e) => setHousingAllowance(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Monthly Transport Allowance (₦)</label>
              <input
                type="number"
                step="5000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={transportAllowance}
                onChange={(e) => setTransportAllowance(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Monthly Other Allowances (₦)</label>
              <input
                type="number"
                step="1000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={otherAllowances}
                onChange={(e) => setOtherAllowances(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Annual Rent Paid (₦)</label>
              <input
                type="number"
                step="50000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={annualRent}
                onChange={(e) => setAnnualRent(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Annual Life Insurance Premiums (₦)</label>
              <input
                type="number"
                step="10000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={annualLifeIns}
                onChange={(e) => setAnnualLifeIns(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Company Employee Count</label>
              <input
                type="number"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={empCount}
                onChange={(e) => setEmpCount(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col space-y-1.5 pt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="calcNhfOpt"
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                  checked={nhfOptIn}
                  onChange={(e) => setNhfOptIn(e.target.checked)}
                />
                <label htmlFor="calcNhfOpt" className="text-[10px] text-slate-350 font-semibold">Opt-in to Voluntary NHF</label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="calcNhisOpt"
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                  checked={nhisOptIn}
                  onChange={(e) => setNhisOptIn(e.target.checked)}
                />
                <label htmlFor="calcNhisOpt" className="text-[10px] text-slate-350 font-semibold">Opt-in to NHIS</label>
              </div>
            </div>
          </div>

          {/* Deductions Output */}
          <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-200">Allowable Pre-tax Reliefs</h4>
              
              <div className="space-y-3 mt-4 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Pension (8% of Emoluments base)</span>
                  <span className="font-semibold text-white">₦{calcPension.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">NHF (2.5% of Basic)</span>
                  <span className="font-semibold text-white">₦{calcNhf.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">NHIS (5% of Basic)</span>
                  <span className="font-semibold text-white">₦{calcNhis.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Rent Relief (20% of rent, max 500k)</span>
                  <span className="font-semibold text-white text-emerald-450">₦{calcRentRelief.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Life Insurance premium</span>
                  <span className="font-semibold text-white">₦{calcLifeIns.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-sm font-bold text-white">
                <span>Total Relief Deductions:</span>
                <span>₦{totalDeductions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <span>Chargeable Income:</span>
                <span>₦{taxableIncome.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tax Allocations */}
          <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-200">2026 progressive taxation</h4>
              
              <div className="space-y-3 mt-4 text-xs font-mono">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">{item.label}</span>
                    <div className="text-right">
                      <span className="text-slate-300 block">Taxable: ₦{Math.round(item.taxable).toLocaleString()}</span>
                      <span className="text-emerald-400 block font-semibold">Tax: ₦{Math.round(item.tax).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {breakdown.length === 0 && (
                  <p className="text-slate-500 italic py-4">Gross is below tax-free threshold.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-350">
                <span>Total Annual PAYE:</span>
                <span className="text-white">₦{Math.round(computedTax).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <span>Monthly PAYE Payslip:</span>
                <span>₦{Math.round(monthlyTax).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
