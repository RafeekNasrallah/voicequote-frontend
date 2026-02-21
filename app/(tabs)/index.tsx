import { useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CheckCircle2, Clock, FileText } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NetworkErrorView from "@/components/NetworkErrorView";
import ProcessingModal from "@/components/ProcessingModal";
import RecordButton from "@/components/RecordButton";
import { QuoteCardSkeleton, Skeleton } from "@/components/Skeleton";
import { useCreateQuote } from "@/src/hooks/useCreateQuote";
import api from "@/src/lib/api";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/src/lib/currency";
import { isNetworkError } from "@/src/lib/networkError";
import {
  deriveQuoteWorkflowStatus,
  getQuoteStatusBadge,
} from "@/src/lib/quoteStatus";

// ─── Types ──────────────────────────────────────────────────

interface Quote {
  id: number;
  name: string | null;
  createdAt: string;
  totalCost: number | null;
  clientId: number | null;
  clientName: string | null;
  status?: string | null;
}

interface QuoteStats {
  total: number;
  withClient: number;
  ready: number;
  needsClient?: number;
  needsPricing?: number;
  draft?: number;
}

// ─── Helpers ────────────────────────────────────────────────

function getInitials(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = firstName?.[0]?.toUpperCase() || "";
  const last = lastName?.[0]?.toUpperCase() || "";
  return first + last || "VQ";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getQuoteTitle(quote: Quote): string {
  const base = quote.name || `Quote #${quote.id}`;
  return quote.clientName ? `${base} - ${quote.clientName}` : base;
}

// ─── Components ─────────────────────────────────────────────

function StatsCard({
  label,
  value,
  Icon,
  color,
  isLoading,
  onPress,
}: {
  label: string;
  value: number;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  isLoading?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View className="flex-1 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
      <View className="flex-row items-center justify-between">
        {isLoading ? (
          <Skeleton width={32} height={28} borderRadius={6} />
        ) : (
          <Text className="text-2xl font-bold text-slate-900">{value}</Text>
        )}
        <Icon size={20} color={color} />
      </View>
      <Text className="mt-1 text-xs text-slate-500">{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-1"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

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
  const status = getQuoteStatusBadge(deriveQuoteWorkflowStatus(quote), t);

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

// ─── Main Screen ────────────────────────────────────────────

interface UserProfile {
  currency: string;
  isPro?: boolean;
  quoteCount?: number;
}

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const createQuote = useCreateQuote();
  const { t } = useTranslation();

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
  const isPro = userProfile?.isPro === true;
  const quoteCount = userProfile?.quoteCount ?? 0;
  const softLimitApproaching = isPro && quoteCount >= 180 && quoteCount < 200;
  const softLimitReached = isPro && quoteCount >= 200;

  // Greeting based on time of day
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 17) return t("greeting.afternoon");
    return t("greeting.evening");
  }

  // Fetch recent quotes (limited to 4 for home screen)
  const {
    data: quotes = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["recentQuotes"],
    queryFn: async () => {
      const { data } = await api.get<{ quotes: Quote[] }>(
        "/api/quotes?limit=4",
      );
      return data.quotes;
    },
  });

  // Fetch quote stats (separate query for accurate counts)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["quoteStats"],
    queryFn: async () => {
      const { data } = await api.get<QuoteStats>("/api/quotes/stats");
      return data;
    },
  });

  // Delete quote
  const deleteQuote = useMutation({
    mutationFn: async (quoteId: number) => {
      await api.delete(`/api/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quoteStats"] });
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

  // Stats from backend (or fallback to 0)
  const totalQuotes = stats?.total ?? 0;
  const needsClient = stats?.needsClient ?? 0;
  const ready = stats?.ready ?? 0;

  const handleRecordingComplete = useCallback(
    (uri: string) => {
      createQuote.mutate(
        { localUri: uri },
        {
          onSuccess: () => {
            // Refresh the quotes list, stats, and profile (for Pro quoteCount)
            queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["quoteStats"] });
            queryClient.invalidateQueries({ queryKey: ["me"] });
          },
          onError: (error: any) => {
            if (error?.fileTooLarge) {
              return; // useCreateQuote already showed the alert
            }
            if (error?.response?.status === 403) {
              const code = error?.response?.data?.code;
              if (code === "QUOTA_EXCEEDED") {
                router.push("/paywall" as any);
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
    [createQuote, queryClient, router, t],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Processing Modal */}
      <ProcessingModal visible={createQuote.isPending} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#0f172a"
          />
        }
      >
        {/* ─── Header ─────────────────────────────────── */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <View>
            <Text className="text-2xl font-bold text-slate-900">
              {getGreeting()}, {user?.firstName || "Pro"}
            </Text>
            <Text className="mt-0.5 text-sm text-slate-500">
              {t("home.readyToCreate")}
            </Text>
          </View>
          {/* Avatar */}
          <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-600">
            <Text className="text-sm font-bold text-white">
              {getInitials(user?.firstName, user?.lastName)}
            </Text>
          </View>
        </View>

        {/* ─── Stats Row ─────────────────────────────── */}
        <View className="mt-4 flex-row gap-3 px-6">
          <StatsCard
            label={t("home.totalQuotes")}
            value={totalQuotes}
            Icon={FileText}
            color="#ea580c"
            isLoading={statsLoading}
            onPress={() => router.push("/(tabs)/quotes" as any)}
          />
          <StatsCard
            label={t("quotes.statusNoClient")}
            value={needsClient}
            Icon={Clock}
            color="#ea580c"
            isLoading={statsLoading}
            onPress={() => router.push("/(tabs)/quotes?status=needs_client" as any)}
          />
          <StatsCard
            label={t("home.ready")}
            value={ready}
            Icon={CheckCircle2}
            color="#ea580c"
            isLoading={statsLoading}
            onPress={() => router.push("/(tabs)/quotes?status=ready" as any)}
          />
        </View>

        {/* Pro soft limit warning banner */}
        {softLimitApproaching && (
          <View className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Text className="text-sm text-amber-800">
              {t("errors.softLimitApproaching")}
            </Text>
          </View>
        )}

        {/* ─── Record Button (Hero) ──────────────────── */}
        <View className="mt-8 mb-6 items-center">
          {softLimitReached ? (
            <View className="items-center">
              <View
                className="h-32 w-32 items-center justify-center rounded-full bg-slate-300 opacity-70"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <FileText size={44} color="#64748b" />
              </View>
              <Text className="mt-4 max-w-[280] text-center text-base font-semibold text-slate-600">
                {t("errors.softLimitReached")}
              </Text>
            </View>
          ) : (
            <RecordButton onRecordingComplete={handleRecordingComplete} />
          )}
        </View>

        {/* ─── Recent Quotes ─────────────────────────── */}
        <View className="px-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-slate-900">
              {t("home.recentQuotes")}
            </Text>
            {quotes.length > 0 && (
              <Pressable
                onPress={() => router.push("/(tabs)/quotes" as any)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text className="text-sm font-semibold text-orange-600">
                  {t("home.viewAll")}
                </Text>
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <>
              <QuoteCardSkeleton />
              <QuoteCardSkeleton />
              <QuoteCardSkeleton />
            </>
          ) : isError && isNetworkError(error) && quotes.length === 0 ? (
            <NetworkErrorView onRetry={refetch} compact />
          ) : quotes.length === 0 ? (
            <View className="items-center rounded-xl bg-white py-8 border border-slate-100">
              <FileText size={32} color="#cbd5e1" />
              <Text className="mt-2 text-sm text-slate-400">
                {t("home.noQuotesYet")}
              </Text>
            </View>
          ) : (
            <>
              {isError && isNetworkError(error) && (
                <View className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex-row items-center">
                  <Text className="text-xs text-amber-800 flex-1">
                    {t("errors.showingCachedData")}
                  </Text>
                  <Pressable
                    onPress={() => refetch()}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                    className="bg-orange-600 px-2 py-1 rounded"
                  >
                    <Text className="text-xs font-semibold text-white">
                      {t("errors.retry")}
                    </Text>
                  </Pressable>
                </View>
              )}
              {quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  t={t}
                  currencySymbol={currencySymbol}
                  onPress={() => router.push(`/quote/${quote.id}` as any)}
                  onLongPress={() => handleDeleteQuote(quote)}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
