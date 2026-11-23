import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, X, AlertCircle } from "lucide-react-native";
import type { JuniorLeave } from "../../types/home";

export interface LeaveReviewSheetProps {
  visible: boolean;
  leave: JuniorLeave | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onDecline: (id: string, reason: string) => void;
}

export function LeaveReviewSheet({
  visible,
  leave,
  onClose,
  onApprove,
  onDecline,
}: LeaveReviewSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Animation values
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Form states
  const [isDecliningMode, setIsDecliningMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard elevation listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Entrance spring animation
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      setIsDecliningMode(false);
      setRejectReason("");
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
  }, [visible, screenHeight, translateY, backdropOpacity]);

  // Swipe-down pan responder on header
  const panResponder = useRef(
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
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  ).current;

  if (!visible && !leave) return null;

  const handleDismiss = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Keyboard.dismiss();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleApproveAction = () => {
    if (!leave) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onApprove(leave.id);
  };

  const handleDeclineAction = () => {
    if (!leave || !rejectReason.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onDecline(leave.id, rejectReason.trim());
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

        {/* Sheet Card */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            ...Platform.select({
              ios: { borderCurve: "continuous" },
              default: {},
            }),
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + 10
                : Math.max(insets.bottom, 16) + 12,
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

          {/* Header */}
          <View
            {...panResponder.panHandlers}
            className="px-6 pt-1 pb-3 border-b border-surface-border flex-row items-center gap-3.5"
          >
            <View className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200/90 shadow-xs shrink-0">
              {leave?.avatarUrl ? (
                <Image
                  source={{ uri: leave.avatarUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full bg-brand-primary items-center justify-center">
                  <Text className="text-sm font-bold text-brand-on-primary">
                    {leave?.name ? leave.name.slice(0, 2).toUpperCase() : ""}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-1 min-w-0">
              <Text className="text-lg font-extrabold text-content-primary tracking-tight">
                {isDecliningMode ? "Decline Leave Request" : "Leave Authorization"}
              </Text>
              <Text className="text-xs font-medium text-content-secondary mt-0.5">
                {leave?.name} · {leave?.department}
              </Text>
            </View>
          </View>

          {/* Body Content */}
          <View className="px-6 py-4 gap-4">
            {/* Request Summary Card */}
            <View className="p-4 rounded-2xl bg-surface-muted border border-surface-border gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-content-secondary uppercase tracking-wider">
                  {leave?.leaveType} Leave
                </Text>
                <Text className="text-xs font-bold text-content-primary font-mono">
                  {leave?.days} {leave?.days === 1 ? "day" : "days"}
                </Text>
              </View>
              <Text className="text-base font-bold text-content-primary mt-0.5">
                {leave?.startDate} – {leave?.endDate}
              </Text>
              <Text className="text-xs text-content-secondary leading-5 mt-1 italic">
                &quot;{leave?.reason}&quot;
              </Text>
            </View>

            {/* Mandatory Rejection Form (If Declining) */}
            {isDecliningMode && (
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-content-primary">
                    Reason for declining <Text className="text-rose-500">*</Text>
                  </Text>
                  <Text className="text-xs text-rose-600 font-semibold">
                    Required
                  </Text>
                </View>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Explain why this request is declined..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                  className="w-full min-h-[95px] p-3.5 rounded-2xl bg-white border border-surface-border text-sm text-content-primary leading-6"
                />
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <AlertCircle size={13} color="#64748B" />
                  <Text className="text-xs text-content-muted">
                    This note will be logged and visible to {leave?.name}.
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View className="pt-2">
              {isDecliningMode ? (
                /* Confirm Decline Button */
                <Pressable
                  onPress={handleDeclineAction}
                  disabled={!rejectReason.trim()}
                  style={({ pressed }) => ({
                    opacity: pressed || !rejectReason.trim() ? 0.75 : 1,
                  })}
                  className={`w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm ${
                    rejectReason.trim()
                      ? "bg-rose-600 active:bg-rose-700"
                      : "bg-slate-300"
                  }`}
                >
                  <Text className="text-sm font-bold text-white tracking-wide">
                    Confirm Decline
                  </Text>
                </Pressable>
              ) : (
                /* Dual Action Buttons: Decline & Approve */
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => setIsDecliningMode(true)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.8 : 1,
                    })}
                    className="flex-1 py-4 rounded-2xl bg-surface-muted border border-surface-border items-center justify-center flex-row gap-1.5 active:bg-slate-200"
                  >
                    <X size={16} color="#64748B" strokeWidth={2.4} />
                    <Text className="text-sm font-bold text-content-secondary">
                      Decline
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleApproveAction}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.88 : 1,
                    })}
                    className="flex-1 py-4 rounded-2xl bg-brand-primary active:bg-brand-primary-dark items-center justify-center flex-row gap-1.5 shadow-sm shadow-brand-primary/20"
                  >
                    <Check size={16} color="#FFFFFF" strokeWidth={2.4} />
                    <Text className="text-sm font-bold text-brand-on-primary">
                      Approve
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
