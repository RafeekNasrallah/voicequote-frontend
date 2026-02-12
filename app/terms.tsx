import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const { t } = useTranslation();

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
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200">
        <Pressable
          onPress={handleBack}
          className="mr-3 h-10 w-10 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={22} color="#0f172a" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-slate-900">
          {t("terms.title")}
        </Text>
        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || saveTerms.isPending}
          className={`h-9 px-4 items-center justify-center rounded-lg ${
            hasChanges ? "bg-slate-900" : "bg-slate-200"
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
            <ActivityIndicator color="#0f172a" size="large" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Status indicator */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-sm text-slate-500">
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
                  <Text className="ml-1 text-sm text-slate-500">
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
                <View className="flex-row items-start">
                  <Text className="px-4 pt-3 text-sm font-semibold text-slate-400">
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
                  />
                  <Pressable
                    onPress={() => deleteTerm(index)}
                    className="px-3 py-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Add term button */}
            <Pressable
              onPress={addTerm}
              className="mt-2 flex-row items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Plus size={18} color="#64748b" />
              <Text className="ml-2 text-sm font-medium text-slate-500">
                {t("terms.addTerm")}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
