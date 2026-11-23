import React, { useEffect, useRef, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MoonStar, MapPin, MapPinOff, LogIn, LogOut } from "lucide-react-native";
import { ThemeConfig } from "../../constants/theme";
import type { PunchModalData } from "../../stores/attendanceStore";

export interface AttendancePunchSheetProps {
  visible: boolean;
  onClose: () => void;
  punchData: PunchModalData | null;
  onConfirmCheckOut: () => void;
  onConfirmRemotePunch?: (actionType: "check_in" | "check_out") => void;
}

export function AttendancePunchSheet({
  visible,
  onClose,
  punchData,
  onConfirmCheckOut,
  onConfirmRemotePunch,
}: AttendancePunchSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Animation values
  const translateY = useMemo(
    () => new Animated.Value(screenHeight),
    [screenHeight],
  );
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const iconScale = useMemo(() => new Animated.Value(0), []);
  const haloScale = useMemo(() => new Animated.Value(0.9), []);
  const haloOpacity = useMemo(() => new Animated.Value(0.4), []);

  const isClosingRef = useRef(false);
  const breathingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isRemoteRequest = punchData?.type === "remote_request";
  const isEarlyWarning =
    punchData?.isEarlyDeparture || punchData?.type === "check_out_warning";

  // Entrance & breathing animation
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}

      translateY.setValue(screenHeight);
      backdropOpacity.setValue(0);
      iconScale.setValue(0);
      haloScale.setValue(0.9);
      haloOpacity.setValue(0.4);

      // Spring sheet and icon in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(iconScale, {
            toValue: 1,
            damping: 12,
            stiffness: 210,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Gentle continuous halo breathing loop
      breathingLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(haloScale, {
              toValue: 1.25,
              duration: 1700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(haloOpacity, {
              toValue: 0.15,
              duration: 1700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(haloScale, {
              toValue: 0.95,
              duration: 1700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(haloOpacity, {
              toValue: 0.45,
              duration: 1700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      breathingLoopRef.current.start();
    } else {
      breathingLoopRef.current?.stop();
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

    return () => {
      breathingLoopRef.current?.stop();
    };
  }, [
    visible,
    screenHeight,
    translateY,
    backdropOpacity,
    iconScale,
    haloScale,
    haloOpacity,
  ]);

  // Pan responder to dismiss on downward swipe
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
          if (gesture.dy > 80 || gesture.vy > 0.5) {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
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
    [screenHeight, translateY, onClose],
  );

  if (!visible && !punchData) return null;

  const handleConfirm = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}
    onConfirmCheckOut();
  };

  const handleRemoteConfirm = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}
    const action = punchData?.actionType || "check_in";
    onConfirmRemotePunch?.(action);
  };

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

        {/* Bottom Sheet Card */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            ...Platform.select({
              ios: { borderCurve: "continuous" },
              default: {},
            }),
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
          className="bg-surface-card border-t border-surface-border shadow-2xl shadow-black/25 overflow-hidden"
        >
          {/* Native Pill Drag Handle (Swipe Down to Dismiss) */}
          <View
            {...panResponder.panHandlers}
            className="w-full items-center pt-3 pb-2"
          >
            <View className="w-12 h-1.5 rounded-full bg-surface-border" />
          </View>

          {/* Centered Celebration Body */}
          <View className="px-6 pt-2 pb-2 items-center gap-4">
            {/* Centered Animated Icon Stage with Radiating Halo */}
            <View className="items-center justify-center py-2 relative">
              {/* Radiating Breathing Halo */}
              <Animated.View
                style={{
                  transform: [{ scale: haloScale }],
                  opacity: haloOpacity,
                }}
                className={`absolute w-28 h-28 rounded-full ${
                  isRemoteRequest
                    ? "bg-amber-500/15"
                    : isEarlyWarning
                    ? "bg-accent-sunshine/15"
                    : "bg-brand-primary/10"
                }`}
              />

              {/* Centered Icon Container with Spring Entrance */}
              <Animated.View
                style={{
                  transform: [{ scale: iconScale }],
                }}
                className={`w-20 h-20 rounded-full items-center justify-center border shadow-sm ${
                  isRemoteRequest
                    ? "bg-amber-50 border-amber-200 shadow-amber-900/5"
                    : isEarlyWarning
                    ? "bg-amber-50 border-amber-200 shadow-amber-900/5"
                    : "bg-brand-primary-light border-brand-primary/20 shadow-brand-primary/10"
                }`}
              >
                {isRemoteRequest ? (
                  <MapPinOff
                    size={34}
                    color={ThemeConfig.accent.sunshine}
                    strokeWidth={2.2}
                  />
                ) : (
                  <MoonStar
                    size={36}
                    color={
                      isEarlyWarning
                        ? ThemeConfig.accent.sunshine
                        : ThemeConfig.brand.primary
                    }
                    strokeWidth={2.2}
                  />
                )}
              </Animated.View>
            </View>

            {/* Positive Uplifting Message (No time shown) */}
            <View className="items-center px-2 gap-1.5">
              <Text className="text-xl font-black text-content-primary text-center">
                {isRemoteRequest
                  ? "Outside Office Range 📍"
                  : isEarlyWarning
                  ? "Heading Out Early? 👋"
                  : "Great Work Today! 🌙"}
              </Text>
              <Text className="text-sm font-medium text-content-secondary text-center leading-relaxed">
                {isRemoteRequest
                  ? `You are not within range of Yangon HQ or Downtown Branch. Would you like to request a remote ${
                      punchData?.actionType === "check_out"
                        ? "check-out"
                        : "check-in"
                    }?`
                  : isEarlyWarning
                  ? "Great effort today! Take care, get some well-deserved rest, and enjoy your evening."
                  : "You've wrapped up for the day. Time to rest, recharge, and enjoy your evening!"}
              </Text>
            </View>

            {/* Clean Typographic Location Status (Strictly No Badge Box per Rule 4) */}
            <View className="flex-row items-center justify-center gap-1.5 pt-1">
              <MapPin
                size={12}
                color={
                  isRemoteRequest ||
                  punchData?.location?.verificationStatus === "remote"
                    ? ThemeConfig.accent.sunshine
                    : ThemeConfig.brand.primary
                }
              />
              <Text className="text-xs font-bold text-content-primary">
                {isRemoteRequest
                  ? "Off-Site Detection"
                  : punchData?.location?.locationLabel || "HQ Floor 4"}
              </Text>
              <Text className="text-xs text-content-muted">·</Text>
              <Text className="text-xs font-medium text-content-secondary">
                {isRemoteRequest
                  ? `${punchData?.location?.formattedDistance || "Off-site"} from nearest office`
                  : punchData?.location?.verificationStatus === "verified"
                  ? `Verified (${punchData.location.formattedDistance || "On-site"})`
                  : punchData?.location?.verificationStatus === "remote"
                  ? `Remote (${punchData.location.formattedDistance || "Off-site"})`
                  : "On-site"}
              </Text>
            </View>

            {/* Action Buttons */}
            {isRemoteRequest ? (
              <View className="w-full gap-2 mt-2">
                <TouchableOpacity
                  onPress={handleRemoteConfirm}
                  activeOpacity={0.85}
                  className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm bg-brand-primary active:bg-brand-primary-dark shadow-brand-primary/20"
                  accessibilityRole="button"
                  accessibilityLabel="Request remote punch"
                >
                  {punchData?.actionType === "check_out" ? (
                    <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
                  ) : (
                    <LogIn size={16} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                  <Text className="text-sm font-bold text-white">
                    {punchData?.actionType === "check_out"
                      ? "Request Remote Check-Out"
                      : "Request Remote Check-In"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDismiss}
                  activeOpacity={0.7}
                  className="w-full py-2.5 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text className="text-sm font-semibold text-content-muted">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleConfirm}
                activeOpacity={0.85}
                className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 mt-2 shadow-sm bg-brand-primary active:bg-brand-primary-dark shadow-brand-primary/20"
                accessibilityRole="button"
                accessibilityLabel="Confirm check out"
              >
                <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text className="text-sm font-bold text-white">
                  Confirm Check-Out
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
