import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    ArrowLeft,
    Clock,
    Pause,
    Play,
    Plus,
    Share2,
    Trash2,
    UserPlus,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ClientSelectModal from "@/components/ClientSelectModal";
import NetworkErrorView from "@/components/NetworkErrorView";
import api from "@/src/lib/api";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/src/lib/currency";
import {
  getPriceMatchCandidates,
  type PriceMatchCandidate,
  type PriceListItem as SavedPriceItem,
} from "@/src/lib/priceMatcher";

const QUOTE_NAME_MAX = 255;
const ITEM_NAME_MAX = 200;

/** Get a user-friendly validation message from an API error response (e.g. 400 from Zod). */
function getValidationMessage(
  error: unknown,
  fallbackKey: string,
  t: (key: string) => string,
): string {
  const data = (
    error as {
      response?: {
        data?: { message?: string; errors?: Array<{ message?: string }> };
      };
    }
  )?.response?.data;
  if (data?.message) return data.message;
  const first = data?.errors?.[0]?.message;
  if (first) return first;
  return t(fallbackKey);
}

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
  name: string | null;
  items: QuoteItem[] | null;
  laborHours: number | null;
  laborRate: number | null;
  laborEnabled: boolean;
  totalCost: number | null;
  clientId: number | null;
  clientName: string | null;
  pdfKey: boolean;
  /** Quote-specific terms from voice (or manually added). Only for this quote. */
  extraTerms: string[] | null;
}

interface MatchPickerState {
  itemIndex: number;
  itemName: string;
  candidates: PriceMatchCandidate[];
}

interface UserProfile {
  laborRate: number | null;
  currency: string;
  taxEnabled: boolean;
  taxRate: number | null;
  taxLabel: string | null;
  taxInclusive: boolean;
  priceList: SavedPriceItem[] | null;
}

