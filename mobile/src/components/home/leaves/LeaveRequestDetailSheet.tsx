import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Calendar,
  FileText,
  AlertCircle,
  Paperclip,
} from "lucide-react-native";
import { LeaveRequestDto } from "../../../types/leave";
import { ThemeConfig } from "../../../constants/theme";

export interface LeaveRequestDetailSheetProps {
  visible: boolean;
  request: LeaveRequestDto | null;
  onClose: () => void;
}

export function LeaveRequestDetailSheet({
  visible,
  request,
  onClose,
}: LeaveRequestDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const sheetHeight = Math.min(screenHeight * 0.88, 760);

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

  if (!visible && !request) return null;
  if (!request) return null;

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

  const isPending = request.status === "Pending";
  const isApproved = request.status === "Approved";

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
        <Animated.View
          style={{ opacity: backdropOpacity }}
          className="absolute inset-0 bg-slate-900/40"
        >
          <Pressable
            className="flex-1"
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close leave request details sheet"
          />
        </Animated.View>

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

          {/* Header */}
          <View
            {...panResponder.panHandlers}
            className="px-6 pt-1 pb-3 border-b border-surface-border flex-row items-center justify-between"
          >
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-content-primary tracking-tight">
                Leave Request Details
              </Text>
              <Text className="text-xs font-semibold text-content-secondary mt-0.5">
                Reference ID: #{request.id.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 24,
              gap: 16,
            }}
          >
            {/* Hero Request Summary Card */}
            <View className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3.5">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-xl font-extrabold text-content-primary tracking-tight">
                    {request.leaveType} Leave
                  </Text>
                  <Text className="text-xs font-semibold text-content-secondary mt-0.5">
                    {request.isHalfDay
                      ? `Half Day (${request.halfDayPeriod || "Day period"}) · 0.5 working day`
                      : `${request.daysCount} working ${request.daysCount === 1 ? "day" : "days"}`}
                  </Text>
                </View>

                {/* Pure Typographic Status (No badge box!) */}
                <View className="flex-row items-center gap-1.5 shrink-0 pt-0.5">
                  <View
                    className={`w-2 h-2 rounded-full ${
                      isPending
                        ? "bg-orange-500"
                        : isApproved
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                    }`}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isPending
                        ? "text-orange-600"
                        : isApproved
                          ? "text-emerald-600"
                          : "text-rose-600"
                    }`}
                  >
                    {isPending
                      ? "Pending review"
                      : isApproved
                        ? "Approved"
                        : "Declined"}
                  </Text>
                </View>
              </View>

              {/* Schedule Strip */}
              <View className="p-3 rounded-xl bg-[#F8FAFC] border border-[#EEF2F6] flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Calendar size={15} color={ThemeConfig.brand.primary} />
                  <Text selectable className="text-xs font-bold text-content-primary">
                    {request.startDate} – {request.endDate}
                  </Text>
                </View>
                <Text className="text-xs font-mono font-bold text-content-secondary">
                  {request.daysCount}d deducted
                </Text>
              </View>
            </View>

            {/* Approval Journey Timeline Card */}
            <View className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                Authorization Journey
              </Text>

              {/* Timeline nodes */}
              <View className="pl-1 pt-1">
                {/* Node 1: Submission */}
                <View className="flex-row items-start gap-3 relative">
                  {/* Vertical connector line */}
                  <View className="w-0.5 absolute left-[7px] top-[16px] bottom-[-16px] bg-[#E2E8F0]" />
                  <View className="w-4 h-4 rounded-full bg-emerald-500 items-center justify-center shrink-0 z-10 mt-0.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-white" />
                  </View>
                  <View className="flex-1 pb-4">
                    <Text className="text-xs font-bold text-content-primary">
                      Request Submitted
                    </Text>
                    <Text className="text-[11px] text-content-secondary mt-0.5">
                      Submitted on {request.appliedOn}
                    </Text>
                  </View>
                </View>

                {/* Node 2: Lead Routing */}
                <View className="flex-row items-start gap-3 relative">
                  <View className="w-0.5 absolute left-[7px] top-[16px] bottom-[-16px] bg-[#E2E8F0]" />
                  <View
                    className={`w-4 h-4 rounded-full ${
                      isPending ? "bg-orange-500" : "bg-emerald-500"
                    } items-center justify-center shrink-0 z-10 mt-0.5`}
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-white" />
                  </View>
                  <View className="flex-1 pb-4">
                    <Text className="text-xs font-bold text-content-primary">
                      {isPending ? "Under Lead Review" : "Reviewed by Lead"}
                    </Text>
                    <Text className="text-[11px] text-content-secondary mt-0.5">
                      Approving Lead: {request.approvedOrRejectedBy || "David Thorne (Engineering Director)"}
                    </Text>
                  </View>
                </View>

                {/* Node 3: Decision */}
                <View className="flex-row items-start gap-3 relative">
                  <View
                    className={`w-4 h-4 rounded-full ${
                      isPending
                        ? "bg-slate-300"
                        : isApproved
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                    } items-center justify-center shrink-0 z-10 mt-0.5`}
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-content-primary">
                      {isPending
                        ? "Awaiting Lead Decision"
                        : isApproved
                          ? "Application Approved"
                          : "Application Declined"}
                    </Text>
                    <Text className="text-[11px] text-content-secondary mt-0.5">
                      {isPending
                        ? "Estimated authorization within 24 working hours."
                        : request.managerComment
                          ? `Decision note: "${request.managerComment}"`
                          : `Recorded by ${request.approvedOrRejectedBy || "David Thorne"}`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Submitted Reason Card */}
            <View className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-2">
              <View className="flex-row items-center gap-2">
                <FileText size={15} color="#64748B" />
                <Text className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                  Applicant Reason
                </Text>
              </View>
              <Text selectable className="text-sm text-content-primary leading-6 italic">
                &quot;{request.reason}&quot;
              </Text>
            </View>

            {/* Medical Certificate / Attachment (if any) */}
            {request.attachmentUrl ? (
              <View className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-2.5">
                <View className="flex-row items-center gap-2">
                  <Paperclip size={15} color="#64748B" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                    Supporting Document
                  </Text>
                </View>
                <Image
                  source={{ uri: request.attachmentUrl }}
                  className="w-full h-44 rounded-xl bg-slate-100 border border-slate-200"
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Policy & Payroll Impact Notice */}
            <View className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] gap-1">
              <View className="flex-row items-center gap-1.5">
                <AlertCircle size={14} color="#64748B" />
                <Text className="text-xs font-bold text-content-primary">
                  Payroll & Attendance Reflection
                </Text>
              </View>
              <Text className="text-xs text-content-secondary leading-5">
                {request.leaveType === "Unpaid"
                  ? "Unpaid leave will reflect as an itemized salary deduction on your monthly MMK payslip."
                  : "Paid leave hours are credited as full working days with zero penalty or deduction."}
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
