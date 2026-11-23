import React, { useState } from "react";
import { View, Text, Dimensions } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  LinearTransition,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, X } from "lucide-react-native";
import { Motion } from "../../constants/motion";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 85;

export interface SwipeableActionCardProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  rightLabel?: string;
  onSwipeLeft?: () => void;
  leftLabel?: string;
  enabled?: boolean;
}

export function SwipeableActionCard({
  children,
  onSwipeRight,
  rightLabel = "Approve",
  onSwipeLeft,
  leftLabel = "Decline",
  enabled = true,
}: SwipeableActionCardProps) {
  const translateX = useSharedValue(0);
  const isThresholdMet = useSharedValue(0); // 0: none, 1: right, -1: left
  const [isDismissed, setIsDismissed] = useState(false);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const triggerNotificationHaptic = (type: Haptics.NotificationFeedbackType) => {
    try {
      Haptics.notificationAsync(type);
    } catch {}
  };

  const panGesture = Gesture.Pan()
    .enabled(enabled && !isDismissed)
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      // Disallow swiping in a direction that has no callback
      if (!onSwipeRight && event.translationX > 0) {
        translateX.value = event.translationX * 0.15; // heavy resistance
        return;
      }
      if (!onSwipeLeft && event.translationX < 0) {
        translateX.value = event.translationX * 0.15; // heavy resistance
        return;
      }

      translateX.value = event.translationX;

      // Haptic triggers when passing activation threshold
      if (event.translationX > SWIPE_THRESHOLD && isThresholdMet.value !== 1) {
        isThresholdMet.value = 1;
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      } else if (event.translationX < -SWIPE_THRESHOLD && isThresholdMet.value !== -1) {
        isThresholdMet.value = -1;
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      } else if (
        event.translationX > -SWIPE_THRESHOLD &&
        event.translationX < SWIPE_THRESHOLD &&
        isThresholdMet.value !== 0
      ) {
        isThresholdMet.value = 0;
      }
    })
    .onEnd((event) => {
      // Swipe Right Trigger (e.g. Approve)
      if (onSwipeRight && (event.translationX > SWIPE_THRESHOLD || event.velocityX > 800)) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(triggerNotificationHaptic)(Haptics.NotificationFeedbackType.Success);
            runOnJS(setIsDismissed)(true);
            runOnJS(onSwipeRight)();
          }
        });
        return;
      }

      // Swipe Left Trigger (e.g. Decline)
      if (onSwipeLeft && (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -800)) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(triggerNotificationHaptic)(Haptics.NotificationFeedbackType.Warning);
            runOnJS(setIsDismissed)(true);
            runOnJS(onSwipeLeft)();
          }
        });
        return;
      }

      // Return to resting center position with spring
      translateX.value = withSpring(0, Motion.spring.feedback);
      isThresholdMet.value = 0;
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Background action indicators styles
  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, 30, SWIPE_THRESHOLD], [0, 0.4, 1], Extrapolation.CLAMP);
    const scale = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.75, 1.05], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, -30, -SWIPE_THRESHOLD], [0, 0.4, 1], Extrapolation.CLAMP);
    const scale = interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0.75, 1.05], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18).stiffness(180)}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Underlying Actions Layer */}
      <View className="absolute inset-0 flex-row items-center justify-between px-5 rounded-2xl bg-slate-100">
        {/* Left Side: Approve Action (Revealed on Swipe Right) */}
        {onSwipeRight ? (
          <Animated.View style={rightActionStyle} className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-emerald-600 items-center justify-center">
              <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">
              {rightLabel}
            </Text>
          </Animated.View>
        ) : (
          <View />
        )}

        {/* Right Side: Decline Action (Revealed on Swipe Left) */}
        {onSwipeLeft ? (
          <Animated.View style={leftActionStyle} className="flex-row items-center gap-2">
            <Text className="text-xs font-extrabold text-rose-700 uppercase tracking-wider">
              {leftLabel}
            </Text>
            <View className="w-8 h-8 rounded-full bg-rose-600 items-center justify-center">
              <X size={18} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </Animated.View>
        ) : (
          <View />
        )}
      </View>

      {/* Foreground Interactive Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimatedStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
