import React, { useEffect, useRef, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { Announcement } from "../../types/home";

export interface AnnouncementReaderSheetProps {
  announcement: Announcement | null;
  onClose: () => void;
}

export function AnnouncementReaderSheet({
  announcement,
  onClose,
}: AnnouncementReaderSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Animation values (useMemo prevents React 19 ref access during render)
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const isClosingRef = useRef(false);

  // Max sheet height: 85% of screen height
  const sheetHeight = Math.min(screenHeight * 0.85, 720);

  useEffect(() => {
    if (announcement) {
      isClosingRef.current = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

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
  }, [announcement, screenHeight, translateY, backdropOpacity]);

  // Swipe-down pan responder on header / handle
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 0.6) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    [screenHeight, translateY, onClose],
  );

  if (!announcement) return null;

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  // Split text into readable paragraphs
  const paragraphs = (announcement.fullBody || announcement.summary || "")
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Modal
      visible={!!announcement}
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

        {/* Reader Card */}
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
            paddingBottom: Math.max(insets.bottom, 16) + 10,
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

          {/* Header: Title + Date/Issuer */}
          <View
            {...panResponder.panHandlers}
            className="px-6 pt-2 pb-3.5 border-b border-surface-border gap-1.5"
          >
            <Text
              selectable
              className="text-lg font-extrabold text-content-primary tracking-tight leading-snug"
            >
              {announcement.title}
            </Text>
            <Text className="text-xs font-medium text-content-secondary">
              {announcement.date}
              {announcement.issuer ? ` · ${announcement.issuer}` : ""}
            </Text>
          </View>

          {/* Clean Scrollable Prose Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 24,
              gap: 14,
            }}
          >
            {paragraphs.map((p, idx) => (
              <Text
                key={idx}
                selectable
                className="text-[15px] leading-7 text-content-secondary font-normal"
              >
                {p}
              </Text>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
