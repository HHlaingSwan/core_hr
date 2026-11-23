import React, { useRef } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, DimensionValue } from "react-native";
import LottieView from "lottie-react-native";

export interface LoadingAnimationProps {
  width?: DimensionValue;
  height?: DimensionValue;
  size?: number;
  aspectRatio?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
  source?: any;
}

const DEFAULT_LOTTIE_SOURCE = require("../../../assets/animations/loading-animation.lottie");

// Native panoramic aspect ratio of the 556x240 animation
const NATIVE_ASPECT_RATIO = 556 / 240;

export function LoadingAnimation({
  width = "100%",
  size,
  aspectRatio = NATIVE_ASPECT_RATIO,
  loop = true,
  autoPlay = true,
  style,
  source = DEFAULT_LOTTIE_SOURCE,
}: LoadingAnimationProps) {
  const animationRef = useRef<LottieView>(null);

  // If size is provided, use size as width while preserving natural panoramic aspect ratio
  const containerWidth: DimensionValue = size ? size : width;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerWidth,
          aspectRatio,
          backgroundColor: "transparent",
        },
        style,
      ]}
    >
      <LottieView
        ref={animationRef}
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        resizeMode="contain"
        renderMode="AUTOMATIC"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
