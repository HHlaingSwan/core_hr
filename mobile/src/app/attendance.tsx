import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { useAttendanceStore } from "../stores";
import { mockAttendanceHistory } from "../api/mockData";
import { CollapsibleHeader } from "../components/common/CollapsibleHeader";

function formatHistoryDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${dayName}, ${formattedDate}`;
  } catch {
    return dateStr;
  }
}

export default function AttendanceScreen() {
  const router = useRouter();
  const { isCheckedIn, checkInTime, checkOutTime, isLate } =
    useAttendanceStore();

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const todayStatus = !checkInTime
    ? "Not Checked In"
    : isCheckedIn
      ? "Active"
      : "Completed";

  const todayDuration = !checkInTime ? "--" : isCheckedIn ? "4.5h" : "8.5h";

  // Merged unified list: Today is the first entry, followed by month history
  const allRecords = [
    {
      id: "today",
      dateLabel: "Today, Nov 18",
      checkIn: checkInTime || "--:--:--",
      checkOut: checkOutTime || "--:--:--",
      duration: todayDuration,
      status: todayStatus,
      isLate: isLate,
      isToday: true,
    },
    ...mockAttendanceHistory.map((item) => ({
      id: item.id,
      dateLabel: formatHistoryDate(item.date),
      checkIn: item.checkInTime || "--:--",
      checkOut: item.checkOutTime || "--:--",
      duration:
        item.status === "OnLeave"
          ? "Leave"
          : item.workHours
            ? `${item.workHours}h`
            : "--",
      status:
        item.status === "OnLeave"
          ? "On Leave"
          : item.status === "HalfDay"
            ? "Half Day"
            : item.status === "Late" || item.isLateCheckIn
              ? "Late"
              : "Present",
      isLate: item.status === "Late" || item.isLateCheckIn,
      isToday: false,
    })),
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER WITH BACK BUTTON */}
      <CollapsibleHeader
        title="My Attendance"
        subtitle="Daily check-ins, check-outs & hours log"
        scrollY={scrollY}
        showBackButton
        onBack={() => router.back()}
      />

      {/* 2. FULL-SCREEN SCROLLABLE DATA BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 40,
          gap: 16,
        }}
      >
        {/* Monthly Summary Statistics Strip */}
        <View className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm shadow-slate-900/5 flex-row items-center justify-between">
          <View className="items-center flex-1">
            <Text className="text-xs text-slate-400 font-medium">
              Worked Hours
            </Text>
            <Text className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
              168.5h
            </Text>
          </View>
          <View className="w-[1px] h-9 bg-slate-100" />
          <View className="items-center flex-1">
            <Text className="text-xs text-slate-400 font-medium">
              On-Time Rate
            </Text>
            <Text className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5">
              98%
            </Text>
          </View>
          <View className="w-[1px] h-9 bg-slate-100" />
          <View className="items-center flex-1">
            <Text className="text-xs text-slate-400 font-medium">
              Days Present
            </Text>
            <Text className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
              21 days
            </Text>
          </View>
        </View>

        {/* Attendance Records History Card */}
        <View className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm shadow-slate-900/5 gap-3">
          <Text className="text-sm font-bold text-slate-900">
            November 2026 Records
          </Text>

          {allRecords.map((item, index) => {
            const isFirst = index === 0;

            const showBadge =
              item.status === "On Leave" ||
              item.status === "Half Day" ||
              (item.isToday && item.status === "Active");

            const isLateRecord = item.isLate;

            return (
              <View
                key={item.id}
                className={`${!isFirst ? "pt-3.5 border-t border-slate-100" : ""} gap-1.5`}
              >
                {/* Top Row: Date & Optional Status Badge */}
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-sm ${
                      item.isToday
                        ? "font-extrabold text-slate-950"
                        : "font-semibold text-slate-700"
                    }`}
                  >
                    {item.dateLabel}
                  </Text>

                  {showBadge && (
                    <View className="flex-row items-center gap-1.5">
                      <View
                        className={`w-2 h-2 rounded-full ${
                          item.status === "Active"
                            ? "bg-emerald-500"
                            : item.status === "Half Day"
                              ? "bg-blue-500"
                              : "bg-purple-500"
                        }`}
                      />
                      <Text
                        className={`text-xs font-bold ${
                          item.status === "Active"
                            ? "text-emerald-600"
                            : item.status === "Half Day"
                              ? "text-blue-600"
                              : "text-purple-600"
                        }`}
                      >
                        {item.status}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bottom Row: IN (Left) ── Duration Bridge (Center) ── OUT (Right) */}
                <View className="flex-row items-center justify-between">
                  {/* Left is always IN */}
                  <Text
                    className={`text-xs font-mono ${
                      isLateRecord
                        ? "font-bold text-rose-600"
                        : item.checkIn === "--:--" ||
                            item.checkIn === "--:--:--"
                          ? "text-slate-400"
                          : "font-bold text-slate-900"
                    }`}
                  >
                    {item.checkIn}
                  </Text>

                  {/* Center Duration Bridge */}
                  <View className="flex-1 flex-row items-center px-3">
                    <View className="flex-1 h-[1px] bg-slate-200/80" />
                    <Text className="text-[11px] text-slate-400 font-mono mx-2">
                      {item.duration}
                    </Text>
                    <View className="flex-1 h-[1px] bg-slate-200/80" />
                  </View>

                  {/* Right is always OUT */}
                  <Text
                    className={`text-xs font-mono ${
                      item.checkOut === "--:--" || item.checkOut === "--:--:--"
                        ? "text-slate-400"
                        : "font-bold text-slate-900"
                    }`}
                  >
                    {item.checkOut}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
