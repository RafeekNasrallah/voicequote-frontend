import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, FileText, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

import api from "@/src/lib/api";
import { getCurrencySymbol } from "@/src/lib/currency";

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
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
  } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data } = await api.get<Client>(`/api/clients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  // Fetch client's quotes
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ["clientQuotes", id],
    queryFn: async () => {
      const { data } = await api.get<ClientQuotesResponse>(
        `/api/clients/${id}/quotes`,
      );
      return data;
    },
    enabled: !!id,
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
      const { data } = await api.patch<Client>(`/api/clients/${id}`, {
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      Alert.alert(t("clients.changesSaved"), t("clients.changesSavedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("clients.saveFailed"));
    },
  });

  // Delete client
  const deleteClient = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/clients/${id}`);
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

  // Loading
  if (isLoading) {
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
          onPress={() => router.replace("/(tabs)/clients")}
          className="mt-4 h-10 items-center justify-center rounded-lg bg-slate-900 px-6"
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
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200">
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            router.replace("/(tabs)/clients");
          }}
          className="mr-3 h-10 w-10 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={22} color="#0f172a" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-slate-900">
          {t("clients.editClient")}
        </Text>
        <Pressable
          onPress={handleDelete}
          className="ml-2 h-10 w-10 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
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
          <View className="mb-5">
            <Text className="mb-1.5 text-sm font-medium text-slate-700">
              {t("clients.name")} *
            </Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder={t("clients.namePlaceholder")}
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Address */}
          <View className="mb-5">
            <Text className="mb-1.5 text-sm font-medium text-slate-700">
              {t("clients.address")}
            </Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder={t("clients.addressPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View className="mb-5">
            <Text className="mb-1.5 text-sm font-medium text-slate-700">
              {t("clients.emailLabel")}
            </Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder={t("clients.emailPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Phone */}
          <View className="mb-5">
            <Text className="mb-1.5 text-sm font-medium text-slate-700">
              {t("clients.phone")}
            </Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
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
            disabled={saveClient.isPending}
            style={({ pressed }) => ({
              opacity: pressed || saveClient.isPending ? 0.8 : 1,
            })}
          >
            {saveClient.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {t("clients.saveChanges")}
              </Text>
            )}
          </Pressable>

          {/* Quote History Section */}
          <View className="mt-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-slate-900">
                {t("clients.quoteHistory")}
              </Text>
              {quotesData && quotesData.totalQuotes > 0 && (
                <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                  <Text className="text-xs font-semibold text-slate-600">
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
                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text className="text-xs text-slate-400 uppercase">
                      {t("clients.totalQuotes")}
                    </Text>
                    <Text className="text-xl font-bold text-slate-900 mt-1">
                      {quotesData.totalQuotes}
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-xs text-slate-400 uppercase">
                      {t("clients.totalValue")}
                    </Text>
                    <Text className="text-xl font-bold text-slate-900 mt-1">
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
                    className={`flex-row items-center px-4 py-3.5 ${
                      index < quotesData.quotes.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      <FileText size={18} color="#64748b" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text
                        className="text-sm font-medium text-slate-900"
                        numberOfLines={1}
                      >
                        {quote.name || `Quote #${quote.id}`}
                      </Text>
                      <Text className="text-xs text-slate-400 mt-0.5">
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      {quote.totalCost !== null && (
                        <Text className="text-sm font-semibold text-slate-700 mr-2">
                          {currencySymbol}
                          {quote.totalCost.toFixed(2)}
                        </Text>
                      )}
                      <ChevronRight size={16} color="#cbd5e1" />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="items-center py-8 rounded-xl bg-white border border-slate-100">
                <FileText size={32} color="#cbd5e1" />
                <Text className="mt-2 text-sm text-slate-400">
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
