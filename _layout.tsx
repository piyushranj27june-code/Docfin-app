import { Tabs } from "expo-router";
import { LayoutDashboard, Receipt, TrendingUp, Building2, Sparkles } from "@/src/icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: Platform.OS === "ios" ? 2 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
          tabBarTestID: "tab-dashboard",
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => <Receipt size={size - 2} color={color} />,
          tabBarTestID: "tab-expenses",
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: "Planning",
          tabBarIcon: ({ color, size }) => <TrendingUp size={size - 2} color={color} />,
          tabBarTestID: "tab-planning",
        }}
      />
      <Tabs.Screen
        name="hospital"
        options={{
          title: "Hospital",
          tabBarIcon: ({ color, size }) => <Building2 size={size - 2} color={color} />,
          tabBarTestID: "tab-hospital",
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI Coach",
          tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} />,
          tabBarTestID: "tab-ai",
        }}
      />
    </Tabs>
  );
}
