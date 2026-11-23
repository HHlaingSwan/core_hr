import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Cake,
  User,
  Heart,
  Phone,
  Mail,
  MapPin,
  Building,
  Clock,
  Calendar,
} from "lucide-react-native";
import type { TeamMemberPresence } from "../../types/home";

export interface ColleagueProfileSheetProps {
  visible: boolean;
  member: TeamMemberPresence | null;
  onClose: () => void;
}

function calculateAge(dobStr?: string): string {
  if (!dobStr) return "";
  try {
    const parts = dobStr.split("-").map(Number);
    if (parts.length === 3) {
      const birth = new Date(parts[0], parts[1] - 1, parts[2]);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return !isNaN(age) ? ` (${age} yrs)` : "";
    }
    return "";
  } catch {
    return "";
  }
}

function formatDOB(dobStr?: string): string {
  if (!dobStr) return "Not specified";
  try {
    const parts = dobStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return dobStr;
  } catch {
    return dobStr;
  }
}

export function ColleagueProfileSheet({
  visible,
  member,
  onClose,
}: ColleagueProfileSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Animation values
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Max sheet height: 85% of screen height
  const sheetHeight = Math.min(screenHeight * 0.85, 740);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      translateY.setValue(screenHeight);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 240,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, screenHeight, translateY, backdropOpacity]);

  // Swipe-down pan responder on header
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.5) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 220,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!visible && !member) return null;

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isClosingRef.current = false;
      onClose();
    });
  };

  const getStatusBadge = () => {
    if (!member) return null;
    if (member.status === "arrived") {
      return {
        label: `In Office · Arrived ${member.arrivalTime || "09:00"}`,
        text: "text-emerald-700",
        dot: "bg-emerald-500",
      };
    }
    if (member.status === "remote") {
      return {
        label: `Remote · Active ${member.arrivalTime || "08:30"}`,
        text: "text-blue-700",
        dot: "bg-blue-500",
      };
    }
    if (member.status === "on_leave") {
      return {
        label: `On Leave · Until ${member.leaveDetails?.until || "pending"}`,
        text: "text-amber-800",
        dot: "bg-amber-500",
      };
    }
    return {
      label: "Expected Today",
      text: "text-slate-600",
      dot: "bg-slate-400",
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View className="flex-1 justify-end">
        {/* Scrim Backdrop */}
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View
            style={{
              opacity: backdropOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.45],
              }),
            }}
            className="absolute inset-0 bg-black"
          />
        </TouchableWithoutFeedback>

        {/* Sheet Card */}
        <Animated.View
          style={{
            maxHeight: sheetHeight,
            transform: [{ translateY }],
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            ...Platform.select({
              ios: { borderCurve: "continuous" },
              default: {},
            }),
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
          className="bg-surface-card border-t border-surface-border shadow-2xl shadow-black/25 overflow-hidden flex-col"
        >
          {/* Native Drag Handle */}
          <View
            {...panResponder.panHandlers}
            className="w-full items-center pt-3 pb-2"
          >
            <View className="w-12 h-1.5 rounded-full bg-surface-border" />
          </View>

          {/* Hero Profile Header */}
          <View
            {...panResponder.panHandlers}
            className="px-6 pt-2 pb-4 border-b border-surface-border flex-row items-center gap-3.5"
          >
            {/* Avatar / Photo */}
            {member?.avatarUrl ? (
              <Image
                source={{ uri: member.avatarUrl }}
                className="w-14 h-14 rounded-full bg-slate-200 border border-surface-border"
              />
            ) : (
              <View className="w-14 h-14 rounded-full bg-brand-primary-light border border-brand-primary/20 items-center justify-center">
                <Text className="text-lg font-bold text-brand-primary">
                  {member?.name
                    ? member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                    : "EM"}
                </Text>
              </View>
            )}

            {/* Names & Role */}
            <View className="flex-1 gap-1">
              <Text
                selectable
                className="text-lg font-extrabold text-content-primary tracking-tight"
              >
                {member?.name}
              </Text>

              {member?.localName && (
                <Text
                  selectable
                  className="text-xs font-semibold text-content-secondary"
                >
                  {member.localName}
                </Text>
              )}

              <Text className="text-xs text-content-muted font-medium">
                {member?.role} · {member?.department}
              </Text>
            </View>
          </View>

          {/* Scrollable Information Body (Apple HIG Grouped Sections) */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 24,
              gap: 18,
            }}
          >
            {/* Live Presence Status (Pure typographic text + indicator dot, no badge box) */}
            {statusBadge && (
              <View className="self-start flex-row items-center gap-2 py-0.5">
                <View className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <Text
                  className={`text-xs font-bold tracking-wide ${statusBadge.text}`}
                >
                  {statusBadge.label}
                </Text>
              </View>
            )}

            {/* GROUP 1: DEMOGRAPHICS (Clean Inset Card with Thin Dividers) */}
            <View className="gap-2">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-muted px-1">
                Demographics
              </Text>

              <View className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                {/* Date of Birth */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <Cake size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Date of Birth
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary"
                  >
                    {formatDOB(member?.dob)}
                    {calculateAge(member?.dob)}
                  </Text>
                </View>

                {/* Gender */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <User size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Gender
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary"
                  >
                    {member?.gender || "Not specified"}
                  </Text>
                </View>

                {/* Marital Status */}
                <View className="flex-row items-center justify-between px-4 py-3.5">
                  <View className="flex-row items-center gap-2.5">
                    <Heart size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Marital Status
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary"
                  >
                    {member?.maritalStatus || "Not specified"}
                  </Text>
                </View>
              </View>
            </View>

            {/* GROUP 2: CONTACT & ADDRESS (Clean Inset Card) */}
            <View className="gap-2">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-muted px-1">
                Contact & Address
              </Text>

              <View className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                {/* Personal Phone */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <Phone size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Personal Phone
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-brand-primary"
                  >
                    {member?.phone || "+95 9 798 123 456"}
                  </Text>
                </View>

                {/* Email */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <Mail size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Corporate Email
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary"
                  >
                    {member?.email ||
                      `${member?.name?.toLowerCase().replace(/\s+/g, ".")}@company.com`}
                  </Text>
                </View>

                {/* Home Address */}
                <View className="px-4 py-3.5 gap-1.5">
                  <View className="flex-row items-center gap-2.5">
                    <MapPin size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Current Home Address
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-medium text-content-primary leading-5 pl-6"
                  >
                    {member?.address ||
                      "No. 42, Pyay Road, Kamayut Township, Yangon"}
                  </Text>
                </View>
              </View>
            </View>

            {/* GROUP 3: EMPLOYMENT & SCHEDULE (Clean Inset Card) */}
            <View className="gap-2">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-muted px-1">
                Employment Schedule
              </Text>

              <View className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                {/* Department */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <Building size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Department
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary"
                  >
                    {member?.department}
                  </Text>
                </View>

                {/* Shift Hours */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-border/60">
                  <View className="flex-row items-center gap-2.5">
                    <Clock size={16} color="#64748B" />
                    <Text className="text-xs font-semibold text-content-secondary">
                      Shift Schedule
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="text-xs font-bold text-content-primary font-mono"
                  >
                    {member?.shiftSchedule || "09:00 – 18:00"}
                  </Text>
                </View>

                {/* Leave Details (if currently on leave) */}
                {member?.leaveDetails && (
                  <View className="flex-row items-center justify-between px-4 py-3.5">
                    <View className="flex-row items-center gap-2.5">
                      <Calendar size={16} color="#D97706" />
                      <Text className="text-xs font-semibold text-amber-800">
                        {member.leaveDetails.type}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-amber-800">
                      Until {member.leaveDetails.until}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
