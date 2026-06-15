// Puppeteer is loaded dynamically inside the generator function due to being a pure ESM package.

/**
 * Helper to format monetary values as Nigerian Naira currency (NGN) strings.
 * @param {number} val 
 * @returns {string}
 */
const formatNaira = (val) => {
  return '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Generates a styled HTML template and converts it to a PDF buffer using Puppeteer.
 * 
 * @param {string} companyName - Name of the tenant company
 * @param {Object} employeeRecord - Employee's computed payroll record from the database
 * @param {string} periodName - Text representation of the month and year (e.g. "June 2026")
 * @returns {Promise<Buffer>} PDF Buffer
 */
const generatePayslipPdf = async (companyName, employeeRecord, periodName) => {
  const puppeteerModule = await import('puppeteer');
  const puppeteer = puppeteerModule.default;

  const {
    staffId,
    name,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    grossSalary,
    workingDaysInMonth = 0,
    daysAbsent = 0,
    halfDays = 0,
    daysWorked = 0,
    proratedGross,
    taxDeduction,
    pensionDeduction,
    nhfDeduction,
    netSalary
  } = employeeRecord;

  const finalProratedGross = proratedGross !== undefined ? proratedGross : grossSalary;
  const isProratedApplied = workingDaysInMonth > 0 && daysWorked < workingDaysInMonth;
  const grossLabel = isProratedApplied ? 'Standard Gross' : 'Gross Earnings';

  let attendanceHtml = '';
  if (workingDaysInMonth > 0) {
    attendanceHtml = `
      <div class="meta-item">
        <span class="meta-label">Working Days in Month:</span>
        <span class="meta-value">${workingDaysInMonth}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Days Worked:</span>
        <span class="meta-value">${daysWorked}</span>
      </div>
    `;
    if (daysAbsent > 0) {
      attendanceHtml += `
        <div class="meta-item">
          <span class="meta-label">Days Absent:</span>
          <span class="meta-value" style="color: #dc2626; font-weight: bold;">${daysAbsent}</span>
        </div>
      `;
    }
    if (halfDays > 0) {
      attendanceHtml += `
        <div class="meta-item">
          <span class="meta-label">Half Days:</span>
          <span class="meta-value" style="color: #ea580c; font-weight: bold;">${halfDays}</span>
        </div>
      `;
    }
  }

  let earnedGrossRow = '';
  if (isProratedApplied) {
    earnedGrossRow = `
      <div class="total-row" style="border-top: 1px dashed #cbd5e1; margin-top: 6px; color: #0f766e; font-weight: 700;">
        <span>Earned Gross</span>
        <span>${formatNaira(finalProratedGross)}</span>
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payslip - ${name}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #334155;
          margin: 0;
          padding: 30px;
          background: #ffffff;
          line-height: 1.5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #e2e8f0;
          padding: 40px;
          border-radius: 8px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f766e;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .company-info h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 5px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .company-info p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .payslip-title {
          text-align: right;
        }
        .payslip-title h2 {
          font-size: 20px;
          font-weight: 600;
          color: #0f766e;
          margin: 0 0 5px 0;
        }
        .payslip-title p {
          font-size: 14px;
          font-weight: 500;
          color: #475569;
          margin: 0;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          background: #f8fafc;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 30px;
          font-size: 13px;
          border: 1px solid #f1f5f9;
        }
        .meta-item {
          display: flex;
          justify-content: space-between;
        }
        .meta-label {
          color: #64748b;
          font-weight: 500;
        }
        .meta-value {
          color: #0f172a;
          font-weight: 600;
        }
        .table-container {
          display: flex;
          gap: 25px;
          margin-bottom: 30px;
        }
        .table-block {
          flex: 1;
        }
        .table-block h3 {
          font-size: 14px;
          color: #0f172a;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 8px;
          margin-top: 0;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .data-row:last-child {
          border-bottom: none;
        }
        .data-label {
          color: #475569;
        }
        .data-value {
          font-weight: 600;
          color: #0f172a;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          border-top: 1px solid #94a3b8;
          margin-top: 8px;
        }
        .net-pay-section {
          background: #0f766e;
          color: #ffffff;
          padding: 20px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .net-pay-label {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .net-pay-amount {
          font-size: 26px;
          font-weight: 700;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
          margin-top: 40px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-info">
            <h1>${companyName}</h1>
            <p>HR & Payroll Division</p>
          </div>
          <div class="payslip-title">
            <h2>PAYSLIP</h2>
            <p>${periodName}</p>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Employee Name:</span>
            <span class="meta-value">${name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Staff ID:</span>
            <span class="meta-value">${staffId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Pay Period:</span>
            <span class="meta-value">${periodName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Mode:</span>
            <span class="meta-value">Bank Transfer</span>
          </div>
          ${attendanceHtml}
        </div>

        <div class="table-container">
          <div class="table-block">
            <h3>Earnings</h3>
            <div class="data-row">
              <span class="data-label">Basic Salary</span>
              <span class="data-value">${formatNaira(basicSalary)}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Housing Allowance</span>
              <span class="data-value">${formatNaira(housingAllowance)}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Transport Allowance</span>
              <span class="data-value">${formatNaira(transportAllowance)}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Other Allowances</span>
              <span class="data-value">${formatNaira(otherAllowances)}</span>
            </div>
            <div class="total-row">
              <span>${grossLabel}</span>
              <span>${formatNaira(grossSalary)}</span>
            </div>
            ${earnedGrossRow}
          </div>

          <div class="table-block">
            <h3>Deductions</h3>
            <div class="data-row">
              <span class="data-label">PAYE Tax</span>
              <span class="data-value">${formatNaira(taxDeduction)}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Pension (8%)</span>
              <span class="data-value">${formatNaira(pensionDeduction)}</span>
            </div>
            <div class="data-row">
              <span class="data-label">NHF (2.5%)</span>
              <span class="data-value">${formatNaira(nhfDeduction)}</span>
            </div>
            <div class="total-row">
              <span>Total Deductions</span>
              <span>${formatNaira(taxDeduction + pensionDeduction + nhfDeduction)}</span>
            </div>
          </div>
        </div>

        <div class="net-pay-section">
          <span class="net-pay-label">NET PAY (TAKE-HOME)</span>
          <span class="net-pay-amount">${formatNaira(netSalary)}</span>
        </div>

        <div class="footer">
          <p>This is a system-generated payslip for Trova Payroll SaaS and does not require a physical signature.</p>
          <p>All statutory pension contributions (PenCom), housing fund (NHF), and tax deductions (PAYE) are processed and remitted to compliance authorities.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  generatePayslipPdf
};
