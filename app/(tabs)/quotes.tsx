import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownUp, Check, FileText, Filter, Mic, Plus, Search, Upload, PenLine } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    FlatList,
    I18nManager,
    Modal,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NetworkErrorView from "@/components/NetworkErrorView";
import ProcessingModal from "@/components/ProcessingModal";
import RecordingModal from "@/components/RecordingModal";
import { QuotesListSkeleton } from "@/components/Skeleton";
import { useCreateManualQuote } from "@/src/hooks/useCreateManualQuote";
import { useCreateQuote } from "@/src/hooks/useCreateQuote";
import { pickAudioFromDevice, type AudioInput } from "@/src/lib/audioInput";
import api from "@/src/lib/api";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/src/lib/currency";
import { isNetworkError } from "@/src/lib/networkError";
import {
  deriveQuoteWorkflowStatus,
  getQuoteStatusBadge,
  type QuoteWorkflowFilter,
} from "@/src/lib/quoteStatus";
import { calculateQuoteGrandTotal } from "@/src/lib/quoteTotals";

// ─── Types ──────────────────────────────────────────────────

interface Quote {
  id: number;
  name: string | null;
  createdAt: string;
  totalCost: number | null;
  laborHours?: number | null;
  laborRate?: number | null;
  laborEnabled?: boolean;
  clientId: number | null;
  clientName: string | null;
  status?: string | null;
}

const RTL_LANGUAGES = ["ar", "he"];

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string, locale?: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getQuoteTitle(quote: Quote): string {
  const base = quote.name || `Quote #${quote.id}`;
  return quote.clientName ? `${base} - ${quote.clientName}` : base;
}

// ─── Components ─────────────────────────────────────────────

