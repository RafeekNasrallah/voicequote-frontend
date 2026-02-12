import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Globe, LogOut, User } from "lucide-react-native";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import api from "@/src/lib/api";
import { SUPPORTED_LANGUAGES, changeLanguage } from "@/src/i18n";

interface UserProfile {
  email: string;
  preferredLanguage: string | null;
  priceList: unknown[];
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/api/me");
      return data;
    },
  });

  // Update language on backend
  const updateBackendLanguage = useMutation({
    mutationFn: async (language: string) => {
      await api.patch("/api/me", { preferredLanguage: language });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("settings.languageUpdateFailed"));
    },
  });

  const currentLang = i18n.language || "en";
  const currentLangEntry = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang);
  const currentLangLabel = currentLangEntry
    ? `${currentLangEntry.nativeLabel}`
    : "English";

  const handleLanguageSelect = useCallback(() => {
    Alert.alert(
      t("settings.selectLanguage"),
      t("settings.selectLanguageMsg"),
      SUPPORTED_LANGUAGES.map((lang) => ({
        text: `${lang.nativeLabel}${lang.code === currentLang ? " ✓" : ""}`,
        onPress: async () => {
          const needsRestart = await changeLanguage(lang.code);
          updateBackendLanguage.mutate(lang.code);
          if (needsRestart) {
            // RTL change requires a restart
            Alert.alert(
              t("settings.language"),
              "Please close and reopen the app for the layout direction change to take effect."
            );
          }
        },
      }))
    );
  }, [currentLang, updateBackendLanguage, t]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  }, [signOut, t]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-2xl font-bold text-slate-900">{t("settings.title")}</Text>
      </View>

      {/* Profile Card */}
      <View className="mx-6 mb-4 flex-row items-center rounded-xl bg-white p-4 shadow-sm border border-slate-100">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-900">
          <User size={20} color="#ffffff" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-slate-900">
            {user?.firstName} {user?.lastName}
          </Text>
          <Text className="mt-0.5 text-sm text-slate-400">
            {user?.primaryEmailAddress?.emailAddress || profile?.email || ""}
          </Text>
        </View>
      </View>

      {/* Preferences Section */}
      <View className="mx-6 mb-4">
        <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1">
          {t("settings.preferences")}
        </Text>
        <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {/* Language */}
          <Pressable
            onPress={handleLanguageSelect}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Globe size={18} color="#3b82f6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.language")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.transcriptionLanguage")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {updateBackendLanguage.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="mr-1 text-sm text-slate-400">
                  {currentLangLabel}
                </Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Account Section */}
      <View className="mx-6">
        <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1">
          {t("settings.account")}
        </Text>
        <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <Pressable
            onPress={handleSignOut}
            className="flex-row items-center px-4 py-3.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <LogOut size={18} color="#ef4444" />
            </View>
            <Text className="ml-3 flex-1 text-sm font-medium text-red-600">
              {t("settings.signOut")}
            </Text>
            <ChevronRight size={16} color="#cbd5e1" />
          </Pressable>
        </View>
      </View>

      {/* App Version */}
      <View className="mt-auto mb-8 items-center">
        <Text className="text-xs text-slate-300">{t("settings.appVersion")}</Text>
      </View>
    </SafeAreaView>
  );
}
