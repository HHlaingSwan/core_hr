import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";
import {
  Bell,
  ChevronRight,
} from "lucide-react-native";
import { ThemeConfig } from "../../constants/theme";
import { useAnnouncementStore } from "../../stores";
import { AnnouncementReaderSheet } from "./AnnouncementReaderSheet";

export function AnnouncementsSection() {
  const {
    announcements,
    selectedAnnouncement,
    setSelectedAnnouncement,
    acknowledgeAnnouncement,
  } = useAnnouncementStore();

  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 390;
  // Card takes 82% of screen width, strictly capped at 340px
  const cardWidth = Math.min(Math.round(screenWidth * 0.82), 340);
  const CARD_HEIGHT = 215;
  const snapInterval = cardWidth + 12; // cardWidth + 12px gap
  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <>
      <View className="gap-3.5">
        {/* Section Header */}
        <View className="flex-row items-center justify-between px-0.5">
          <View className="flex-row items-center gap-2">
            <Bell size={16} color="#0F172A" />
            <Text className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
              Announcements
            </Text>
            {unreadCount > 0 && (
              <View className="flex-row items-center gap-1.5 pl-0.5">
                <View className="w-2 h-2 rounded-full bg-accent-sunshine" />
                <Text className="text-xs font-bold text-content-primary">
                  {unreadCount} new
                </Text>
              </View>
            )}
          </View>

          <Text className="text-xs font-semibold text-[#94A3B8]">Swipe →</Text>
        </View>

        {/* Horizontal Peek Carousel */}
        <View className="-mx-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 12,
            }}
          >
            {announcements.map((item) => {
              const categoryLabel =
                item.authorityCode === "MD"
                  ? "Executive Directive"
                  : item.authorityCode === "HR"
                    ? "HR Notice"
                    : "Engineering";

              return (
                <View
                  key={item.id}
                  style={{
                    width: cardWidth,
                    maxWidth: cardWidth,
                    height: CARD_HEIGHT,
                  }}
                  className="overflow-hidden"
                >
                  <Pressable
                    onPress={() => {
                      setSelectedAnnouncement(item);
                      if (!item.isRead) {
                        acknowledgeAnnouncement(item.id);
                      }
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => ({
                      width: "100%",
                      height: "100%",
                      opacity: pressed ? 0.88 : 1,
                    })}
                    className="w-full h-full bg-white border border-[#E2E5E9] rounded-3xl p-5 shadow-sm shadow-slate-900/5 justify-between gap-3"
                  >
                    {/* Top Metadata Row: Department Tag + Date */}
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                        <View
                          className={`w-2 h-2 rounded-full ${
                            !item.isRead ? "bg-accent-sunshine shadow-xs" : "bg-content-muted/40"
                          }`}
                        />
                        <Text
                          className="text-[11px] font-bold text-content-secondary capitalize tracking-wider"
                          numberOfLines={1}
                        >
                          {categoryLabel}
                        </Text>
                      </View>

                      <Text className="text-xs font-medium text-content-muted">
                        {item.date}
                      </Text>
                    </View>

                    {/* Body Content */}
                    <View
                      style={{ width: "100%", maxWidth: "100%" }}
                      className="gap-5 flex-1"
                    >
                      <Text
                        className="text-base font-bold text-content-primary leading-snug tracking-tight"
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        className="text-xs text-content-secondary leading-5 mt-0.5"
                        numberOfLines={3}
                      >
                        {item.summary}
                      </Text>
                    </View>

                    {/* Footer Attribution & Action */}
                    <View className="flex-row items-center justify-between pt-2.5 border-t border-surface-border">
                      <Text
                        className="text-xs font-medium text-content-muted flex-1 pr-2"
                        numberOfLines={1}
                      >
                        {item.issuer}
                      </Text>
                      <View className="flex-row items-center gap-0.5">
                        <Text className="text-xs font-bold text-brand-primary">
                          Read Memo
                        </Text>
                        <ChevronRight size={14} color={ThemeConfig.brand.primary} />
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Dedicated Distraction-Free Announcement Reader Sheet */}
      <AnnouncementReaderSheet
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </>
  );
}
