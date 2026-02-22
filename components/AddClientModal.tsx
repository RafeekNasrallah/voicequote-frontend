import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";

const RTL_LANGUAGES = ["ar", "he"];

interface AddClientModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddClientModal({
  visible,
  onClose,
}: AddClientModalProps) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes(
    (i18n.language || "").split("-")[0]
  );
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlFieldDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const rtlLabelContainer = { alignSelf: "flex-start" as const };

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const createClient = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/clients", {
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      resetForm();
      onClose();
    },
    onError: () => {
      Alert.alert(t("common.error"), t("clients.createFailed"));
    },
  });

  const resetForm = () => {
    setName("");
    setAddress("");
    setEmail("");
    setPhone("");
  };

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert(t("clients.missingName"), t("clients.nameRequired"));
      return;
    }
    createClient.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 pt-4"
          style={isRTL ? { flexDirection: "row-reverse" } : undefined}
        >
          <Text className="text-lg font-bold text-slate-900" style={rtlText}>
            {t("clients.newClient")}
          </Text>
          <Pressable
            onPress={() => { resetForm(); onClose(); }}
            className="h-11 w-11 items-center justify-center rounded-full bg-slate-100"
            accessibilityLabel={t("common.cancel")}
            accessibilityRole="button"
          >
            <X size={18} color="#64748b" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View className="mb-4 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelContainer]}
            >
              {t("clients.name")} *
            </Text>
            <TextInput
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.namePlaceholder")}
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Address */}
          <View className="mb-4 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelContainer]}
            >
              {t("clients.address")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.addressPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View className="mb-4 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelContainer]}
            >
              {t("clients.emailLabel")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
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
          <View className="mb-4 w-full" style={rtlFieldDirection}>
            <Text
              className="mb-1.5 text-sm font-medium text-slate-700"
              style={[rtlText, rtlLabelContainer]}
            >
              {t("clients.phone")}
            </Text>
            <TextInput
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              style={rtlText}
              placeholder={t("clients.phonePlaceholder")}
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Create Button */}
          <Pressable
            className="mt-2 h-12 items-center justify-center rounded-lg bg-slate-900"
            onPress={handleCreate}
            disabled={createClient.isPending}
            style={({ pressed }) => ({
              opacity: pressed || createClient.isPending ? 0.8 : 1,
            })}
          >
            {createClient.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {t("clients.createClient")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
