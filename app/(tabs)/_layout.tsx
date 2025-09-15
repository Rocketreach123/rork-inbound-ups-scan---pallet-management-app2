import { Tabs } from "expo-router";
import { Home, Search, Package, Settings } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = 56 as const;
  const androidFallbackBottomInset = Platform.OS === 'android' ? 24 : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          minHeight: baseTabBarHeight + Math.max(insets?.bottom ?? 0, androidFallbackBottomInset),
          paddingBottom: Math.max(insets?.bottom ?? 0, androidFallbackBottomInset, 12),
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopColor: 'rgba(0,0,0,0.06)',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: "Operations",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}