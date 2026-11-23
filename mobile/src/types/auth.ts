export type UserRole = 'Employee' | 'Manager' | 'Admin';

export interface UserEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface UserPayrollInfo {
  bankName: string;
  accountLast4: string;
  paySchedule: string;
  taxFilingStatus: string;
}

export interface UserDto {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: UserRole;
  department: string;
  designation: string;
  permissions?: string[];
  mustChangePassword?: boolean;
  tempPassword?: string;
  organizationId?: string;
  joinDate: string;
  reportingManagerName?: string;
  workLocation?: string;
  workSchedule?: string;
  employmentType?: string;
  emergencyContact?: UserEmergencyContact;
  payrollInfo?: UserPayrollInfo;
}

export interface LoginRequestDto {
  email: string;
  password?: string;
  isBiometric?: boolean;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}
