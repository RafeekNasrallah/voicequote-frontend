import { useAuth, useUser } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Building2, Camera, Check, ChevronRight, Clock, Coins, Crown, DollarSign, FileText, Globe, LogOut, Receipt, Shield, Trash2, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  I18nManager,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import api from "@/src/lib/api";
import { SUPPORTED_LANGUAGES, changeLanguage } from "@/src/i18n";
import {
  SUPPORTED_CURRENCIES,
  getCurrencyLabel,
  getCurrencySymbol,
  DEFAULT_CURRENCY,
} from "@/src/lib/currency";
import { isRevenueCatConfigured } from "@/src/lib/revenueCat";
import { presentCustomerCenter } from "@/src/lib/revenueCatUI";

interface UserProfile {
  email: string;
  preferredLanguage: string | null;
  priceList: { name: string; price: number; unit?: string }[] | null;
  laborRate: number | null;
  currency: string;
  logoKey: string | null;
  termsAndConditions: string[] | null;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  taxRate: number | null;
  taxLabel: string | null;
  taxEnabled: boolean;
  isPro?: boolean;
  quoteCount?: number;
  periodEnd?: string | null;
}

interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
}

const RTL_LANGUAGES = ["ar", "he"];

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes((i18n.language || "").split("-")[0]);
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlAlignEnd = isRTL ? { alignItems: "flex-start" as const } : undefined;
  const rtlRowReverse = isRTL ? { flexDirection: "row-reverse" as const } : undefined;

  // Modal states
  const [laborRateModalVisible, setLaborRateModalVisible] = useState(false);
  const [laborRateInput, setLaborRateInput] = useState("");
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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

  // Update labor rate on backend
  const updateLaborRate = useMutation({
    mutationFn: async (rate: number | null) => {
      await api.patch("/api/me", { laborRate: rate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setLaborRateModalVisible(false);
    },
    onError: () => {
      Alert.alert(t("common.error"), t("settings.laborRateUpdateFailed"));
    },
  });

  // Update currency on backend
  const updateCurrency = useMutation({
    mutationFn: async (currency: string) => {
      await api.patch("/api/me", { currency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setCurrencyModalVisible(false);
    },
    onError: () => {
      Alert.alert(t("common.error"), t("settings.currencyUpdateFailed"));
    },
  });

  // Delete account
  const deleteAccount = useMutation({
    mutationFn: async () => {
      await api.delete("/api/me");
    },
    onSuccess: () => {
      signOut();
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error || t("settings.deleteAccountFailed");
      Alert.alert(t("common.error"), message);
    },
  });

  const currentCurrency = profile?.currency || DEFAULT_CURRENCY;
  const currencySymbol = getCurrencySymbol(currentCurrency);

  // Logo upload handler
  const handleUploadLogo = useCallback(async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t("common.error"), t("settings.photoPermissionRequired"));
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      
      // Determine file extension
      const ext = uri.split(".").pop()?.toLowerCase() || "png";
      const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

      setLogoUploading(true);

      // Step 1: Get presigned S3 URL
      const { data: uploadData } = await api.post<UploadUrlResponse>(
        "/api/upload-url",
        { ext, contentType }
      );
      const { uploadUrl, fileKey } = uploadData;

      // Step 2: Upload image to S3
      const response = await fetch(uri);
      const blob = await response.blob();

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });

      // Step 3: Save logo key to backend
      await api.post("/api/me/logo", { fileKey });

      // Refresh profile
      queryClient.invalidateQueries({ queryKey: ["me"] });

      Alert.alert(t("settings.logoUploaded"), t("settings.logoUploadedMsg"));
    } catch (error) {
      console.error("Logo upload error:", error);
      Alert.alert(t("common.error"), t("settings.logoUploadFailed"));
    } finally {
      setLogoUploading(false);
    }
  }, [queryClient, t]);

  const handleOpenLaborRateModal = useCallback(() => {
    setLaborRateInput(profile?.laborRate?.toString() || "");
    setLaborRateModalVisible(true);
  }, [profile?.laborRate]);

  const handleSaveLaborRate = useCallback(() => {
    const rate = parseFloat(laborRateInput);
    if (laborRateInput.trim() === "" || isNaN(rate)) {
      updateLaborRate.mutate(null);
    } else {
      updateLaborRate.mutate(rate);
    }
  }, [laborRateInput, updateLaborRate]);

  const currentLang =
    (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? undefined;
  const currentLangEntry = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang);
  const currentLangLabel = currentLangEntry
    ? `${currentLangEntry.nativeLabel}`
    : t("settings.languageUnknown");

  const handleLanguageChange = useCallback(async (langCode: string) => {
    setLanguageModalVisible(false);
    const needsRestart = await changeLanguage(langCode);
    updateBackendLanguage.mutate(langCode);
    if (needsRestart) {
      // RTL change requires a restart
      Alert.alert(
        t("settings.language"),
        t("settings.languageRestartRequired"),
      );
    }
  }, [updateBackendLanguage, t]);

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

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.deleteAccountConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAccount"),
          style: "destructive",
          onPress: () => deleteAccount.mutate(),
        },
      ]
    );
  }, [deleteAccount, t]);

  const privacyPolicyUrl =
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://www.getquotio.com/privacy";
  const termsOfUseUrl =
    process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ?? "https://www.getquotio.com/terms";

  const getAppVersionString = useCallback(() => {
    const version = Constants.expoConfig?.version;
    if (!version) return t("settings.appVersion");
    const build =
      Constants.expoConfig?.android?.versionCode ??
      Constants.expoConfig?.ios?.buildNumber;
    const buildStr = build != null ? ` (${build})` : "";
    return `${t("common.appName")} v${version}${buildStr}`;
  }, [t]);

  const openUrl = useCallback((url: string, title: string) => {
    if (!url || !url.startsWith("http")) {
      Alert.alert(
        t("common.error"),
        t("settings.urlNotConfigured", { title }),
      );
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert(t("common.error"), t("settings.openLinkFailed"));
    });
  }, [t]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Labor Rate Modal */}
      <Modal
        visible={laborRateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLaborRateModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center"
          onPress={() => setLaborRateModalVisible(false)}
        >
          <Pressable
            className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-slate-900 mb-4">
              {t("settings.laborRate")}
            </Text>
            <Text className="text-sm text-slate-500 mb-4">
              {t("settings.laborRateModalDesc")}
            </Text>
            <View className="flex-row items-center border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-lg font-semibold text-slate-400 me-2">{currencySymbol}</Text>
              <TextInput
                className="flex-1 text-lg font-semibold text-slate-900"
                value={laborRateInput}
                onChangeText={setLaborRateInput}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text className="text-sm text-slate-400">{t("settings.perHour")}</Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setLaborRateModalVisible(false)}
                className="flex-1 h-11 items-center justify-center rounded-lg border border-slate-200"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-sm font-semibold text-slate-600">
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveLaborRate}
                disabled={updateLaborRate.isPending}
                className="flex-1 h-11 items-center justify-center rounded-lg bg-slate-900"
                style={({ pressed }) => ({ opacity: pressed || updateLaborRate.isPending ? 0.7 : 1 })}
              >
                {updateLaborRate.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">
                    {t("common.save")}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Currency Modal */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center"
          onPress={() => setCurrencyModalVisible(false)}
        >
          <Pressable
            className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-slate-900 mb-4">
              {t("settings.selectCurrency")}
            </Text>
            <ScrollView className="max-h-80">
              {SUPPORTED_CURRENCIES.map((currency) => (
                <Pressable
                  key={currency.code}
                  onPress={() => updateCurrency.mutate(currency.code)}
                  className="flex-row items-center justify-between py-3 border-b border-slate-100"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-slate-700 w-10">
                      {currency.symbol}
                    </Text>
                    <View className="ms-2">
                      <Text className="text-sm font-medium text-slate-900">
                        {currency.code}
                      </Text>
                      <Text className="text-xs text-slate-400">
                        {currency.name}
                      </Text>
                    </View>
                  </View>
                  {currentCurrency === currency.code && (
                    <Text className="text-blue-500 font-semibold">✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setCurrencyModalVisible(false)}
              className="mt-4 h-11 items-center justify-center rounded-lg border border-slate-200"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-sm font-semibold text-slate-600">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Language Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center"
          onPress={() => setLanguageModalVisible(false)}
        >
          <Pressable
            className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-slate-900 mb-4">
              {t("settings.selectLanguage")}
            </Text>
            <ScrollView className="max-h-80">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLanguageChange(lang.code)}
                  className="flex-row items-center justify-between py-3 border-b border-slate-100"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View>
                    <Text className="text-sm font-medium text-slate-900">
                      {lang.nativeLabel}
                    </Text>
                    <Text className="text-xs text-slate-400">
                      {lang.label}
                    </Text>
                  </View>
                  {currentLang === lang.code && (
                    <Text className="text-blue-500 font-semibold">✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setLanguageModalVisible(false)}
              className="mt-4 h-11 items-center justify-center rounded-lg border border-slate-200"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-sm font-semibold text-slate-600">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-2xl font-bold text-slate-900" style={rtlText}>
          {t("settings.title")}
        </Text>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="mx-6 mb-4 flex-row items-center rounded-xl bg-white p-4 shadow-sm border border-slate-100">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-orange-600">
            <User size={20} color="#ffffff" />
          </View>
          <View className="ms-3 flex-1" style={rtlAlignEnd}>
            <Text className="text-base font-semibold text-slate-900" style={rtlText}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text className="mt-0.5 text-sm text-slate-400" style={rtlText}>
              {user?.primaryEmailAddress?.emailAddress || profile?.email || ""}
            </Text>
          </View>
        </View>

        {/* Plan / Pro status */}
        <View className="mx-6 mb-4">
          <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden p-4">
            {profile?.isPro ? (
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Crown size={20} color="#d97706" />
                </View>
                <View className="ms-3 flex-1" style={rtlAlignEnd}>
                  <Text className="text-base font-semibold text-slate-900" style={rtlText}>
                    {t("settings.pro")}
                  </Text>
                  <Text className="text-sm text-slate-500" style={rtlText}>
                    {t("settings.proActive")}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <View className="flex-row items-center justify-between mb-2" style={rtlRowReverse}>
                  <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                    {t("settings.quoteUsage")}
                  </Text>
                  <Text className="text-sm text-slate-500" style={rtlText}>
                    {(profile?.quoteCount ?? 0)} / 5
                  </Text>
                </View>
                <View className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                  <View
                    className="h-full rounded-full bg-orange-500"
                    style={{
                      width: `${Math.min(100, ((profile?.quoteCount ?? 0) / 5) * 100)}%`,
                    }}
                  />
                </View>
                {profile?.periodEnd ? (
                  <Text className="text-xs text-slate-500 mb-4" style={rtlText}>
                    {t("settings.resetsOn", {
                      date: new Date(profile.periodEnd).toLocaleDateString(activeLocale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }),
                    })}
                  </Text>
                ) : (
                  <View className="mb-4" />
                )}
                <Pressable
                  onPress={() => router.push("/paywall" as any)}
                  className="h-11 items-center justify-center rounded-lg bg-orange-600"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Text className="text-sm font-semibold text-white">
                    {t("settings.upgradeToPro")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Manage subscription (Customer Center) — restore, cancel, contact support */}
        {isRevenueCatConfigured() && (
          <View className="mx-6 mb-4">
            <Pressable
              onPress={() => presentCustomerCenter()}
              className="flex-row items-center rounded-xl bg-white px-4 py-3.5 shadow-sm border border-slate-100"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <Receipt size={18} color="#64748b" />
              </View>
              <View className="ms-3 flex-1" style={rtlAlignEnd}>
                <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                  {t("settings.manageSubscription")}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                  {t("settings.manageSubscriptionHint")}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </Pressable>
          </View>
        )}

        {/* Preferences Section */}
        <View className="mx-6 mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1" style={rtlText}>
            {t("settings.preferences")}
          </Text>
          <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {/* Language */}
          <Pressable
            onPress={() => setLanguageModalVisible(true)}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Globe size={18} color="#3b82f6" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.language")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.transcriptionLanguage")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {updateBackendLanguage.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                  {currentLangLabel}
                </Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </Pressable>

          {/* Currency */}
          <Pressable
            onPress={() => setCurrencyModalVisible(true)}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <Coins size={18} color="#9333ea" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.currency")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.currencyDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {updateCurrency.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                  {getCurrencyLabel(currentCurrency)}
                </Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </Pressable>

          {/* Tax / VAT */}
          <Pressable
            onPress={() => router.push("/tax-settings")}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <Receipt size={18} color="#10b981" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.taxSettings")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.taxSettingsDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {profile?.taxEnabled && profile.taxRate ? (
                <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                  {profile.taxLabel || t("taxSettings.defaultLabel")} {profile.taxRate}%
                </Text>
              ) : (
                <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                  {t("settings.taxDisabled")}
                </Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </Pressable>

          {/* Price List */}
          <Pressable
            onPress={() => router.push("/pricelist" as any)}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign size={18} color="#10b981" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.priceList")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.priceListDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                {profile?.priceList?.length ?? 0}
              </Text>
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </Pressable>

          {/* Labor Rate */}
          <Pressable
            onPress={handleOpenLaborRateModal}
            className="flex-row items-center px-4 py-3.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
              <Clock size={18} color="#f97316" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.laborRate")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.laborRateDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {updateLaborRate.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="me-1 text-sm text-slate-400" style={rtlText}>
                  {profile?.laborRate
                    ? `${currencySymbol}${profile.laborRate}${t("settings.perHour")}`
                    : t("settings.laborRateNotSet")}
                </Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Business Section */}
        <View className="mx-6 mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1" style={rtlText}>
            {t("settings.business")}
          </Text>
          <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            {/* Business Info */}
          <Pressable
            onPress={() => router.push("/business-info")}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Building2 size={18} color="#3b82f6" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.businessInfo")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.businessInfoDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {profile?.companyName ? (
                <View className="flex-row items-center" style={rtlRowReverse}>
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 me-1">
                    <Check size={12} color="#16a34a" />
                  </View>
                  <Text className="text-sm text-slate-400 max-w-[100]" numberOfLines={1} style={rtlText}>
                    {profile.companyName}
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-slate-400" style={rtlText}>{t("settings.notConfigured")}</Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" style={{ marginStart: 4 }} />
            </View>
          </Pressable>

          {/* Business Logo */}
          <Pressable
            onPress={handleUploadLogo}
            disabled={logoUploading}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed || logoUploading ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 overflow-hidden">
              <Camera size={18} color="#6366f1" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.businessLogo")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.businessLogoDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {logoUploading ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : profile?.logoKey ? (
                <View className="flex-row items-center" style={rtlRowReverse}>
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 me-1">
                    <Check size={12} color="#16a34a" />
                  </View>
                  <Text className="text-sm text-slate-400" style={rtlText}>{t("settings.uploaded")}</Text>
                </View>
              ) : (
                <Text className="text-sm text-slate-400" style={rtlText}>{t("settings.uploadLogo")}</Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" style={{ marginStart: 4 }} />
            </View>
          </Pressable>

          {/* Quote Terms */}
          <Pressable
            onPress={() => router.push("/terms")}
            className="flex-row items-center px-4 py-3.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <FileText size={18} color="#f59e0b" />
            </View>
            <View className="ms-3 flex-1" style={rtlAlignEnd}>
              <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                {t("settings.quoteTerms")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                {t("settings.quoteTermsDesc")}
              </Text>
            </View>
            <View className="flex-row items-center" style={rtlRowReverse}>
              {profile?.termsAndConditions && profile.termsAndConditions.length > 0 ? (
                <View className="flex-row items-center" style={rtlRowReverse}>
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 me-1">
                    <Check size={12} color="#16a34a" />
                  </View>
                  <Text className="text-sm text-slate-400" style={rtlText}>
                    {profile.termsAndConditions.length} {t("terms.items")}
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-slate-400" style={rtlText}>{t("terms.usingDefaults")}</Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" style={{ marginStart: 4 }} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Legal Section */}
        <View className="mx-6 mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1" style={rtlText}>
            {t("settings.legal")}
          </Text>
          <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <Pressable
              onPress={() => openUrl(privacyPolicyUrl, t("settings.privacyPolicy"))}
              className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <Shield size={18} color="#64748b" />
              </View>
              <View className="ms-3 flex-1" style={rtlAlignEnd}>
                <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                  {t("settings.privacyPolicy")}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                  {t("settings.privacyPolicyDesc")}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </Pressable>
            <Pressable
              onPress={() => openUrl(termsOfUseUrl, t("settings.termsOfUse"))}
              className="flex-row items-center px-4 py-3.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <FileText size={18} color="#64748b" />
              </View>
              <View className="ms-3 flex-1" style={rtlAlignEnd}>
                <Text className="text-sm font-medium text-slate-900" style={rtlText}>
                  {t("settings.termsOfUse")}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-400" style={rtlText}>
                  {t("settings.termsOfUseDesc")}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </Pressable>
          </View>
        </View>

        {/* Account Section */}
        <View className="mx-6">
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1" style={rtlText}>
            {t("settings.account")}
          </Text>
          <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            {/* Sign Out */}
            <Pressable
              onPress={handleSignOut}
              className="flex-row items-center px-4 py-3.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <LogOut size={18} color="#64748b" />
              </View>
              <View className="ms-3 flex-1" style={rtlAlignEnd}>
                <Text className="text-sm font-medium text-slate-700" style={rtlText}>
                  {t("settings.signOut")}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </Pressable>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="mx-6 mt-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-red-600 px-1" style={rtlText}>
            {t("settings.dangerZone")}
          </Text>
          <View className="rounded-xl bg-red-50 shadow-sm border border-red-200 overflow-hidden">
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleteAccount.isPending}
              className="flex-row items-center px-4 py-3.5"
              style={({ pressed }) => ({
                opacity: pressed || deleteAccount.isPending ? 0.7 : 1,
              })}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <Trash2 size={18} color="#dc2626" />
              </View>
              <View className="ms-3 flex-1" style={rtlAlignEnd}>
                <Text className="text-sm font-semibold text-red-700" style={rtlText}>
                  {t("settings.deleteAccount")}
                </Text>
                <Text className="mt-0.5 text-xs text-red-500" style={rtlText}>
                  {t("settings.deleteAccountDesc")}
                </Text>
              </View>
              {deleteAccount.isPending ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <ChevronRight size={16} color="#f87171" />
              )}
            </Pressable>
          </View>
        </View>

        {/* App Version */}
        <View className="mt-6 items-center">
          <Text className="text-xs text-slate-300" style={rtlText}>
            {getAppVersionString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
