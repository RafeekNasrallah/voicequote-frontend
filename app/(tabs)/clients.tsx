import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Search, ChevronRight, Plus, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import AddClientModal from "@/components/AddClientModal";
import MicFAB from "@/components/MicFAB";
import NetworkErrorView from "@/components/NetworkErrorView";
import api from "@/src/lib/api";
import { isNetworkError } from "@/src/lib/networkError";
import { ClientsListSkeleton } from "@/components/Skeleton";

interface Client {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  _count?: {
    quotes: number;
  };
}

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
  const { t } = useTranslation();

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

  const renderClient = useCallback(({ item }: { item: Client }) => {
    const quoteCount = item._count?.quotes ?? 0;
    return (
      <Link
        href={(`/client/${item.id}`) as Href}
        asChild
        className="mb-3"
      >
        <Pressable
          className="flex-row items-center rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
        {/* Avatar */}
        <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Text className="text-base font-bold text-slate-600">
            {getInitials(item.name)}
          </Text>
        </View>
        {/* Info */}
        <View className="ml-4 flex-1">
          <Text className="text-base font-semibold text-slate-900">
            {item.name}
          </Text>
          <View className="flex-row items-center mt-1">
            {item.address ? (
              <Text className="text-sm text-slate-400 flex-1" numberOfLines={1}>
                {item.address}
              </Text>
            ) : null}
            {quoteCount > 0 && (
              <View className="bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-xs font-medium text-slate-500">
                  {quoteCount} {quoteCount === 1 ? t("clients.quote") : t("clients.quotesPlural")}
                </Text>
              </View>
            )}
          </View>
        </View>
        {/* Arrow */}
        <ChevronRight size={20} color="#cbd5e1" />
      </Pressable>
      </Link>
    );
  }, [t]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Add Client Modal */}
      <AddClientModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />

      {/* Header */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900">{t("clients.title")}</Text>
        <Pressable
          onPress={() => setAddModalVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-900"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
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
          <Text className="mt-3 text-base font-medium text-slate-400">
            {search ? t("clients.noClientsFound") : t("clients.noClientsYet")}
          </Text>
          {!search && (
            <Text className="mt-1 text-sm text-slate-300">
              {t("clients.addFirstClient")}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderClient}
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
