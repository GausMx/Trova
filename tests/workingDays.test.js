const { getWorkingDays } = require('../utils/payrollEngine');

describe('Working Days Calculation Utility', () => {
  test('should compute correct working days for June 2026 (30 days, 22 working days)', () => {
    const days = getWorkingDays(6, 2026);
    expect(days).toBe(22);
  });

  test('should compute correct working days for February 2024 (Leap year, 29 days, 21 working days)', () => {
    const days = getWorkingDays(2, 2024);
    expect(days).toBe(21);
  });

  test('should compute correct working days for February 2025 (Non-leap year, 28 days, 20 working days)', () => {
    const days = getWorkingDays(2, 2025);
    expect(days).toBe(20);
  });

  test('should compute correct working days for December 2026 (31 days, 23 working days)', () => {
    const days = getWorkingDays(12, 2026);
    expect(days).toBe(23);
  });
});
