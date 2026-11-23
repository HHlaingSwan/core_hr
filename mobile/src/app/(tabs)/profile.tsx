import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  Mail,
  Building,
  Shield,
  MapPin,
  Clock,
  CalendarDays,
  CreditCard,
  Bell,
  ChevronRight,
  LogOut,
  Fingerprint,
} from "lucide-react-native";

import { useAuthStore, useLeaveStore, useToastStore } from "../../stores";
import { ThemeConfig } from "../../constants/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, role, logout } = useAuthStore();
  const { myRequests } = useLeaveStore();
  const { showToast } = useToastStore();

  const [isBiometricEnabled, setIsBiometricEnabled] = useState(true);
  const [biometricTypeLabel, setBiometricTypeLabel] =
    useState("Biometric Login");
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    (async () => {
      try {
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricTypeLabel("Face ID");
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricTypeLabel("Fingerprint / Touch ID");
        } else {
          setBiometricTypeLabel("Biometric Security");
        }
      } catch {}
    })();
  }, []);

  const handleToggleBiometric = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        showToast("Biometric hardware not available on this device", "warning");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to toggle biometric login",
        fallbackLabel: "Use device passcode",
      });

      if (result.success) {
        setIsBiometricEnabled((prev) => {
          const next = !prev;
          showToast(
            next
              ? `${biometricTypeLabel} authentication enabled`
              : `${biometricTypeLabel} authentication disabled`,
            "success",
          );
          return next;
        });
      }
    } catch {
      showToast("Biometric verification could not be completed", "warning");
    }
  };

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const initials = (user?.fullName || "Armad")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Telegram-style avatar shrink animation: 1.0 (104px) -> 0.54 (56px)
  const avatarAnimStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 110],
      [1.0, 0.54],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 110],
      [0, 14],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateY }, { scale }],
    };
  });

  // Hero extra details collapse and fade on scroll
  const heroDetailsAnimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 60],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      scrollY.value,
      [0, 60],
      [64, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      height,
      overflow: "hidden" as const,
    };
  });

  // Sticky top bar header border fades in on scroll
  const headerBorderAnimStyle = useAnimatedStyle(() => {
    const borderOpacity = interpolate(
      scrollY.value,
      [15, 60],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      borderBottomColor: `rgba(226, 232, 240, ${borderOpacity})`,
      borderBottomWidth: 1,
    };
  });

  // Sticky top bar title appears centered when hero scrolls up
  const topBarTitleAnimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [50, 95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [50, 95],
      [8, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const pendingLeavesCount = myRequests.filter(
    (r) => r.status === "Pending",
  ).length;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. STICKY CENTERED TOP BAR (No static title; Name & Role center on scroll) */}
      <Animated.View
        style={[headerBorderAnimStyle]}
        className="h-12 px-4 items-center justify-center bg-surface-background z-20"
      >
        <Animated.View
          style={[topBarTitleAnimStyle]}
          className="items-center justify-center"
        >
          <Text
            numberOfLines={1}
            className="text-sm font-bold text-content-primary text-center"
          >
            {user?.fullName || "Armad"}
          </Text>
          <Text
            numberOfLines={1}
            className="text-[10px] font-medium text-brand-primary text-center"
          >
            {user?.designation ||
              (role === "Manager"
                ? "Engineering Director"
                : "Senior Frontend Engineer")}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* 2. SCROLLABLE BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 130,
          gap: 16,
        }}
      >
        {/* TELEGRAM-STYLE CENTERED HERO */}
        <View className="items-center justify-center pt-2 pb-1">
          {/* Animated Centered Large Avatar */}
          <Animated.View
            style={[avatarAnimStyle]}
            className="w-[104px] h-[104px] rounded-full bg-slate-100 items-center justify-center p-1 border-2 border-white shadow-md shadow-slate-900/10"
          >
            <View className="w-full h-full rounded-full overflow-hidden bg-slate-200">
              {user?.avatarUrl && !imageError ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                  onError={() => setImageError(true)}
                />
              ) : (
                <View className="w-full h-full bg-brand-primary items-center justify-center">
                  <Text className="text-2xl font-bold text-brand-on-primary tracking-wider">
                    {initials}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Centered Name & Role Pill */}
          <View className="items-center mt-3 gap-1">
            {/* Animated Subtitle, Designation & Code (Collapses smoothly on scroll) */}
            <Animated.View
              style={[heroDetailsAnimStyle]}
              className="items-center justify-center w-full"
            >
              <Text className="text-xl font-bold text-content-primary tracking-tight text-center">
                {user?.fullName || "Armad"}
              </Text>
              <Text
                numberOfLines={1}
                className="text-xs text-content-secondary font-medium text-center"
              >
                {user?.designation ||
                  (role === "Manager"
                    ? "Engineering Director"
                    : "Senior Frontend Engineer")}
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* CARD 1: ESSENTIAL WORK INFO */}
        <View className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-3.5">
          <Text className="text-sm font-bold text-content-primary mb-0.5">
            Work Details
          </Text>

          {[
            {
              icon: Mail,
              label: "Work Email",
              value:
                user?.email ||
                (role === "Manager"
                  ? "david.thorne@acmecorp.com"
                  : "sarah.jenkins@acmecorp.com"),
            },
            {
              icon: Building,
              label: "Department",
              value: user?.department || "Product Engineering",
            },
            {
              icon: Shield,
              label: "Reporting Lead",
              value:
                user?.reportingManagerName ||
                (role === "Manager"
                  ? "Elena Rostova (VP)"
                  : "David Thorne (Director)"),
            },
            {
              icon: MapPin,
              label: "Location",
              value:
                user?.workLocation ||
                (role === "Manager" ? "SF HQ · Flexible" : "SF HQ · Hybrid"),
            },
          ].map((item, index) => {
            const IconComp = item.icon;
            return (
              <View
                key={item.label}
                className={`flex-row items-center justify-between ${
                  index > 0 ? "pt-3.5 border-t border-surface-border/70" : ""
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
                    <IconComp size={14} color="#475569" />
                  </View>
                  <Text className="text-xs font-semibold text-content-secondary">
                    {item.label}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  className="text-xs font-bold text-content-primary max-w-[55%] text-right"
                >
                  {item.value}
                </Text>
              </View>
            );
          })}
        </View>

        {/* CARD 2: QUICK RECORDS & HUBS (1-Tap Navigations) */}
        <View className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-3.5">
          <Text className="text-sm font-bold text-content-primary mb-0.5">
            My Records & Hubs
          </Text>

          {/* Attendance Hub */}
          <Pressable
            onPress={() => router.push("/attendance")}
            hitSlop={6}
            className="flex-row items-center justify-between active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Open attendance screen"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-brand-primary-light items-center justify-center">
                <Clock size={15} color={ThemeConfig.brand.primary} />
              </View>
              <View>
                <Text className="text-xs font-bold text-content-primary">
                  Attendance Records
                </Text>
                <Text className="text-[11px] text-content-muted mt-0.5">
                  168.5h worked · 98% on-time
                </Text>
              </View>
            </View>
            <ChevronRight size={14} color={ThemeConfig.content.muted} />
          </Pressable>

          {/* Time Off & Leaves */}
          <Pressable
            onPress={() => router.push("/leaves")}
            hitSlop={6}
            className="flex-row items-center justify-between pt-3.5 border-t border-surface-border/70 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Open time off and leaves hub"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-brand-primary-light items-center justify-center">
                <CalendarDays size={15} color={ThemeConfig.brand.primary} />
              </View>
              <View>
                <Text className="text-xs font-bold text-content-primary">
                  Time Off & Leaves
                </Text>
                <Text className="text-[11px] text-content-muted mt-0.5">
                  18 days left ·{" "}
                  {pendingLeavesCount > 0
                    ? `${pendingLeavesCount} pending`
                    : "all approved"}
                </Text>
              </View>
            </View>
            <ChevronRight size={14} color={ThemeConfig.content.muted} />
          </Pressable>

          {/* Payroll & Payslips */}
          <Pressable
            onPress={() => router.push("/payroll")}
            hitSlop={6}
            className="flex-row items-center justify-between pt-3.5 border-t border-surface-border/70 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Open payroll and payslips"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-brand-primary-light items-center justify-center">
                <CreditCard size={15} color={ThemeConfig.brand.primary} />
              </View>
              <View>
                <Text className="text-xs font-bold text-content-primary">
                  Payroll & Payslips
                </Text>
                <Text className="text-[11px] text-content-muted mt-0.5">
                  Direct deposit · Semi-monthly
                </Text>
              </View>
            </View>
            <ChevronRight size={14} color={ThemeConfig.content.muted} />
          </Pressable>
        </View>

        {/* CARD 3: APP & SECURITY */}
        <View className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-3.5">
          <Text className="text-sm font-bold text-content-primary mb-0.5">
            Settings & Security
          </Text>

          {/* Notification Alerts */}
          <Pressable
            hitSlop={6}
            className="flex-row items-center justify-between active:opacity-75"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
                <Bell size={14} color="#475569" />
              </View>
              <View>
                <Text className="text-xs font-bold text-content-primary">
                  Notifications
                </Text>
                <Text className="text-[11px] text-content-muted mt-0.5">
                  Push & email alerts
                </Text>
              </View>
            </View>
            <ChevronRight size={14} color="#94A3B8" />
          </Pressable>

          {/* Biometric Login with Real Native LocalAuthentication */}
          <Pressable
            onPress={handleToggleBiometric}
            hitSlop={6}
            className="flex-row items-center justify-between pt-3.5 border-t border-surface-border/70 active:opacity-75"
            accessibilityRole="switch"
            accessibilityState={{ checked: isBiometricEnabled }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
                <Fingerprint size={14} color="#475569" />
              </View>
              <View>
                <Text className="text-xs font-bold text-content-primary">
                  {biometricTypeLabel}
                </Text>
                <Text className="text-[11px] text-content-muted mt-0.5">
                  {isBiometricEnabled
                    ? `${biometricTypeLabel} active for security`
                    : "Tap to enable biometric prompt"}
                </Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: "#E2E8F0", true: ThemeConfig.brand.primary }}
              thumbColor="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* APP VERSION FOOTER */}
        <View className="items-center py-1">
          <Text className="text-[11px] font-mono text-content-muted">
            OmniHR Mobile v1.4.2 · Build 204
          </Text>
        </View>

        {/* SIGN OUT ACTION */}
        <Pressable
          onPress={async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            } catch {}
            await logout();
            showToast("Signed out", "info");
            router.replace("/login");
          }}
          hitSlop={6}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}
          className="w-full py-4 rounded-2xl bg-white border border-rose-200/80 items-center justify-center flex-row gap-2 active:bg-rose-50 shadow-sm shadow-slate-900/5"
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
          <Text className="text-sm font-bold text-rose-700">
            Sign Out of Account
          </Text>
        </Pressable>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
