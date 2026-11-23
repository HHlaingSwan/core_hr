export interface SalaryItemDto {
  name: string;
  amount: number;
  category: 'Earning' | 'Deduction';
}

export interface PayslipSummaryDto {
  id: string;
  month: number;
  year: number;
  monthName: string;
  payDate: string;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  currency: string;
  status: 'Paid' | 'Processing' | 'Held';
}

export interface PayslipDetailDto extends PayslipSummaryDto {
  earnings: SalaryItemDto[];
  deductions: SalaryItemDto[];
  bankName: string;
  bankAccountMasked: string;
  taxNumberMasked?: string;
  downloadUrl?: string;
}
