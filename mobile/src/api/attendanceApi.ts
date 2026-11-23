import { apiClient, USE_MOCK_API } from './client';
import {
  AttendanceRecordDto,
  AttendanceSummaryDto,
  CheckInRequestDto,
  CheckOutRequestDto,
  CheckInPromptResponseDto,
  OfficeLocationDto,
} from '../types';
import { mockAttendanceHistory, mockAttendanceSummary } from './mockData';
import { CORPORATE_OFFICES } from '../utils/geoUtils';

let currentSummaryState: AttendanceSummaryDto = { ...mockAttendanceSummary };
let currentHistory: AttendanceRecordDto[] = [...mockAttendanceHistory];

export const attendanceApi = {
  // Fetch active company branches / office locations
  getBranches: async (): Promise<OfficeLocationDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 200));
      return CORPORATE_OFFICES.map((o, idx) => ({
        id: `branch-00${idx + 1}`,
        name: o.name,
        latitude: o.latitude,
        longitude: o.longitude,
        radiusMeters: o.radiusMeters,
        isActive: true,
      }));
    }
    const response = await apiClient.get<OfficeLocationDto[]>('/attendance/branches');
    return response.data;
  },

  getSummary: async (): Promise<AttendanceSummaryDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return { ...currentSummaryState };
    }
    const response = await apiClient.get<AttendanceSummaryDto>('/attendance/summary');
    return response.data;
  },

  getHistory: async (month?: number, year?: number): Promise<AttendanceRecordDto[]> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 400));
      return [...currentHistory];
    }
    const response = await apiClient.get<AttendanceRecordDto[]>('/attendance/history', {
      params: { month, year },
    });
    return response.data;
  },

  checkIn: async (
    req: CheckInRequestDto
  ): Promise<AttendanceRecordDto | CheckInPromptResponseDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 700));
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const record: AttendanceRecordDto = {
        id: `att-${Date.now()}`,
        date: now.toISOString().split('T')[0],
        checkInTime: timeStr,
        status: req.isRemoteConfirmed ? 'Remote' : 'Present',
        workHours: 0.1,
        locationName: req.isRemoteConfirmed
          ? 'Remote (Off-Site)'
          : 'Yangon HQ - M Tower (Geofence Verified)',
        note: req.remoteReason,
      };
      currentSummaryState = {
        ...currentSummaryState,
        currentStatus: 'CheckedIn',
        presentDays: currentSummaryState.presentDays + 1,
        todayRecord: record,
      };
      currentHistory = [record, ...currentHistory];
      return record;
    }
    const response = await apiClient.post<AttendanceRecordDto | CheckInPromptResponseDto>(
      '/attendance/check-in',
      req
    );
    return response.data;
  },

  checkOut: async (
    req: CheckOutRequestDto
  ): Promise<AttendanceRecordDto | CheckInPromptResponseDto> => {
    if (USE_MOCK_API) {
      await new Promise((r) => setTimeout(r, 700));
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updatedRecord: AttendanceRecordDto = {
        ...(currentSummaryState.todayRecord || {
          id: `att-${Date.now()}`,
          date: now.toISOString().split('T')[0],
          status: 'Present',
        }),
        checkOutTime: timeStr,
        workHours: 8.5,
      };
      currentSummaryState = {
        ...currentSummaryState,
        currentStatus: 'CheckedOut',
        totalWorkHours: currentSummaryState.totalWorkHours + 8.5,
        todayRecord: updatedRecord,
      };
      return updatedRecord;
    }
    const response = await apiClient.post<AttendanceRecordDto | CheckInPromptResponseDto>(
      '/attendance/check-out',
      req
    );
    return response.data;
  },
};
