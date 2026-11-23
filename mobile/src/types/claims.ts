export type ClaimCategory = 'Travel' | 'Meals' | 'Medical' | 'OfficeSupplies' | 'Training' | 'Other';
export type ClaimStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Reimbursed';

export interface ExpenseClaimDto {
  id: string;
  title: string;
  category: ClaimCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  receiptUrl?: string;
  status: ClaimStatus;
  notes?: string;
  createdAt: string;
}

export interface CreateClaimDto {
  title: string;
  category: ClaimCategory;
  amount: number;
  currency?: string;
  expenseDate: string;
  receiptUri?: string;
  notes?: string;
}
