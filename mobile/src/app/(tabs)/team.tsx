import React, { useState } from "react";
import { View, Text, Pressable, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import {
  Search,
  Check,
  X,
  Users,
  ChevronRight,
} from "lucide-react-native";

import { useAuthStore, useLeaveStore } from "../../stores";
import { JuniorLeave, TeamMemberPresence } from "../../types/home";
import { mockTeamPresence } from "../../api/mockData";
import { CollapsibleHeader } from "../../components/common/CollapsibleHeader";
import { LeaveReviewSheet } from "../../components/team/LeaveReviewSheet";
import { ColleagueProfileSheet } from "../../components/team/ColleagueProfileSheet";

// Full team roster for the directory
const fullDirectory: TeamMemberPresence[] = mockTeamPresence;

export default function TeamScreen() {
  const { role } = useAuthStore();
  const isManager = role === "Manager";

  const { juniorLeaves, decideLeave } = useLeaveStore();

  const [searchQuery, setSearchQuery] = useState("");

  // Selected leave request for Bottom Sheet modal review (manager only)
  const [activeReviewLeave, setActiveReviewLeave] = useState<JuniorLeave | null>(
    null,
  );

  // Member profile view modal (only accessible to Manager)
  const [viewingProfileMember, setViewingProfileMember] =
    useState<TeamMemberPresence | null>(null);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Filter roster by search text across name, role, and department
  const filteredTeam = fullDirectory.filter((member) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      member.name.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q) ||
      member.department.toLowerCase().includes(q)
    );
  });

  // Tap handler: progressive disclosure via bottom sheet on demand
  const handleMemberPress = (member: TeamMemberPresence) => {
    if (!isManager) return;

    const activeLeave = juniorLeaves.find(
      (jl) => jl.name.toLowerCase() === member.name.toLowerCase(),
    );

    if (activeLeave?.status === "Pending") {
      setActiveReviewLeave(activeLeave);
    } else {
      setViewingProfileMember(member);
    }
  };

  const handleApprove = (id: string) => {
    decideLeave(id, "Approved");
    setActiveReviewLeave(null);
  };

  const handleConfirmDecline = (id: string, reason: string) => {
    decideLeave(id, "Declined", reason);
    setActiveReviewLeave(null);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER */}
      <CollapsibleHeader
        title="Team"
        subtitle="Live presence, colleagues & authorizations"
        scrollY={scrollY}
      />

      {/* 2. SCROLLABLE BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 110,
          gap: 16,
        }}
      >
        {/* Search Bar */}
        <View className="flex-row items-center px-4 py-3 rounded-2xl bg-white border border-[#E2E5E9] gap-2.5 shadow-sm shadow-slate-900/5">
          <Search size={16} color="#475569" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search colleagues by name, role, department..."
            placeholderTextColor="#94A3B8"
            className="flex-1 text-sm text-[#0F172A] p-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
              <X size={15} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* SINGLE UNIFIED TEAM ROSTER CONTAINER */}
        <View className="bg-white border border-[#E2E5E9] rounded-3xl p-5 shadow-sm shadow-slate-900/5 gap-3.5">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-[#EEF2F6]">
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#475569" />
              <Text className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                Team Roster ({filteredTeam.length})
              </Text>
            </View>

            {isManager && (
              <Text className="text-[11px] font-medium text-[#94A3B8]">
                Tap for details
              </Text>
            )}
          </View>

          {filteredTeam.map((member, index) => {
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const isArrived = member.status === "arrived";
            const isRemote = member.status === "remote";
            const isOnLeave = member.status === "on_leave";

            // Check if member has pending leave
            const activeLeave = juniorLeaves.find(
              (jl) => jl.name.toLowerCase() === member.name.toLowerCase(),
            );
            const hasPendingLeave = activeLeave?.status === "Pending";

            // Clean, scan-friendly row content
            const rowContent = (
              <View className="flex-row items-center justify-between gap-3">
                {/* Left: Avatar with demo picture & subtle indicator dot if leave requested */}
                <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                  <View className="relative shrink-0">
                    {/* Inner circular avatar (overflow-hidden to clip image) */}
                    <View className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden border border-slate-200/90 shadow-xs">
                      {member.avatarUrl ? (
                        <Image
                          source={{ uri: member.avatarUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-full h-full bg-brand-primary items-center justify-center">
                          <Text className="text-sm font-bold text-brand-on-primary tracking-wider">
                            {initials}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Unclipped notification dot floating cleanly above avatar */}
                    {isManager && hasPendingLeave && (
                      <View className="w-3.5 h-3.5 rounded-full bg-accent-sunshine border-2 border-white absolute -top-0.5 -right-0.5 z-20 shadow-xs" />
                    )}
                  </View>

                  <View className="flex-1 min-w-0 justify-center">
                    <View className="flex-row items-center gap-2">
                      <Text
                        numberOfLines={1}
                        className="text-[15px] font-bold text-[#0F172A] tracking-tight"
                      >
                        {member.name}
                      </Text>
                      {/* Typographic indicator if leave requested (manager only, no badge box) */}
                      {isManager && hasPendingLeave && (
                        <Text className="text-xs font-extrabold text-accent-sunshine-dark">
                          · Leave req
                        </Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      className="text-xs text-[#475569] font-medium mt-0.5"
                    >
                      {member.role}
                    </Text>
                  </View>
                </View>

                {/* Right: Typographic Presence Status */}
                <View className="items-end justify-center min-w-[75px]">
                  {isArrived && (
                    <>
                      <Text className="text-sm font-bold text-[#0F172A] font-mono">
                        {member.arrivalTime}
                      </Text>
                      <Text className="text-xs text-[#475569] font-medium mt-0.5">
                        In office
                      </Text>
                    </>
                  )}

                  {isOnLeave && (
                    <>
                      <Text className="text-sm font-bold text-rose-600">
                        On leave
                      </Text>
                      {member.leaveDetails && (
                        <Text className="text-xs text-[#475569] font-medium mt-0.5">
                          Until {member.leaveDetails.until}
                        </Text>
                      )}
                    </>
                  )}

                  {isRemote && (
                    <>
                      <Text className="text-sm font-bold text-[#475569]">
                        Remote
                      </Text>
                      {member.arrivalTime && (
                        <Text className="text-xs text-[#475569] font-mono mt-0.5">
                          Active {member.arrivalTime}
                        </Text>
                      )}
                    </>
                  )}

                  {!isArrived && !isOnLeave && !isRemote && (
                    <Text className="text-xs text-[#94A3B8] font-medium">
                      Expected
                    </Text>
                  )}
                </View>

                {/* Manager Navigation Chevron */}
                {isManager && (
                  <ChevronRight size={14} color="#94A3B8" />
                )}
              </View>
            );

            return (
              <View
                key={member.id}
                className={`py-3.5 ${
                  index > 0 ? "border-t border-[#EEF2F6]" : ""
                } gap-1.5`}
              >
                {/* Manager: Tap row to open details sheet; Staff: Static View */}
                {isManager ? (
                  <Pressable
                    onPress={() => handleMemberPress(member)}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {rowContent}
                  </Pressable>
                ) : (
                  <View>{rowContent}</View>
                )}

                {/* Logged Receipt if already decided (Manager only) */}
                {isManager && activeLeave && activeLeave.status !== "Pending" && (
                  <View className="pl-[58px] pt-0.5 flex-row items-center gap-1.5">
                    {activeLeave.status === "Approved" ? (
                      <Check size={12} color="#059669" />
                    ) : (
                      <X size={12} color="#DC2626" />
                    )}
                    <Text
                      numberOfLines={1}
                      className={`text-[11px] font-semibold ${
                        activeLeave.status === "Approved"
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {activeLeave.status === "Approved"
                        ? `Approved (${activeLeave.days}d ${activeLeave.leaveType})`
                        : `Declined: ${activeLeave.managerComment || "Schedule conflict"}`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* 3. MANAGER LEAVE REVIEW & DECLINE SHEET */}
      <LeaveReviewSheet
        visible={!!activeReviewLeave && isManager}
        leave={activeReviewLeave}
        onClose={() => {
          setActiveReviewLeave(null);
        }}
        onApprove={handleApprove}
        onDecline={handleConfirmDecline}
      />

      {/* 4. COLLEAGUE QUICK PROFILE SHEET */}
      <ColleagueProfileSheet
        visible={!!viewingProfileMember && isManager}
        member={viewingProfileMember}
        onClose={() => setViewingProfileMember(null)}
      />
    </SafeAreaView>
  );
}
