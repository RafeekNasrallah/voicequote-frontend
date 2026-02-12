import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  ArrowLeft,
  FileText,
  UserPlus,
  Trash2,
  Plus,
  Share2,
  Loader2,
} from "lucide-react-native";
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

import ClientSelectModal from "@/components/ClientSelectModal";
import api from "@/src/lib/api";

// ─── Types ──────────────────────────────────────────────────

interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  price: number | null;
  lineTotal: number | null;
}

interface QuoteData {
  id: number;
  items: QuoteItem[] | null;
  totalCost: number | null;
  clientId: number | null;
  clientName: string | null;
  pdfKey: boolean;
}

// ─── Main Screen ────────────────────────────────────────────

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [localItems, setLocalItems] = useState<QuoteItem[]>([]);
  const [localTotal, setLocalTotal] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // ─── Fetch Quote ────────────────────────────────────────
  const {
    data: quote,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data } = await api.get<QuoteData>(`/api/quotes/${id}`);
      return data;
    },
  });

  // Sync server data to local state
  useEffect(() => {
    if (quote?.items) {
      setLocalItems(quote.items);
    }
    if (quote?.totalCost !== undefined) {
      setLocalTotal(quote.totalCost);
    }
  }, [quote]);

  // ─── Mutations ──────────────────────────────────────────

  const patchClient = useMutation({
    mutationFn: async (clientId: number) => {
      await api.patch(`/api/quotes/${id}/client`, { clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedUpdateClient"));
    },
  });

  const patchItems = useMutation({
    mutationFn: async (items: QuoteItem[]) => {
      const { data } = await api.patch<{ ok: boolean; totalCost: number | null }>(
        `/api/quotes/${id}/items`,
        { items }
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.totalCost !== null && data.totalCost !== undefined) {
        setLocalTotal(data.totalCost);
      }
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedSaveItems"));
    },
  });

  // PDF Generation
  const generatePdf = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ pdfUrl: string }>(
        `/api/quotes/${id}/regenerate-pdf`
      );
      return data;
    },
    onSuccess: (data) => {
      setPdfUrl(data.pdfUrl);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      Alert.alert(t("quoteEditor.pdfReady"), t("quoteEditor.pdfReadyMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.pdfError"));
    },
  });

  // ─── Share PDF ──────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!pdfUrl) {
      Alert.alert(t("quoteEditor.noPdf"), t("quoteEditor.generateFirst"));
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(t("quoteEditor.sharingUnavailable"), t("quoteEditor.sharingUnavailableMsg"));
      return;
    }

    setIsSharing(true);
    try {
      // Download the PDF to a local temp file
      const response = await fetch(pdfUrl);
      const blob = await response.blob();

      // Convert blob to base64 and write to cache
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:... prefix
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Write to a temp file using the legacy API
      const FileSystem = require("expo-file-system/legacy");
      const localUri = FileSystem.cacheDirectory + `quote-${id}.pdf`;
      await FileSystem.writeAsStringAsync(localUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share
      await Sharing.shareAsync(localUri, {
        mimeType: "application/pdf",
        dialogTitle: `Quote #${id}`,
      });
    } catch (err) {
      console.error("Share failed:", err);
      Alert.alert(t("quoteEditor.shareFailed"), t("quoteEditor.shareFailedMsg"));
    } finally {
      setIsSharing(false);
    }
  }, [pdfUrl, id, t]);

  // ─── Item Editing Helpers ───────────────────────────────

  const recalcTotal = useCallback((items: QuoteItem[]) => {
    const total = items.reduce((sum, item) => {
      const lineTotal = (item.qty || 0) * (item.price || 0);
      return sum + lineTotal;
    }, 0);
    setLocalTotal(total);
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof QuoteItem, value: string) => {
      setLocalItems((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };

        if (field === "name" || field === "unit") {
          (item as any)[field] = value;
        } else {
          const num = parseFloat(value) || 0;
          (item as any)[field] = num;
          item.lineTotal = (item.qty || 0) * (item.price || 0);
        }

        updated[index] = item;
        recalcTotal(updated);
        return updated;
      });
    },
    [recalcTotal]
  );

  const saveItems = useCallback(() => {
    patchItems.mutate(localItems);
  }, [localItems, patchItems]);

  const addItem = useCallback(() => {
    setLocalItems((prev) => [
      ...prev,
      { name: "", qty: 1, unit: "ea", price: 0, lineTotal: 0 },
    ]);
  }, []);

  const removeItem = useCallback(
    (index: number) => {
      setLocalItems((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        recalcTotal(updated);
        return updated;
      });
      // Auto-save after removal
      setTimeout(() => {
        const updated = localItems.filter((_, i) => i !== index);
        patchItems.mutate(updated);
      }, 100);
    },
    [localItems, patchItems, recalcTotal]
  );

  // ─── Loading / Error States ─────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f172a" />
      </SafeAreaView>
    );
  }

  if (isError || !quote) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6">
        <FileText size={36} color="#94a3b8" />
        <Text className="mt-4 text-base text-slate-500">
          {t("quoteEditor.failedToLoad")}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 h-10 items-center justify-center rounded-lg bg-slate-900 px-6"
        >
          <Text className="text-sm font-semibold text-white">{t("quoteEditor.goBack")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const hasPdf = quote.pdfKey || pdfUrl;

  // ─── Render ─────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Client Select Modal */}
      <ClientSelectModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSelect={(client) => patchClient.mutate(client.id)}
      />

      {/* Header Bar */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200 bg-white">
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            router.back();
          }}
          className="mr-3 h-10 w-10 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={22} color="#0f172a" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-slate-900">
            Quote #{quote.id}
          </Text>
          <Text className="text-xs text-slate-400">{formattedDate}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Paper Container ─────────────────────── */}
          <View className="mx-4 mt-4 rounded-xl bg-white shadow-sm border border-slate-100">
            {/* ─── Client Section ──────────────────── */}
            <View className="border-b border-slate-100 p-4">
              <Text className="mb-2 text-xs font-semibold uppercase text-slate-400">
                {t("quoteEditor.client")}
              </Text>
              {quote.clientName ? (
                <Pressable
                  onPress={() => setClientModalVisible(true)}
                  className="rounded-lg border border-slate-200 p-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-sm font-semibold text-slate-900">
                    {quote.clientName}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-400">
                    {t("quoteEditor.tapToChange")}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setClientModalVisible(true)}
                  className="items-center rounded-lg border border-dashed border-slate-300 p-4"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <UserPlus size={20} color="#3b82f6" />
                  <Text className="mt-1 text-sm font-semibold text-blue-500">
                    {t("quoteEditor.selectClient")}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ─── Line Items ──────────────────────── */}
            <View className="p-4">
              {/* Table Header */}
              <View className="mb-2 flex-row items-center">
                <Text className="flex-1 text-xs font-semibold uppercase text-slate-400">
                  {t("quoteEditor.item")}
                </Text>
                <Text className="w-14 text-center text-xs font-semibold uppercase text-slate-400">
                  {t("quoteEditor.qty")}
                </Text>
                <Text className="w-20 text-right text-xs font-semibold uppercase text-slate-400">
                  {t("quoteEditor.price")}
                </Text>
                <View className="w-9" />
              </View>

              {/* Rows */}
              {localItems.map((item, index) => (
                <View
                  key={index}
                  className="flex-row items-center border-b border-slate-100 py-2.5"
                >
                  {/* Name */}
                  <TextInput
                    className="flex-1 text-sm text-slate-900 mr-2"
                    value={item.name}
                    onChangeText={(v) => updateItem(index, "name", v)}
                    onBlur={saveItems}
                    placeholder={t("quoteEditor.itemNamePlaceholder")}
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Qty */}
                  <TextInput
                    className="w-14 text-center text-sm text-slate-900"
                    value={item.qty?.toString() || ""}
                    onChangeText={(v) => updateItem(index, "qty", v)}
                    onBlur={saveItems}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Price */}
                  <TextInput
                    className="w-20 text-right text-sm text-slate-900"
                    value={item.price?.toString() || ""}
                    onChangeText={(v) => updateItem(index, "price", v)}
                    onBlur={saveItems}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Delete */}
                  <Pressable
                    onPress={() => removeItem(index)}
                    className="ml-1 h-9 w-9 items-center justify-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}

              {/* Add Item Button */}
              <Pressable
                onPress={addItem}
                className="mt-3 flex-row items-center justify-center rounded-lg border border-dashed border-slate-300 py-2.5"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Plus size={16} color="#64748b" />
                <Text className="ml-1.5 text-sm font-medium text-slate-500">
                  {t("quoteEditor.addItem")}
                </Text>
              </Pressable>
            </View>

            {/* ─── Footer / Total ──────────────────── */}
            <View className="border-t border-slate-100 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-500">{t("quoteEditor.total")}</Text>
                <Text className="text-xl font-bold text-slate-900">
                  ${(localTotal ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── Action Buttons ────────────────────── */}
          <View className="mx-4 mt-4 gap-3">
            {/* Finalize PDF */}
            <Pressable
              className="h-12 flex-row items-center justify-center rounded-lg bg-orange-600"
              onPress={() => generatePdf.mutate()}
              disabled={generatePdf.isPending}
              style={({ pressed }) => ({
                opacity: pressed || generatePdf.isPending ? 0.85 : 1,
              })}
            >
              {generatePdf.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {hasPdf ? t("quoteEditor.regeneratePdf") : t("quoteEditor.finalizePdf")}
                </Text>
              )}
            </Pressable>

            {/* Share PDF (only when PDF exists) */}
            {hasPdf && (
              <Pressable
                className="h-12 flex-row items-center justify-center rounded-lg border border-slate-200 bg-white"
                onPress={handleShare}
                disabled={isSharing}
                style={({ pressed }) => ({
                  opacity: pressed || isSharing ? 0.85 : 1,
                })}
              >
                {isSharing ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <>
                    <Share2 size={18} color="#0f172a" />
                    <Text className="ml-2 text-base font-semibold text-slate-900">
                      {t("quoteEditor.sharePdf")}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
