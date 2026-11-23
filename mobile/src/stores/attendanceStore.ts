import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  acquirePunchLocation,
  DEFAULT_OFFICE,
  CORPORATE_OFFICES,
  OfficeLocation,
} from "../utils/geoUtils";
import { attendanceApi } from "../api/attendanceApi";

// Helper to determine if a check-in time is late (>= 09:15 AM)
export function checkIsLate(timeStr: string | null): boolean {
  if (!timeStr) return false;
  try {
    const parts = timeStr.trim().split(" ");
    const timePart = parts[0];
    const meridiem = parts[1]?.toUpperCase() || "AM";
    const [hStr, mStr] = timePart.split(":");
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr || "0", 10);
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    // Late cutoff is 09:15 AM
    return hours > 9 || (hours === 9 && minutes >= 15);
  } catch {
    return false;
  }
}

// Helper to determine if current time is before shift end (18:00 / 06:00 PM)
export function checkIsEarlyDeparture(timeStr: string | null): boolean {
  if (!timeStr) return false;
  try {
    const parts = timeStr.trim().split(" ");
    const timePart = parts[0];
    const meridiem = parts[1]?.toUpperCase() || "AM";
    const [hStr, mStr] = timePart.split(":");
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr || "0", 10);
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    // Shift ends at 18:00 (06:00 PM = 1080 minutes)
    return hours * 60 + minutes < 18 * 60;
  } catch {
    return false;
  }
}

export interface PunchLocationInfo {
  locationLabel: string;
  verificationStatus: "verified" | "remote" | "unverified";
  distanceMeters?: number | null;
  formattedDistance?: string | null;
  coords?: { latitude: number; longitude: number } | null;
}

export interface PunchModalData {
  type: "check_out_warning" | "check_out_confirmed" | "remote_request";
  actionType?: "check_in" | "check_out";
  isLate?: boolean;
  isEarlyDeparture?: boolean;
  time: string;
  title: string;
  message: string;
  location?: PunchLocationInfo;
}

interface AttendanceState {
  currentTime: string;
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  isLate: boolean;
  isCompletedToday: boolean;
  isLoading: boolean;
  isLocating: boolean;
  lastLocation: PunchLocationInfo | null;
  punchModal: PunchModalData | null;
  offices: OfficeLocation[];

  initializeAttendance: () => Promise<void>;
  tickClock: () => void;
  punchToggle: () => Promise<void>;
  confirmCheckOut: () => Promise<void>;
  confirmRemotePunch: (
    actionType: "check_in" | "check_out",
    reason?: string
  ) => Promise<void>;
  closePunchModal: () => void;
  resetAttendanceDev: () => Promise<void>;
}

