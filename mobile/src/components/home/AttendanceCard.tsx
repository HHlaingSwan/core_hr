import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
} from "react-native-reanimated";
import {
  LogIn,
  LogOut,
  RotateCcw,
  CheckCircle2,
  MapPin,
} from "lucide-react-native";
import { ThemeConfig } from "../../constants/theme";
import { Motion } from "../../constants/motion";
import { useAttendanceStore, useToastStore } from "../../stores";
import { AttendancePunchSheet } from "./AttendancePunchSheet";

export function AttendanceCard() {
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

  // Animation shared values (60fps worklets)
  const buttonScale = useSharedValue(1);
  const pressProgress = useSharedValue(0);
  const pulseScale = useSharedValue(0.9);
  const pulseOpacity = useSharedValue(0);
  const statusPulseScale = useSharedValue(1);

  const [isHolding, setIsHolding] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midHapticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isPunchingRef = useRef(false);

  // Status dot breathing pulse while shift is active
  useEffect(() => {
    if (isCheckedIn && !isCompletedToday) {
      statusPulseScale.value = withRepeat(
        withSequence(
          withTiming(1.35, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1.0, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    } else {
      statusPulseScale.value = 1;
    }
  }, [isCheckedIn, isCompletedToday, statusPulseScale]);

  const executePunch = async () => {
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

  const handleStartHold = () => {
    if (isLocating || isCompletedToday) return;

    setIsHolding(true);
    isPunchingRef.current = false;

    // Initial subtle tactile tap
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    // Spring button down & animate progress fill
    buttonScale.value = withSpring(
      Motion.scale.pressed,
      Motion.spring.feedback,
    );
    pressProgress.value = withTiming(1, {
      duration: Motion.timing.holdToPunch,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
    });

    // Midway haptic pulse (at 320ms)
    midHapticTimeoutRef.current = setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }, Motion.timing.holdToPunch * 0.5);

    // Completion trigger (at 650ms)
    holdTimeoutRef.current = setTimeout(async () => {
      isPunchingRef.current = true;
      setIsHolding(false);

      // Heavy completion haptic
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Radiating confirmation wave
      pulseScale.value = 0.9;
      pulseOpacity.value = 0.8;
      pulseScale.value = withTiming(2.2, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      });
      pulseOpacity.value = withTiming(0, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      });

      // Elastic bounce back
      buttonScale.value = withSpring(
        Motion.scale.active,
        Motion.spring.emphasis,
      );
      pressProgress.value = withTiming(0, { duration: 150 });

      await executePunch();
    }, Motion.timing.holdToPunch);
  };

  const handleCancelHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (midHapticTimeoutRef.current) clearTimeout(midHapticTimeoutRef.current);

    if (!isPunchingRef.current) {
      setIsHolding(false);
      buttonScale.value = withSpring(
        Motion.scale.active,
        Motion.spring.feedback,
      );
      pressProgress.value = withSpring(0, Motion.spring.feedback);
    }
  };

  const handleConfirmCheckOut = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    confirmCheckOut();
    showToast("Check-out recorded successfully", "success");
  };

  const handleConfirmRemotePunch = async (
    actionType: "check_in" | "check_out",
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    resetAttendanceDev();
    showToast("Attendance reset for demonstration", "info");
  };

  // Reanimated 60fps styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => {
    const scaleX = pressProgress.value;
    const opacity = interpolate(
      pressProgress.value,
      [0, 0.05, 1],
      [0, 0.4, 0.8],
    );
    return {
      opacity,
      transform: [{ scaleX }],
      transformOrigin: "left",
    };
  });

  const animatedPulseWaveStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const statusDotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statusPulseScale.value }],
  }));

  return (
    <>
      <View className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-4 overflow-hidden relative">
        {/* 1. Open Header: Shift Label, Timing & Dev Reset (No heavy border line) */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
            <Text className="text-xs font-extrabold text-content-primary uppercase tracking-wider">
              Today&apos;s Shift
            </Text>
            <Text className="text-xs text-content-muted">·</Text>
            <Text className="text-xs text-content-secondary font-mono">
              09:00 AM – 06:00 PM
            </Text>
          </View>

          {/* Right Status Indicator & Subtle Dev Reset (Strict Rule 4: Text & dot only, strictly no badge box) */}
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5">
              <Animated.View
                style={
                  isCheckedIn && !isCompletedToday
                    ? statusDotAnimatedStyle
                    : undefined
                }
                className={`w-2 h-2 rounded-full ${
                  isCompletedToday
                    ? "bg-brand-primary"
                    : isCheckedIn
                      ? "bg-brand-primary"
                      : "bg-accent-sunshine"
                }`}
              />
              <Text className="text-xs font-bold text-content-primary">
                {isCompletedToday
                  ? "Completed"
                  : isCheckedIn
                    ? "Active"
                    : "Pending"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleResetDev}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="w-5 h-5 items-center justify-center opacity-40 active:opacity-100 ml-0.5"
              accessibilityRole="button"
              accessibilityLabel="Reset attendance state"
            >
              <RotateCcw size={11} color={ThemeConfig.content.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Hero Digital Clock & Live Location (Airy, Zero Nested Boxes) */}
        <View className="pt-1 pb-0.5">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-3xl font-black font-mono text-content-primary tracking-tight">
              {currentTime}
            </Text>
            <View className="flex-row items-center gap-1">
              <MapPin
                size={12}
                color={
                  lastLocation?.verificationStatus === "remote"
                    ? ThemeConfig.accent.sunshine
                    : ThemeConfig.brand.primary
                }
              />
              <Text className="text-xs font-bold text-content-primary">
                {lastLocation?.locationLabel || "HQ Floor 4"}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-0.5">
            <Text className="text-[11px] font-medium text-content-muted">
              Standard 8h Shift · Flexible
            </Text>
            <Text className="text-[11px] font-medium text-content-secondary">
              {lastLocation?.verificationStatus === "verified"
                ? `Verified (${lastLocation.formattedDistance || "35m"})`
                : lastLocation?.verificationStatus === "remote"
                  ? `Remote (${lastLocation.formattedDistance || "Off-site"})`
                  : isCheckedIn
                    ? "On-site verified"
                    : "Floor 4 · Level 2"}
            </Text>
          </View>
        </View>

        {/* 3. Dual Typographic Stat Columns (Zero Chip Boxes) */}
        <View className="flex-row items-center justify-between py-1">
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
            <Text className="text-[11px] text-content-muted font-medium">
              {checkInTime ? "Arrival recorded" : "Expected 09:00 AM"}
            </Text>
          </View>

          {/* Subtle Hairline Vertical Separator */}
          <View className="w-[1px] h-9 bg-surface-border" />

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
            <Text className="text-[11px] text-content-muted font-medium">
              {checkOutTime ? "Departure recorded" : "Scheduled 06:00 PM"}
            </Text>
          </View>
        </View>

        {/* 5. Primary Action Button with 60fps Press-and-Hold & Ripple Wave */}
        {isCompletedToday ? (
          <View className="w-full py-3.5 rounded-2xl bg-surface-muted items-center justify-center flex-row gap-2">
            <CheckCircle2
              size={16}
              color={ThemeConfig.brand.primary}
              strokeWidth={2.2}
            />
            <Text className="text-xs font-bold text-content-primary">
              Shift completed for today
            </Text>
          </View>
        ) : isLocating ? (
          <View className="w-full py-3.5 rounded-2xl bg-brand-primary items-center justify-center flex-row gap-2 shadow-sm shadow-brand-primary/25 opacity-90">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">
              Acquiring GPS Location...
            </Text>
          </View>
        ) : (
          <View className="relative items-center justify-center">
            {/* Radiating Success Pulse Wave */}
            <Animated.View
              pointerEvents="none"
              style={[
                animatedPulseWaveStyle,
                {
                  position: "absolute",
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: ThemeConfig.brand.primary,
                },
              ]}
            />

            <Animated.View style={[animatedButtonStyle, { width: "100%" }]}>
              <Pressable
                onPressIn={handleStartHold}
                onPressOut={handleCancelHold}
                accessibilityRole="button"
                accessibilityLabel={
                  isCheckedIn ? "Hold to check out" : "Hold to check in"
                }
                className="w-full h-13 rounded-2xl bg-brand-primary active:bg-brand-primary-dark items-center justify-center overflow-hidden shadow-sm shadow-brand-primary/25 relative"
              >
                {/* Hold Progress Bar Fill */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    animatedProgressStyle,
                    {
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: "100%",
                      backgroundColor: ThemeConfig.brand.primaryDark,
                    },
                  ]}
                />

                {/* Button Content Row */}
                <View className="flex-row items-center gap-2 z-10">
                  {isCheckedIn ? (
                    <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
                  ) : (
                    <LogIn size={16} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                  <Text className="text-sm font-bold text-white">
                    {isHolding
                      ? isCheckedIn
                        ? "Hold to Check Out..."
                        : "Hold to Check In..."
                      : isCheckedIn
                        ? "Hold to Check Out"
                        : "Hold to Check In"}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>

      {/* Check-In / Check-Out Confirmation Modal */}
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
