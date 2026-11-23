import { apiClient, USE_MOCK_API } from './client';
import { PayslipDetailDto, PayslipSummaryDto } from '../types';
import { mockPayslips } from './mockData';

export const payrollApi = {
  getPayslips: async (): Promise<PayslipSummaryDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return mockPayslips.map(({ earnings, deductions, ...summary }) => summary);
    }
    const response = await apiClient.get<PayslipSummaryDto[]>('/payroll/payslips');
    return response.data;
  },

  getPayslipDetail: async (id: string): Promise<PayslipDetailDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      const found = mockPayslips.find((p) => p.id === id);
      if (!found) throw new Error('Payslip not found');
      return found;
    }
    const response = await apiClient.get<PayslipDetailDto>(`/payroll/payslips/${id}`);
    return response.data;
  },
};
