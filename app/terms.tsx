import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react-native";
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

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_TERMS = [
  "This quote is valid for 30 days from the date of issue.",
  "Payment is due upon completion of work unless otherwise agreed.",
  "Prices are subject to change if project scope is altered.",
  "All materials and labor are guaranteed as specified above.",
];

// ─── Types ───────────────────────────────────────────────────

interface UserProfile {
  termsAndConditions: string[] | null;
}

// ─── Main Screen ─────────────────────────────────────────────

export default function TermsScreen() {
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

  const [terms, setTerms] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isUsingDefaults, setIsUsingDefaults] = useState(true);

  // Fetch current terms
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
      if (profile.termsAndConditions && profile.termsAndConditions.length > 0) {
        setTerms(profile.termsAndConditions);
        setIsUsingDefaults(false);
      } else {
        setTerms(DEFAULT_TERMS);
        setIsUsingDefaults(true);
      }
    }
  }, [profile]);

  // Save mutation
  const saveTerms = useMutation({
    mutationFn: async (newTerms: string[] | null) => {
      await api.patch("/api/me", { termsAndConditions: newTerms });
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      Alert.alert(t("terms.saved"), t("terms.savedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("terms.saveFailed"));
    },
  });

  // ─── Actions ───────────────────────────────────────────────

  const addTerm = useCallback(() => {
    setTerms((prev) => [...prev, ""]);
    setHasChanges(true);
    setIsUsingDefaults(false);
  }, []);

  const updateTerm = useCallback((index: number, value: string) => {
    setTerms((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
    setHasChanges(true);
    setIsUsingDefaults(false);
  }, []);

  const deleteTerm = useCallback((index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setIsUsingDefaults(false);
  }, []);

  const handleSave = useCallback(() => {
    // Filter out empty terms
    const validTerms = terms.filter((term) => term.trim().length > 0);
    if (validTerms.length === 0) {
      // If all terms are empty, reset to defaults
      saveTerms.mutate(null);
      setIsUsingDefaults(true);
    } else {
      saveTerms.mutate(validTerms);
      setTerms(validTerms);
    }
  }, [terms, saveTerms]);

  const handleResetToDefaults = useCallback(() => {
    Alert.alert(
      t("terms.resetToDefaults"),
      t("terms.resetConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("terms.reset"),
          style: "destructive",
          onPress: () => {
            saveTerms.mutate(null, {
              onSuccess: () => {
                setTerms(DEFAULT_TERMS);
                setIsUsingDefaults(true);
                setHasChanges(false);
                queryClient.invalidateQueries({ queryKey: ["me"] });
              },
            });
          },
        },
      ]
    );
  }, [saveTerms, queryClient, t]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        t("terms.title"),
        t("terms.unsavedChanges"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("terms.discard"),
            style: "destructive",
            onPress: () => router.replace("/(tabs)/settings"),
          },
          {
            text: t("common.save"),
            onPress: () => {
              const validTerms = terms.filter((term) => term.trim().length > 0);
              saveTerms.mutate(validTerms.length > 0 ? validTerms : null, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ["me"] });
                  router.replace("/(tabs)/settings");
                },
              });
            },
          },
        ]
      );
    } else {
      router.replace("/(tabs)/settings");
    }
  }, [hasChanges, terms, saveTerms, queryClient, router, t]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header — RTL: title on right, back arrow mirrored, Save on left */}
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
            {t("terms.title")}
          </Text>
        </View>
        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || saveTerms.isPending}
          className={`h-11 px-4 items-center justify-center rounded-lg ${
            hasChanges ? "bg-orange-600" : "bg-slate-200"
          }`}
          style={({ pressed }) => ({
            opacity: pressed || saveTerms.isPending ? 0.7 : 1,
          })}
        >
          {saveTerms.isPending ? (
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
            {/* Status indicator — RTL: status text on right, reset on left */}
            <View
              className="mb-4 flex-row items-center justify-between"
              style={isRTL ? { direction: "rtl" as const } : undefined}
            >
              <Text className="text-sm text-slate-500" style={rtlText}>
                {isUsingDefaults && !hasChanges
                  ? t("terms.usingDefaults")
                  : t("terms.customTerms", { count: terms.length })}
              </Text>
              {!isUsingDefaults && (
                <Pressable
                  onPress={handleResetToDefaults}
                  className="flex-row items-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <RotateCcw size={14} color="#64748b" />
                  <Text
                    className="text-sm text-slate-500"
                    style={[rtlText, isRTL ? { marginRight: 4 } : { marginLeft: 4 }]}
                  >
                    {t("terms.resetToDefaults")}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Terms list */}
            {terms.map((term, index) => (
              <View
                key={index}
                className="mb-3 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden"
              >
                <View
                  className="flex-row items-start"
                  style={isRTL ? { direction: "rtl" as const } : undefined}
                >
                  <Text
                    className="px-4 pt-3 text-sm font-semibold text-slate-400"
                    style={rtlText}
                  >
                    {index + 1}.
                  </Text>
                  <TextInput
                    className="flex-1 px-2 py-3 text-sm text-slate-900"
                    value={term}
                    onChangeText={(v) => updateTerm(index, v)}
                    placeholder={t("terms.termPlaceholder")}
                    placeholderTextColor="#94a3b8"
                    multiline
                    textAlignVertical="top"
                    style={inputRtlStyle}
                  />
                  <Pressable
                    onPress={() => deleteTerm(index)}
                    className="px-3 py-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    accessibilityLabel={t("terms.deleteTerm")}
                    accessibilityRole="button"
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Add term button — RTL: icon and text direction */}
            <Pressable
              onPress={addTerm}
              className="mt-2 flex-row items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-4"
              style={({ pressed }) => [
                { opacity: pressed ? 0.7 : 1 },
                isRTL ? { direction: "rtl" as const } : undefined,
              ]}
            >
              <Plus size={18} color="#64748b" />
              <Text
                className="text-sm font-medium text-slate-500"
                style={[rtlText, isRTL ? { marginRight: 8 } : { marginLeft: 8 }]}
              >
                {t("terms.addTerm")}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
