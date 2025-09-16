import { Tabs } from "expo-router";
import { Home, Search, Package, Settings } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = 44 as const;
  const androidFallbackBottomInset = Platform.OS === 'android' ? 18 : 0;

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
          fontSize: 16,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          minHeight: baseTabBarHeight + Math.max(insets?.bottom ?? 0, androidFallbackBottomInset),
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
          tabBarIcon: ({ color }) => <Home color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: "Operations",
          tabBarIcon: ({ color }) => <Package color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Search color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}