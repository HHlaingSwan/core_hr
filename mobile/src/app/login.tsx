import React, { useState, useEffect } from "react";
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
import * as LocalAuthentication from "expo-local-authentication";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Fingerprint,
  ShieldCheck,
} from "lucide-react-native";

import { ThemeConfig } from "../constants/theme";
import { useAuthStore, useToastStore } from "../stores";
import { LoadingAnimation } from "../components/common/LoadingAnimation";
import { mockUsers } from "../api/mockData";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { showToast } = useToastStore();

  const [email, setEmail] = useState("hhlaingswan@omnihr.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [biometricType, setBiometricType] = useState<string>(
    "Face ID / Biometrics",
  );

  // Check device biometric capabilities
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled && isMounted) {
          setHasBiometrics(true);
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (
            types.includes(
              LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
            )
          ) {
            setBiometricType("Face ID");
          } else if (
            types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
          ) {
            setBiometricType("Fingerprint");
          }
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBiometricAuth = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in to Omni HR with ${biometricType}`,
        fallbackLabel: "Use Password",
        cancelLabel: "Cancel",
      });

      if (result.success) {
        useAuthStore.setState({
          user: mockUsers.employee,
          token: "mock-biometric-jwt-token",
          role: "Employee",
          isAuthenticated: true,
        });
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        showToast("Biometric verification verified", "success");
        router.replace("/(tabs)");
      }
    } catch {
      showToast("Biometric authentication cancelled", "info");
    }
  };

  const handleStandardLogin = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      clearError();

      const success = await login({
        email: email.trim(),
        password: password.trim(),
      });

      if (success) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        showToast("Signed in successfully", "success");
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.mustChangePassword) {
          router.replace("/change-password" as any);
        } else {
          router.replace("/(tabs)");
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        showToast(error || "Invalid email or password", "warning");
      }
    } catch {
      showToast("Sign in failed. Please try again.", "warning");
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
          {/* 1. TOP ~60% PURE MOTION STAGE (Full Panoramic 556x240 - Generous Spacing) */}
          <View
            style={{
              paddingTop: Math.max(insets.top, 20),
              minHeight: 260,
            }}
            className="flex-1 items-center justify-between px-4 pb-4 bg-[#EFF4FC] relative"
          >
            {/* Subtle Brand Tag (Top Pinned Floating Pill with Generous Clearance) */}
            <View className="flex-row items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-white/80 border border-slate-200/70 shadow-sm shadow-slate-900/5 mt-1 mb-6">
              <View className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <Text className="text-[10px] font-extrabold text-content-primary uppercase tracking-widest font-mono">
                Omni HR
              </Text>
            </View>

            {/* Native Panoramic Lottie Stage: Centered with ample breathing room */}
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
                Welcome Back
              </Text>
              <Text className="text-xs font-medium text-content-secondary">
                Sign in with your enterprise credentials
              </Text>
            </View>

            {/* Email Field */}
            <View className="gap-1.5">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-content-secondary ml-1">
                Work Email
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 gap-3">
                <Mail size={16} color={ThemeConfig.content.muted} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@company.com"
                  placeholderTextColor={ThemeConfig.content.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 text-sm font-semibold text-content-primary p-0"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between ml-1">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showToast(
                      "Password reset link sent to registered email",
                      "info",
                    )
                  }
                  hitSlop={6}
                >
                  <Text className="text-[11px] font-semibold text-brand-primary">
                    Forgot?
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 gap-3">
                <Lock size={16} color={ThemeConfig.content.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={ThemeConfig.content.muted}
                  secureTextEntry={!showPassword}
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

            {/* Primary Sign In Button */}
            <TouchableOpacity
              onPress={handleStandardLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              className="w-full py-4 rounded-2xl bg-brand-primary active:bg-brand-primary-dark items-center justify-center flex-row gap-2 shadow-sm shadow-brand-primary/25 mt-1"
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white tracking-wide">
                    Sign In
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
                </>
              )}
            </TouchableOpacity>

            {/* Biometric Quick Unlock Option */}
            {hasBiometrics && (
              <TouchableOpacity
                onPress={handleBiometricAuth}
                activeOpacity={0.8}
                className="w-full py-3.5 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center flex-row gap-2 active:bg-slate-100"
                accessibilityRole="button"
                accessibilityLabel={`Unlock with ${biometricType}`}
              >
                <Fingerprint size={17} color={ThemeConfig.brand.primary} />
                <Text className="text-xs font-bold text-content-primary">
                  Sign in with {biometricType}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bottom Security Note */}
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
