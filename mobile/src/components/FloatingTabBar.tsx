import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  LinearTransition,
  FadeInRight,
  FadeOutLeft,
} from "react-native-reanimated";
import { ThemeConfig } from "../constants/theme";
import { Home, Users, Inbox, ReceiptText, User } from "lucide-react-native";

interface TabItemConfig {
  name: string;
  label: string;
  IconComponent: React.ComponentType<{
    size: number;
    color: string;
    strokeWidth?: number;
  }>;
}

const tabConfigs: Record<string, TabItemConfig> = {
  index: { name: "index", label: "Home", IconComponent: Home },
  team: { name: "team", label: "Team", IconComponent: Users },
  inbox: { name: "inbox", label: "Inbox", IconComponent: Inbox },
  payroll: { name: "payroll", label: "Payslips", IconComponent: ReceiptText },
  profile: { name: "profile", label: "Profile", IconComponent: User },
};

export function FloatingTabBar(props: any) {
  const { state, descriptors, navigation, navigateToTab } = props;
  const insets = useSafeAreaInsets();
  const bottomPosition = Math.max(insets.bottom, 14);

  const activeColor = ThemeConfig.brand.primary; // #2563EB
  const inactiveColor = ThemeConfig.text.muted; // #94A3B8

  return (
    <View
      style={{ bottom: bottomPosition }}
      className="absolute left-4 right-4 h-18 rounded-3xl border border-[#E2E5E9] bg-white/95 flex-row items-center justify-between px-3 shadow-xl shadow-slate-900/10"
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const config = tabConfigs[route.name] || {
          name: route.name,
          label: (options.title as string) || route.name,
          IconComponent: Home,
        };
        const { IconComponent, label } = config;

        const onPress = () => {
          let defaultPrevented = false;
          if (navigation?.emit) {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            defaultPrevented = event.defaultPrevented;
          } else if (props.emitter?.emit) {
            const event = props.emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            defaultPrevented = event.defaultPrevented;
          }

          if (!isFocused && !defaultPrevented) {
            if (navigation?.navigate) {
              navigation.navigate(route.name);
            } else if (navigateToTab) {
              navigateToTab(route.key);
            }
          }
        };

        const onLongPress = () => {
          if (navigation?.emit) {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel || label}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.80}
            className="items-center justify-center py-2"
          >
            <Animated.View
              layout={LinearTransition.springify().damping(16).stiffness(150)}
              className={`flex-row items-center justify-center rounded-2xl ${
                isFocused
                  ? "bg-brand-primary-light border border-brand-primary-light px-3.5 py-3 gap-1"
                  : "w-11 h-11 bg-transparent"
              }`}
            >
              <View className="relative">
                <IconComponent
                  size={20}
                  color={isFocused ? activeColor : inactiveColor}
                  strokeWidth={isFocused ? 2.3 : 1.8}
                />
                {route.name === "inbox" && (
                  <View className="w-2.5 h-2.5 rounded-full bg-accent-sunshine absolute -top-1 -right-1 border border-white" />
                )}
              </View>

              {isFocused && (
                <Animated.Text
                  entering={FadeInRight.duration(180)}
                  exiting={FadeOutLeft.duration(120)}
                  numberOfLines={1}
                  className="text-sm font-bold text-brand-primary tracking-wide"
                >
                  {label}
                </Animated.Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
