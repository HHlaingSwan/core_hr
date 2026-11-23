import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { CheckCircle2, LogIn, LogOut, RotateCcw } from "lucide-react-native";

import { ThemeConfig } from "../../constants/theme";
import { useAttendanceStore, useToastStore } from "../../stores";
import { AttendancePunchSheet } from "./AttendancePunchSheet";

interface CalendarDay {
  dateStr: string;
  dayName: string;
  dayNum: number;
  isToday: boolean;
  isWeekend: boolean;
  hasHoliday?: boolean;
  holidayName?: string;
}

const SHORT_WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DailyCommandCenter() {
  const { showToast } = useToastStore();
  const {
    currentTime,
    isCheckedIn,
    checkInTime,
    checkOutTime,
    isCompletedToday,
    isLocating,
    lastLocation,
    punchToggle,
    confirmCheckOut,
    confirmRemotePunch,
    punchModal,
    closePunchModal,
    resetAttendanceDev,
  } = useAttendanceStore();

  // Generate current 7-day week (Sun to Sat) around today
  const { weekDays, todayISO } = useMemo(() => {
    const today = new Date();
    const todayStr = toLocalISODate(today);

    // Calculate Sunday of current week (0 = Sunday)
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);

    const days: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = toLocalISODate(d);
      const dayOfWeekIdx = d.getDay();
      const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
      const isToday = dateStr === todayStr;

      return {
        dateStr,
        dayName: SHORT_WEEKDAY_NAMES[dayOfWeekIdx] || "Day",
        dayNum: d.getDate(),
        isToday,
        isWeekend,
        hasHoliday: dateStr === "2026-11-27" || dateStr === "2026-11-28",
        holidayName:
          dateStr === "2026-11-27" || dateStr === "2026-11-28"
            ? "Thanksgiving Holiday"
            : undefined,
      };
    });

    return { weekDays: days, todayISO: todayStr };
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  const activeDay = useMemo(() => {
    return (
      weekDays.find((d) => d.dateStr === selectedDate) ||
      weekDays[0] || {
        dateStr: todayISO,
        dayName: "Today",
        dayNum: new Date().getDate(),
        isToday: true,
        isWeekend: false,
      }
    );
  }, [weekDays, selectedDate, todayISO]);

  const handleSelectDay = (dateStr: string) => {
    try {
      Haptics.selectionAsync?.().catch(() => {});
    } catch {}
    setSelectedDate(dateStr);
  };

  const handlePunchToggle = async () => {
    try {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}

    const wasCheckedIn = isCheckedIn;
    await punchToggle();

    if (!wasCheckedIn && !isCompletedToday) {
      const updatedLoc = useAttendanceStore.getState().lastLocation;
      if (updatedLoc?.verificationStatus === "verified") {
        showToast(
          `Checked in · Verified (${updatedLoc.formattedDistance || "On-site"})`,
          "success",
        );
      } else if (updatedLoc?.verificationStatus === "remote") {
        showToast(
          `Checked in · Remote (${updatedLoc.formattedDistance || "Off-site"})`,
          "info",
        );
      } else {
        showToast("Checked in successfully", "success");
      }
    }
  };

  const handleConfirmCheckOut = () => {
    try {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch {}
    confirmCheckOut();
    showToast("Check-out recorded successfully", "success");
  };

  const handleConfirmRemotePunch = async (
    actionType: "check_in" | "check_out",
  ) => {
    try {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch {}
    await confirmRemotePunch(actionType);
    const loc = useAttendanceStore.getState().lastLocation;
    showToast(
      actionType === "check_in"
        ? `Checked in · Remote (${loc?.formattedDistance || "Off-site"})`
        : `Checked out · Remote (${loc?.formattedDistance || "Off-site"})`,
      "info",
    );
  };

  const handleResetDev = () => {
    try {
      Haptics.notificationAsync?.(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } catch {}
    resetAttendanceDev();
    showToast("Attendance reset for demonstration", "info");
  };

  return (
    <>
      <View className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-4">
        {/* 1. Header: Command Center Title & Dev Reset */}
        <View className="flex-row items-center justify-between pb-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-extrabold text-content-primary uppercase tracking-wider">
              Daily Command Center
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleResetDev}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-5 h-5 items-center justify-center opacity-40 active:opacity-100"
            accessibilityRole="button"
            accessibilityLabel="Reset attendance state"
          >
            <RotateCcw size={11} color={ThemeConfig.content.muted} />
          </TouchableOpacity>
        </View>

        {/* 2. Interactive 7-Day Weekly Calendar Strip */}
        <View className="flex-row gap-1.5">
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <Pressable
                key={day.dateStr}
                onPress={() => handleSelectDay(day.dateStr)}
                className={`flex-1 items-center py-2.5 px-0.5 rounded-2xl gap-1 ${
                  isSelected
                    ? "bg-brand-primary"
                    : "bg-surface-muted border border-surface-border active:bg-surface-card"
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${day.dayName} ${day.dayNum}`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isSelected ? "text-white/80" : "text-content-secondary"
                  }`}
                >
                  {day.dayName}
                </Text>
                <Text
                  className={`text-sm font-extrabold font-mono ${
                    isSelected ? "text-white" : "text-content-primary"
                  }`}
                >
                  {day.dayNum}
                </Text>

                {/* Indicator Dot */}
                <View
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected
                      ? "bg-accent-sunshine"
                      : day.hasHoliday
                        ? "bg-accent-sunshine"
                        : day.isWeekend
                          ? "bg-transparent"
                          : "bg-brand-primary"
                  }`}
                />
              </Pressable>
            );
          })}
        </View>

        {/* 3. Hero Digital Clock & Location (Clean, Spacious, No Text Overload) */}
        <View className="py-2.5">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-3xl font-black font-mono text-content-primary tracking-tight">
              {activeDay.isToday ? currentTime : "09:00 – 18:00"}
            </Text>
            <Text className="text-xs font-bold text-content-primary">
              {lastLocation?.locationLabel || "Yangon HQ (Floor 4)"}
            </Text>
          </View>
        </View>

        {/* 4. Arrival & Departure Columns (Zero Chip Boxes) */}
        <View className="flex-row items-center justify-between pt-2 pb-1">
          {/* Check In Column */}
          <View className="gap-0.5">
            <View className="flex-row items-center gap-1.5">
              <View
                className={`w-1.5 h-1.5 rounded-full ${
                  checkInTime ? "bg-brand-primary" : "bg-content-muted"
                }`}
              />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                Check In
              </Text>
            </View>
            <Text className="text-base font-extrabold font-mono text-content-primary">
              {checkInTime || "--:--"}
            </Text>
          </View>

          {/* Hairline Separator */}
          <View className="w-[1px] h-8 bg-surface-border" />

          {/* Check Out Column */}
          <View className="gap-0.5 items-end">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                Check Out
              </Text>
              <View
                className={`w-1.5 h-1.5 rounded-full ${
                  checkOutTime ? "bg-brand-primary" : "bg-content-muted"
                }`}
              />
            </View>
            <Text className="text-base font-extrabold font-mono text-content-primary">
              {checkOutTime || "--:--"}
            </Text>
          </View>
        </View>

        {/* 5. Primary Action Button */}
        {isCompletedToday ? (
          <View className="w-full py-3.5 rounded-2xl bg-surface-muted border border-surface-border items-center justify-center flex-row gap-2">
            <CheckCircle2
              size={16}
              color={ThemeConfig.brand.primary}
              strokeWidth={2.2}
            />
            <Text className="text-xs font-bold text-content-primary">
              Shift Completed
            </Text>
          </View>
        ) : isLocating ? (
          <View className="w-full py-3.5 rounded-2xl bg-brand-primary items-center justify-center flex-row gap-2 shadow-sm shadow-brand-primary/25 opacity-90">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">
              Acquiring GPS Location...
            </Text>
          </View>
        ) : isCheckedIn ? (
          <TouchableOpacity
            onPress={handlePunchToggle}
            activeOpacity={0.85}
            className="w-full py-3.5 rounded-2xl bg-brand-primary active:bg-brand-primary-dark items-center justify-center flex-row gap-2 shadow-sm shadow-brand-primary/25"
            accessibilityRole="button"
            accessibilityLabel="Check out of work"
          >
            <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text className="text-sm font-bold text-white">Check Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handlePunchToggle}
            activeOpacity={0.85}
            className="w-full py-3.5 rounded-2xl bg-brand-primary active:bg-brand-primary-dark items-center justify-center flex-row gap-2 shadow-sm shadow-brand-primary/25"
            accessibilityRole="button"
            accessibilityLabel="Check in to work"
          >
            <LogIn size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text className="text-sm font-bold text-white">Check In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Confirmation Bottom Sheet */}
      <AttendancePunchSheet
        visible={!!punchModal}
        onClose={closePunchModal}
        punchData={punchModal}
        onConfirmCheckOut={handleConfirmCheckOut}
        onConfirmRemotePunch={handleConfirmRemotePunch}
      />
    </>
  );
}
