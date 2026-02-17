import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FileText, Plus, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MicFAB from "@/components/MicFAB";
import NetworkErrorView from "@/components/NetworkErrorView";
import { QuotesListSkeleton } from "@/components/Skeleton";
import { useCreateManualQuote } from "@/src/hooks/useCreateManualQuote";
import api from "@/src/lib/api";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/src/lib/currency";
import { isNetworkError } from "@/src/lib/networkError";

// ─── Types ──────────────────────────────────────────────────

interface Quote {
  id: number;
  name: string | null;
  createdAt: string;
  totalCost: number | null;
  clientId: number | null;
  clientName: string | null;
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getQuoteStatus(
  quote: Quote,
  t: (key: string) => string,
): { label: string; bg: string; text: string } {
  if (quote.clientId && quote.totalCost) {
    return {
      label: t("quotes.statusReady"),
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    };
  }
  if (quote.totalCost) {
    return {
      label: t("quotes.statusNoClient"),
      bg: "bg-amber-50",
      text: "text-amber-700",
    };
  }
  return {
    label: t("quotes.statusDraft"),
    bg: "bg-slate-100",
    text: "text-slate-600",
  };
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
}: {
  quote: Quote;
  onPress: () => void;
  onLongPress?: () => void;
  t: (key: string) => string;
  currencySymbol: string;
}) {
  const status = getQuoteStatus(quote, t);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 text-base font-semibold text-slate-900 mr-3"
          numberOfLines={1}
        >
          {getQuoteTitle(quote)}
        </Text>
        <View className={`rounded-full px-3 py-1 ${status.bg}`}>
          <Text className={`text-xs font-semibold ${status.text}`}>
            {status.label}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row items-center">
        <Text className="text-sm text-slate-400">
          {formatDate(quote.createdAt)}
        </Text>
        {quote.totalCost != null && (
          <Text className="ml-3 text-sm font-medium text-slate-600">
            {currencySymbol}
            {quote.totalCost.toFixed(2)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

interface UserProfile {
  currency: string;
}

// ─── Main Screen ────────────────────────────────────────────

export default function AllQuotesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: quotes = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data } = await api.get<{ quotes: Quote[] }>("/api/quotes");
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
      const date = formatDate(q.createdAt).toLowerCase();
      const cost = q.totalCost != null ? `$${q.totalCost.toFixed(2)}` : "";
      const status = getQuoteStatus(q, t).label.toLowerCase();
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
  }, [quotes, search, t]);

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

  const renderQuote = useCallback(
    ({ item }: { item: Quote }) => (
      <QuoteCard
        quote={item}
        t={t}
        currencySymbol={currencySymbol}
        onPress={() => router.push(`/quote/${item.id}` as any)}
        onLongPress={() => handleDeleteQuote(item)}
      />
    ),
    [router, t, handleDeleteQuote, currencySymbol],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900">
          {t("quotes.title")}
        </Text>
        <Pressable
          onPress={() => createManualQuote.mutate()}
          disabled={createManualQuote.isPending}
          className="h-10 w-10 items-center justify-center rounded-full bg-orange-600"
          style={({ pressed }) => ({ opacity: pressed || createManualQuote.isPending ? 0.7 : 1 })}
        >
          <Plus size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-6 py-3">
        <View className="flex-row items-center rounded-full bg-slate-100 px-4 h-11">
          <Search size={18} color="#94a3b8" />
          <TextInput
            className="ml-3 flex-1 text-base text-slate-900"
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
          <Text className="mt-3 text-base font-medium text-slate-400">
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
                className="bg-orange-600 px-2 py-1 rounded"
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
              paddingBottom: 100,
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

      {/* Mic FAB */}
      <MicFAB />
    </SafeAreaView>
  );
}
