import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Percent, Tag } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";
import { getCurrencySymbol } from "@/src/lib/currency";

// ─── Types ───────────────────────────────────────────────────

interface UserProfile {
  taxRate: number | null;
  taxLabel: string | null;
  taxEnabled: boolean;
  taxInclusive: boolean;
  currency: string;
}

// ─── Main Screen ─────────────────────────────────────────────

export default function TaxSettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [taxLabel, setTaxLabel] = useState("");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialValues, setInitialValues] = useState({
    taxEnabled: false,
    taxRate: "",
    taxLabel: "",
    taxInclusive: false,
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
        taxEnabled: profile.taxEnabled ?? false,
        taxRate: profile.taxRate?.toString() ?? "",
        taxLabel: profile.taxLabel ?? "",
        taxInclusive: profile.taxInclusive ?? false,
      };
      setTaxEnabled(values.taxEnabled);
      setTaxRate(values.taxRate);
      setTaxLabel(values.taxLabel);
      setTaxInclusive(values.taxInclusive);
      setInitialValues(values);
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    const changed =
      taxEnabled !== initialValues.taxEnabled ||
      taxRate !== initialValues.taxRate ||
      taxLabel !== initialValues.taxLabel ||
      taxInclusive !== initialValues.taxInclusive;
    setHasChanges(changed);
  }, [taxEnabled, taxRate, taxLabel, taxInclusive, initialValues]);

  // Save mutation
  const saveSettings = useMutation({
    mutationFn: async () => {
      const rateValue = parseFloat(taxRate);
      await api.patch("/api/me", {
        taxEnabled,
        taxRate: !isNaN(rateValue) && rateValue > 0 ? rateValue : null,
        taxLabel: taxLabel.trim() || null,
        taxInclusive,
      });
    },
    onSuccess: () => {
      setHasChanges(false);
      setInitialValues({ taxEnabled, taxRate, taxLabel, taxInclusive });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      Alert.alert(t("taxSettings.saved"), t("taxSettings.savedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("taxSettings.saveFailed"));
    },
  });

  // ─── Actions ───────────────────────────────────────────────

  const handleSave = useCallback(() => {
    saveSettings.mutate();
  }, [saveSettings]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(t("taxSettings.title"), t("taxSettings.unsavedChanges"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("taxSettings.discard"),
          style: "destructive",
          onPress: () => router.replace("/(tabs)/settings"),
        },
        {
          text: t("common.save"),
          onPress: () => {
            saveSettings.mutate(undefined, {
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
  }, [hasChanges, saveSettings, queryClient, router, t]);

  // ─── Preview Calculation ───────────────────────────────────

  const currencySymbol = getCurrencySymbol(profile?.currency ?? "USD");
  const previewTotal = 100; // The item prices total
  const rateNum = parseFloat(taxRate) || 0;
  const displayLabel = taxLabel.trim() || t("taxSettings.defaultLabel");

  // Calculate based on tax-inclusive vs tax-exclusive mode
  let subtotal: number;
  let taxAmount: number;
  let grandTotal: number;

  if (taxEnabled && rateNum > 0) {
    if (taxInclusive) {
      // Prices INCLUDE tax - extract it
      grandTotal = previewTotal;
      subtotal = previewTotal / (1 + rateNum / 100);
      taxAmount = previewTotal - subtotal;
    } else {
      // Prices EXCLUDE tax - add it on top
      subtotal = previewTotal;
      taxAmount = subtotal * (rateNum / 100);
      grandTotal = subtotal + taxAmount;
    }
  } else {
    subtotal = previewTotal;
    taxAmount = 0;
    grandTotal = previewTotal;
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200">
        <Pressable
          onPress={handleBack}
          className="mr-3 h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          accessibilityLabel={t("quoteEditor.goBack")}
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color="#0f172a" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-slate-900">
          {t("taxSettings.title")}
        </Text>
        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || saveSettings.isPending}
          className={`h-11 px-4 items-center justify-center rounded-lg ${
            hasChanges ? "bg-slate-900" : "bg-slate-200"
          }`}
          style={({ pressed }) => ({
            opacity: pressed || saveSettings.isPending ? 0.7 : 1,
          })}
        >
          {saveSettings.isPending ? (
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
            <ActivityIndicator color="#0f172a" size="large" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Enable Tax Toggle */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-1">
                  <Text className="text-base font-medium text-slate-900">
                    {t("taxSettings.enableTax")}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {t("taxSettings.enableTaxDesc")}
                  </Text>
                </View>
                <Switch
                  value={taxEnabled}
                  onValueChange={setTaxEnabled}
                  trackColor={{ false: "#e2e8f0", true: "#ea580c" }}
                  thumbColor="#ffffff"
                  accessibilityLabel={t("taxSettings.enableTax")}
                />
              </View>
            </View>

            {/* Tax Rate */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 mr-3">
                  <Percent size={16} color="#10b981" />
                </View>
                <Text className="text-sm font-medium text-slate-700">
                  {t("taxSettings.taxRate")}
                </Text>
              </View>
              <View className="flex-row items-center px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-slate-900"
                  value={taxRate}
                  onChangeText={setTaxRate}
                  placeholder={t("taxSettings.taxRatePlaceholder")}
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  editable={taxEnabled}
                  style={{ opacity: taxEnabled ? 1 : 0.5 }}
                />
                <Text className="text-base text-slate-500 ml-2">%</Text>
              </View>
            </View>

            {/* Tax Label */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-violet-50 mr-3">
                  <Tag size={16} color="#8b5cf6" />
                </View>
                <Text className="text-sm font-medium text-slate-700">
                  {t("taxSettings.taxLabel")}
                </Text>
              </View>
              <TextInput
                className="px-4 py-3 text-base text-slate-900"
                value={taxLabel}
                onChangeText={setTaxLabel}
                placeholder={t("taxSettings.taxLabelPlaceholder")}
                placeholderTextColor="#94a3b8"
                editable={taxEnabled}
                style={{ opacity: taxEnabled ? 1 : 0.5 }}
              />
            </View>

            {/* Tax Inclusive Toggle */}
            <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden" style={{ opacity: taxEnabled ? 1 : 0.5 }}>
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-medium text-slate-900">
                    {t("taxSettings.taxInclusive")}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {taxInclusive
                      ? t("taxSettings.taxInclusiveHint")
                      : t("taxSettings.taxExclusiveHint")}
                  </Text>
                </View>
                <Switch
                  value={taxInclusive}
                  onValueChange={setTaxInclusive}
                  trackColor={{ false: "#e2e8f0", true: "#ea580c" }}
                  thumbColor="#ffffff"
                  disabled={!taxEnabled}
                  accessibilityLabel={t("taxSettings.taxInclusive")}
                />
              </View>
            </View>

            {/* Preview Section */}
            <View className="mb-4">
              <Text className="text-xs font-semibold uppercase text-slate-400 px-1 mb-2">
                {t("taxSettings.preview")}
              </Text>
              <View className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden p-4">
                {/* Item Prices */}
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm text-slate-600">
                    {t("taxSettings.itemPrices")}
                  </Text>
                  <Text className="text-sm font-medium text-slate-900">
                    {currencySymbol}{previewTotal.toFixed(2)}
                  </Text>
                </View>

                {/* Divider */}
                <View className="h-px bg-slate-200 my-2" />

                {/* Subtotal */}
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm text-slate-600">
                    {taxInclusive && taxEnabled && rateNum > 0
                      ? t("taxSettings.subtotalExclTax")
                      : t("taxSettings.subtotal")}
                  </Text>
                  <Text className="text-sm font-medium text-slate-900">
                    {currencySymbol}{subtotal.toFixed(2)}
                  </Text>
                </View>

                {/* Tax Line */}
                {taxEnabled && rateNum > 0 && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-slate-600">
                      {displayLabel} ({rateNum}%)
                    </Text>
                    <Text className="text-sm font-medium text-slate-900">
                      {currencySymbol}{taxAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Divider */}
                <View className="h-px bg-slate-200 my-2" />

                {/* Total */}
                <View className="flex-row justify-between">
                  <Text className="text-base font-semibold text-slate-900">
                    {t("taxSettings.total")}
                  </Text>
                  <Text className="text-base font-bold text-slate-900">
                    {currencySymbol}{grandTotal.toFixed(2)}
                  </Text>
                </View>

                {/* Info text */}
                {!taxEnabled && (
                  <Text className="text-xs text-slate-400 mt-3 text-center">
                    {t("taxSettings.taxDisabledPreview")}
                  </Text>
                )}

                {/* Mode indicator */}
                {taxEnabled && rateNum > 0 && (
                  <View className="mt-3 bg-slate-50 rounded-lg px-3 py-2">
                    <Text className="text-xs text-slate-500 text-center">
                      {taxInclusive
                        ? t("taxSettings.inclusiveModeInfo")
                        : t("taxSettings.exclusiveModeInfo")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
