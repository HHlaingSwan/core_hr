import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { ThemeConfig } from "../../constants/theme";
import { useAuthStore, useAttendanceStore, useToastStore } from "../../stores";
import { DailyCommandCenter } from "../../components/home/DailyCommandCenter";
import { AnnouncementsSection } from "../../components/home/AnnouncementsSection";
import { CollapsibleHeader } from "../../components/common/CollapsibleHeader";

export default function HomeScreen() {
  const { user, role, switchDemoRole } = useAuthStore();
  const { initializeAttendance, tickClock } = useAttendanceStore();
  const { showToast } = useToastStore();

  const isManagerOrLead = role === "Manager";

  const [refreshing, setRefreshing] = useState(false);

  // Scroll position shared value for Reanimated 60-120fps animations
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Initialize saved attendance and start real-time second tick
  useEffect(() => {
    initializeAttendance();

    const timer = setInterval(() => {
      tickClock();
    }, 1000);
    return () => clearInterval(timer);
  }, [initializeAttendance, tickClock]);

  const onRefresh = () => {
    setRefreshing(true);
    initializeAttendance().finally(() => {
      setTimeout(() => setRefreshing(false), 500);
    });
  };

  const handleRoleSwitch = () => {
    const nextRole = isManagerOrLead ? "Employee" : "Manager";
    switchDemoRole(nextRole);
    showToast(
      `Switched to ${nextRole === "Manager" ? "Manager View" : "Staff View"}`,
      "info",
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER */}
      <CollapsibleHeader
        title={user?.fullName || "Armad"}
        subtitle={user?.designation || "Senior Frontend Engineer"}
        scrollY={scrollY}
        rightElement={
          <TouchableOpacity
            onPress={handleRoleSwitch}
            activeOpacity={0.7}
            className="px-3.5 py-1.5 rounded-full border border-surface-border bg-surface-card flex-row items-center gap-1.5"
          >
            <View
              className={`w-2 h-2 rounded-full ${isManagerOrLead ? "bg-brand-primary" : "bg-content-muted"}`}
            />
            <Text className="text-xs font-bold text-content-primary">
              {isManagerOrLead ? "Manager View" : "Staff View"}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* 2. SCROLLABLE BODY CONTENT */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 110,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ThemeConfig.brand.primary}
          />
        }
      >
        {/* UNIFIED DAILY COMMAND CENTER (Calendar, Shifts & Attendance) */}
        <DailyCommandCenter />

        {/* CORPORATE BULLETINS & OFFICIAL MEMOS */}
        <AnnouncementsSection />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
