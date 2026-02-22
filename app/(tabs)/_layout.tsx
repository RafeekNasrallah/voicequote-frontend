import { Tabs } from "expo-router";
import { FileText, Home, Settings, Users } from "lucide-react-native";
import { I18nManager } from "react-native";
import { useTranslation } from "react-i18next";

const RTL_LANGUAGES = ["ar", "he"];

export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes(
    (i18n.language || "").split("-")[0]
  );
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const tabDirection = isRTL ? "rtl" : "ltr";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#c2410c", // orange-700, accessible on white
        tabBarInactiveTintColor: "#475569", // slate-600, accessible on white
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          paddingTop: 6,
          direction: tabDirection,
        },
        tabBarItemStyle: {
          direction: tabDirection,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "700",
          marginBottom: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t("tabs.quotes"),
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t("tabs.clients"),
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
