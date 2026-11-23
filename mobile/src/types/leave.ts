export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Maternity' | 'Paternity' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveBalanceDto {
  leaveType: LeaveType;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  isHalfDay: boolean;
  halfDayPeriod?: 'Morning' | 'Afternoon';
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approvedOrRejectedBy?: string;
  managerComment?: string;
  attachmentUrl?: string;
}

export interface CreateLeaveRequestDto {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'Morning' | 'Afternoon';
  reason: string;
  attachmentUrl?: string;
}

export interface ReviewLeaveRequestDto {
  id: string;
  action: 'Approve' | 'Reject';
  comment?: string;
}
