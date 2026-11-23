import React from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";

export interface CollapsibleHeaderProps {
  title: string;
  subtitle?: string;
  scrollY: SharedValue<number>;
  rightElement?: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function CollapsibleHeader({
  title,
  subtitle,
  scrollY,
  rightElement,
  showBackButton,
  onBack,
}: CollapsibleHeaderProps) {
  // Container height compression on scroll (respects safe area, zero border, zero shadow)
  const headerContainerStyle = useAnimatedStyle(() => {
    const minHeight = showBackButton ? 52 : 48;
    const height = interpolate(
      scrollY.value,
      [0, 60],
      [76, minHeight],
      Extrapolation.CLAMP,
    );

    return {
      height,
    };
  });

  // Title scale animation
  const titleStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 60],
      [1.0, 0.84],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
      transformOrigin: "left center",
    };
  });

  // Subtitle smooth collapse and fade
  const subtitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 30],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      scrollY.value,
      [0, 30],
      [16, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      height,
      overflow: "hidden" as const,
    };
  });

  return (
    <Animated.View
      style={[headerContainerStyle]}
      className="px-4 justify-center bg-surface-background pt-2 pb-1"
    >
      <View className="flex-row items-center justify-between">
        {/* Optional Native Back Button */}
        {showBackButton && onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-white border border-[#E2E5E9] items-center justify-center active:bg-slate-100 shadow-sm shadow-slate-900/5 mr-3 shrink-0"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={18} color="#0F172A" strokeWidth={2.4} />
          </Pressable>
        ) : null}

        {/* Title & Optional Subtitle */}
        <View className="flex-1 min-w-0 pr-3 justify-center">
          <Animated.Text
            numberOfLines={1}
            style={[titleStyle]}
            className="text-2xl font-extrabold text-[#0F172A] tracking-tight"
          >
            {title}
          </Animated.Text>
          {subtitle ? (
            <Animated.View style={[subtitleStyle]}>
              <Text
                numberOfLines={1}
                className="text-xs font-semibold text-[#475569] mt-0.5"
              >
                {subtitle}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Optional Right Action Element (e.g. Role Toggle Pill) */}
        {rightElement ? (
          <View className="flex-row items-center shrink-0">
            {rightElement}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
