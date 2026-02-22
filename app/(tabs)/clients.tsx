import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Search, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    I18nManager,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AddClientModal from "@/components/AddClientModal";
import NetworkErrorView from "@/components/NetworkErrorView";
import { ClientsListSkeleton } from "@/components/Skeleton";
import api from "@/src/lib/api";
import { isNetworkError } from "@/src/lib/networkError";

interface Client {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  quoteCount?: number;
}

const RTL_LANGUAGES = ["ar", "he"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ClientsScreen() {
  const [search, setSearch] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes(
    (i18n.language || "").split("-")[0]
  );
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const fullWidthText = isRTL ? { width: "100%" as const } : undefined;
  const infoAlign = isRTL ? { alignItems: "flex-end" as const } : undefined;
  /** RTL row: direction 'rtl' so title (first child) is on the right, icon on the left. */
  const rtlHeaderDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const router = useRouter();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await api.get<{ clients: Client[] }>("/api/clients");
      return data.clients;
    },
  });

  const clients = data ?? [];
  const filteredClients = clients.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.address && c.address.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.phone && c.phone.toLowerCase().includes(term))
    );
  });

  const handleOpenClient = useCallback(
    (clientId: number) => {
      router.push(`/client/${clientId}` as any);
    },
    [router],
  );

  const renderClient = useCallback(
    ({ item }: { item: Client }) => {
      const quoteCount = item.quoteCount ?? 0;
      const infoSpacing = isRTL
        ? { marginRight: 16 as const }
        : { marginLeft: 16 as const };
      const countSpacing = isRTL
        ? { marginRight: 8 as const }
        : { marginLeft: 8 as const };
      return (
        <Pressable
          onPress={() => handleOpenClient(item.id)}
          className="mb-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View className="flex-row items-center" style={{ direction: "ltr" }}>
            {isRTL ? (
              <>
                <View className="w-5 items-start">
                  <View style={{ transform: [{ scaleX: -1 }] }}>
                    <ChevronRight size={20} color="#cbd5e1" />
                  </View>
                </View>

                <View className="flex-1 min-w-0" style={[infoSpacing, infoAlign]}>
                  <Text
                    className="text-base font-semibold text-slate-900"
                    style={[rtlText, fullWidthText]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text
                      className="mt-1 text-sm text-slate-500"
                      numberOfLines={1}
                      style={[rtlText, fullWidthText]}
                    >
                      {item.address}
                    </Text>
                  ) : null}
                  <View
                    className="mt-2 flex-row items-center"
                    style={{ direction: "ltr", justifyContent: "flex-end" }}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        quoteCount > 0 ? "text-orange-600" : "text-slate-500"
                      }`}
                      style={[rtlText, countSpacing]}
                    >
                      {quoteCount}
                    </Text>
                    <Text
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                      style={rtlText}
                    >
                      {t("clients.totalQuotes")}
                    </Text>
                  </View>
                </View>

                <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Text className="text-base font-bold text-slate-600">
                    {getInitials(item.name)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Text className="text-base font-bold text-slate-600">
                    {getInitials(item.name)}
                  </Text>
                </View>
                <View className="flex-1 min-w-0" style={infoSpacing}>
                  <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text
                      className="mt-1 text-sm text-slate-500"
                      numberOfLines={1}
                    >
                      {item.address}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row items-center">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("clients.totalQuotes")}
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        quoteCount > 0 ? "text-orange-600" : "text-slate-500"
                      }`}
                      style={countSpacing}
                    >
                      {quoteCount}
                    </Text>
                  </View>
                </View>
                <View className="w-5 items-end">
                  <ChevronRight size={20} color="#cbd5e1" />
                </View>
              </>
            )}
          </View>
        </Pressable>
      );
    },
    [fullWidthText, handleOpenClient, infoAlign, isRTL, rtlText, t],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Add Client Modal */}
      <AddClientModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />

      {/* Header — title first, icon second; direction rtl puts title right, icon left; thin orange line under title */}
      <View
        className="px-6 pt-4 pb-2 flex-row items-center justify-between"
        style={rtlHeaderDirection}
      >
        <Text
          className="text-2xl font-bold text-slate-900"
          style={rtlText}
        >
          {t("clients.title")}
        </Text>
        <Pressable
          onPress={() => setAddModalVisible(true)}
          className="h-11 w-11 items-center justify-center rounded-full bg-orange-600"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          accessibilityLabel={t("clients.newClient")}
          accessibilityRole="button"
        >
          <Plus size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-6 py-3">
        <View
          className="flex-row items-center rounded-full bg-slate-100 px-4 h-11"
          style={isRTL ? { flexDirection: "row-reverse" } : undefined}
        >
          <Search size={18} color="#94a3b8" />
          <TextInput
            className="flex-1 text-base text-slate-900"
            style={[rtlText, { marginStart: 12 }]}
            placeholder={t("clients.searchPlaceholder")}
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <ClientsListSkeleton count={6} />
      ) : isError && isNetworkError(error) ? (
        <NetworkErrorView onRetry={refetch} />
      ) : filteredClients.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <User size={40} color="#cbd5e1" />
          <Text className="mt-3 text-base font-medium text-slate-500">
            {search ? t("clients.noClientsFound") : t("clients.noClientsYet")}
          </Text>
          {!search && (
            <Text className="mt-1 text-sm text-slate-500">
              {t("clients.addFirstClient")}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderClient}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
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

    </SafeAreaView>
  );
}
