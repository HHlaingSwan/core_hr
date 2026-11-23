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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Sun,
  HeartPulse,
  Coffee,
  CalendarOff,
  Users,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";
import { LeaveBalances } from "../../../stores/leaveStore";
import { LeaveType } from "../../../types/leave";
import { ThemeConfig } from "../../../constants/theme";

export interface LeaveBalancesSheetProps {
  visible: boolean;
  balances: LeaveBalances;
  onClose: () => void;
  onRequestCategory?: (leaveType: LeaveType) => void;
}

interface LeaveCategoryItem {
  key: string;
  leaveType: LeaveType;
  title: string;
  categoryTag: string;
  left: number;
  total: number;
  isUnlimited?: boolean;
  policyNote: string;
  statLabel: string;
  color: string;
  iconBg: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export function LeaveBalancesSheet({
  visible,
  balances,
  onClose,
  onRequestCategory,
}: LeaveBalancesSheetProps) {
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

  if (!visible && !balances) return null;

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

  const totalAllocated =
    balances.annual.total + balances.sick.total + balances.casual.total;
  const totalAvailable =
    balances.annual.left + balances.sick.left + balances.casual.left;
  const totalUsed = Math.max(0, totalAllocated - totalAvailable);

  // Clearly differentiated categories:
  // Annual is an accrued vacation entitlement; Sick is a medical protection net
  const categories: LeaveCategoryItem[] = [
    {
      key: "annual",
      leaveType: "Annual",
      title: "Annual Vacation Leave",
      categoryTag: "Accrued PTO · Planned Vacation",
      left: balances.annual.left,
      total: balances.annual.total,
      statLabel: `${balances.annual.left}d available (${balances.annual.total - balances.annual.left}d taken of ${balances.annual.total}d)`,
      policyNote: "Accrues 1.25 days/month · Up to 5 days rollover to 2027",
      color: ThemeConfig.brand.primary,
      iconBg: "bg-brand-primary-light",
      icon: Sun,
    },
    {
      key: "sick",
      leaveType: "Sick",
      title: "Sick & Medical Leave",
      categoryTag: "Health & Medical Recovery Net",
      left: balances.sick.left,
      total: balances.sick.total,
      statLabel: `${balances.sick.left}d available (Paid Medical Protection)`,
      policyNote: "Fully paid · Doctor consultation/cert required for >2 consecutive days",
      color: "#DC2626",
      iconBg: "bg-[#FEF2F2]",
      icon: HeartPulse,
    },
    {
      key: "casual",
      leaveType: "Casual",
      title: "Casual & Urgent Leave",
      categoryTag: "Short-Notice Urgent Needs",
      left: balances.casual.left,
      total: balances.casual.total,
      statLabel: `${balances.casual.left}d available of ${balances.casual.total}d`,
      policyNote: "Short notice allowed · Max 2 consecutive days per instance",
      color: "#6366F1",
      iconBg: "bg-[#EEF2FF]",
      icon: Coffee,
    },
    {
      key: "unpaid",
      leaveType: "Unpaid",
      title: "Unpaid Leave",
      categoryTag: "Discretionary Leave",
      left: balances.unpaid.left,
      total: balances.unpaid.total,
      isUnlimited: true,
      statLabel: "Discretionary (Subject to Approval)",
      policyNote: "Requires Director authorization · Itemized MMK salary adjustment",
      color: "#64748B",
      iconBg: "bg-[#F1F5F9]",
      icon: CalendarOff,
    },
    ...(balances.parental
      ? [
          {
            key: "parental",
            leaveType: "Maternity" as LeaveType,
            title: "Parental Leave",
            categoryTag: "Family Care & Statutory Allowance",
            left: balances.parental.left,
            total: balances.parental.total,
            statLabel: `${balances.parental.left}d statutory allocation`,
            policyNote: "Statutory paid allowance for primary caregivers",
            color: "#8B5CF6",
            iconBg: "bg-[#F5F3FF]",
            icon: Users,
          },
        ]
      : []),
  ];

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
            accessibilityLabel="Close leave balances sheet"
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
                Leave Balances & Policies
              </Text>
              <Text className="text-xs font-medium text-content-secondary mt-0.5">
                Allocated entitlements, used days & carryover rules
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
            {/* Overview Summary Card (Pure typographic stats, NO progress bar) */}
            <View className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3.5">
              <View className="flex-row items-start justify-between">
                <View>
                  <Text className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                    Total Paid Allowance (2026)
                  </Text>
                  <View className="flex-row items-baseline gap-1.5 mt-1">
                    <Text className="text-3xl font-extrabold text-content-primary font-mono tracking-tight">
                      {totalAvailable}
                    </Text>
                    <Text className="text-xs font-semibold text-content-secondary">
                      days available
                    </Text>
                  </View>
                </View>

                {/* Pure Typographic Status (No badge box!) */}
                <View className="items-end">
                  <Text className="text-sm font-bold text-brand-primary font-mono">
                    {totalAvailable}d Remaining
                  </Text>
                  <Text className="text-[10px] text-content-muted font-medium mt-0.5">
                    {totalUsed}d used of {totalAllocated}d allocated
                  </Text>
                </View>
              </View>

              {/* 3-Point Micro Stats */}
              <View className="pt-2.5 border-t border-[#EEF2F6] flex-row items-center justify-between">
                <View className="items-center flex-1">
                  <Text className="text-[10px] text-content-muted font-medium">Used</Text>
                  <Text className="text-xs font-bold text-content-primary font-mono mt-0.5">
                    {totalUsed}d
                  </Text>
                </View>
                <View className="w-[1px] h-5 bg-[#EEF2F6]" />
                <View className="items-center flex-1">
                  <Text className="text-[10px] text-content-muted font-medium">Available</Text>
                  <Text className="text-xs font-bold text-brand-primary font-mono mt-0.5">
                    {totalAvailable}d
                  </Text>
                </View>
                <View className="w-[1px] h-5 bg-[#EEF2F6]" />
                <View className="items-center flex-1">
                  <Text className="text-[10px] text-content-muted font-medium">Cycle</Text>
                  <Text className="text-xs font-bold text-content-primary font-mono mt-0.5">
                    2026
                  </Text>
                </View>
              </View>
            </View>

            {/* Section Header */}
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                Entitlement Categories
              </Text>
              <Text className="text-xs font-semibold text-content-muted">
                {categories.length} Types
              </Text>
            </View>

            {/* Differentiated Category Cards (Pure typographic stats, NO progress bars) */}
            <View className="gap-3">
              {categories.map((item) => {
                const IconComp = item.icon;

                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      if (onRequestCategory) {
                        handleDismiss();
                        setTimeout(() => {
                          onRequestCategory(item.leaveType);
                        }, 240);
                      }
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                    })}
                    className="bg-white border border-[#E2E5E9] rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3"
                  >
                    {/* Top Row: Icon + Title + Category Tag + Pure Typographic Available */}
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-start gap-3 flex-1 min-w-0 pr-2">
                        <View
                          className={`w-9 h-9 rounded-xl ${item.iconBg} items-center justify-center shrink-0 mt-0.5`}
                        >
                          <IconComp size={17} color={item.color} strokeWidth={2.2} />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text
                            numberOfLines={1}
                            className="text-sm font-bold text-content-primary tracking-tight"
                          >
                            {item.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            className="text-[11px] font-semibold text-content-muted mt-0.5"
                          >
                            {item.categoryTag}
                          </Text>
                        </View>
                      </View>

                      {/* Pure Typographic Status (No badge box!) */}
                      <View className="items-end shrink-0">
                        <Text className="text-sm font-extrabold text-content-primary font-mono">
                          {item.left}d left
                        </Text>
                        {!item.isUnlimited ? (
                          <Text className="text-[10px] text-content-muted font-medium">
                            of {item.total}d total
                          </Text>
                        ) : (
                          <Text className="text-[10px] text-content-muted font-medium">
                            unlimited
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Differentiated Context Details Strip (No progress bar) */}
                    <View className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#EEF2F6]">
                      <Text className="text-xs font-semibold text-content-primary">
                        {item.statLabel}
                      </Text>
                    </View>

                    {/* Policy note & tap hint */}
                    <View className="pt-2 border-t border-[#EEF2F6] flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                        <ShieldCheck size={12} color="#94A3B8" strokeWidth={2} />
                        <Text
                          numberOfLines={1}
                          className="text-[11px] text-content-secondary flex-1 font-medium"
                        >
                          {item.policyNote}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-0.5">
                        <Text className="text-[11px] font-bold text-brand-primary">
                          Apply
                        </Text>
                        <ChevronRight size={12} color={ThemeConfig.brand.primary} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* General Policy Footer Strip */}
            <View className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] gap-1">
              <View className="flex-row items-center gap-2">
                <Sparkles size={14} color={ThemeConfig.brand.primary} />
                <Text className="text-xs font-bold text-content-primary">
                  Accrual & Authorization Guidelines
                </Text>
              </View>
              <Text className="text-xs text-content-secondary leading-5 mt-1">
                Annual leave accrues continuously on the 1st of each calendar month. Requests longer than 3 consecutive working days require at least 5 business days advance submission. Sick leaves are granted for immediate health recovery. Unused annual leave up to 5 days carries forward into 2027.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
