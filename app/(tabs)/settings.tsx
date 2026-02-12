import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Camera, Check, ChevronRight, Clock, Coins, DollarSign, FileText, Globe, LogOut, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

interface UserProfile {
  email: string;
  preferredLanguage: string | null;
  priceList: { name: string; price: number; unit?: string }[] | null;
  laborRate: number | null;
  currency: string;
  logoKey: string | null;
  termsAndConditions: string[] | null;
}

interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // Modal states
  const [laborRateModalVisible, setLaborRateModalVisible] = useState(false);
  const [laborRateInput, setLaborRateInput] = useState("");
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
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
              <Text className="text-lg font-semibold text-slate-400 mr-2">{currencySymbol}</Text>
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
                    <View className="ml-2">
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

          {/* Currency */}
          <Pressable
            onPress={() => setCurrencyModalVisible(true)}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <Coins size={18} color="#9333ea" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.currency")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.currencyDesc")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {updateCurrency.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="mr-1 text-sm text-slate-400">
                  {getCurrencyLabel(currentCurrency)}
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
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.priceList")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.priceListDesc")}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="mr-1 text-sm text-slate-400">
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
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.laborRate")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.laborRateDesc")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {updateLaborRate.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text className="mr-1 text-sm text-slate-400">
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

      {/* Account Section */}
      <View className="mx-6">
        <Text className="mb-2 text-xs font-semibold uppercase text-slate-400 px-1">
          {t("settings.account")}
        </Text>
        <View className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
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
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.businessLogo")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.businessLogoDesc")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {logoUploading ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : profile?.logoKey ? (
                <View className="flex-row items-center">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 mr-1">
                    <Check size={12} color="#16a34a" />
                  </View>
                  <Text className="text-sm text-slate-400">{t("settings.uploaded")}</Text>
                </View>
              ) : (
                <Text className="text-sm text-slate-400">{t("settings.uploadLogo")}</Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: 4 }} />
            </View>
          </Pressable>

          {/* Terms & Conditions */}
          <Pressable
            onPress={() => router.push("/terms")}
            className="flex-row items-center px-4 py-3.5 border-b border-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <FileText size={18} color="#f59e0b" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-slate-900">
                {t("settings.termsAndConditions")}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {t("settings.termsAndConditionsDesc")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {profile?.termsAndConditions && profile.termsAndConditions.length > 0 ? (
                <View className="flex-row items-center">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 mr-1">
                    <Check size={12} color="#16a34a" />
                  </View>
                  <Text className="text-sm text-slate-400">
                    {profile.termsAndConditions.length} {t("terms.items")}
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-slate-400">{t("terms.usingDefaults")}</Text>
              )}
              <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: 4 }} />
            </View>
          </Pressable>

          {/* Sign Out */}
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
