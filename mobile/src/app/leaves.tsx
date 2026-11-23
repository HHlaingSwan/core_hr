import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Calendar,
  Clock,
  Check,
  X,
  Plus,
  ChevronRight,
  Sun,
  HeartPulse,
  Coffee,
  CalendarOff,
  Users,
  Inbox,
} from "lucide-react-native";

import { ThemeConfig } from "../constants/theme";
import { useLeaveStore } from "../stores";
import { LeaveRequestDto, LeaveType } from "../types/leave";
import { CollapsibleHeader } from "../components/common/CollapsibleHeader";
import { RequestLeaveSheet } from "../components/home/leaves/RequestLeaveSheet";
import { LeaveBalancesSheet } from "../components/home/leaves/LeaveBalancesSheet";
import { LeaveRequestDetailSheet } from "../components/home/leaves/LeaveRequestDetailSheet";

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";

export default function LeavesHubScreen() {
  const router = useRouter();
  const { accruedBalances, myRequests, submitLeaveRequest } = useLeaveStore();

  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [isRequestSheetOpen, setIsRequestSheetOpen] = useState(false);
  const [selectedCategoryForRequest, setSelectedCategoryForRequest] =
    useState<LeaveType | null>(null);
  const [isBalancesSheetOpen, setIsBalancesSheetOpen] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] =
    useState<LeaveRequestDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 400);
  };

  // Balances calculation for hero overview
  const totalAvailable =
    accruedBalances.annual.left +
    accruedBalances.sick.left +
    accruedBalances.casual.left;

  // Requests stats & filtering
  const pendingRequests = myRequests.filter((r) => r.status === "Pending");
  const approvedRequests = myRequests.filter((r) => r.status === "Approved");
  const rejectedRequests = myRequests.filter(
    (r) => r.status === "Rejected" || r.status === "Cancelled",
  );

  const filteredRequests =
    activeFilter === "All"
      ? myRequests
      : activeFilter === "Pending"
        ? pendingRequests
        : activeFilter === "Approved"
          ? approvedRequests
          : rejectedRequests;

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "All", label: "All", count: myRequests.length },
    { key: "Pending", label: "Pending", count: pendingRequests.length },
    { key: "Approved", label: "Approved", count: approvedRequests.length },
    { key: "Rejected", label: "Declined", count: rejectedRequests.length },
  ];

  const handleOpenRequestModal = (category?: LeaveType) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedCategoryForRequest(category || "Annual");
    setIsRequestSheetOpen(true);
  };

  const handleOpenBalancesModal = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsBalancesSheetOpen(true);
  };

  const handleOpenRequestDetail = (request: LeaveRequestDto) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedRequestForDetail(request);
  };

  const getCategoryMeta = (type: LeaveType) => {
    switch (type) {
      case "Annual":
        return {
          title: "Annual Vacation Leave",
          tag: "Planned Vacation",
          color: ThemeConfig.brand.primary,
          iconBg: "bg-brand-primary-light",
          icon: Sun,
        };
      case "Sick":
        return {
          title: "Sick & Medical Leave",
          tag: "Medical Recovery",
          color: "#DC2626",
          iconBg: "bg-rose-50",
          icon: HeartPulse,
        };
      case "Casual":
        return {
          title: "Casual & Urgent Leave",
          tag: "Urgent Personal",
          color: "#6366F1",
          iconBg: "bg-indigo-50",
          icon: Coffee,
        };
      case "Unpaid":
        return {
          title: "Unpaid Leave",
          tag: "Discretionary",
          color: "#64748B",
          iconBg: "bg-slate-100",
          icon: CalendarOff,
        };
      default:
        return {
          title: `${type} Leave`,
          tag: "Leave",
          color: "#8B5CF6",
          iconBg: "bg-purple-50",
          icon: Users,
        };
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER WITH BACK BUTTON */}
      <CollapsibleHeader
        title="Time Off & Leaves"
        subtitle="Entitlements, requests & lead authorizations"
        scrollY={scrollY}
        showBackButton
        onBack={() => router.back()}
      />

      {/* 2. SCROLLABLE BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 100,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ThemeConfig.brand.primary}
          />
        }
      >
        {/* COMPACT HERO ALLOWANCE & ACTION CARD (NO PROGRESS BAR) */}
        <View className="bg-white border border-[#E2E5E9] rounded-3xl p-5 shadow-sm shadow-slate-900/5 gap-4">
          {/* Top Row: Total Days Available & Detail trigger */}
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Paid Leave Allowance (2026)
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

            {/* Tap to View Full Category Breakdown (No badge box, clean interactive link) */}
            <Pressable
              onPress={handleOpenBalancesModal}
              hitSlop={6}
              style={({ pressed }) => ({
                opacity: pressed ? 0.75 : 1,
              })}
              className="flex-row items-center gap-1 pt-1"
              accessibilityRole="button"
              accessibilityLabel="View leave breakdown and balance details"
            >
              <Text className="text-xs font-bold text-brand-primary">
                View Breakdown
              </Text>
              <ChevronRight size={13} color={ThemeConfig.brand.primary} />
            </Pressable>
          </View>

          {/* Differentiated Category Preview (Annual vs Sick vs Casual) */}
          <View className="pt-2.5 pb-1 border-t border-[#EEF2F6] flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Sun size={13} color={ThemeConfig.brand.primary} />
              <Text className="text-xs font-medium text-content-secondary">
                Annual: <Text className="font-bold text-content-primary font-mono">{accruedBalances.annual.left}d</Text>
              </Text>
            </View>
            <View className="w-[1px] h-3.5 bg-[#EEF2F6]" />
            <View className="flex-row items-center gap-1.5">
              <HeartPulse size={13} color="#DC2626" />
              <Text className="text-xs font-medium text-content-secondary">
                Sick: <Text className="font-bold text-content-primary font-mono">{accruedBalances.sick.left}d</Text>
              </Text>
            </View>
            <View className="w-[1px] h-3.5 bg-[#EEF2F6]" />
            <View className="flex-row items-center gap-1.5">
              <Coffee size={13} color="#6366F1" />
              <Text className="text-xs font-medium text-content-secondary">
                Casual: <Text className="font-bold text-content-primary font-mono">{accruedBalances.casual.left}d</Text>
              </Text>
            </View>
          </View>

          {/* Authoritative "Request Time Off" CTA */}
          <Pressable
            onPress={() => handleOpenRequestModal("Annual")}
            hitSlop={6}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
            className="w-full py-3.5 rounded-2xl bg-brand-primary flex-row items-center justify-center gap-2 shadow-sm shadow-brand-primary/20 active:bg-brand-primary-dark"
            accessibilityRole="button"
            accessibilityLabel="Request time off"
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text className="text-sm font-bold text-white tracking-wide">
              Request Time Off
            </Text>
          </Pressable>
        </View>

        {/* SECTION HEADER & FILTER PILLS */}
        <View className="gap-2.5 pt-1">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-sm font-bold text-[#0F172A] tracking-tight">
              Leave Requests & History
            </Text>
            <Text className="text-xs font-semibold text-[#64748B]">
              {filteredRequests.length} {filteredRequests.length === 1 ? "entry" : "entries"}
            </Text>
          </View>

          {/* Clean Filter Bar (No inner badge boxes, counts integrated inline) */}
          <View className="flex-row items-center gap-2">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    setActiveFilter(tab.key);
                  }}
                  hitSlop={6}
                  className={`px-3 py-1.5 rounded-full border ${
                    isActive
                      ? "bg-brand-primary border-brand-primary"
                      : "bg-white border-[#E2E8F0] active:bg-slate-50"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isActive ? "text-white" : "text-[#475569]"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* DISTINCT CONTEXTUAL CARDS STREAM (NO CONNECTED TIMELINE RAIL) */}
        {filteredRequests.length === 0 ? (
          <View className="bg-white border border-[#E2E5E9] rounded-2xl p-8 items-center justify-center gap-3 shadow-sm shadow-slate-900/5">
            <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
              <Inbox size={22} color="#94A3B8" />
            </View>
            <Text className="text-base font-bold text-[#0F172A]">
              No leave requests found
            </Text>
            <Text className="text-xs text-[#64748B] text-center max-w-[260px] leading-5">
              {activeFilter === "All"
                ? "You haven't submitted any leave requests yet. Tap Request Time Off above to apply."
                : `No ${activeFilter.toLowerCase()} leave requests at this time.`}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredRequests.map((item) => {
              const isPending = item.status === "Pending";
              const isApproved = item.status === "Approved";
              const meta = getCategoryMeta(item.leaveType);
              const IconComp = meta.icon;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleOpenRequestDetail(item)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                  })}
                  className={`bg-white border rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3 ${
                    isPending ? "border-orange-200" : "border-[#E2E5E9]"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.leaveType} leave request: ${item.status}`}
                >
                  {/* Top Row: Type-Specific Icon + Category Title + Pure Typographic Status (No Badge Box) */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <View
                        className={`w-8 h-8 rounded-xl ${meta.iconBg} items-center justify-center shrink-0`}
                      >
                        <IconComp size={16} color={meta.color} strokeWidth={2.2} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-bold text-[#0F172A] tracking-tight"
                        >
                          {meta.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-[11px] font-semibold text-[#64748B]"
                        >
                          {meta.tag} · {item.isHalfDay ? `0.5d (${item.halfDayPeriod || "Half"})` : `${item.daysCount}d`}
                        </Text>
                      </View>
                    </View>

                    {/* Pure Typographic Status Text + Dot Indicator */}
                    <View className="flex-row items-center gap-1.5 shrink-0">
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

                  {/* Schedule Dates Strip */}
                  <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#EEF2F6]">
                    <View className="flex-row items-center gap-1.5">
                      <Calendar size={13} color="#64748B" />
                      <Text className="text-xs font-bold text-[#0F172A]">
                        {item.startDate} – {item.endDate}
                      </Text>
                    </View>
                    <Text className="text-xs text-[#64748B] font-mono font-medium">
                      {item.daysCount} {item.daysCount === 1 ? "day" : "days"}
                    </Text>
                  </View>

                  {/* Reason Statement Snippet */}
                  <Text
                    numberOfLines={2}
                    className="text-xs text-[#475569] leading-5 italic"
                  >
                    &quot;{item.reason}&quot;
                  </Text>

                  {/* Bottom Attribution & Review Stage */}
                  <View className="pt-2 border-t border-[#EEF2F6] flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                      {isPending ? (
                        <>
                          <Clock size={12} color="#EA580C" />
                          <Text
                            numberOfLines={1}
                            className="text-[11px] font-semibold text-orange-700 flex-1"
                          >
                            Awaiting review with David Thorne
                          </Text>
                        </>
                      ) : isApproved ? (
                        <>
                          <Check size={12} color="#059669" />
                          <Text
                            numberOfLines={1}
                            className="text-[11px] font-semibold text-emerald-700 flex-1"
                          >
                            {item.managerComment
                              ? `Note: ${item.managerComment}`
                              : `Approved by ${item.approvedOrRejectedBy || "David Thorne"}`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <X size={12} color="#DC2626" />
                          <Text
                            numberOfLines={1}
                            className="text-[11px] font-semibold text-rose-700 flex-1"
                          >
                            {item.managerComment
                              ? `Declined: ${item.managerComment}`
                              : "Declined by Lead"}
                          </Text>
                        </>
                      )}
                    </View>

                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] text-[#94A3B8] font-medium">
                        {item.appliedOn}
                      </Text>
                      <ChevronRight size={12} color="#94A3B8" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      {/* 3. REQUEST LEAVE BOTTOM SHEET MODAL */}
      <RequestLeaveSheet
        visible={isRequestSheetOpen}
        initialLeaveType={selectedCategoryForRequest}
        onClose={() => {
          setIsRequestSheetOpen(false);
          setSelectedCategoryForRequest(null);
        }}
        onSubmit={submitLeaveRequest}
      />

      {/* 4. LEAVE BALANCES & POLICY BREAKDOWN SHEET */}
      <LeaveBalancesSheet
        visible={isBalancesSheetOpen}
        balances={accruedBalances}
        onClose={() => setIsBalancesSheetOpen(false)}
        onRequestCategory={(category) => {
          handleOpenRequestModal(category);
        }}
      />

      {/* 5. INDIVIDUAL LEAVE REQUEST DETAIL SHEET */}
      <LeaveRequestDetailSheet
        visible={!!selectedRequestForDetail}
        request={selectedRequestForDetail}
        onClose={() => setSelectedRequestForDetail(null)}
      />
    </SafeAreaView>
  );
}
