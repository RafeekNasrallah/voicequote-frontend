import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Building2, Mail, MapPin, Phone } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";

const RTL_LANGUAGES = ["ar", "he"];

// ─── Types ───────────────────────────────────────────────────

interface UserProfile {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
}

// ─── Main Screen ─────────────────────────────────────────────

export default function BusinessInfoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes((i18n.language || "").split("-")[0]);
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlHeaderDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const rtlTitleWrapStyle = isRTL
    ? { flexDirection: "row" as const, justifyContent: "flex-end" as const, width: "100%" as const, direction: "ltr" as const }
    : undefined;
  const backArrowStyle = isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
  const inputRtlStyle = isRTL ? { textAlign: "right" as const, writingDirection: "rtl" as const } : undefined;

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [initialValues, setInitialValues] = useState({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
  });

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/api/me");
      return data;
    },
  });

  // Sync server data to local state on first load
  useEffect(() => {
    if (profile) {
      const values = {
        companyName: profile.companyName ?? "",
        companyAddress: profile.companyAddress ?? "",
        companyPhone: profile.companyPhone ?? "",
        companyEmail: profile.companyEmail ?? "",
      };
      setCompanyName(values.companyName);
      setCompanyAddress(values.companyAddress);
      setCompanyPhone(values.companyPhone);
      setCompanyEmail(values.companyEmail);
      setInitialValues(values);
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    const changed =
      companyName !== initialValues.companyName ||
      companyAddress !== initialValues.companyAddress ||
      companyPhone !== initialValues.companyPhone ||
      companyEmail !== initialValues.companyEmail;
    setHasChanges(changed);
  }, [companyName, companyAddress, companyPhone, companyEmail, initialValues]);

  // Save mutation
  const saveInfo = useMutation({
    mutationFn: async () => {
      await api.patch("/api/me", {
        companyName: companyName.trim() || null,
        companyAddress: companyAddress.trim() || null,
        companyPhone: companyPhone.trim() || null,
        companyEmail: companyEmail.trim() || null,
      });
    },
    onSuccess: () => {
      setHasChanges(false);
      setInitialValues({
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      Alert.alert(t("businessInfo.saved"), t("businessInfo.savedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("businessInfo.saveFailed"));
    },
  });

  // ─── Actions ───────────────────────────────────────────────

  const handleSave = useCallback(() => {
    saveInfo.mutate();
  }, [saveInfo]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(t("businessInfo.title"), t("businessInfo.unsavedChanges"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("businessInfo.discard"),
          style: "destructive",
          onPress: () => router.replace("/(tabs)/settings"),
        },
        {
          text: t("common.save"),
          onPress: () => {
            saveInfo.mutate(undefined, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["me"] });
                router.replace("/(tabs)/settings");
              },
            });
          },
        },
      ]);
    } else {
      router.replace("/(tabs)/settings");
    }
  }, [hasChanges, saveInfo, queryClient, router, t]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header — RTL: title on right, back arrow mirrored */}
      <View
        className="flex-row items-center px-4 py-3 border-b border-slate-200"
        style={rtlHeaderDirection}
      >
        <Pressable
          onPress={handleBack}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => [
            { opacity: pressed ? 0.6 : 1 },
            isRTL ? { marginLeft: 12 } : { marginRight: 12 },
          ]}
          accessibilityLabel={t("quoteEditor.goBack")}
          accessibilityRole="button"
        >
          <View style={backArrowStyle}>
            <ArrowLeft size={22} color="#ea580c" />
          </View>
        </Pressable>
        <View className="flex-1" style={rtlTitleWrapStyle}>
          <Text className="text-lg font-bold text-slate-900" style={rtlText}>
            {t("businessInfo.title")}
          </Text>
        </View>
        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || saveInfo.isPending}
          className={`h-11 px-4 items-center justify-center rounded-lg ${
            hasChanges ? "bg-orange-600" : "bg-slate-200"
          }`}
          style={({ pressed }) => ({
            opacity: pressed || saveInfo.isPending ? 0.7 : 1,
          })}
        >
          {saveInfo.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              className={`text-sm font-semibold ${
                hasChanges ? "text-white" : "text-slate-400"
              }`}
            >
              {t("common.save")}
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#ea580c" size="large" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info Text — RTL: on right */}
            <View className="mb-4" style={rtlTitleWrapStyle}>
              <Text className="text-sm text-slate-500" style={rtlText}>
                {t("businessInfo.description")}
              </Text>
            </View>

            {/* Company Name — RTL: label row + input */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View
                className="flex-row items-center px-4 py-3 border-b border-slate-100"
                style={isRTL ? { direction: "rtl" as const } : undefined}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg bg-blue-50"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                >
                  <Building2 size={16} color="#3b82f6" />
                </View>
                <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                  {t("businessInfo.companyName")}
                </Text>
              </View>
              <TextInput
                className="px-4 py-3 text-base text-slate-900"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder={t("businessInfo.companyNamePlaceholder")}
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                style={inputRtlStyle}
              />
            </View>

            {/* Address — RTL: label row + input */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View
                className="flex-row items-center px-4 py-3 border-b border-slate-100"
                style={isRTL ? { direction: "rtl" as const } : undefined}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg bg-green-50"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                >
                  <MapPin size={16} color="#22c55e" />
                </View>
                <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                  {t("businessInfo.address")}
                </Text>
              </View>
              <TextInput
                className="px-4 py-3 text-base text-slate-900"
                value={companyAddress}
                onChangeText={setCompanyAddress}
                placeholder={t("businessInfo.addressPlaceholder")}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={[{ minHeight: 80 }, inputRtlStyle]}
              />
            </View>

            {/* Phone — RTL: label row + input */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View
                className="flex-row items-center px-4 py-3 border-b border-slate-100"
                style={isRTL ? { direction: "rtl" as const } : undefined}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg bg-purple-50"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                >
                  <Phone size={16} color="#a855f7" />
                </View>
                <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                  {t("businessInfo.phone")}
                </Text>
              </View>
              <TextInput
                className="px-4 py-3 text-base text-slate-900"
                value={companyPhone}
                onChangeText={setCompanyPhone}
                placeholder={t("businessInfo.phonePlaceholder")}
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                style={inputRtlStyle}
              />
            </View>

            {/* Email — RTL: label row + input */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View
                className="flex-row items-center px-4 py-3 border-b border-slate-100"
                style={isRTL ? { direction: "rtl" as const } : undefined}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg bg-orange-50"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                >
                  <Mail size={16} color="#f97316" />
                </View>
                <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                  {t("businessInfo.email")}
                </Text>
              </View>
              <TextInput
                className="px-4 py-3 text-base text-slate-900"
                value={companyEmail}
                onChangeText={setCompanyEmail}
                placeholder={t("businessInfo.emailPlaceholder")}
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                style={inputRtlStyle}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
