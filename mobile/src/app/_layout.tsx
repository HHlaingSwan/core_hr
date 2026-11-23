import "../global.css";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ToastNotification } from "../components/common/ToastNotification";
import { useAuthStore } from "../stores";

function AuthNavigation() {
  const { isAuthenticated, user, initializeAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await initializeAuth();
      if (isMounted) setIsReady(true);
    })();
    return () => {
      isMounted = false;
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (!isReady) return;

    const inLogin = segments[0] === "login";
    const inChangePassword = (segments[0] as string) === "change-password";

    if (!isAuthenticated && !inLogin) {
      // Direct unauthenticated user to login gate
      router.replace("/login");
    } else if (isAuthenticated) {
      if (user?.mustChangePassword && !inChangePassword) {
        // Enforce mandatory first-time password reset
        router.replace("/change-password" as any);
      } else if (!user?.mustChangePassword && (inLogin || inChangePassword)) {
        // Direct authenticated user with established password to home dashboard
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, user?.mustChangePassword, isReady, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="attendance"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="leaves"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthNavigation />
        <ToastNotification />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
