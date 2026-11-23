export interface JuniorLeave {
  id: string;
  name: string;
  role: string;
  department: string;
  avatarUrl?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Declined";
  managerComment?: string;
  decidedBy?: string;
  decidedByRole?: string;
  decidedAt?: string;
}

export interface Announcement {
  id: string;
  authorityGroup: string;
  authorityCode: "MD" | "HR" | "ENG";
  directiveNo: string;
  title: string;
  summary: string;
  fullBody: string;
  date: string;
  issuer: string;
  priority: "Urgent" | "Standard";
  isRead: boolean;
}

export interface TeamMemberPresence {
  id: string;
  name: string;
  localName?: string;
  role: string;
  department: string;
  avatarUrl?: string;
  status: "arrived" | "not_arrived" | "on_leave" | "remote";
  arrivalTime?: string;
  shiftSchedule: string;
  leaveDetails?: {
    type: string;
    until: string;
  };
  // Demographics
  dob?: string;
  gender?: "Male" | "Female" | "Other";
  maritalStatus?: "Single" | "Married" | "Other";
  // Contact Details
  phone?: string;
  email?: string;
  address?: string;
}
