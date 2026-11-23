import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, Animated, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckCircle2, Info, AlertCircle } from "lucide-react-native";
import { useToastStore } from "../../stores";
import { ThemeConfig } from "../../constants/theme";

export function ToastNotification() {
  const insets = useSafeAreaInsets();
  const { toast, hideToast } = useToastStore();

  const [activeToast, setActiveToast] = useState(toast);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  // Animation values (useMemo prevents React 19 ref access during render)
  const translateY = useMemo(() => new Animated.Value(-70), []);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const scale = useMemo(() => new Animated.Value(0.94), []);

  const triggerDismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -70,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isDismissingRef.current = false;
      setActiveToast(null);
      hideToast();
    });
  }, [translateY, opacity, scale, hideToast]);

  useEffect(() => {
    if (toast) {
      setActiveToast(toast);
      isDismissingRef.current = false;

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      try {
        if (toast.type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else if (toast.type === "warning") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } catch {}

      translateY.setValue(-70);
      opacity.setValue(0);
      scale.setValue(0.94);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 240,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 18,
          stiffness: 240,
          useNativeDriver: true,
        }),
      ]).start();

      dismissTimerRef.current = setTimeout(() => {
        triggerDismiss();
      }, 2800);
    } else if (activeToast && !isDismissingRef.current) {
      triggerDismiss();
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [toast, translateY, opacity, scale, triggerDismiss]);

  // Swipe up to dismiss
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -5,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy < 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -20 || gesture.vy < -0.4) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            triggerDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 18,
              stiffness: 220,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [translateY, triggerDismiss],
  );

  if (!activeToast) return null;

  const isSuccess = activeToast.type === "success";
  const isWarning = activeToast.type === "warning";

  const IconComp = isSuccess ? CheckCircle2 : isWarning ? AlertCircle : Info;
  const iconColor = isSuccess
    ? "#10B981"
    : isWarning
    ? ThemeConfig.accent.sunshine
    : ThemeConfig.brand.primary;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    triggerDismiss();
  };

  return (
    <Animated.View
      style={{
        top: Math.max(insets.top, 16) + 8,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
      className="absolute left-4 right-4 z-50 items-center pointer-events-box-none"
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={handlePress}
        className="w-full max-w-sm px-4 py-3 rounded-2xl bg-white shadow-xl shadow-black/10 flex-row items-center gap-3 border border-surface-border active:bg-slate-50"
        accessibilityRole="alert"
      >
        <View className="w-8 h-8 rounded-full bg-surface-muted border border-surface-border items-center justify-center shrink-0">
          <IconComp size={16} color={iconColor} strokeWidth={2.4} />
        </View>
        <Text
          numberOfLines={2}
          className="flex-1 text-xs font-bold text-content-primary tracking-tight leading-snug"
        >
          {activeToast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