function QuoteCard({
  quote,
  onPress,
  onLongPress,
  t,
  currencySymbol,
  defaultLaborRate,
  taxEnabled,
  taxRate,
  taxInclusive,
  locale,
  isRTL,
  rtlText,
}: {
  quote: Quote;
  onPress: () => void;
  onLongPress?: () => void;
  t: (key: string) => string;
  currencySymbol: string;
  defaultLaborRate?: number | null;
  taxEnabled?: boolean;
  taxRate?: number | null;
  taxInclusive?: boolean;
  locale?: string;
  isRTL: boolean;
  rtlText?: { textAlign: "right"; writingDirection: "rtl" };
}) {
  const status = getQuoteStatusBadge(deriveQuoteWorkflowStatus(quote), t);
  const displayTotal = calculateQuoteGrandTotal(quote, {
    defaultLaborRate,
    taxEnabled,
    taxRate,
    taxInclusive,
  });
  const titleSpacing = isRTL ? { marginLeft: 12 as const } : { marginRight: 12 as const };
  const totalSpacing = isRTL ? { marginRight: 12 as const } : { marginLeft: 12 as const };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center" style={{ direction: "ltr" }}>
        {isRTL ? (
          <>
            <View className={`rounded-full px-3 py-1 ${status.bg}`}>
              <Text
                className={`text-xs font-semibold ${status.text}`}
                style={rtlText}
              >
                {status.label}
              </Text>
            </View>
            <View className="flex-1" style={[titleSpacing, { minWidth: 0 }]}>
              <Text
                className="text-base font-semibold text-slate-900"
                numberOfLines={1}
                style={rtlText}
              >
                {getQuoteTitle(quote)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="flex-1" style={[titleSpacing, { minWidth: 0 }]}>
              <Text
                className="text-base font-semibold text-slate-900"
                numberOfLines={1}
              >
                {getQuoteTitle(quote)}
              </Text>
            </View>
            <View className={`rounded-full px-3 py-1 ${status.bg}`}>
              <Text className={`text-xs font-semibold ${status.text}`}>
                {status.label}
              </Text>
            </View>
          </>
        )}
      </View>
      <View className="mt-2 flex-row items-center" style={{ direction: "ltr" }}>
        {isRTL ? (
          <>
            {displayTotal != null && (
              <Text
                className="text-sm font-medium text-slate-600"
                style={[rtlText, totalSpacing]}
              >
                {currencySymbol}
                {displayTotal.toFixed(2)}
              </Text>
            )}
            <View className="flex-1" style={{ minWidth: 0 }}>
              <Text className="text-sm text-slate-500" style={rtlText}>
                {formatDate(quote.createdAt, locale)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="flex-1" style={{ minWidth: 0 }}>
              <Text className="text-sm text-slate-500">
                {formatDate(quote.createdAt, locale)}
              </Text>
            </View>
            {displayTotal != null && (
              <Text
                className="text-sm font-medium text-slate-600"
                style={totalSpacing}
              >
                {currencySymbol}
                {displayTotal.toFixed(2)}
              </Text>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

interface UserProfile {
  currency: string;
  laborRate?: number | null;
  taxEnabled?: boolean;
  taxRate?: number | null;
  taxInclusive?: boolean;
}

// ─── Main Screen ────────────────────────────────────────────

export type QuoteStatusFilter = QuoteWorkflowFilter;
export type QuoteSortOrder = "createdAt_desc" | "createdAt_asc";

export default function AllQuotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    status?: string;
    sort?: string;
  }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<QuoteSortOrder>("createdAt_desc");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const [newQuoteModalVisible, setNewQuoteModalVisible] = useState(false);
  const documentPickInProgressRef = useRef(false);
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? undefined;
  const languageIsRTL = RTL_LANGUAGES.includes(
    (i18n.language || "").split("-")[0]
  );
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  /** RTL: align text block content to the end (right); same as settings rows. */
  const rtlAlignEnd = isRTL ? { alignItems: "flex-start" as const } : undefined;
  /** RTL: put section titles on the right (LTR row + flex-end so block stays right). */
  const rtlSectionTitleWrapStyle = isRTL
    ? { flexDirection: "row" as const, justifyContent: "flex-end" as const, width: "100%" as const, direction: "ltr" as const }
    : undefined;
  const queryClient = useQueryClient();

  // Sync URL params from homepage (e.g. "View Ready" -> status=ready)
  useEffect(() => {
    const s = params.status as string | undefined;
    const o = params.sort as QuoteSortOrder | undefined;
    if (s === "with_client") {
      // Legacy deep-link -> actionable modern status.
      setStatusFilter("needs_pricing");
    } else if (s === "no_client") {
      // Legacy deep-link -> actionable modern status.
      setStatusFilter("needs_client");
    } else if (
      s &&
      ["all", "ready", "needs_client", "needs_pricing", "draft"].includes(s)
    ) {
      setStatusFilter(s as QuoteStatusFilter);
    }
    if (o && (o === "createdAt_desc" || o === "createdAt_asc")) {
      setSortOrder(o);
    }
  }, [params.status, params.sort]);

  const applyFilterAndSort = useCallback(
    (status: QuoteStatusFilter, sort: QuoteSortOrder) => {
      setStatusFilter(status);
      setSortOrder(sort);
      const q = new URLSearchParams();
      if (status !== "all") q.set("status", status);
      if (sort !== "createdAt_desc") q.set("sort", sort);
      const query = q.toString();
      router.replace(
        query ? `/(tabs)/quotes?${query}` as any : "/(tabs)/quotes" as any,
      );
    },
    [router],
  );

  const {
    data: quotes = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["quotes", statusFilter, sortOrder],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (statusFilter !== "all") q.set("status", statusFilter);
      if (sortOrder !== "createdAt_desc") q.set("sort", sortOrder);
      const query = q.toString();
      const { data } = await api.get<{ quotes: Quote[] }>(
        `/api/quotes${query ? `?${query}` : ""}`,
      );
      return data.quotes;
    },
  });

  // Fetch user profile for currency
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

  // Search across all fields
  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;

    const term = search.toLowerCase();
    return quotes.filter((q) => {
      const title = getQuoteTitle(q).toLowerCase();
      const date = formatDate(q.createdAt, activeLocale).toLowerCase();
      const displayTotal = calculateQuoteGrandTotal(q, {
        defaultLaborRate: userProfile?.laborRate,
        taxEnabled: userProfile?.taxEnabled,
        taxRate: userProfile?.taxRate,
        taxInclusive: userProfile?.taxInclusive,
      });
      const cost =
        displayTotal != null ? `${currencySymbol}${displayTotal.toFixed(2)}` : "";
      const status = getQuoteStatusBadge(
        deriveQuoteWorkflowStatus(q),
        t,
      ).label.toLowerCase();
      const idStr = q.id.toString();
      const name = (q.name || "").toLowerCase();

      return (
        title.includes(term) ||
        name.includes(term) ||
        date.includes(term) ||
        cost.includes(term) ||
        status.includes(term) ||
        idStr.includes(term)
      );
    });
  }, [
    quotes,
    search,
    t,
    currencySymbol,
    activeLocale,
    userProfile?.laborRate,
    userProfile?.taxEnabled,
    userProfile?.taxRate,
    userProfile?.taxInclusive,
  ]);

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: number) => {
      await api.delete(`/api/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: () => {
      Alert.alert(t("common.error"), t("quotes.deleteQuoteFailed"));
    },
  });

  const handleDeleteQuote = useCallback(
    (quote: Quote) => {
      Alert.alert(t("quotes.deleteQuote"), t("quotes.deleteQuoteConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => deleteQuote.mutate(quote.id),
        },
      ]);
    },
    [deleteQuote, t],
  );

  const createManualQuote = useCreateManualQuote();
  const createQuote = useCreateQuote();

  const handleRecordingComplete = useCallback(
    (audio: AudioInput) => {
      createQuote.mutate(
        {
          localUri: audio.uri,
          fileName: audio.fileName ?? null,
          mimeType: audio.mimeType ?? null,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["quoteStats"] });
          },
          onError: (error: any) => {
            if (error?.fileTooLarge || error?.fileTooLong) {
              return; // useCreateQuote already showed the alert
            }
            if (error?.response?.status === 403) {
              const code = error?.response?.data?.code;
              if (code === "QUOTA_EXCEEDED") {
                Alert.alert(
                  t("errors.quotaExceededTitle"),
                  t("errors.quotaExceededMessage"),
                  [
                    {
                      text: t("errors.quotaExceededManualEntry"),
                      onPress: () => createManualQuote.mutate(undefined),
                    },
                    {
                      text: t("errors.quotaExceededUpgrade"),
                      onPress: () => router.push("/paywall" as any),
                    },
                    { text: t("common.cancel"), style: "cancel" },
                  ],
                );
                return;
              }
            }
            if (isNetworkError(error)) {
              Alert.alert(
                t("errors.noConnection"),
                t("errors.somethingWentWrong"),
              );
            } else {
              const detail = error?.response?.data?.detail;
              const message = detail
                ? `${t("home.processingFailedMsg")}\n\n${detail}`
                : t("home.processingFailedMsg");
              Alert.alert(t("home.processingFailed"), message);
            }
            console.error("Create quote error:", error);
          },
        },
      );
    },
    [createQuote, createManualQuote, queryClient, router, t],
  );

  const handleCreateQuoteAction = useCallback(() => {
    setNewQuoteModalVisible(true);
  }, []);

  const handleNewQuoteOption = useCallback(
    (option: "record" | "device" | "manual") => {
      if (option === "record") {
        setNewQuoteModalVisible(false);
        setRecordingModalVisible(true);
      } else if (option === "device") {
        // Keep modal open, open document picker on top, then close modal when done.
        // Closing the modal first caused the picker to never appear on iOS (Expo Go / TestFlight).
        if (documentPickInProgressRef.current) return;
        documentPickInProgressRef.current = true;
        const runPick = async () => {
          try {
            const selected = await pickAudioFromDevice();
            setNewQuoteModalVisible(false);
            if (selected) handleRecordingComplete(selected);
          } catch (error) {
            setNewQuoteModalVisible(false);
            console.error("Pick audio failed:", error);
            Alert.alert(t("common.error"), t("recording.failedToPick"));
          } finally {
            documentPickInProgressRef.current = false;
          }
        };
        // Short delay so the tap completes and the picker can present over the modal.
        setTimeout(runPick, 200);
      } else {
        setNewQuoteModalVisible(false);
        createManualQuote.mutate(undefined);
      }
    },
    [createManualQuote, handleRecordingComplete, t],
  );

  const renderQuote = useCallback(
    ({ item }: { item: Quote }) => (
      <QuoteCard
        quote={item}
        t={t}
        currencySymbol={currencySymbol}
        defaultLaborRate={userProfile?.laborRate}
        taxEnabled={userProfile?.taxEnabled}
        taxRate={userProfile?.taxRate}
        taxInclusive={userProfile?.taxInclusive}
        locale={activeLocale}
        isRTL={isRTL}
        rtlText={rtlText}
        onPress={() => router.push(`/quote/${item.id}` as any)}
        onLongPress={() => handleDeleteQuote(item)}
      />
    ),
    [
      router,
      t,
      handleDeleteQuote,
      currencySymbol,
      userProfile?.laborRate,
      userProfile?.taxEnabled,
      userProfile?.taxRate,
      userProfile?.taxInclusive,
      isRTL,
      rtlText,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <RecordingModal
        visible={recordingModalVisible}
        onClose={() => setRecordingModalVisible(false)}
        onRecordingComplete={handleRecordingComplete}
      />
      <ProcessingModal visible={createQuote.isPending || createManualQuote.isPending} />

      {/* New quote options modal — custom bottom sheet instead of native Alert */}
      <Modal
        visible={newQuoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewQuoteModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50 px-6 pb-12"
          onPress={() => setNewQuoteModalVisible(false)}
        >
          <Pressable
            className="rounded-3xl bg-white overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-2" style={rtlSectionTitleWrapStyle}>
              <View>
                <Text className="text-lg font-semibold text-slate-900" style={rtlText}>
                  {t("quotes.newQuote")}
                </Text>
                <Text className="mt-0.5 text-sm text-slate-500" style={rtlText}>
                  {t("quotes.newQuoteSubtitle")}
                </Text>
              </View>
            </View>
            <View className="py-2">
              <Pressable
                onPress={() => handleNewQuoteOption("record")}
                className="flex-row items-center px-5 py-3.5 active:bg-slate-50"
                style={({ pressed }) => [
                  isRTL ? { direction: "rtl" as const } : undefined,
                  { backgroundColor: pressed ? "rgb(248 250 252)" : undefined },
                ]}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <Mic size={20} color="#ea580c" />
                </View>
                <View className="ms-3 flex-1" style={rtlAlignEnd}>
                  <Text className="text-base font-medium text-slate-900" style={rtlText}>
                    {t("recording.tapToRecord")}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500" style={rtlText}>
                    {t("quotes.newQuoteRecordHint")}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleNewQuoteOption("device")}
                className="flex-row items-center px-5 py-3.5 active:bg-slate-50"
                style={({ pressed }) => [
                  isRTL ? { direction: "rtl" as const } : undefined,
                  { backgroundColor: pressed ? "rgb(248 250 252)" : undefined },
                ]}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <Upload size={20} color="#475569" />
                </View>
                <View className="ms-3 flex-1" style={rtlAlignEnd}>
                  <Text className="text-base font-medium text-slate-900" style={rtlText}>
                    {t("recording.chooseFromDevice")}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500" style={rtlText}>
                    {t("quotes.newQuoteDeviceHint")}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleNewQuoteOption("manual")}
                className="flex-row items-center px-5 py-3.5 active:bg-slate-50"
                style={({ pressed }) => [
                  isRTL ? { direction: "rtl" as const } : undefined,
                  { backgroundColor: pressed ? "rgb(248 250 252)" : undefined },
                ]}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <PenLine size={20} color="#475569" />
                </View>
                <View className="ms-3 flex-1" style={rtlAlignEnd}>
                  <Text className="text-base font-medium text-slate-900" style={rtlText}>
                    {t("home.newQuoteManual")}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500" style={rtlText}>
                    {t("quotes.newQuoteManualHint")}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View className="border-t border-slate-100 px-5 py-3">
              <Pressable
                onPress={() => setNewQuoteModalVisible(false)}
                className="py-2.5 items-center rounded-xl active:bg-slate-50"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? "rgb(248 250 252)" : undefined,
                })}
              >
                <Text className="text-base font-medium text-slate-600" style={rtlText}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header — RTL: direction rtl so title on right, buttons on left; thin orange line under title */}
      <View
        className="px-6 pt-4 pb-2 flex-row items-center justify-between"
        style={isRTL ? { direction: "rtl" as const } : undefined}
      >
        <Text className="text-2xl font-bold text-slate-900" style={rtlText}>
          {t("quotes.title")}
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            className="h-11 w-11 items-center justify-center rounded-full bg-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            accessibilityLabel={t("quotes.filterLabel")}
            accessibilityRole="button"
          >
            <Filter size={20} color="#475569" />
          </Pressable>
          <Pressable
            onPress={() => setSortModalVisible(true)}
            className="h-11 w-11 items-center justify-center rounded-full bg-slate-100"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            accessibilityLabel={t("quotes.sortLabel")}
            accessibilityRole="button"
          >
            <ArrowDownUp size={20} color="#475569" />
          </Pressable>
          <Pressable
            onPress={handleCreateQuoteAction}
            disabled={createManualQuote.isPending || createQuote.isPending}
            className="h-11 w-11 items-center justify-center rounded-full bg-orange-600"
            style={({ pressed }) => ({
              opacity:
                pressed || createManualQuote.isPending || createQuote.isPending
                  ? 0.7
                  : 1,
            })}
            accessibilityLabel={t("quotes.newQuote")}
            accessibilityRole="button"
          >
            <Plus size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Search — RTL: row direction so icon on right; input text right-aligned (LTR wrapper trick not needed for input, textAlign + writingDirection suffice). */}
      <View className="px-6 py-3">
        <View
          className="flex-row items-center rounded-full bg-slate-100 px-4 h-11"
          style={isRTL ? { direction: "rtl" as const } : undefined}
        >
          <Search size={18} color="#94a3b8" />
          <TextInput
            className="flex-1 text-base text-slate-900"
            style={[
              isRTL ? { textAlign: "right" as const, writingDirection: "rtl" as const } : undefined,
              isRTL ? { marginRight: 12, marginLeft: 0 } : { marginLeft: 12 },
            ]}
            placeholder={t("quotes.searchPlaceholder")}
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <QuotesListSkeleton count={6} />
      ) : isError && isNetworkError(error) && filteredQuotes.length === 0 ? (
        <NetworkErrorView onRetry={refetch} />
      ) : filteredQuotes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={40} color="#cbd5e1" />
          <Text className="mt-3 text-base font-medium text-slate-500">
            {search ? t("quotes.noMatchSearch") : t("quotes.noQuotesYet")}
          </Text>
        </View>
      ) : (
        <>
          {isError && isNetworkError(error) && (
            <View className="mx-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex-row items-center">
              <Text className="text-xs text-amber-800 flex-1">
                {t("errors.showingCachedData")}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="h-11 items-center justify-center rounded bg-orange-600 px-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Text className="text-xs font-semibold text-white">
                  {t("errors.retry")}
                </Text>
              </Pressable>
            </View>
          )}
          <FlatList
            data={filteredQuotes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderQuote}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor="#0f172a"
              />
            }
          />
        </>
      )}

      {/* Filter modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50 px-6 pb-12"
          onPress={() => setFilterModalVisible(false)}
        >
          <Pressable
            className="rounded-3xl bg-white overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-2" style={rtlSectionTitleWrapStyle}>
              <View>
                <Text className="text-lg font-semibold text-slate-900" style={rtlText}>
                  {t("quotes.filterLabel")}
                </Text>
                <Text className="mt-0.5 text-sm text-slate-500" style={rtlText}>
                  {t("quotes.filterSubtitle")}
                </Text>
              </View>
            </View>
            <View className="py-2">
              {(
                [
                  ["all", t("quotes.filterAll"), t("quotes.filterAllDesc")],
                  ["ready", t("quotes.filterReady"), t("quotes.filterReadyDesc")],
                  [
                    "needs_client",
                    t("quotes.filterNeedsClient"),
                    t("quotes.filterNeedsClientDesc"),
                  ],
                  [
                    "needs_pricing",
                    t("quotes.filterNeedsPricing"),
                    t("quotes.filterNeedsPricingDesc"),
                  ],
                  ["draft", t("quotes.filterDraft"), t("quotes.filterDraftDesc")],
                ] as const
              ).map(([value, label, desc]) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    applyFilterAndSort(value as QuoteStatusFilter, sortOrder);
                    setFilterModalVisible(false);
                  }}
                  className="flex-row items-center justify-between px-5 py-3.5 active:bg-slate-50"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "rgb(248 250 252)" : undefined,
                  })}
                >
                  <View className="flex-1 mr-3">
                    <Text
                      className={`text-base ${
                        statusFilter === value
                          ? "font-semibold text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      {label}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs text-slate-500"
                      numberOfLines={2}
                    >
                      {desc}
                    </Text>
                  </View>
                  {statusFilter === value && (
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                      <Check size={16} color="#ea580c" strokeWidth={2.5} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50 px-6 pb-12"
          onPress={() => setSortModalVisible(false)}
        >
          <Pressable
            className="rounded-3xl bg-white overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-2" style={rtlSectionTitleWrapStyle}>
              <View>
                <Text className="text-lg font-semibold text-slate-900" style={rtlText}>
                  {t("quotes.sortByDate")}
                </Text>
                <Text className="mt-0.5 text-sm text-slate-500" style={rtlText}>
                  {t("quotes.sortSubtitle")}
                </Text>
              </View>
            </View>
            <View className="py-2">
              <Pressable
                onPress={() => {
                  applyFilterAndSort(statusFilter, "createdAt_desc");
                  setSortModalVisible(false);
                }}
                className="flex-row items-center justify-between px-5 py-3.5 active:bg-slate-50"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? "rgb(248 250 252)" : undefined,
                })}
              >
                <Text
                  className={`text-base ${
                    sortOrder === "createdAt_desc"
                      ? "font-semibold text-slate-900"
                      : "text-slate-600"
                  }`}
                >
                  {t("quotes.sortNewest")}
                </Text>
                {sortOrder === "createdAt_desc" && (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                    <Check size={16} color="#ea580c" strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  applyFilterAndSort(statusFilter, "createdAt_asc");
                  setSortModalVisible(false);
                }}
                className="flex-row items-center justify-between px-5 py-3.5 active:bg-slate-50"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? "rgb(248 250 252)" : undefined,
                })}
              >
                <Text
                  className={`text-base ${
                    sortOrder === "createdAt_asc"
                      ? "font-semibold text-slate-900"
                      : "text-slate-600"
                  }`}
                >
                  {t("quotes.sortOldest")}
                </Text>
                {sortOrder === "createdAt_asc" && (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                    <Check size={16} color="#ea580c" strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