// ─── Main Screen ────────────────────────────────────────────

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? undefined;

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [localItems, setLocalItems] = useState<QuoteItem[]>([]);
  const [localTotal, setLocalTotal] = useState<number | null>(null);
  const [localName, setLocalName] = useState("");
  const [localLaborHours, setLocalLaborHours] = useState<string>("");
  const [localLaborRate, setLocalLaborRate] = useState<string>("");
  const [localLaborEnabled, setLocalLaborEnabled] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [localExtraTerms, setLocalExtraTerms] = useState<string[]>([]);
  const [matchPicker, setMatchPicker] = useState<MatchPickerState | null>(null);

  // ─── Fetch Quote ────────────────────────────────────────
  const {
    data: quote,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data } = await api.get<QuoteData>(`/api/quotes/${id}`);
      return data;
    },
  });

  // ─── Audio playback URL (for "Play recording") ───────────
  const { data: audioUrl } = useQuery({
    queryKey: ["quote", id, "audio-url"],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ url: string }>(
          `/api/quotes/${id}/audio-url`,
        );
        return data.url;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!quote?.id,
    staleTime: 25 * 60 * 1000, // 25 min (URL TTL is 1h)
  });

  const audioPlayer = useAudioPlayer(audioUrl ?? null, {
    updateInterval: 500,
    downloadFirst: true, // download remote URL before playback for reliable sound
  });
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  // ─── Fetch User Profile (for default labor rate) ──────────────────
  const { data: userProfile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/api/me");
      return data;
    },
  });

  const currencySymbol = getCurrencySymbol(
    userProfile?.currency || DEFAULT_CURRENCY,
  );
  const laborRateNum = parseFloat(localLaborRate) || 0;
  const laborHoursNum = parseFloat(localLaborHours) || 0;
  const laborCost =
    localLaborEnabled && laborRateNum > 0 && laborHoursNum > 0
      ? laborHoursNum * laborRateNum
      : null;
  const materialsCost = localTotal ?? 0;
  const subtotalBeforeTax =
    materialsCost + (localLaborEnabled ? (laborCost ?? 0) : 0);

  // Tax calculation
  const taxEnabled = userProfile?.taxEnabled ?? false;
  const taxRate = userProfile?.taxRate ?? 0;
  const taxInclusive = userProfile?.taxInclusive ?? false;
  const taxLabel = userProfile?.taxLabel || t("taxSettings.defaultLabel");

  let displaySubtotal: number;
  let taxAmount: number;
  let grandTotal: number;

  if (taxEnabled && taxRate > 0) {
    if (taxInclusive) {
      // Prices include tax - extract it
      grandTotal = subtotalBeforeTax;
      displaySubtotal = subtotalBeforeTax / (1 + taxRate / 100);
      taxAmount = subtotalBeforeTax - displaySubtotal;
    } else {
      // Prices exclude tax - add it on top
      displaySubtotal = subtotalBeforeTax;
      taxAmount = displaySubtotal * (taxRate / 100);
      grandTotal = displaySubtotal + taxAmount;
    }
  } else {
    displaySubtotal = subtotalBeforeTax;
    taxAmount = 0;
    grandTotal = subtotalBeforeTax;
  }

  // Sync server data to local state (manual quotes may have items: [] or null)
  useEffect(() => {
    if (Array.isArray(quote?.items)) {
      setLocalItems(quote.items);
    } else if (quote) {
      setLocalItems([]);
    }
    if (quote?.totalCost !== undefined) {
      setLocalTotal(quote.totalCost);
    }
    if (quote?.name !== undefined) {
      setLocalName(quote.name || "");
    }
    if (quote?.laborHours !== undefined) {
      setLocalLaborHours(quote.laborHours?.toString() || "");
    }
    if (quote?.laborRate !== undefined) {
      setLocalLaborRate(
        quote.laborRate != null
          ? quote.laborRate.toString()
          : (userProfile?.laborRate?.toString() ?? ""),
      );
    }
    if (quote?.laborEnabled !== undefined) {
      setLocalLaborEnabled(quote.laborEnabled);
    }
    if (quote?.extraTerms !== undefined) {
      setLocalExtraTerms(
        Array.isArray(quote.extraTerms) ? [...quote.extraTerms] : [],
      );
    }
  }, [quote, userProfile?.laborRate]);

  // ─── Mutations ──────────────────────────────────────────

  const patchClient = useMutation({
    mutationFn: async (clientId: number | null) => {
      await api.patch(`/api/quotes/${id}/client`, { clientId });
    },
    onSuccess: () => {
      setPdfUrl(null); // Clear PDF so share will regenerate
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedUpdateClient"));
    },
  });

  const patchItems = useMutation({
    mutationFn: async (items: QuoteItem[]) => {
      const { data } = await api.patch<{
        ok: boolean;
        totalCost: number | null;
      }>(`/api/quotes/${id}/items`, { items });
      return data;
    },
    onSuccess: (data) => {
      if (data.totalCost !== null && data.totalCost !== undefined) {
        setLocalTotal(data.totalCost);
      }
      setPdfUrl(null); // Clear PDF so share will regenerate
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (err) => {
      const message = getValidationMessage(err, "errors.itemNameTooLong", t);
      Alert.alert(t("common.error"), message);
    },
  });

  // Patch Quote Name
  const patchName = useMutation({
    mutationFn: async (name: string) => {
      const value = name.trim().slice(0, QUOTE_NAME_MAX) || null;
      await api.patch(`/api/quotes/${id}`, { name: value });
    },
    onSuccess: () => {
      setPdfUrl(null); // Clear PDF so share will regenerate
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err) => {
      const message = getValidationMessage(err, "errors.quoteNameTooLong", t);
      Alert.alert(t("common.error"), message);
    },
  });

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
    const trimmed = localName.trim().slice(0, QUOTE_NAME_MAX);
    if (trimmed !== localName) setLocalName(trimmed); // Keep UI in sync with limit
    if (trimmed !== (quote?.name ?? "")) {
      patchName.mutate(trimmed);
    }
  }, [localName, quote?.name, patchName]);

  // Patch Labor Hours
  const patchLaborHours = useMutation({
    mutationFn: async (hours: number | null) => {
      await api.patch(`/api/quotes/${id}`, { laborHours: hours });
    },
    onSuccess: () => {
      setPdfUrl(null); // Clear PDF so share will regenerate
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedSaveLaborHours"));
    },
  });

  const handleLaborHoursBlur = useCallback(() => {
    const serverHours = quote?.laborHours?.toString() || "";
    if (localLaborHours !== serverHours) {
      const hours = parseFloat(localLaborHours) || null;
      patchLaborHours.mutate(hours);
    }
  }, [localLaborHours, quote?.laborHours, patchLaborHours]);

  // Patch Labor Rate (per-quote)
  const patchLaborRate = useMutation({
    mutationFn: async (rate: number | null) => {
      await api.patch(`/api/quotes/${id}`, { laborRate: rate });
    },
    onSuccess: () => {
      setPdfUrl(null);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedSaveLaborHours"));
    },
  });

  const handleLaborRateBlur = useCallback(() => {
    const serverRate = quote?.laborRate?.toString() ?? "";
    if (localLaborRate !== serverRate) {
      const rate =
        localLaborRate.trim() === "" ? null : parseFloat(localLaborRate);
      patchLaborRate.mutate(
        rate === null || Number.isNaN(rate) ? null : rate,
      );
    }
  }, [localLaborRate, quote?.laborRate, patchLaborRate]);

  // Patch Labor Enabled
  const patchLaborEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      await api.patch(`/api/quotes/${id}`, { laborEnabled: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.failedSaveLaborEnabled"));
    },
  });

  const handleLaborEnabledToggle = useCallback(() => {
    const newValue = !localLaborEnabled;
    setLocalLaborEnabled(newValue);
    setPdfUrl(null); // Clear PDF so share will regenerate
    patchLaborEnabled.mutate(newValue);
  }, [localLaborEnabled, patchLaborEnabled]);

  // Patch Extra Terms (quote-specific terms from recording / manual)
  const patchExtraTerms = useMutation({
    mutationFn: async (extraTerms: string[]) => {
      await api.patch(`/api/quotes/${id}`, { extraTerms });
    },
    onSuccess: () => {
      setPdfUrl(null);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      Alert.alert(t("common.error"), t("quoteEditor.extraTermsSaveFailed"));
    },
  });

  const updateExtraTerm = useCallback((index: number, value: string) => {
    setLocalExtraTerms((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const removeExtraTerm = useCallback(
    (index: number) => {
      setLocalExtraTerms((prev) => {
        const next = prev.filter((_, i) => i !== index);
        patchExtraTerms.mutate(next);
        return next;
      });
    },
    [patchExtraTerms],
  );

  const addExtraTerm = useCallback(() => {
    setLocalExtraTerms((prev) => [...prev, ""]);
  }, []);

  const saveExtraTerms = useCallback(() => {
    const trimmed = localExtraTerms
      .map((s) => (s ?? "").trim())
      .filter((s) => s.length > 0);
    setLocalExtraTerms(trimmed);
    if (
      JSON.stringify(trimmed) !==
      JSON.stringify(Array.isArray(quote?.extraTerms) ? quote.extraTerms : [])
    ) {
      patchExtraTerms.mutate(trimmed);
    }
  }, [localExtraTerms, quote?.extraTerms, patchExtraTerms]);

  // Delete Quote
  const deleteQuote = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/quotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
      router.replace("/(tabs)/quotes");
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quotes.deleteQuoteFailed"));
    },
  });

  const handleDeleteQuote = useCallback(() => {
    Alert.alert(t("quotes.deleteQuote"), t("quotes.deleteQuoteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => deleteQuote.mutate(),
      },
    ]);
  }, [deleteQuote, t]);

  // PDF Generation
  const generatePdf = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ pdfUrl: string }>(
        `/api/quotes/${id}/regenerate-pdf`,
      );
      return data;
    },
    onSuccess: (data) => {
      setPdfUrl(data.pdfUrl);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quoteEditor.pdfError"));
    },
  });

  // ─── Share PDF ──────────────────────────────────────────

  const handleShare = useCallback(async () => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(
        t("quoteEditor.sharingUnavailable"),
        t("quoteEditor.sharingUnavailableMsg"),
      );
      return;
    }

    setIsSharing(true);
    try {
      // If no PDF URL, generate it first
      let urlToShare = pdfUrl;
      if (!urlToShare) {
        const result = await generatePdf.mutateAsync();
        urlToShare = result.pdfUrl;
      }

      // Download the PDF to a local temp file
      const response = await fetch(urlToShare);
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
        dialogTitle: localName || `Quote #${id}`,
      });
    } catch (err) {
      console.error("Share failed:", err);
      Alert.alert(
        t("quoteEditor.shareFailed"),
        t("quoteEditor.shareFailedMsg"),
      );
    } finally {
      setIsSharing(false);
    }
  }, [pdfUrl, id, t, generatePdf, localName]);

  // ─── Item Editing Helpers ───────────────────────────────

  const recalcTotal = useCallback((items: QuoteItem[]) => {
    const total = items.reduce((sum, item) => {
      const lineTotal = (item.qty || 0) * (item.price || 0);
      return sum + lineTotal;
    }, 0);
    setLocalTotal(total);
  }, []);

  const itemMatchCandidates = useMemo(() => {
    const priceList = Array.isArray(userProfile?.priceList)
      ? userProfile.priceList
      : [];
    return localItems.map((item) => {
      const hasValidPrice =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0;
      if (hasValidPrice || !item.name?.trim() || priceList.length === 0) {
        return [] as PriceMatchCandidate[];
      }
      return getPriceMatchCandidates(item.name, item.unit, priceList, {
        maxResults: 3,
        minScore: 0.5,
      });
    });
  }, [localItems, userProfile?.priceList]);

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
    [recalcTotal],
  );

  const saveItems = useCallback(() => {
    const normalized = localItems.map((it) => ({
      ...it,
      name: (it.name ?? "").trim().slice(0, ITEM_NAME_MAX),
    }));
    setLocalItems(normalized); // Keep UI in sync with limit
    recalcTotal(normalized);
    patchItems.mutate(normalized);
  }, [localItems, recalcTotal, patchItems]);

  const openMatchPickerForItem = useCallback(
    (itemIndex: number) => {
      const candidates = itemMatchCandidates[itemIndex] ?? [];
      if (candidates.length === 0) return;
      setMatchPicker({
        itemIndex,
        itemName: localItems[itemIndex]?.name ?? "",
        candidates,
      });
    },
    [itemMatchCandidates, localItems],
  );

  const applyMatchedCandidate = useCallback(
    (itemIndex: number, candidate: PriceMatchCandidate) => {
      const updated = localItems.map((item, index) => {
        if (index !== itemIndex) return item;
        const nextPrice = candidate.item.price;
        const nextUnit =
          (!item.unit || item.unit.trim().length === 0) && candidate.item.unit
            ? candidate.item.unit
            : item.unit;
        return {
          ...item,
          unit: nextUnit,
          price: nextPrice,
          lineTotal: (item.qty || 0) * nextPrice,
        };
      });
      setLocalItems(updated);
      recalcTotal(updated);
      patchItems.mutate(updated);
      setMatchPicker(null);
    },
    [localItems, recalcTotal, patchItems],
  );

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
    [localItems, patchItems, recalcTotal],
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
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1">
          <NetworkErrorView onRetry={refetch} />
        </View>
        <View className="px-6 pb-8">
          <Pressable
            onPress={() => router.replace("/(tabs)/quotes")}
            className="h-11 items-center justify-center rounded-lg border border-slate-200"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-sm font-semibold text-slate-600">
              {t("quoteEditor.goBack")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = new Date().toLocaleDateString(activeLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // ─── Render ─────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Client Select Modal */}
      <ClientSelectModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSelect={(client) => patchClient.mutate(client.id)}
      />

      <Modal
        visible={matchPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchPicker(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/45 px-6 pb-10"
          onPress={() => setMatchPicker(null)}
        >
          <Pressable
            className="rounded-3xl bg-white p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-semibold text-slate-900">
              {t("quoteEditor.chooseSavedPrice")}
            </Text>
            <Text className="mt-1 text-sm text-slate-500" numberOfLines={1}>
              {matchPicker?.itemName || t("quoteEditor.item")}
            </Text>

            <View className="mt-4 gap-2">
              {(matchPicker?.candidates ?? []).map((candidate, idx) => (
                <Pressable
                  key={`${candidate.item.name}-${candidate.item.unit ?? "unit"}-${idx}`}
                  onPress={() => {
                    if (!matchPicker) return;
                    applyMatchedCandidate(matchPicker.itemIndex, candidate);
                  }}
                  className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-sm font-medium text-slate-900"
                      numberOfLines={1}
                    >
                      {candidate.item.name}
                    </Text>
                    {!!candidate.item.unit && (
                      <Text className="mt-0.5 text-xs text-slate-500">
                        /{candidate.item.unit}
                      </Text>
                    )}
                  </View>
                  <Text className="text-sm font-semibold text-slate-900">
                    {currencySymbol}
                    {candidate.item.price.toFixed(2)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setMatchPicker(null)}
              className="mt-4 h-11 items-center justify-center rounded-xl border border-slate-200"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className="text-sm font-semibold text-slate-700">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header Bar */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-200 border-b-orange-200">
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
            router.replace("/(tabs)/quotes");
          }}
          className="mr-3 h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          accessibilityLabel={t("quoteEditor.goBack")}
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color="#ea580c" />
        </Pressable>
        <Pressable className="flex-1" onPress={() => setIsEditingName(true)}>
          {isEditingName ? (
            <TextInput
              className="text-lg font-bold text-slate-900 py-0"
              value={localName}
              onChangeText={setLocalName}
              onBlur={handleNameBlur}
              placeholder={t("quoteEditor.quoteNamePlaceholder")}
              placeholderTextColor="#94a3b8"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleNameBlur}
              maxLength={QUOTE_NAME_MAX}
            />
          ) : (
            <Text
              className="text-lg font-bold text-slate-900"
              numberOfLines={1}
            >
              {quote.clientName
                ? `${localName || `Quote #${quote.id}`} - ${quote.clientName}`
                : localName || `Quote #${quote.id}`}
            </Text>
          )}
          <Text className="text-sm text-slate-500">
            {isEditingName
              ? ""
              : localName
                ? `#${quote.id} · ${formattedDate}`
                : formattedDate}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDeleteQuote}
          className="ml-2 h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          accessibilityLabel={t("quotes.deleteQuote")}
          accessibilityHint={t("quotes.deleteQuoteConfirm")}
          accessibilityRole="button"
        >
          <Trash2 size={20} color="#ef4444" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
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
            {/* ─── Play recording (when quote has audio) ─────── */}
            {audioUrl && (
              <View className="border-b border-slate-100 p-4">
                <Text className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  {t("quoteEditor.recording")}
                </Text>
                <Pressable
                  onPress={async () => {
                    if (audioStatus.playing) {
                      audioPlayer.pause();
                    } else {
                      // Ensure playback is audible (iOS: play even in silent mode)
                      await setAudioModeAsync({
                        allowsRecording: false,
                        playsInSilentMode: true,
                      });
                      const dur = audioStatus.duration ?? 0;
                      if (dur > 0 && audioStatus.currentTime >= dur - 0.5) {
                        audioPlayer.seekTo(0);
                      }
                      audioPlayer.play();
                    }
                  }}
                  className="flex-row items-center rounded-lg border border-slate-200 bg-slate-50 p-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  accessibilityLabel={
                    audioStatus.playing
                      ? t("quoteEditor.pauseRecording")
                      : t("quoteEditor.playRecording")
                  }
                  accessibilityRole="button"
                >
                  {audioStatus.playing ? (
                    <Pause size={20} color="#0f172a" />
                  ) : (
                    <Play size={20} color="#0f172a" />
                  )}
                  <Text className="ml-2 text-sm font-medium text-slate-900">
                    {audioStatus.playing
                      ? t("quoteEditor.pauseRecording")
                      : t("quoteEditor.playRecording")}
                  </Text>
                  {audioStatus.playing && (audioStatus.duration ?? 0) > 0 && (
                    <Text className="ml-2 text-xs text-slate-500">
                      {Math.floor(audioStatus.currentTime / 60)}:
                      {String(
                        Math.floor(audioStatus.currentTime % 60),
                      ).padStart(2, "0")}{" "}
                      / {Math.floor((audioStatus.duration ?? 0) / 60)}:
                      {String(
                        Math.floor((audioStatus.duration ?? 0) % 60),
                      ).padStart(2, "0")}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* ─── Line Items ──────────────────────── */}
            <View className="p-4">
              {/* Table Header */}
              <View className="mb-2 flex-row items-center">
                <Text className="flex-1 text-xs font-semibold uppercase text-slate-500">
                  {t("quoteEditor.item")}
                </Text>
                <Text className="w-16 text-center text-xs font-semibold uppercase text-slate-500">
                  {t("quoteEditor.unit")}
                </Text>
                <Text className="w-14 text-center text-xs font-semibold uppercase text-slate-500">
                  {t("quoteEditor.qty")}
                </Text>
                <Text className="w-20 text-right text-xs font-semibold uppercase text-slate-500">
                  {t("quoteEditor.price")}
                </Text>
                <View className="w-14" />
              </View>

              {/* Rows */}
              {localItems.map((item, index) => {
                const candidates = itemMatchCandidates[index] ?? [];
                const hasPossibleMatch = candidates.length > 0;
                return (
                <View
                  key={index}
                  style={{ minHeight: 56 }}
                  className={`flex-row items-start border-b py-4 ${
                    hasPossibleMatch
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-100"
                  }`}
                >
                  {/* Name — more height so long names can wrap */}
                  <View style={{ flex: 1, maxWidth: 220 }} className="mr-1">
                    <TextInput
                      className="text-sm text-slate-900 flex-1 min-w-0"
                      style={{ minHeight: 44 }}
                      value={item.name}
                      onChangeText={(v) => updateItem(index, "name", v)}
                      onBlur={saveItems}
                      placeholder={t("quoteEditor.itemNamePlaceholder")}
                      placeholderTextColor="#cbd5e1"
                      maxLength={ITEM_NAME_MAX}
                      multiline
                    />
                    {hasPossibleMatch && (
                      <Pressable
                        onPress={() => openMatchPickerForItem(index)}
                        className="mt-1 self-start rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1"
                        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        accessibilityRole="button"
                        accessibilityLabel={t("quoteEditor.possibleMatch")}
                      >
                        <Text className="text-[11px] font-semibold text-amber-800">
                          {t("quoteEditor.possibleMatch")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {/* Unit */}
                  <TextInput
                    className="w-16 text-center text-sm text-slate-900 mt-1"
                    value={item.unit || ""}
                    onChangeText={(v) => updateItem(index, "unit", v)}
                    onBlur={saveItems}
                    placeholder={t("quoteEditor.unitPlaceholder")}
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Qty */}
                  <TextInput
                    className="w-14 text-center text-sm text-slate-900 mt-1"
                    value={item.qty?.toString() || ""}
                    onChangeText={(v) => updateItem(index, "qty", v)}
                    onBlur={saveItems}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Price */}
                  <TextInput
                    className="w-20 text-right text-sm text-slate-900 mt-1"
                    value={item.price?.toString() || ""}
                    onChangeText={(v) => updateItem(index, "price", v)}
                    onBlur={saveItems}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#cbd5e1"
                  />
                  {/* Delete action is visually/physically separated from price input to reduce fat-finger deletes */}
                  <View className="ml-3 border-l border-slate-200 pl-2">
                    <Pressable
                      onPress={() => removeItem(index)}
                      className="h-11 w-11 items-center justify-center rounded-full border border-red-100 bg-red-50"
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      hitSlop={4}
                      accessibilityLabel={`${t("common.delete")} ${t("quoteEditor.item")}`}
                      accessibilityRole="button"
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </Pressable>
                  </View>
                </View>
              )})}

              {/* Add Item Button */}
              <Pressable
                onPress={addItem}
                className="mt-3 h-11 flex-row items-center justify-center rounded-lg border border-dashed border-slate-300"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Plus size={16} color="#64748b" />
                <Text className="ml-1.5 text-sm font-medium text-slate-500">
                  {t("quoteEditor.addItem")}
                </Text>
              </Pressable>
            </View>

            {/* ─── Labor Section ──────────────────────── */}
            <View className="border-t border-slate-100 p-4">
              {/* Header with Toggle */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Clock size={14} color="#64748b" />
                  <Text className="ml-2 text-xs font-semibold uppercase text-slate-500">
                    {t("quoteEditor.labor")}
                  </Text>
                </View>
                <Switch
                  value={localLaborEnabled}
                  onValueChange={handleLaborEnabledToggle}
                  trackColor={{ false: "#e2e8f0", true: "#ea580c" }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#e2e8f0"
                  accessibilityLabel={t("quoteEditor.labor")}
                />
              </View>

              {/* Calculation Row: [hours] hrs × $[rate]/hr = $total */}
              {localLaborEnabled && (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {/* Hours */}
                    <TextInput
                      className="w-12 text-center text-sm font-semibold text-slate-900 border border-slate-200 rounded-md px-2"
                      style={{
                        paddingTop: 6,
                        paddingBottom: 10,
                        textAlignVertical: "center",
                        includeFontPadding: false,
                      }}
                      value={localLaborHours}
                      onChangeText={setLocalLaborHours}
                      onBlur={handleLaborHoursBlur}
                      placeholder="0"
                      placeholderTextColor="#cbd5e1"
                      keyboardType="decimal-pad"
                    />
                    <Text className="mx-2 text-sm text-slate-600">
                      {t("quoteEditor.hours")} ×
                    </Text>
                    {/* Rate */}
                    <View
                      className="flex-row items-center border border-slate-200 rounded-md px-2"
                      style={{ paddingVertical: 10 }}
                    >
                      <Text className="text-sm text-slate-500">
                        {currencySymbol}
                      </Text>
                      <TextInput
                        className="w-12 text-center text-sm font-semibold text-slate-900"
                        style={{
                          paddingVertical: 0,
                          textAlignVertical: "center",
                          includeFontPadding: false,
                        }}
                        value={localLaborRate}
                        onChangeText={setLocalLaborRate}
                        onBlur={handleLaborRateBlur}
                        placeholder="0"
                        placeholderTextColor="#cbd5e1"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Text className="ml-1 text-sm text-slate-600">
                      {t("settings.perHour")}
                    </Text>
                  </View>
                  {/* Result */}
                  <Text className="text-sm font-semibold text-slate-700">
                    = {currencySymbol}
                    {(laborCost ?? 0).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* ─── Footer / Total ──────────────────── */}
            <View className="border-t border-slate-100 p-4">
              {/* Materials line (only show if labor cost exists) */}
              {laborCost !== null && laborCost > 0 && (
                <>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-sm text-slate-600">
                      {t("quoteEditor.materials")}
                    </Text>
                    <Text className="text-sm text-slate-500">
                      {currencySymbol}
                      {materialsCost.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm text-slate-600">
                      {t("quoteEditor.labor")}
                    </Text>
                    <Text className="text-sm text-slate-500">
                      {currencySymbol}
                      {laborCost.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}

              {/* Subtotal (show when tax is enabled) */}
              {taxEnabled && taxRate > 0 && (
                <>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-sm text-slate-600">
                      {taxInclusive
                        ? t("taxSettings.subtotalExclTax")
                        : t("taxSettings.subtotal")}
                    </Text>
                    <Text className="text-sm text-slate-500">
                      {currencySymbol}
                      {displaySubtotal.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm text-slate-600">
                      {taxLabel} ({taxRate}%)
                    </Text>
                    <Text className="text-sm text-slate-500">
                      {currencySymbol}
                      {taxAmount.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}

              {/* Grand Total */}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-500">
                  {t("quoteEditor.total")}
                </Text>
                <Text className="text-xl font-bold text-slate-900">
                  {currencySymbol}
                  {grandTotal.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* ─── Client Section ──────────────────── */}
            <View className="border-t border-slate-100 p-4">
              <Text className="mb-2 text-xs font-semibold uppercase text-slate-500">
                {t("quoteEditor.client")}
              </Text>
              {quote.clientName ? (
                <View className="gap-2">
                  <Pressable
                    onPress={() => setClientModalVisible(true)}
                    className="rounded-lg border border-slate-200 p-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text className="text-sm font-semibold text-slate-900">
                      {quote.clientName}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      {t("quoteEditor.tapToChange")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        t("quoteEditor.removeClient"),
                        t("quoteEditor.removeClientConfirm"),
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("quoteEditor.removeClient"),
                            style: "destructive",
                            onPress: () => patchClient.mutate(null),
                          },
                        ],
                      );
                    }}
                    className="self-start rounded px-2 py-1"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text className="text-xs text-red-600">
                      {t("quoteEditor.removeClient")}
                    </Text>
                  </Pressable>
                </View>
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

            {/* ─── Terms for this quote (from recording / manual) ──────────────────── */}
            <View className="border-t border-slate-100 p-4">
              <Text className="mb-2 text-xs font-semibold uppercase text-slate-500">
                {t("quoteEditor.termsForThisQuote")}
              </Text>
              <Text className="mb-3 text-sm text-slate-600">
                {t("quoteEditor.additionalTermsFromRecording")}
              </Text>
              {localExtraTerms.length === 0 ? (
                <View className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-4">
                  <Text className="text-center text-sm text-slate-500">
                    {t("quoteEditor.noExtraTerms")}
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {localExtraTerms.map((term, index) => (
                    <View
                      key={index}
                      className="flex-row items-center gap-2 border-b border-slate-100 pb-2"
                    >
                      <TextInput
                        className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        style={{ minHeight: 40 }}
                        value={term}
                        onChangeText={(v) => updateExtraTerm(index, v)}
                        onBlur={saveExtraTerms}
                        placeholder={t("quoteEditor.addQuoteTerm")}
                        placeholderTextColor="#cbd5e1"
                        multiline
                      />
                      <Pressable
                        onPress={() => removeExtraTerm(index)}
                        className="h-11 w-11 items-center justify-center"
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.5 : 1,
                        })}
                        accessibilityLabel={t("quoteEditor.removeQuoteTerm")}
                        accessibilityRole="button"
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <Pressable
                onPress={addExtraTerm}
                className="mt-3 h-11 flex-row items-center justify-center rounded-lg border border-dashed border-slate-300"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Plus size={16} color="#64748b" />
                <Text className="ml-1.5 text-sm font-medium text-slate-500">
                  {t("quoteEditor.addQuoteTerm")}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ─── Action: Generate & Share PDF (one button) ────────────────────── */}
          <View className="mx-4 mt-4">
            <Pressable
              className="h-12 flex-row items-center justify-center rounded-lg bg-orange-600"
              onPress={handleShare}
              disabled={isSharing || generatePdf.isPending}
              style={({ pressed }) => ({
                opacity:
                  pressed || isSharing || generatePdf.isPending ? 0.85 : 1,
              })}
            >
              {isSharing || generatePdf.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Share2 size={18} color="#ffffff" />
                  <Text className="ml-2 text-base font-semibold text-white">
                    {t("quoteEditor.sharePdf")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
