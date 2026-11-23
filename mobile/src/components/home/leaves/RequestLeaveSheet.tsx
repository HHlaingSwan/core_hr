import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Paperclip,
  X,
  Sun,
  Sunset,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { LeaveType } from "../../../types/leave";
import { ThemeConfig } from "../../../constants/theme";
import { useLeaveStore } from "../../../stores";
import { CalendarRangePicker } from "./CalendarRangePicker";

export interface RequestLeaveSheetProps {
  visible: boolean;
  initialLeaveType?: LeaveType | null;
  onClose: () => void;
  onSubmit: (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    isHalfDay?: boolean;
    halfDayPeriod?: "Morning" | "Afternoon";
    attachmentUrl?: string;
  }) => void;
}

interface DropdownOption {
  type: LeaveType;
  label: string;
  balanceKey: "annual" | "sick" | "casual" | "unpaid" | "parental";
}

const DROPDOWN_OPTIONS: DropdownOption[] = [
  { type: "Annual", label: "Annual leave", balanceKey: "annual" },
  { type: "Sick", label: "Sick leave", balanceKey: "sick" },
  { type: "Casual", label: "Casual leave", balanceKey: "casual" },
  { type: "Unpaid", label: "Unpaid leave", balanceKey: "unpaid" },
  { type: "Maternity", label: "Parental leave", balanceKey: "parental" },
];

function getTodayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function RequestLeaveSheet({
  visible,
  initialLeaveType,
  onClose,
  onSubmit,
}: RequestLeaveSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { accruedBalances } = useLeaveStore();

  // Animation values
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Max sheet height: 90% of screen height
  const sheetHeight = Math.min(screenHeight * 0.9, 780);

  // Form states
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Calendar & Schedule states (Default to Today for single-day leave)
  const [startDate, setStartDate] = useState(getTodayISO);
  const [endDate, setEndDate] = useState(getTodayISO);
  const [baseDaysCount, setBaseDaysCount] = useState(1);

  // Half-Day states
  const [halfDayMode, setHalfDayMode] = useState<"Full" | "Morning" | "Afternoon">(
    "Full",
  );

  // Attachment states (Sick leave)
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);

  // Reason & Submission
  const [reason, setReason] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<any>(null);

  // Keyboard elevation listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 50);
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

  // Open / Close animation
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      if (initialLeaveType) {
        setLeaveType(initialLeaveType);
      }
      setIsDropdownOpen(false);
      setIsSubmitted(false);
      setHalfDayMode("Full");
      setAttachmentUri(null);

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
  }, [visible, initialLeaveType, screenHeight, translateY, backdropOpacity]);

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
        if (gesture.dy > 100 || gesture.vy > 0.6) {
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

  if (!visible) return null;

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

  // Handle Calendar Range Selection
  const handleRangeChange = (start: string, end: string, workingDays: number) => {
    setStartDate(start);
    setEndDate(end);
    setBaseDaysCount(workingDays);
    if (workingDays > 1) {
      setHalfDayMode("Full");
    }
  };

  // Image Picker for Medical Certificate
  const pickMedicalCertificate = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch {}
  };

  const handleSelectOption = (type: LeaveType) => {
    setLeaveType(type);
    setIsDropdownOpen(false);
  };

  // Compute effective requested days
  const isSingleDay = baseDaysCount === 1;
  const isHalfDay = isSingleDay && halfDayMode !== "Full";
  const effectiveDays = isHalfDay ? 0.5 : baseDaysCount;

  // Selected Option Available Balance
  const selectedOption =
    DROPDOWN_OPTIONS.find((o) => o.type === leaveType) || DROPDOWN_OPTIONS[0];

  const currentAvailableDays =
    accruedBalances?.[selectedOption.balanceKey]?.left ??
    (selectedOption.balanceKey === "annual" ? 14 : 0);

  const isBalanceExceeded = effectiveDays > currentAvailableDays;
  const isFormValid = reason.trim().length > 0 && !isBalanceExceeded;

  const handleSubmit = () => {
    if (!isFormValid) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setIsSubmitted(true);
    setTimeout(() => {
      onSubmit({
        leaveType,
        startDate,
        endDate,
        daysCount: effectiveDays,
        reason: reason.trim(),
        isHalfDay,
        halfDayPeriod: isHalfDay
          ? halfDayMode === "Morning"
            ? "Morning"
            : "Afternoon"
          : undefined,
        attachmentUrl: attachmentUri || undefined,
      });
      onClose();
    }, 400);
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

        {/* Sheet Card with Keyboard Avoidance */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
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

            {/* Header: Title & Subtitle */}
            <View
              {...panResponder.panHandlers}
              className="px-6 pt-1 pb-3 border-b border-surface-border gap-0.5"
            >
              <Text className="text-lg font-extrabold text-content-primary tracking-tight">
                Request Leave
              </Text>
              <Text className="text-xs font-medium text-content-secondary">
                Direct submission for team lead authorization
              </Text>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 20,
                gap: 16,
              }}
            >
              {/* 1. Leave Category Dropdown */}
              <View className="gap-2 z-20">
                <Text className="text-sm font-bold text-content-secondary">
                  Leave category
                </Text>

                <Pressable
                  onPress={() => setIsDropdownOpen((prev) => !prev)}
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-white border border-surface-border"
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-content-primary">
                      {selectedOption.label}
                    </Text>
                    <Text className="text-xs font-bold text-brand-primary font-mono">
                      · {currentAvailableDays} days left
                    </Text>
                  </View>
                  {isDropdownOpen ? (
                    <ChevronUp size={18} color="#475569" />
                  ) : (
                    <ChevronDown size={18} color="#475569" />
                  )}
                </Pressable>

                {/* Dropdown Options List */}
                {isDropdownOpen && (
                  <View className="bg-white border border-surface-border rounded-2xl p-1.5 shadow-lg gap-1 mt-1">
                    {DROPDOWN_OPTIONS.map((option) => {
                      const isSelected = option.type === leaveType;
                      const daysLeft =
                        accruedBalances?.[option.balanceKey]?.left ?? 0;

                      return (
                        <Pressable
                          key={option.type}
                          onPress={() => handleSelectOption(option.type)}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.8 : 1,
                          })}
                          className={`flex-row items-center justify-between p-3 rounded-xl ${
                            isSelected ? "bg-brand-primary-light" : "bg-transparent"
                          }`}
                        >
                          <View className="flex-row items-center gap-2">
                            <Text
                              className={`text-sm font-semibold ${
                                isSelected ? "text-brand-primary font-bold" : "text-content-primary"
                              }`}
                            >
                              {option.label}
                            </Text>
                            <Text className="text-xs text-content-secondary">
                              ({daysLeft} days available)
                            </Text>
                          </View>
                          {isSelected && <Check size={16} color={ThemeConfig.brand.primary} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 2. Schedule & Native Date Picker Section */}
              <View className="gap-2">
                <Text className="text-sm font-bold text-content-secondary">
                  Schedule & leave period
                </Text>

                <CalendarRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={handleRangeChange}
                />
              </View>

              {/* 3. Half-Day Selector (Visible when single day leave) */}
              {isSingleDay && (
                <View className="gap-2">
                  <Text className="text-sm font-bold text-content-secondary">
                    Day period option
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setHalfDayMode("Morning")}
                      className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                        halfDayMode === "Morning"
                          ? "bg-brand-primary border-brand-primary"
                          : "bg-white border-surface-border"
                      }`}
                    >
                      <Sun
                        size={14}
                        color={halfDayMode === "Morning" ? "#FFFFFF" : "#475569"}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          halfDayMode === "Morning" ? "text-white" : "text-content-secondary"
                        }`}
                      >
                        Morning (0.5d)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setHalfDayMode("Afternoon")}
                      className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                        halfDayMode === "Afternoon"
                          ? "bg-brand-primary border-brand-primary"
                          : "bg-white border-surface-border"
                      }`}
                    >
                      <Sunset
                        size={14}
                        color={halfDayMode === "Afternoon" ? "#FFFFFF" : "#475569"}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          halfDayMode === "Afternoon" ? "text-white" : "text-content-secondary"
                        }`}
                      >
                        Afternoon (0.5d)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setHalfDayMode("Full")}
                      className={`flex-1 py-2.5 px-2 rounded-xl border items-center justify-center ${
                        halfDayMode === "Full"
                          ? "bg-brand-primary border-brand-primary"
                          : "bg-white border-surface-border"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          halfDayMode === "Full" ? "text-white" : "text-content-secondary"
                        }`}
                      >
                        Full day (1d)
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 4. Medical Certificate Attachment (Conditioned on Sick Leave) */}
              {leaveType === "Sick" && (
                <View className="gap-2">
                  <Text className="text-sm font-bold text-content-secondary">
                    Medical document / Certificate
                  </Text>

                  {attachmentUri ? (
                    <View className="flex-row items-center justify-between p-3 rounded-2xl bg-surface-muted border border-surface-border">
                      <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <Image
                          source={{ uri: attachmentUri }}
                          className="w-10 h-10 rounded-xl bg-slate-200"
                        />
                        <View className="flex-1 min-w-0">
                          <Text
                            numberOfLines={1}
                            className="text-xs font-bold text-content-primary"
                          >
                            medical_certificate.jpg
                          </Text>
                          <Text className="text-[11px] text-emerald-600 font-semibold">
                            Attached & verified
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => setAttachmentUri(null)}
                        hitSlop={8}
                        className="w-7 h-7 rounded-full bg-slate-200 items-center justify-center active:bg-slate-300"
                      >
                        <X size={14} color="#475569" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={pickMedicalCertificate}
                      className="p-3.5 rounded-2xl border border-dashed border-surface-border bg-surface-muted items-center justify-center flex-row gap-2 active:bg-white"
                    >
                      <Paperclip size={16} color="#475569" />
                      <Text className="text-xs font-bold text-content-secondary">
                        Attach doctor note or medical slip
                      </Text>
                    </Pressable>
                  )}
                  <Text className="text-[11px] text-content-muted">
                    Optional for short sick leave; required for medical authorization.
                  </Text>
                </View>
              )}

              {/* 5. Live Balance Exceeded Alert Banner */}
              {isBalanceExceeded && (
                <View className="flex-row items-center gap-2 p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <AlertCircle size={18} color="#EF4444" />
                  <Text className="text-xs font-bold text-rose-800 flex-1">
                    Insufficient balance: You requested {effectiveDays} days, but only have{" "}
                    {currentAvailableDays} days available for {selectedOption.label}.
                  </Text>
                </View>
              )}

              {/* 6. Reason for Leave Note */}
              <View className="gap-2">
                <Text className="text-sm font-bold text-content-secondary">
                  Reason for request <Text className="text-rose-500">*</Text>
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
                  placeholder="Brief explanation for your manager..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="w-full min-h-[95px] p-3.5 rounded-2xl bg-white border border-surface-border text-sm text-content-primary leading-6"
                />
              </View>
            </ScrollView>

            {/* Sticky Action Footer */}
            <View
              style={{
                paddingBottom:
                  keyboardHeight > 0
                    ? keyboardHeight + 8
                    : Math.max(insets.bottom, 16) + 6,
              }}
              className="px-5 pt-3 border-t border-surface-border bg-surface-card"
            >
              <Pressable
                onPress={handleSubmit}
                disabled={!isFormValid || isSubmitted}
                style={({ pressed }) => ({
                  opacity: pressed || !isFormValid ? 0.75 : 1,
                })}
                className={`w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm ${
                  isSubmitted
                    ? "bg-emerald-500"
                    : !isFormValid
                      ? "bg-slate-300"
                      : "bg-brand-primary active:bg-brand-primary-dark"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Submit leave request"
              >
                {isSubmitted ? (
                  <>
                    <Check size={18} color="#FFFFFF" strokeWidth={2.4} />
                    <Text className="text-base font-bold text-white tracking-wide">
                      Submitted to lead!
                    </Text>
                  </>
                ) : (
                  <Text className="text-base font-bold text-white tracking-wide">
                    Submit request ({effectiveDays} {effectiveDays === 1 ? "day" : "days"})
                  </Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
