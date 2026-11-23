import { create } from "zustand";
import { JuniorLeave } from "../types/home";
import { LeaveRequestDto, LeaveType } from "../types/leave";
import { mockLeaveRequests } from "../api/mockData";

export const initialJuniorLeaves: JuniorLeave[] = [
  {
    id: "jl-1",
    name: "Alex Rivera",
    role: "Junior Frontend Developer",
    department: "Frontend Engineering",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    leaveType: "Annual Leave",
    startDate: "Dec 01, 2026",
    endDate: "Dec 03, 2026",
    days: 3,
    reason: "Attending web engineering conference and workshops.",
    status: "Pending",
  },
  {
    id: "jl-2",
    name: "Chloe Bennett",
    role: "Associate Web Engineer",
    department: "Frontend Engineering",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    leaveType: "Sick Leave",
    startDate: "Nov 20, 2026",
    endDate: "Nov 21, 2026",
    days: 2,
    reason: "Medical recovery under doctor prescription.",
    status: "Pending",
  },
  {
    id: "jl-3",
    name: "Marcus Vance",
    role: "Junior QA Analyst",
    department: "Quality Assurance",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    leaveType: "Casual Leave",
    startDate: "Nov 25, 2026",
    endDate: "Nov 25, 2026",
    days: 1,
    reason: "Personal family administrative obligations.",
    status: "Pending",
  },
  {
    id: "jl-4",
    name: "Elena Rostova",
    role: "Senior UX Designer",
    department: "Product Design",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    leaveType: "Annual Leave",
    startDate: "Nov 12, 2026",
    endDate: "Nov 14, 2026",
    days: 3,
    reason: "Family trip and annual wellness recharge.",
    status: "Approved",
    decidedBy: "David Thorne",
    decidedByRole: "Engineering Director",
    decidedAt: "Nov 10, 2026, 04:15 PM",
  },
];

export interface LeaveBalances {
  annual: { left: number; total: number };
  sick: { left: number; total: number };
  casual: { left: number; total: number };
  unpaid: { left: number; total: number };
  parental?: { left: number; total: number };
}

interface LeaveState {
  juniorLeaves: JuniorLeave[];
  accruedBalances: LeaveBalances;
  myRequests: LeaveRequestDto[];

  decideLeave: (
    id: string,
    decision: "Approved" | "Declined",
    comment?: string,
    decidedBy?: string,
    decidedByRole?: string,
  ) => void;
  submitLeaveRequest: (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    isHalfDay?: boolean;
    halfDayPeriod?: "Morning" | "Afternoon";
    attachmentUrl?: string;
  }) => void;
}

export const useLeaveStore = create<LeaveState>((set) => ({
  juniorLeaves: initialJuniorLeaves,
  accruedBalances: {
    annual: { left: 14.0, total: 20.0 },
    sick: { left: 8.0, total: 10.0 },
    casual: { left: 4.0, total: 6.0 },
    unpaid: { left: 30.0, total: 30.0 },
    parental: { left: 60.0, total: 60.0 },
  },
  myRequests: mockLeaveRequests.filter((r) => r.employeeId === "emp-101"),

  decideLeave: (
    id: string,
    decision: "Approved" | "Declined",
    comment?: string,
    decidedBy = "David Thorne",
    decidedByRole = "Engineering Director",
  ) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const decidedAt = `${dateStr}, ${timeStr}`;

    set((state) => ({
      juniorLeaves: state.juniorLeaves.map((item) =>
        item.id === id
          ? {
              ...item,
              status: decision,
              managerComment: comment,
              decidedBy,
              decidedByRole,
              decidedAt,
            }
          : item,
      ),
    }));
  },

  submitLeaveRequest: (data) => {
    const newRequest: LeaveRequestDto = {
      id: `req-${Date.now()}`,
      employeeId: "emp-101",
      employeeName: "Armad",
      employeeCode: "EMP-2044",
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      daysCount: data.daysCount,
      isHalfDay: data.isHalfDay ?? false,
      halfDayPeriod: data.halfDayPeriod,
      attachmentUrl: data.attachmentUrl,
      reason: data.reason,
      status: "Pending",
      appliedOn: new Date().toISOString().split("T")[0],
    };

    set((state) => {
      // Deduct balance optimistically
      const key = data.leaveType.toLowerCase() as keyof LeaveBalances;
      const current = state.accruedBalances[key];
      const updatedBalances = current
        ? {
            ...state.accruedBalances,
            [key]: {
              ...current,
              left: Math.max(0, current.left - data.daysCount),
            },
          }
        : state.accruedBalances;

      return {
        myRequests: [newRequest, ...state.myRequests],
        accruedBalances: updatedBalances,
      };
    });
  },
}));
