import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Check,
  LogOut,
} from "lucide-react-native";

import { ThemeConfig } from "../constants/theme";
import { useAuthStore, useToastStore } from "../stores";
import { LoadingAnimation } from "../components/common/LoadingAnimation";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, changePassword, logout, isLoading } = useAuthStore();
  const { showToast } = useToastStore();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasMixedChars = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = hasMinLength && passwordsMatch && !submitting && !isLoading;

  const handleSavePassword = async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const success = await changePassword(password);
      if (success) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        showToast("Password updated successfully. Welcome!", "success");
        router.replace("/(tabs)");
      } else {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
        showToast("Failed to update password. Please try again.", "warning");
      }
    } catch {
      showToast("An unexpected error occurred.", "warning");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await logout();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  return (
    <View className="flex-1 bg-[#EFF4FC]">
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. TOP MOTION STAGE (Panoramic 556x240 - Identical to Login) */}
          <View
            style={{
              paddingTop: Math.max(insets.top, 20),
              minHeight: 240,
            }}
            className="flex-1 items-center justify-between px-4 pb-4 bg-[#EFF4FC] relative"
          >
            {/* Subtle Brand Tag */}
            <View className="flex-row items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-white/80 border border-slate-200/70 shadow-sm shadow-slate-900/5 mt-1 mb-4">
              <View className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <Text className="text-[10px] font-extrabold text-content-primary uppercase tracking-widest font-mono">
                Omni HR
              </Text>
            </View>

            {/* Native Panoramic Lottie Stage */}
            <View className="w-full items-center justify-center px-2 mb-2 flex-1">
              <LoadingAnimation width="100%" />
            </View>
          </View>

          {/* 2. BOTTOM DRAWER SECTION (Elevated Pure White Card with Integrated Header) */}
          <View
            style={{
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              ...Platform.select({
                ios: { borderCurve: "continuous" },
                default: {},
              }),
            }}
            className="bg-white px-6 pt-3.5 shadow-2xl shadow-slate-900/10 border-t border-slate-200/80 gap-3.5"
          >
            {/* Native Drawer Drag Handle Pill */}
            <View className="w-10 h-1.5 rounded-full bg-slate-200 self-center mb-0.5" />

            {/* Integrated Typography Inside Drawer */}
            <View className="gap-0.5">
              <Text className="text-xl font-black text-content-primary tracking-tight">
                Set New Password
              </Text>
              <Text className="text-xs font-medium text-content-secondary">
                {user ? `Account: ${user.fullName} (${user.email})` : "First-time security setup for your enterprise account"}
              </Text>
            </View>

            {/* New Password Field */}
            <View className="gap-1.5">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-secondary ml-1">
                New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 gap-3">
                <Lock size={16} color={ThemeConfig.content.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter at least 8 characters"
                  placeholderTextColor={ThemeConfig.content.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-sm font-semibold text-content-primary p-0"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={16} color={ThemeConfig.content.muted} />
                  ) : (
                    <Eye size={16} color={ThemeConfig.content.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View className="gap-1.5">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-secondary ml-1">
                Confirm New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 gap-3">
                <Lock size={16} color={ThemeConfig.content.muted} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your new password"
                  placeholderTextColor={ThemeConfig.content.muted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-sm font-semibold text-content-primary p-0"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={8}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} color={ThemeConfig.content.muted} />
                  ) : (
                    <Eye size={16} color={ThemeConfig.content.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Requirements Checklist */}
            <View className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Requirements
              </Text>
              <View className="flex-row items-center gap-2">
                <Check
                  size={14}
                  color={hasMinLength ? "#10B981" : "#94A3B8"}
                />
                <Text
                  className={`text-xs ${
                    hasMinLength
                      ? "text-emerald-700 font-semibold"
                      : "text-slate-500 font-medium"
                  }`}
                >
                  At least 8 characters
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Check
                  size={14}
                  color={hasMixedChars ? "#10B981" : "#94A3B8"}
                />
                <Text
                  className={`text-xs ${
                    hasMixedChars
                      ? "text-emerald-700 font-semibold"
                      : "text-slate-500 font-medium"
                  }`}
                >
                  Contains numbers or symbols
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Check
                  size={14}
                  color={passwordsMatch ? "#10B981" : "#94A3B8"}
                />
                <Text
                  className={`text-xs ${
                    passwordsMatch
                      ? "text-emerald-700 font-semibold"
                      : "text-slate-500 font-medium"
                  }`}
                >
                  Passwords match exactly
                </Text>
              </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              onPress={handleSavePassword}
              disabled={!canSubmit}
              activeOpacity={0.85}
              className={`w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm mt-1 ${
                canSubmit
                  ? "bg-brand-primary active:bg-brand-primary-dark shadow-brand-primary/25"
                  : "bg-slate-300 opacity-60"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Save password and enter workspace"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white tracking-wide">
                    Save Password & Enter
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
                </>
              )}
            </TouchableOpacity>

            {/* Cancel & Sign Out */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              className="w-full py-3 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center flex-row gap-2 active:bg-slate-100"
              accessibilityRole="button"
              accessibilityLabel="Cancel and return to sign in"
            >
              <LogOut size={15} color={ThemeConfig.content.muted} />
              <Text className="text-xs font-bold text-content-primary">
                Cancel & Sign Out
              </Text>
            </TouchableOpacity>

            {/* Bottom Security Note (Identical to Login) */}
            <View
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
              className="items-center pt-1 pb-1 flex-row justify-center gap-1.5"
            >
              <ShieldCheck size={13} color={ThemeConfig.brand.primary} />
              <Text className="text-[11px] font-medium text-content-muted">
                End-to-End Encrypted Enterprise Session
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
