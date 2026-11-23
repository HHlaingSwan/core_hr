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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Clock,
  Download,
  Building2,
  TrendingUp,
  TrendingDown,
} from "lucide-react-native";

export interface PayslipBreakdownItem {
  id: string;
  name: string;
  amount: number;
  category: "Earning" | "Deduction";
  note?: string;
  type?:
    | "base"
    | "allowance"
    | "bonus"
    | "overtime"
    | "tax"
    | "late_fine"
    | "unpaid_cut"
    | "insurance";
}

export interface DetailedPayslip {
  id: string;
  monthName: string;
  payDate: string;
  status: "Paid" | "Scheduled";
  currency: string;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  bankName: string;
  bankAccountMasked: string;
  attendanceMetrics?: {
    workHours: number;
    daysPresent: number;
    onTimeRate: number;
    lateArrivals: number;
    unpaidLeaveDays: number;
  };
  earnings: PayslipBreakdownItem[];
  deductions: PayslipBreakdownItem[];
}

export interface PayslipDetailSheetProps {
  visible: boolean;
  payslip: DetailedPayslip | null;
  onClose: () => void;
}

function formatMMK(amount: number): string {
  return `${amount.toLocaleString("en-US")} MMK`;
}

export function PayslipDetailSheet({
  visible,
  payslip,
  onClose,
}: PayslipDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Animation values for native bottom sheet feel
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Max sheet height: 88% of screen
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

  // Swipe-down pan responder on header drag handle
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

  if (!visible && !payslip) return null;
  if (!payslip) return null;

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

  const isScheduled = payslip.status === "Scheduled";
  const metrics = payslip.attendanceMetrics;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View className="flex-1 justify-end">
        {/* Dimmed Backdrop */}
        <Animated.View
          style={{ opacity: backdropOpacity }}
          className="absolute inset-0 bg-slate-900/40"
        >
          <Pressable
            className="flex-1"
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close payslip breakdown"
          />
        </Animated.View>

        {/* Sliding Sheet Container */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight: sheetHeight,
          }}
          className="bg-white rounded-t-[32px] overflow-hidden shadow-2xl shadow-slate-900/20"
        >
          {/* Header Drag Handle Area */}
          <View {...panResponder.panHandlers} className="items-center pt-3 pb-1">
            <View className="w-12 h-1.5 rounded-full bg-slate-300" />
          </View>

          {/* Sheet App Bar (No close button; dismissed via drag handle or backdrop tap) */}
          <View className="px-5 pt-1 pb-3 border-b border-[#EEF2F6]">
            <Text
              numberOfLines={1}
              className="text-lg font-extrabold text-[#0F172A] tracking-tight"
            >
              Salary & Deductions
            </Text>
            <Text
              numberOfLines={1}
              className="text-xs font-semibold text-[#64748B] mt-0.5"
            >
              {payslip.monthName} · Official Statement
            </Text>
          </View>

          {/* Scrollable Content Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              gap: 14,
            }}
          >
            {/* 1. Net Pay Hero Summary Card */}
            <View className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Net Disbursed Salary
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`w-2 h-2 rounded-full ${
                      isScheduled ? "bg-accent-sunshine shadow-xs" : "bg-status-success"
                    }`}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isScheduled ? "text-accent-sunshine-dark font-extrabold" : "text-status-success"
                    }`}
                  >
                    {isScheduled ? "Scheduled for Nov 30" : "Paid Direct Deposit"}
                  </Text>
                </View>
              </View>

              <Text className="text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
                {formatMMK(payslip.netPay)}
              </Text>

              {/* Deposit Bank Strip */}
              <View className="pt-2.5 border-t border-[#EEF2F6] flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Building2 size={13} color="#64748B" />
                  <Text className="text-xs font-medium text-[#64748B]">
                    {payslip.bankName}
                  </Text>
                </View>
                <Text className="text-xs font-mono font-semibold text-[#0F172A]">
                  {payslip.bankAccountMasked}
                </Text>
              </View>
            </View>

            {/* 2. Attendance & Work Metrics Strip (Explains Deductions & Fines) */}
            {metrics ? (
              <View className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 gap-2 shadow-xs">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={13} color="#1F3FBF" />
                    <Text className="text-xs font-bold text-[#0F172A]">
                      Attendance Performance & Fines Log
                    </Text>
                  </View>
                  <Text className="text-[11px] text-[#64748B] font-medium">
                    {metrics.onTimeRate}% on-time
                  </Text>
                </View>

                <View className="flex-row items-center justify-between pt-2 border-t border-[#F1F5F9]">
                  <View className="items-center flex-1">
                    <Text className="text-[11px] text-[#94A3B8] font-medium">
                      Worked
                    </Text>
                    <Text className="text-xs font-bold text-[#0F172A] font-mono mt-0.5">
                      {metrics.daysPresent}d ({metrics.workHours}h)
                    </Text>
                  </View>
                  <View className="w-[1px] h-6 bg-[#EEF2F6]" />
                  <View className="items-center flex-1">
                    <Text className="text-[11px] text-[#94A3B8] font-medium">
                      Late Arrivals
                    </Text>
                    <Text
                      className={`text-xs font-bold font-mono mt-0.5 ${
                        metrics.lateArrivals > 0
                          ? "text-rose-600"
                          : "text-[#0F172A]"
                      }`}
                    >
                      {metrics.lateArrivals} {metrics.lateArrivals === 1 ? "day" : "days"}
                    </Text>
                  </View>
                  <View className="w-[1px] h-6 bg-[#EEF2F6]" />
                  <View className="items-center flex-1">
                    <Text className="text-[11px] text-[#94A3B8] font-medium">
                      Unpaid Leave
                    </Text>
                    <Text
                      className={`text-xs font-bold font-mono mt-0.5 ${
                        metrics.unpaidLeaveDays > 0
                          ? "text-rose-600"
                          : "text-[#0F172A]"
                      }`}
                    >
                      {metrics.unpaidLeaveDays} {metrics.unpaidLeaveDays === 1 ? "day" : "days"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* 3. Allowances & Earnings Section (+) */}
            <View className="bg-white border border-[#E2E8F0] rounded-2xl p-4 gap-3 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <TrendingUp size={15} color="#10B981" />
                  <Text className="text-sm font-bold text-[#0F172A]">
                    Earnings & Allowances
                  </Text>
                </View>
                <Text className="text-xs font-bold text-emerald-700 font-mono">
                  +{formatMMK(payslip.grossEarnings)}
                </Text>
              </View>

              <View className="gap-2.5 pt-1">
                {payslip.earnings.map((item, idx) => (
                  <View
                    key={item.id}
                    className={`flex-row items-center justify-between ${
                      idx > 0 ? "pt-2.5 border-t border-[#F8FAFC]" : ""
                    }`}
                  >
                    <View className="flex-1 min-w-0 pr-2">
                      <Text
                        numberOfLines={1}
                        className="text-xs font-semibold text-[#0F172A]"
                      >
                        {item.name}
                      </Text>
                      {item.note ? (
                        <Text
                          numberOfLines={1}
                          className="text-[11px] text-[#64748B] mt-0.5"
                        >
                          {item.note}
                        </Text>
                      ) : null}
                    </View>

                    <Text className="text-xs font-bold text-emerald-600 font-mono">
                      +{formatMMK(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Deductions, Fines & Cut-offs Section (-) */}
            <View className="bg-white border border-[#E2E8F0] rounded-2xl p-4 gap-3 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <TrendingDown size={15} color="#EF4444" />
                  <Text className="text-sm font-bold text-[#0F172A]">
                    Deductions, Fines & Cut-offs
                  </Text>
                </View>
                <Text className="text-xs font-bold text-rose-600 font-mono">
                  -{formatMMK(payslip.totalDeductions)}
                </Text>
              </View>

              <View className="gap-2.5 pt-1">
                {payslip.deductions.map((item, idx) => {
                  const isFineOrCut =
                    item.type === "late_fine" || item.type === "unpaid_cut";

                  return (
                    <View
                      key={item.id}
                      className={`flex-row items-start justify-between ${
                        idx > 0 ? "pt-2.5 border-t border-[#F8FAFC]" : ""
                      }`}
                    >
                      <View className="flex-1 min-w-0 pr-2">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            numberOfLines={1}
                            className={`text-xs font-semibold ${
                              isFineOrCut ? "text-rose-700" : "text-[#0F172A]"
                            }`}
                          >
                            {item.name}
                          </Text>
                          {isFineOrCut ? (
                            <Text className="text-[11px] font-bold text-rose-600">
                              · Penalty
                            </Text>
                          ) : null}
                        </View>
                        {item.note ? (
                          <Text
                            numberOfLines={1}
                            className="text-[11px] text-[#64748B] mt-0.5"
                          >
                            {item.note}
                          </Text>
                        ) : null}
                      </View>

                      <Text className="text-xs font-bold text-rose-600 font-mono">
                        -{formatMMK(item.amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 5. Net Calculation Equation Strip */}
            <View className="p-3.5 bg-[#EFF2FC] border border-[#C7D2FE] rounded-2xl flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-semibold text-[#64748B] uppercase">
                  Equation
                </Text>
                <Text className="text-xs font-bold text-[#0F172A] font-mono mt-0.5">
                  Gross ({formatMMK(payslip.grossEarnings)}) − Cuts (
                  {formatMMK(payslip.totalDeductions)})
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-semibold text-[#64748B] uppercase">
                  Take-Home
                </Text>
                <Text className="text-xs font-extrabold text-[#1F3FBF] font-mono mt-0.5">
                  {formatMMK(payslip.netPay)}
                </Text>
              </View>
            </View>

            {/* 6. Download / Export Action Button */}
            <Pressable
              onPress={() => {
                try {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                } catch {}
                onClose();
              }}
              hitSlop={6}
              className="w-full py-3.5 rounded-2xl bg-brand-primary flex-row items-center justify-center gap-2 shadow-sm shadow-brand-primary/20 active:bg-brand-primary-dark mt-1"
              accessibilityRole="button"
              accessibilityLabel="Download payslip as PDF"
            >
              <Download size={16} color="#FFFFFF" strokeWidth={2.3} />
              <Text className="text-xs font-bold text-white tracking-wide">
                Download Official Payslip (PDF)
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
