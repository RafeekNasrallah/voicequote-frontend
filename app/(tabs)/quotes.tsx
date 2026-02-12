import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FileText, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";
import { getCurrencySymbol, DEFAULT_CURRENCY } from "@/src/lib/currency";
import { QuotesListSkeleton } from "@/components/Skeleton";
import MicFAB from "@/components/MicFAB";

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
  t: (key: string) => string
): { label: string; bg: string; text: string } {
  if (quote.clientId && quote.totalCost) {
    return { label: t("quotes.statusReady"), bg: "bg-emerald-50", text: "text-emerald-700" };
  }
  if (quote.totalCost) {
    return { label: t("quotes.statusNoClient"), bg: "bg-amber-50", text: "text-amber-700" };
  }
  return { label: t("quotes.statusDraft"), bg: "bg-slate-100", text: "text-slate-600" };
}

function getQuoteTitle(quote: Quote): string {
  if (quote.name) return quote.name;
  if (quote.clientName) return `Quote #${quote.id} - ${quote.clientName}`;
  return `Quote #${quote.id}`;
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
            {currencySymbol}{quote.totalCost.toFixed(2)}
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

  const currencySymbol = getCurrencySymbol(userProfile?.currency || DEFAULT_CURRENCY);

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
    [deleteQuote, t]
  );

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
    [router, t, handleDeleteQuote, currencySymbol]
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <Text className="text-2xl font-bold text-slate-900">{t("quotes.title")}</Text>
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
      ) : filteredQuotes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={40} color="#cbd5e1" />
          <Text className="mt-3 text-base font-medium text-slate-400">
            {search ? t("quotes.noMatchSearch") : t("quotes.noQuotesYet")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredQuotes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderQuote}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0f172a"
            />
          }
        />
      )}

      {/* Mic FAB */}
      <MicFAB />
    </SafeAreaView>
  );
}
