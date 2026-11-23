import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Calendar, Clock, ArrowRight } from "lucide-react-native";
import { ThemeConfig } from "../../../constants/theme";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";

export interface CalendarRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onRangeChange: (start: string, end: string, workingDays: number) => void;
}

function parseISO(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== "string") {
    return new Date();
  }
  const parts = dateStr.split("-").map(Number);
  if (
    parts.length === 3 &&
    !isNaN(parts[0]) &&
    !isNaN(parts[1]) &&
    !isNaN(parts[2])
  ) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

function formatISO(date: Date): string {
  const year = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function formatDisplayDate(dateStr: string): { dayName: string; formatted: string } {
  const d = parseISO(dateStr);
  const dayName = WEEKDAY_NAMES[d.getDay()];
  const formatted = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return { dayName, formatted };
}

function countWorkingDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  if (start > end) return 1;

  let count = 0;
  const current = new Date(start);
  let safety = 0;

  while (current <= end && safety < 120) {
    safety++;
    const dayOfWeek = current.getDay(); // 0 is Sun, 6 is Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

export function CalendarRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: CalendarRangePickerProps) {
  const today = new Date();
  const todayStr = formatISO(today);

  const [currentStart, setCurrentStart] = useState<string>(startDate || todayStr);
  const [currentEnd, setCurrentEnd] = useState<string>(endDate || todayStr);

  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false);

  useEffect(() => {
    if (startDate) setCurrentStart(startDate);
    if (endDate) setCurrentEnd(endDate);
  }, [startDate, endDate]);

  const handleStartPicked = (date: Date) => {
    const newStartStr = formatISO(date);
    let newEndStr = currentEnd;
    if (newStartStr > currentEnd) {
      newEndStr = newStartStr;
    }
    setCurrentStart(newStartStr);
    setCurrentEnd(newEndStr);
    const days = countWorkingDays(newStartStr, newEndStr);
    onRangeChange(newStartStr, newEndStr, days);
  };

  const handleEndPicked = (date: Date) => {
    let newEndStr = formatISO(date);
    if (newEndStr < currentStart) {
      newEndStr = currentStart;
    }
    setCurrentEnd(newEndStr);
    const days = countWorkingDays(currentStart, newEndStr);
    onRangeChange(currentStart, newEndStr, days);
  };

  const applyPreset = (preset: "today" | "tomorrow" | "2days" | "nextweek") => {
    const base = new Date();
    let s = new Date(base);
    let e = new Date(base);

    if (preset === "today") {
      s = new Date(base);
      e = new Date(base);
    } else if (preset === "tomorrow") {
      s.setDate(s.getDate() + 1);
      e = new Date(s);
    } else if (preset === "2days") {
      e.setDate(e.getDate() + 1);
    } else {
      // Next Monday to Friday
      const daysUntilNextMonday = (8 - s.getDay()) % 7 || 7;
      s.setDate(s.getDate() + daysUntilNextMonday);
      e = new Date(s);
      e.setDate(e.getDate() + 4); // Mon to Fri
    }

    const startStr = formatISO(s);
    const endStr = formatISO(e);

    setCurrentStart(startStr);
    setCurrentEnd(endStr);

    const days = countWorkingDays(startStr, endStr);
    onRangeChange(startStr, endStr, days);
  };

  const startInfo = formatDisplayDate(currentStart);
  const endInfo = formatDisplayDate(currentEnd);
  const totalDays = countWorkingDays(currentStart, currentEnd);

  const startDateObj = parseISO(currentStart);
  const endDateObj = parseISO(currentEnd);

  return (
    <View className="bg-surface-background border border-surface-border rounded-2xl p-3.5 gap-3">
      {/* Header with Title & Live Duration Badge */}
      <View className="flex-row items-center justify-between pb-2 border-b border-surface-border">
        <View className="flex-row items-center gap-1.5">
          <Calendar size={15} color={ThemeConfig.brand.primary} />
          <Text className="text-xs font-bold text-content-primary tracking-tight uppercase">
            Select Leave Period
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary-light border border-brand-primary-light">
          <Clock size={11} color={ThemeConfig.brand.primary} />
          <Text className="text-xs font-bold text-brand-primary">
            {totalDays} {totalDays === 1 ? "working day" : "working days"}
          </Text>
        </View>
      </View>

      {/* Side-by-Side Start & End Date Selection Cards */}
      <View className="flex-row items-center gap-2">
        {/* Start Date Card */}
        <Pressable
          onPress={() => setShowStartPicker(true)}
          className="flex-1 bg-surface-card border border-surface-border rounded-xl p-3 active:border-brand-primary active:bg-surface-background"
          accessibilityRole="button"
          accessibilityLabel={`Start date: ${startInfo.formatted}`}
        >
          <Text className="text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">
            Start Date
          </Text>
          <Text className="text-sm font-extrabold text-content-primary tracking-tight">
            {startInfo.formatted}
          </Text>
          <Text className="text-[11px] font-semibold text-brand-primary mt-0.5">
            {startInfo.dayName}
          </Text>

          {/* iOS Compact DateTimePicker overlay or embed */}
          {Platform.OS === "ios" && (
            <View className="mt-2">
              <DateTimePicker
                value={startDateObj}
                mode="date"
                minimumDate={new Date()}
                display="compact"
                accentColor={ThemeConfig.brand.primary}
                onChange={(_event, selected) => {
                  if (selected) handleStartPicked(selected);
                }}
              />
            </View>
          )}
        </Pressable>

        <View className="items-center justify-center">
          <ArrowRight size={14} color={ThemeConfig.content.muted} />
        </View>

        {/* End Date Card */}
        <Pressable
          onPress={() => setShowEndPicker(true)}
          className="flex-1 bg-surface-card border border-surface-border rounded-xl p-3 active:border-brand-primary active:bg-surface-background"
          accessibilityRole="button"
          accessibilityLabel={`End date: ${endInfo.formatted}`}
        >
          <Text className="text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">
            End Date
          </Text>
          <Text className="text-sm font-extrabold text-content-primary tracking-tight">
            {endInfo.formatted}
          </Text>
          <Text className="text-[11px] font-semibold text-brand-primary mt-0.5">
            {endInfo.dayName}
          </Text>

          {/* iOS Compact DateTimePicker overlay or embed */}
          {Platform.OS === "ios" && (
            <View className="mt-2">
              <DateTimePicker
                value={endDateObj}
                mode="date"
                minimumDate={startDateObj}
                display="compact"
                accentColor={ThemeConfig.brand.primary}
                onChange={(_event, selected) => {
                  if (selected) handleEndPicked(selected);
                }}
              />
            </View>
          )}
        </Pressable>
      </View>

      {/* Android Native Modal Dialog Pickers */}
      {Platform.OS === "android" && showStartPicker && (
        <DateTimePicker
          value={startDateObj}
          mode="date"
          minimumDate={new Date()}
          presentation="dialog"
          onChange={(event, selected) => {
            setShowStartPicker(false);
            if (event.type === "set" && selected) {
              handleStartPicked(selected);
            }
          }}
          onDismiss={() => setShowStartPicker(false)}
        />
      )}

      {Platform.OS === "android" && showEndPicker && (
        <DateTimePicker
          value={endDateObj}
          mode="date"
          minimumDate={startDateObj}
          presentation="dialog"
          onChange={(event, selected) => {
            setShowEndPicker(false);
            if (event.type === "set" && selected) {
              handleEndPicked(selected);
            }
          }}
          onDismiss={() => setShowEndPicker(false)}
        />
      )}

      {/* Quick Presets Bar */}
      <View className="flex-row items-center gap-1.5 pt-2 border-t border-[#E2E8F0]">
        <Text className="text-[11px] font-bold text-[#64748B] mr-1">Quick:</Text>
        <Pressable
          onPress={() => applyPreset("today")}
          className="px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] active:bg-[#F1F5F9]"
        >
          <Text className="text-[11px] font-semibold text-[#475569]">
            Today (1d)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => applyPreset("tomorrow")}
          className="px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] active:bg-[#F1F5F9]"
        >
          <Text className="text-[11px] font-semibold text-[#475569]">
            Tomorrow
          </Text>
        </Pressable>
        <Pressable
          onPress={() => applyPreset("2days")}
          className="px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] active:bg-[#F1F5F9]"
        >
          <Text className="text-[11px] font-semibold text-[#475569]">
            2 Days
          </Text>
        </Pressable>
        <Pressable
          onPress={() => applyPreset("nextweek")}
          className="px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] active:bg-[#F1F5F9]"
        >
          <Text className="text-[11px] font-semibold text-[#475569]">
            Next Week
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