const DEFAULT_VERIFIED_LOCATION: PunchLocationInfo = {
  locationLabel: DEFAULT_OFFICE.name,
  verificationStatus: "verified",
  formattedDistance: "35m",
  distanceMeters: 35,
};

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  currentTime: new Date().toLocaleTimeString(),
  isCheckedIn: true,
  checkInTime: "09:22:15 AM",
  checkOutTime: null,
  isLate: true,
  isCompletedToday: false,
  isLoading: false,
  isLocating: false,
  lastLocation: DEFAULT_VERIFIED_LOCATION,
  punchModal: null,
  offices: CORPORATE_OFFICES,

  tickClock: () => {
    set({ currentTime: new Date().toLocaleTimeString() });
  },

  closePunchModal: () => {
    set({ punchModal: null });
  },

  resetAttendanceDev: async () => {
    try {
      await SecureStore.deleteItemAsync("hr_attendance_status");
      await SecureStore.deleteItemAsync("hr_attendance_checkin_time");
      await SecureStore.deleteItemAsync("hr_attendance_checkout_time");
      await SecureStore.deleteItemAsync("hr_attendance_date");
      await SecureStore.deleteItemAsync("hr_attendance_location");
    } catch {}
    set({
      isCheckedIn: false,
      checkInTime: null,
      checkOutTime: null,
      isLate: false,
      isCompletedToday: false,
      lastLocation: null,
      punchModal: null,
    });
  },

  initializeAttendance: async () => {
    try {
      set({ isLoading: true });
      const todayDateStr = new Date().toISOString().split("T")[0];

      // 1. Fetch live office locations from backend if available
      try {
        const branches = await attendanceApi.getBranches();
        if (branches && branches.length > 0) {
          const mappedOffices: OfficeLocation[] = branches.map((b) => ({
            name: b.name,
            latitude: typeof b.latitude === "string" ? parseFloat(b.latitude) : b.latitude,
            longitude: typeof b.longitude === "string" ? parseFloat(b.longitude) : b.longitude,
            radiusMeters: b.radiusMeters || 250,
          }));
          set({ offices: mappedOffices });
        }
      } catch {
        // Fallback to CORPORATE_OFFICES
      }

      // Check date rollover
      const savedDate = await SecureStore.getItemAsync("hr_attendance_date");
      if (savedDate && savedDate !== todayDateStr) {
        await SecureStore.deleteItemAsync("hr_attendance_status");
        await SecureStore.deleteItemAsync("hr_attendance_checkin_time");
        await SecureStore.deleteItemAsync("hr_attendance_checkout_time");
        await SecureStore.deleteItemAsync("hr_attendance_location");
        await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
        set({
          isCheckedIn: false,
          checkInTime: null,
          checkOutTime: null,
          isLate: false,
          isCompletedToday: false,
          lastLocation: null,
          isLoading: false,
        });
        return;
      }

      const savedStatus = await SecureStore.getItemAsync("hr_attendance_status");
      const savedTime = await SecureStore.getItemAsync("hr_attendance_checkin_time");
      const savedOut = await SecureStore.getItemAsync("hr_attendance_checkout_time");
      const savedLoc = await SecureStore.getItemAsync("hr_attendance_location");

      let parsedLoc: PunchLocationInfo | null = null;
      if (savedLoc) {
        try {
          parsedLoc = JSON.parse(savedLoc);
        } catch {}
      }

      if (savedStatus === "checked_in" && savedTime) {
        set({
          isCheckedIn: true,
          checkInTime: savedTime,
          checkOutTime: null,
          isLate: checkIsLate(savedTime),
          isCompletedToday: false,
          lastLocation: parsedLoc || DEFAULT_VERIFIED_LOCATION,
          isLoading: false,
        });
      } else if (savedStatus === "checked_out" && savedOut) {
        set({
          isCheckedIn: false,
          checkOutTime: savedOut,
          checkInTime: savedTime || null,
          isLate: checkIsLate(savedTime),
          isCompletedToday: Boolean(savedTime && savedOut),
          lastLocation: parsedLoc || DEFAULT_VERIFIED_LOCATION,
          isLoading: false,
        });
      } else {
        // Default initial preview: Checked in at 09:22 AM
        const defaultTime = "09:22:15 AM";
        await SecureStore.setItemAsync("hr_attendance_status", "checked_in");
        await SecureStore.setItemAsync("hr_attendance_checkin_time", defaultTime);
        await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
        await SecureStore.setItemAsync(
          "hr_attendance_location",
          JSON.stringify(DEFAULT_VERIFIED_LOCATION)
        );
        set({
          isCheckedIn: true,
          checkInTime: defaultTime,
          checkOutTime: null,
          isLate: true,
          isCompletedToday: false,
          lastLocation: DEFAULT_VERIFIED_LOCATION,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  punchToggle: async () => {
    const { isCheckedIn, isCompletedToday, offices } = get();
    if (isCompletedToday) return; // Prevent any punch once completed for today

    set({ isLocating: true });

    // Acquire native GPS coordinates and validate against all 4 offices
    let locInfo: PunchLocationInfo = DEFAULT_VERIFIED_LOCATION;
    try {
      const locResult = await acquirePunchLocation(offices);
      locInfo = {
        locationLabel: locResult.locationLabel,
        verificationStatus: locResult.verificationStatus,
        distanceMeters: locResult.geofence?.distanceMeters ?? null,
        formattedDistance: locResult.geofence?.formattedDistance ?? null,
        coords: locResult.coords,
      };
    } catch {
      // Graceful fallback
    }

    set({ isLocating: false, lastLocation: locInfo });

    const now = new Date().toLocaleTimeString();
    const todayDateStr = new Date().toISOString().split("T")[0];
    const isInsideOffice = locInfo.verificationStatus === "verified";

    if (isCheckedIn) {
      // Trying to Check Out
      if (!isInsideOffice) {
        // Outside all offices: Prompt Remote Check-Out Request
        const nearestName = locInfo.locationLabel;
        const distStr = locInfo.formattedDistance ? `(${locInfo.formattedDistance} away)` : "";
        set({
          punchModal: {
            type: "remote_request",
            actionType: "check_out",
            time: now,
            isEarlyDeparture: checkIsEarlyDeparture(now),
            title: "Outside Office Range 📍",
            message: `You are not within range of any office (Nearest: ${nearestName} ${distStr}). Would you like to request a remote check-out?`,
            location: locInfo,
          },
        });
      } else {
        // Inside office: Prompt Normal Check-Out Sheet
        const isEarly = checkIsEarlyDeparture(now);
        set({
          punchModal: {
            type: isEarly ? "check_out_warning" : "check_out_confirmed",
            actionType: "check_out",
            time: now,
            isEarlyDeparture: isEarly,
            title: isEarly ? "Heading Out Early? 👋" : "Great Work Today! 🌙",
            message: isEarly
              ? "Great effort today! Take care, get some well-deserved rest, and enjoy your evening."
              : "You've wrapped up for the day. Time to rest, recharge, and enjoy your evening!",
            location: locInfo,
          },
        });
      }
    } else {
      // Trying to Check In
      if (!isInsideOffice) {
        // Outside all offices: Prompt Remote Check-In Request
        const nearestName = locInfo.locationLabel;
        const distStr = locInfo.formattedDistance ? `(${locInfo.formattedDistance} away)` : "";
        set({
          punchModal: {
            type: "remote_request",
            actionType: "check_in",
            time: now,
            isLate: checkIsLate(now),
            title: "Outside Office Range 📍",
            message: `You are not within range of any office (Nearest: ${nearestName} ${distStr}). Would you like to request a remote check-in?`,
            location: locInfo,
          },
        });
      } else {
        // Inside office: Clock In directly on-screen with zero modal!
        const nowLate = checkIsLate(now);
        try {
          if (locInfo.coords) {
            await attendanceApi.checkIn({
              latitude: locInfo.coords.latitude,
              longitude: locInfo.coords.longitude,
            });
          }
          await SecureStore.setItemAsync("hr_attendance_status", "checked_in");
          await SecureStore.setItemAsync("hr_attendance_checkin_time", now);
          await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
          await SecureStore.setItemAsync("hr_attendance_location", JSON.stringify(locInfo));
          await SecureStore.deleteItemAsync("hr_attendance_checkout_time");
        } catch {
          // Fallback in-memory
        }

        set({
          isCheckedIn: true,
          checkInTime: now,
          checkOutTime: null,
          isLate: nowLate,
          isCompletedToday: false,
          punchModal: null,
        });
      }
    }
  },

  confirmCheckOut: async () => {
    const { lastLocation } = get();
    const now = new Date().toLocaleTimeString();
    const todayDateStr = new Date().toISOString().split("T")[0];
    try {
      if (lastLocation?.coords) {
        await attendanceApi.checkOut({
          latitude: lastLocation.coords.latitude,
          longitude: lastLocation.coords.longitude,
        });
      }
      await SecureStore.setItemAsync("hr_attendance_status", "checked_out");
      await SecureStore.setItemAsync("hr_attendance_checkout_time", now);
      await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
    } catch {
      // Fallback in-memory
    }

    set({
      isCheckedIn: false,
      checkOutTime: now,
      isCompletedToday: true,
      punchModal: null,
    });
  },

  confirmRemotePunch: async (actionType: "check_in" | "check_out", reason?: string) => {
    const { lastLocation } = get();
    const now = new Date().toLocaleTimeString();
    const todayDateStr = new Date().toISOString().split("T")[0];

    const remoteLocInfo: PunchLocationInfo = {
      ...(lastLocation || DEFAULT_VERIFIED_LOCATION),
      verificationStatus: "remote",
      locationLabel: lastLocation?.locationLabel
        ? `Remote (${lastLocation.locationLabel})`
        : "Off-Site (Remote)",
    };

    if (actionType === "check_in") {
      const nowLate = checkIsLate(now);
      try {
        if (lastLocation?.coords) {
          await attendanceApi.checkIn({
            latitude: lastLocation.coords.latitude,
            longitude: lastLocation.coords.longitude,
            isRemoteConfirmed: true,
            remoteReason: reason || "Remote Check-In Request",
          });
        }
        await SecureStore.setItemAsync("hr_attendance_status", "checked_in");
        await SecureStore.setItemAsync("hr_attendance_checkin_time", now);
        await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
        await SecureStore.setItemAsync(
          "hr_attendance_location",
          JSON.stringify(remoteLocInfo)
        );
        await SecureStore.deleteItemAsync("hr_attendance_checkout_time");
      } catch {}

      set({
        isCheckedIn: true,
        checkInTime: now,
        checkOutTime: null,
        isLate: nowLate,
        isCompletedToday: false,
        lastLocation: remoteLocInfo,
        punchModal: null,
      });
    } else {
      try {
        if (lastLocation?.coords) {
          await attendanceApi.checkOut({
            latitude: lastLocation.coords.latitude,
            longitude: lastLocation.coords.longitude,
            isRemoteConfirmed: true,
            remoteReason: reason || "Remote Check-Out Request",
          });
        }
        await SecureStore.setItemAsync("hr_attendance_status", "checked_out");
        await SecureStore.setItemAsync("hr_attendance_checkout_time", now);
        await SecureStore.setItemAsync("hr_attendance_date", todayDateStr);
        await SecureStore.setItemAsync(
          "hr_attendance_location",
          JSON.stringify(remoteLocInfo)
        );
      } catch {}

      set({
        isCheckedIn: false,
        checkOutTime: now,
        isCompletedToday: true,
        lastLocation: remoteLocInfo,
        punchModal: null,
      });
    }
  },
}));
