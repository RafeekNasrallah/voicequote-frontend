import { useQuery } from "@tanstack/react-query";
import { Search, X, User, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";
import AddClientModal from "./AddClientModal";

const RTL_LANGUAGES = ["ar", "he"];

interface Client {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

interface ClientSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
}

export default function ClientSelectModal({
  visible,
  onClose,
  onSelect,
}: ClientSelectModalProps) {
  const [search, setSearch] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes((i18n.language || "").split("-")[0]);
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlHeaderDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const rtlTitleWrapStyle = isRTL
    ? { flexDirection: "row" as const, justifyContent: "flex-end" as const, width: "100%" as const, direction: "ltr" as const }
    : undefined;
  const inputRtlStyle = isRTL ? { textAlign: "right" as const, writingDirection: "rtl" as const } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await api.get<{ clients: Client[] }>("/api/clients");
      return data.clients;
    },
    enabled: visible,
  });

  const filteredClients = (data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback(
    (client: Client) => {
      onSelect(client);
      onClose();
    },
    [onSelect, onClose]
  );

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      {/* Add Client Modal */}
      <AddClientModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />

      <View className="flex-1 bg-slate-50">
        {/* Header — RTL: title on right, Add + Close on left; orange hint */}
        <View
          className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 pt-4"
          style={rtlHeaderDirection}
        >
          <View className="flex-1" style={rtlTitleWrapStyle}>
            <Text className="text-lg font-bold text-slate-900" style={rtlText}>
              {t("clients.selectClient")}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setAddModalVisible(true)}
              className="h-11 w-11 items-center justify-center rounded-full bg-orange-600"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              accessibilityLabel={t("clients.newClient")}
              accessibilityRole="button"
            >
              <Plus size={18} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-slate-100"
              accessibilityLabel={t("common.cancel")}
              accessibilityRole="button"
            >
              <X size={18} color="#64748b" />
            </Pressable>
          </View>
        </View>

        {/* Search — RTL: row direction, input alignment */}
        <View className="px-4 py-3">
          <View
            className="flex-row items-center rounded-full bg-slate-100 px-4 h-11"
            style={isRTL ? { direction: "rtl" as const } : undefined}
          >
            <Search size={18} color="#94a3b8" />
            <TextInput
              className="flex-1 text-base text-slate-900"
              style={[isRTL ? { marginRight: 12 } : { marginLeft: 12 }, inputRtlStyle]}
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
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#ea580c" size="large" />
          </View>
        ) : filteredClients.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <User size={36} color="#cbd5e1" />
            <Text className="mt-3 text-base text-slate-400" style={rtlText}>
              {search ? t("clients.noClientsFound") : t("clients.noClientsYet")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            style={isRTL ? { direction: "rtl" as const } : undefined}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-3.5 border border-slate-100"
                style={({ pressed }) => [
                  { opacity: pressed ? 0.7 : 1 },
                  isRTL ? { direction: "rtl" as const } : undefined,
                ]}
              >
                {/* RTL: Avatar first so it appears on the right, then Info (text) on the left */}
                {isRTL ? (
                  <>
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Text className="text-sm font-bold text-slate-600">
                        {getInitials(item.name)}
                      </Text>
                    </View>
                    <View
                      className="flex-1"
                      style={{
                        marginRight: 12,
                        alignItems: "flex-end",
                        direction: "ltr",
                      }}
                    >
                      <Text className="text-sm font-semibold text-slate-900" style={rtlText}>
                        {item.name}
                      </Text>
                      {item.address && (
                        <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1} style={rtlText}>
                          {item.address}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Text className="text-sm font-bold text-slate-600">
                        {getInitials(item.name)}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-slate-900" style={rtlText}>
                        {item.name}
                      </Text>
                      {item.address && (
                        <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1} style={rtlText}>
                          {item.address}
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
