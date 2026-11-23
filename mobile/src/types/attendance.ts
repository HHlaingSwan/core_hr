export type AttendanceStatus =
  | 'Present'
  | 'Late'
  | 'Remote'
  | 'HalfDay'
  | 'Absent'
  | 'OnLeave'
  | 'Holiday';

export interface OfficeLocationDto {
  id: string;
  orgId?: string;
  name: string;
  code?: string;
  latitude: string | number;
  longitude: string | number;
  radiusMeters: number;
  address?: string;
  isActive?: boolean;
}

export interface CheckInRequestDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceId?: string;
  isRemoteConfirmed?: boolean;
  remoteReason?: string;
  notes?: string;
}

export interface CheckOutRequestDto {
  latitude: number;
  longitude: number;
  deviceId?: string;
  isRemoteConfirmed?: boolean;
  remoteReason?: string;
  notes?: string;
}

export interface CheckInPromptResponseDto {
  requiresRemoteConfirmation?: boolean;
  nearestBranchName?: string;
  nearestBranchId?: string;
  distanceMeters?: number;
  message?: string;
}

export interface AttendanceRecordDto {
  id: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  status: AttendanceStatus;
  workHours?: number; // e.g. 8.5
  isLateCheckIn?: boolean;
  isEarlyCheckOut?: boolean;
  isOutsideGeofence?: boolean;
  locationName?: string;
  note?: string;
}

export interface AttendanceSummaryDto {
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  onLeaveDays: number;
  totalWorkHours: number;
  currentStatus: 'NotCheckedIn' | 'CheckedIn' | 'CheckedOut';
  todayRecord?: AttendanceRecordDto;
}
