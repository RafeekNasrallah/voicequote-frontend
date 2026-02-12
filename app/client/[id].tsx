import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
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

interface Client {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Fetch client
  const {
    data: client,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      // Get from the clients list since there's no GET /clients/:id
      const { data } = await api.get<{ clients: Client[] }>("/api/clients");
      const found = data.clients.find((c) => c.id === Number(id));
      if (!found) throw new Error("Client not found");
      return found;
    },
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
      router.back();
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
          onPress={() => router.back()}
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200 bg-white">
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            router.back();
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
        className="flex-1"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
