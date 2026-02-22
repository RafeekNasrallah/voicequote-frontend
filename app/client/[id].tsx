import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, FileText, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

import api from "@/src/lib/api";
import { getCurrencySymbol } from "@/src/lib/currency";

const RTL_LANGUAGES = ["ar", "he"];

interface Client {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

interface ClientQuote {
  id: number;
  name: string | null;
  totalCost: number | null;
  grandTotal?: number | null;
  createdAt: string;
  pdfUrl: string | null;
}

interface ClientQuotesResponse {
  client: {
    id: number;
    name: string;
    address: string | null;
  };
  quotes: ClientQuote[];
  totalQuotes: number;
  totalValue: number;
}

interface UserProfile {
  currency: string;
}

export default function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const numericId = id ? Number(id) : NaN;
  const hasValidId = Number.isInteger(numericId) && numericId > 0;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? undefined;
  const languageIsRTL = RTL_LANGUAGES.includes(
    (i18n.language || "").split("-")[0]
  );
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlFieldDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const rtlLabelAlign = isRTL ? { alignSelf: "flex-start" as const } : undefined;
  /** Header row: RTL puts title+arrow group on right, trash on left. */
  const rtlHeaderDirection = isRTL ? { direction: "rtl" as const } : undefined;
  /** Title group: RTL puts arrow on right, text on left (arrow first in DOM). */
  const rtlTitleGroupDirection = isRTL ? { direction: "rtl" as const } : undefined;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [backPressed, setBackPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const [savePressed, setSavePressed] = useState(false);
  const [pressedQuoteId, setPressedQuoteId] = useState<number | null>(null);

  // Fetch user profile for currency
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/api/me");
      return data;
    },
  });

  const currencySymbol = getCurrencySymbol(profile?.currency ?? "USD");

  // Fetch client by ID
  const {
    data: client,
    isLoading,
    isError,
    refetch: refetchClient,
  } = useQuery({
    queryKey: ["client", numericId],
    queryFn: async () => {
      const { data } = await api.get<Client>(`/api/clients/${numericId}`);
      return data;
    },
    enabled: hasValidId,
  });

  // Fetch client's quotes
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ["clientQuotes", numericId],
    queryFn: async () => {
      const { data } = await api.get<ClientQuotesResponse>(
        `/api/clients/${numericId}/quotes`,
      );
      return data;
    },
    enabled: hasValidId,
  });

  // Sync server data to form
  useEffect(() => {
    if (client) {
      setName(client.name);
      setAddress(client.address || "");
      setEmail(client.email || "");
      setPhone(client.phone || "");
    }
  }, [client]);

  // Save changes
  const saveClient = useMutation({
    mutationFn: async () => {
      if (!hasValidId) throw new Error("Invalid client ID");
      const { data } = await api.patch<Client>(`/api/clients/${numericId}`, {
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", numericId] });
      Alert.alert(t("clients.changesSaved"), t("clients.changesSavedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("clients.saveFailed"));
    },
  });

  // Delete client
  const deleteClient = useMutation({
    mutationFn: async () => {
      if (!hasValidId) throw new Error("Invalid client ID");
      await api.delete(`/api/clients/${numericId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.replace("/(tabs)/clients");
    },
    onError: () => {
      Alert.alert(t("common.error"), t("clients.deleteClientFailed"));
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert(t("clients.missingName"), t("clients.nameRequired"));
      return;
    }
    saveClient.mutate();
  }, [name, saveClient, t]);

  const handleDelete = useCallback(() => {
    Alert.alert(t("clients.deleteClient"), t("clients.deleteClientConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => deleteClient.mutate(),
      },
    ]);
  }, [deleteClient, t]);

  // Wait for route params before querying/showing errors.
  if (!hasValidId || isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f172a" />
      </SafeAreaView>
    );
  }

  // Error
  if (isError || !client) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-base text-slate-500">
          {t("clients.noClientsFound")}
        </Text>
        <Pressable
          onPress={() => refetchClient()}
          className="mt-4 h-11 items-center justify-center rounded-lg border border-slate-200 px-6"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-sm font-semibold text-slate-700">
            {t("errors.retry")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)/clients")}
          className="mt-4 h-11 items-center justify-center rounded-lg bg-slate-900 px-6"
        >
          <Text className="text-sm font-semibold text-white">
            {t("quoteEditor.goBack")}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header: one order; RTL = trash left, right side = arrow then text */}
      <View
        className="flex-row items-center px-4 py-3 border-b border-slate-200"
        style={rtlHeaderDirection}
      >
        <View
          className="flex-1 flex-row items-center"
          style={[rtlTitleGroupDirection, { marginEnd: 12 }]}
        >
          <Pressable
            onPress={() => {
              queryClient.invalidateQueries({ queryKey: ["clients"] });
              router.replace("/(tabs)/clients");
            }}
            onPressIn={() => setBackPressed(true)}
            onPressOut={() => setBackPressed(false)}
            className="h-11 w-11 items-center justify-center rounded-lg"
            style={{ opacity: backPressed ? 0.6 : 1 }}
            accessibilityLabel={t("quoteEditor.goBack")}
            accessibilityRole="button"
          >
            <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
              <ArrowLeft size={22} color="#ea580c" />
            </View>
          </Pressable>
          <Text
            className="text-lg font-bold text-slate-900"
            style={[rtlText, { marginStart: 12 }]}
          >
            {t("clients.editClient")}
          </Text>
        </View>
        <Pressable
          onPress={handleDelete}
          onPressIn={() => setDeletePressed(true)}
          onPressOut={() => setDeletePressed(false)}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={[
            { opacity: deletePressed ? 0.5 : 1 },
            isRTL ? { marginEnd: 8 } : { marginStart: 8 },
          ]}
          accessibilityLabel={t("clients.deleteClient")}
          accessibilityHint={t("clients.deleteClientConfirm")}
          accessibilityRole="button"
        >
          <Trash2 size={20} color="#ef4444" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View className="mb-5 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelAlign]}
            >
              {t("clients.name")} *
            </Text>
            <TextInput
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.namePlaceholder")}
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Address */}
          <View className="mb-5 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelAlign]}
            >
              {t("clients.address")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.addressPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View className="mb-5 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelAlign]}
            >
              {t("clients.emailLabel")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.emailPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Phone */}
          <View className="mb-5 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelAlign]}
            >
              {t("clients.phone")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.phonePlaceholder")}
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Save Button */}
          <Pressable
            className="mt-2 h-12 items-center justify-center rounded-xl bg-slate-900"
            onPress={handleSave}
            onPressIn={() => setSavePressed(true)}
            onPressOut={() => setSavePressed(false)}
            disabled={saveClient.isPending}
            style={{
              opacity: savePressed || saveClient.isPending ? 0.8 : 1,
            }}
          >
            {saveClient.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                className="text-base font-semibold text-white"
                style={rtlText}
              >
                {t("clients.saveChanges")}
              </Text>
            )}
          </Pressable>

          {/* Quote History Section — RTL: align to the right */}
          <View className="mt-8 w-full" style={rtlFieldDirection}>
            <View
              className="flex-row items-center justify-between mb-3"
              style={rtlHeaderDirection}
            >
              <Text
                className="text-lg font-bold text-slate-900"
                style={rtlText}
              >
                {t("clients.quoteHistory")}
              </Text>
              {quotesData && quotesData.totalQuotes > 0 && (
                <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                  <Text
                    className="text-xs font-semibold text-slate-600"
                    style={rtlText}
                  >
                    {quotesData.totalQuotes}{" "}
                    {quotesData.totalQuotes === 1
                      ? t("clients.quote")
                      : t("clients.quotesPlural")}
                  </Text>
                </View>
              )}
            </View>

            {/* Summary Card */}
            {quotesData && quotesData.totalQuotes > 0 && (
              <View className="mb-4 rounded-xl bg-white border border-slate-100 shadow-sm p-4">
                <View
                  className="flex-row justify-between"
                  style={isRTL ? { flexDirection: "row-reverse" } : undefined}
                >
                  <View className="flex-1" style={isRTL ? { alignItems: "flex-end" } : undefined}>
                    <Text
                      className="text-xs text-slate-500 uppercase"
                      style={rtlText}
                    >
                      {t("clients.totalQuotes")}
                    </Text>
                    <Text
                      className="text-xl font-bold text-slate-900 mt-1"
                      style={rtlText}
                    >
                      {quotesData.totalQuotes}
                    </Text>
                  </View>
                  <View
                    className="flex-1"
                    style={isRTL ? { alignItems: "flex-start" } : { alignItems: "flex-end" }}
                  >
                    <Text
                      className="text-xs text-slate-500 uppercase"
                      style={rtlText}
                    >
                      {t("clients.totalValue")}
                    </Text>
                    <Text
                      className="text-xl font-bold text-slate-900 mt-1"
                      style={rtlText}
                    >
                      {currencySymbol}
                      {quotesData.totalValue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quotes List */}
            {quotesLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color="#94a3b8" />
              </View>
            ) : quotesData && quotesData.quotes.length > 0 ? (
              <View className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                {quotesData.quotes.map((quote, index) => (
                  <Pressable
                    key={quote.id}
                    onPress={() => router.push(`/quote/${quote.id}` as any)}
                    onPressIn={() => setPressedQuoteId(quote.id)}
                    onPressOut={() => setPressedQuoteId(null)}
                    className={`flex-row items-center px-4 py-3.5 ${
                      index < quotesData.quotes.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                    style={[
                      { opacity: pressedQuoteId === quote.id ? 0.7 : 1 },
                      isRTL ? { flexDirection: "row-reverse" } : undefined,
                    ]}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      <FileText size={18} color="#64748b" />
                    </View>
                    <View
                      className="flex-1"
                      style={{ marginStart: 12 }}
                    >
                      <Text
                        className="text-sm font-medium text-slate-900"
                        numberOfLines={1}
                        style={rtlText}
                      >
                        {quote.name || `Quote #${quote.id}`}
                      </Text>
                      <Text
                        className="text-xs text-slate-500 mt-0.5"
                        style={rtlText}
                      >
                        {new Date(quote.createdAt).toLocaleDateString(
                          activeLocale,
                        )}
                      </Text>
                    </View>
                    <View
                      className="flex-row items-center"
                      style={isRTL ? { flexDirection: "row-reverse", marginEnd: 8 } : { marginStart: 8 }}
                    >
                      {(quote.grandTotal ?? quote.totalCost) !== null && (
                        <Text
                          className="text-sm font-semibold text-slate-700"
                          style={[rtlText, isRTL ? { marginStart: 8 } : { marginEnd: 8 }]}
                        >
                          {currencySymbol}
                          {(quote.grandTotal ?? quote.totalCost)?.toFixed(2)}
                        </Text>
                      )}
                      <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
                        <ChevronRight size={16} color="#cbd5e1" />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="items-center py-8 rounded-xl bg-white border border-slate-100">
                <FileText size={32} color="#cbd5e1" />
                <Text
                  className="mt-2 text-sm text-slate-500"
                  style={rtlText}
                >
                  {t("clients.noQuotesForClient")}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
