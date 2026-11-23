import React, { useState } from "react";
import { View, Text, Pressable, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import {
  CalendarDays,
  Wallet,
  Clock,
  Megaphone,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Search,
  X,
} from "lucide-react-native";

import { useAuthStore } from "../../stores";
import { ThemeConfig } from "../../constants/theme";
import { CollapsibleHeader } from "../../components/common/CollapsibleHeader";
import { LeaveReviewSheet } from "../../components/team/LeaveReviewSheet";
import { SwipeableActionCard } from "../../components/common/SwipeableActionCard";
import type { JuniorLeave } from "../../types/home";

interface NotificationItem {
  id: string;
  category: "approvals" | "payroll" | "announcements";
  title: string;
  subtitle: string;
  timestamp: string;
  isRead: boolean;
  type: "leave_review" | "leave_decision" | "payroll_ready" | "attendance_summary" | "announcement";
  leavePayload?: JuniorLeave;
  actionRoute?: string;
  actionLabel?: string;
}

export default function InboxScreen() {
  const router = useRouter();
  const { role } = useAuthStore();
  const isManager = role === "Manager";

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReviewLeave, setSelectedReviewLeave] = useState<JuniorLeave | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Mock pending leave for review (accessible by managers)
  const initialPendingLeave: JuniorLeave = {
    id: "req-sarah-101",
    name: "Sarah Jenkins",
    role: "UI/UX Designer",
    department: "Design",
    leaveType: "Annual",
    startDate: "Nov 24, 2026",
    endDate: "Nov 26, 2026",
    days: 3,
    reason: "Attending a family reunion out of town.",
    status: "Pending",
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      category: "approvals",
      title: isManager
        ? "Leave Request: Sarah Jenkins"
        : "Annual Leave Approved",
      subtitle: isManager
        ? "3 days Annual Leave (Nov 24 – Nov 26) awaiting your review."
        : "David Thorne approved your 2-day Annual Leave (Dec 12 – Dec 13).",
      timestamp: "15m ago",
      isRead: false,
      type: isManager ? "leave_review" : "leave_decision",
      leavePayload: isManager ? initialPendingLeave : undefined,
      actionLabel: isManager ? "Review Request" : "View Details",
    },
    {
      id: "notif-2",
      category: "payroll",
      title: "November 2026 Payslip Generated",
      subtitle: "Net pay breakdown of 2,850,000 MMK is ready for your review.",
      timestamp: "2h ago",
      isRead: false,
      type: "payroll_ready",
      actionRoute: "/payroll",
      actionLabel: "View Payslip",
    },
    {
      id: "notif-3",
      category: "payroll",
      title: "Monthly Timesheet Verified",
      subtitle: "168.5 hours recorded with 98% on-time check-in rate for November.",
      timestamp: "1d ago",
      isRead: true,
      type: "attendance_summary",
      actionRoute: "/attendance",
      actionLabel: "View Timesheet",
    },
    {
      id: "notif-4",
      category: "announcements",
      title: "Q4 All-Hands Town Hall",
      subtitle: "Company-wide roadmap presentation scheduled this Friday at 3:00 PM EST.",
      timestamp: "2d ago",
      isRead: true,
      type: "announcement",
      actionLabel: "View Directive",
    },
  ]);

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleOpenReview = (leave: JuniorLeave) => {
    setSelectedReviewLeave(leave);
    setIsReviewOpen(true);
  };

  const handleApproveLeave = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.leavePayload?.id === id
          ? {
              ...n,
              isRead: true,
              subtitle: "Request approved and authorized.",
              actionLabel: "Approved",
            }
          : n
      )
    );
    setIsReviewOpen(false);
  };

  const handleDeclineLeave = (id: string, reason: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.leavePayload?.id === id
          ? {
              ...n,
              isRead: true,
              subtitle: `Request declined. Reason: "${reason}"`,
              actionLabel: "Declined",
            }
          : n
      )
    );
    setIsReviewOpen(false);
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredNotifications = notifications.filter((item) => {
    if (!trimmedQuery) return true;
    const inTitle = item.title.toLowerCase().includes(trimmedQuery);
    const inSubtitle = item.subtitle.toLowerCase().includes(trimmedQuery);
    const inCategory = item.category.toLowerCase().includes(trimmedQuery);
    const inPayload =
      item.leavePayload &&
      (item.leavePayload.name.toLowerCase().includes(trimmedQuery) ||
        item.leavePayload.department.toLowerCase().includes(trimmedQuery) ||
        item.leavePayload.leaveType.toLowerCase().includes(trimmedQuery) ||
        item.leavePayload.reason.toLowerCase().includes(trimmedQuery));

    return inTitle || inSubtitle || inCategory || inPayload;
  });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER */}
      <CollapsibleHeader
        title="Inbox"
        subtitle="Approvals, announcements & alerts"
        scrollY={scrollY}
        rightElement={
          unreadCount > 0 ? (
            <View className="flex-row items-center gap-2">
              <View className="px-2.5 py-0.5 rounded-full bg-accent-sunshine flex-row items-center gap-1 shadow-2xs">
                <View className="w-1.5 h-1.5 rounded-full bg-accent-sunshine-foreground" />
                <Text className="text-[11px] font-black text-accent-sunshine-foreground">
                  {unreadCount} NEW
                </Text>
              </View>
              <Pressable
                onPress={handleMarkAllRead}
                hitSlop={8}
                className="px-3 py-1.5 rounded-full bg-surface-card border border-surface-border shadow-xs active:bg-slate-100"
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
              >
                <Text className="text-xs font-bold text-brand-primary">
                  Mark read
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Text className="text-xs font-bold text-emerald-600">
                All Caught Up
              </Text>
            </View>
          )
        }
      />

      {/* 2. SEARCH BAR (Replaced Category Filter Chips) */}
      <View className="px-4 pt-1 pb-2">
        <View className="flex-row items-center bg-white border border-[#E2E8F0] rounded-2xl px-3.5 py-2.5 gap-2.5 shadow-xs">
          <Search size={16} color="#94A3B8" strokeWidth={2.2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search approvals, payslips, notices..."
            placeholderTextColor="#94A3B8"
            className="flex-1 text-xs font-semibold text-[#0F172A] p-0"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              className="w-5 h-5 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
            >
              <X size={12} color="#475569" strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 3. NOTIFICATION LIST BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 110,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ThemeConfig.brand.primary}
          />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View className="bg-white border border-[#E2E8F0] rounded-3xl p-8 items-center justify-center gap-2.5 shadow-sm shadow-slate-900/5 mt-4">
            <CheckCircle2
              size={32}
              color={trimmedQuery ? "#94A3B8" : "#10B981"}
              strokeWidth={2}
            />
            <Text className="text-sm font-bold text-[#0F172A] mt-1 text-center">
              {trimmedQuery
                ? `No notifications matching "${searchQuery}"`
                : "No notifications in inbox"}
            </Text>
            <Text className="text-xs text-[#64748B] text-center max-w-[240px]">
              {trimmedQuery
                ? "Try searching with a different colleague name, keyword, or leave type."
                : "You are all caught up with your updates and approval actions."}
            </Text>
            {trimmedQuery ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                className="mt-2 px-4 py-2 rounded-full bg-[#EFF2FC] border border-[#C7D2FE] active:bg-[#E0E7FF]"
              >
                <Text className="text-xs font-bold text-brand-primary">
                  Clear Search
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !item.isRead;

            // Icon by type using configured brand / status tokens
            let IconComp = CalendarDays;
            let iconColor: string = ThemeConfig.brand.primary; // #1F3FBF
            let iconBg: string = "bg-brand-primary-light"; // #EFF2FC

            if (item.category === "payroll") {
              if (item.type === "payroll_ready") {
                IconComp = Wallet;
                iconColor = "#059669";
                iconBg = "bg-[#ECFDF5]";
              } else {
                IconComp = Clock;
                iconColor = ThemeConfig.brand.primary;
                iconBg = "bg-brand-primary-light";
              }
            } else if (item.category === "announcements") {
              IconComp = Megaphone;
              iconColor = "#7C3AED";
              iconBg = "bg-[#F5F3FF]";
            }

            const cardContent = (
              <View
                className={`bg-surface-card border rounded-2xl p-4 shadow-sm shadow-slate-900/5 gap-3 ${
                  isUnread ? "border-brand-primary-light" : "border-surface-border"
                }`}
              >
                {/* Top Row: Icon + Title + Timestamp + Unread Dot */}
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-start gap-3 flex-1 min-w-0 pr-2">
                    <View
                      className={`w-9 h-9 rounded-2xl ${iconBg} items-center justify-center shrink-0 mt-0.5`}
                    >
                      <IconComp size={16} color={iconColor} strokeWidth={2.2} />
                    </View>

                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-bold text-[#0F172A] tracking-tight flex-1"
                        >
                          {item.title}
                        </Text>
                      </View>
                      <Text className="text-xs text-[#64748B] leading-5 mt-1">
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end gap-1.5 shrink-0">
                    <Text className="text-[11px] font-medium text-[#94A3B8]">
                      {item.timestamp}
                    </Text>
                    {isUnread && (
                      <View className="w-2.5 h-2.5 rounded-full bg-accent-sunshine shadow-xs" />
                    )}
                  </View>
                </View>

                {/* Bottom Action Footer */}
                {item.type === "leave_review" && item.leavePayload ? (
                  <View className="pt-2.5 border-t border-[#EEF2F6] flex-row items-center justify-between">
                    <Text className="text-[11px] font-semibold text-[#64748B]">
                      Swipe right to approve · left to decline
                    </Text>
                    <Pressable
                      onPress={() => handleOpenReview(item.leavePayload!)}
                      hitSlop={6}
                      className="px-3.5 py-1.5 rounded-full bg-brand-primary flex-row items-center gap-1 active:bg-brand-primary-dark"
                    >
                      <Text className="text-xs font-bold text-white">
                        Review
                      </Text>
                      <ArrowUpRight size={12} color="#FFFFFF" strokeWidth={2.4} />
                    </Pressable>
                  </View>
                ) : item.actionRoute ? (
                  <View className="pt-2.5 border-t border-[#EEF2F6] flex-row items-center justify-between">
                    <Text className="text-[11px] font-medium text-[#94A3B8]">
                      Tap to open details
                    </Text>
                    <Pressable
                      onPress={() => router.push(item.actionRoute as any)}
                      hitSlop={6}
                      className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 active:bg-slate-100"
                    >
                      <Text className="text-xs font-bold text-slate-700">
                        {item.actionLabel}
                      </Text>
                      <ChevronRight size={13} color="#475569" strokeWidth={2.2} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );

            if (item.type === "leave_review" && item.leavePayload) {
              return (
                <SwipeableActionCard
                  key={item.id}
                  onSwipeRight={() => handleApproveLeave(item.leavePayload!.id)}
                  rightLabel="Approve"
                  onSwipeLeft={() =>
                    handleDeclineLeave(
                      item.leavePayload!.id,
                      "Declined via quick swipe",
                    )
                  }
                  leftLabel="Decline"
                >
                  {cardContent}
                </SwipeableActionCard>
              );
            }

            return (
              <View key={item.id}>
                {cardContent}
              </View>
            );
          })
        )}
      </Animated.ScrollView>

      {/* 4. LEAVE REVIEW BOTTOM SHEET MODAL */}
      <LeaveReviewSheet
        visible={isReviewOpen}
        leave={selectedReviewLeave}
        onClose={() => setIsReviewOpen(false)}
        onApprove={handleApproveLeave}
        onDecline={handleDeclineLeave}
      />
    </SafeAreaView>
  );
}
