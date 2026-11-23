import { apiClient, USE_MOCK_API } from './client';
import { CreateLeaveRequestDto, LeaveBalanceDto, LeaveRequestDto, ReviewLeaveRequestDto } from '../types';
import { mockLeaveBalances, mockLeaveRequests } from './mockData';

let balances = [...mockLeaveBalances];
let requests = [...mockLeaveRequests];

export const leavesApi = {
  getBalances: async (): Promise<LeaveBalanceDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return [...balances];
    }
    const response = await apiClient.get<LeaveBalanceDto[]>('/leaves/balances');
    return response.data;
  },

  getMyRequests: async (): Promise<LeaveRequestDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return requests.filter((r) => r.employeeId === 'emp-101');
    }
    const response = await apiClient.get<LeaveRequestDto[]>('/leaves/my-requests');
    return response.data;
  },

  getPendingApprovals: async (): Promise<LeaveRequestDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return requests.filter((r) => r.status === 'Pending');
    }
    const response = await apiClient.get<LeaveRequestDto[]>('/leaves/pending-approvals');
    return response.data;
  },

  createRequest: async (dto: CreateLeaveRequestDto): Promise<LeaveRequestDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 700));
      const newReq: LeaveRequestDto = {
        id: `lr-${Date.now()}`,
        employeeId: 'emp-101',
        employeeName: 'Sarah Jenkins',
        employeeCode: 'EMP-2044',
        leaveType: dto.leaveType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        daysCount: dto.isHalfDay ? 0.5 : 2,
        isHalfDay: dto.isHalfDay,
        halfDayPeriod: dto.halfDayPeriod,
        reason: dto.reason,
        status: 'Pending',
        appliedOn: new Date().toISOString().split('T')[0],
      };
      requests = [newReq, ...requests];
      return newReq;
    }
    const response = await apiClient.post<LeaveRequestDto>('/leaves', dto);
    return response.data;
  },

  reviewRequest: async (dto: ReviewLeaveRequestDto): Promise<LeaveRequestDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 500));
      const target = requests.find((r) => r.id === dto.id);
      if (!target) throw new Error('Leave request not found');
      target.status = dto.action === 'Approve' ? 'Approved' : 'Rejected';
      target.managerComment = dto.comment || (dto.action === 'Approve' ? 'Approved by manager' : 'Declined');
      target.approvedOrRejectedBy = 'David Thorne';
      return { ...target };
    }
    const response = await apiClient.put<LeaveRequestDto>(`/leaves/${dto.id}/review`, dto);
    return response.data;
  },
};
