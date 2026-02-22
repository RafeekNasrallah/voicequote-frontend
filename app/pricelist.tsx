import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
    ArrowLeft,
    DollarSign,
    Plus,
    Search,
    Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    I18nManager,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "@/src/lib/api";

const RTL_LANGUAGES = ["ar", "he"];
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/src/lib/currency";

// ─── Types ──────────────────────────────────────────────────

interface PriceItem {
  name: string;
  price: number;
  unit?: string;
}

interface UserProfile {
  priceList: PriceItem[] | null;
  currency: string;
}

// ─── Main Screen ────────────────────────────────────────────

export default function PriceListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const backArrowStyle = isRTL ? { transform: [{ scaleX: -1 }] } : undefined;

  const [items, setItems] = useState<PriceItem[]>([]);
  const [search, setSearch] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current price list
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/api/me");
      return data;
    },
  });

  const currencySymbol = getCurrencySymbol(
    profile?.currency || DEFAULT_CURRENCY,
  );

  // Sync server data to local state on first load
  useEffect(() => {
    if (profile?.priceList) {
      setItems(profile.priceList);
    }
  }, [profile]);

  // Save mutation
  const savePriceList = useMutation({
    mutationFn: async (priceItems: PriceItem[]) => {
      await api.put("/api/me/pricelist", { items: priceItems });
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      Alert.alert(t("priceList.saved"), t("priceList.savedMsg"));
    },
    onError: () => {
      Alert.alert(t("common.error"), t("priceList.saveFailed"));
    },
  });

  // ─── Item Actions ─────────────────────────────────────────

  const addItem = useCallback(() => {
    setItems((prev) => [{ name: "", price: 0, unit: "" }, ...prev]);
    setHasChanges(true);
    setSearch(""); // Clear search to show the new item
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof PriceItem, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };
        if (field === "price") {
          item.price = parseFloat(value) || 0;
        } else {
          (item as any)[field] = value;
        }
        updated[index] = item;
        return updated;
      });
      setHasChanges(true);
    },
    [],
  );

  const deleteItem = useCallback(
    (index: number) => {
      const item = items[index];
      const itemName = item.name || t("priceList.itemName");
      Alert.alert(
        t("priceList.deleteItem"),
        `${t("priceList.deleteItemConfirm")}\n\n${itemName}`,
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              setItems((prev) => prev.filter((_, i) => i !== index));
              setHasChanges(true);
            },
          },
        ],
      );
    },
    [items, t],
  );

  const handleSave = useCallback(() => {
    // Filter out items with empty names
    const validItems = items.filter((item) => item.name.trim().length > 0);
    setItems(validItems);
    savePriceList.mutate(validItems);
  }, [items, savePriceList]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        t("priceList.title"),
        "You have unsaved changes. Save before leaving?",
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.replace("/(tabs)/settings"),
          },
          {
            text: t("common.save"),
            onPress: () => {
              const validItems = items.filter(
                (item) => item.name.trim().length > 0,
              );
              savePriceList.mutate(validItems, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ["me"] });
                  router.replace("/(tabs)/settings");
                },
              });
            },
          },
        ],
      );
    } else {
      router.replace("/(tabs)/settings");
    }
  }, [hasChanges, items, savePriceList, queryClient, router, t]);

  // ─── Filtered items ───────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.unit && item.unit.toLowerCase().includes(term)),
    );
  }, [items, search]);

  // Map filtered items back to their original index
  const getOriginalIndex = useCallback(
    (item: PriceItem) => items.indexOf(item),
    [items],
  );

  // ─── Render Item ──────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: PriceItem }) => {
      const originalIndex = getOriginalIndex(item);
      const inputRtlStyle = isRTL ? { textAlign: "right" as const, writingDirection: "rtl" as const } : undefined;
      return (
        <View className="mb-2 rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          {/* Row 1: Name */}
          <View className="px-4 pt-3 pb-1">
            <TextInput
              className="text-base font-semibold text-slate-900"
              value={item.name}
              onChangeText={(v) => updateItem(originalIndex, "name", v)}
              placeholder={t("priceList.itemNamePlaceholder")}
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              maxLength={200}
              style={inputRtlStyle}
            />
          </View>

          {/* Row 2: Price, Unit, Delete — RTL: row direction so order flips */}
          <View
            className="flex-row items-center px-4 pb-3 pt-1"
            style={isRTL ? { direction: "rtl" as const } : undefined}
          >
            {/* Price */}
            <View className="flex-row items-center flex-1" style={isRTL ? { direction: "rtl" as const } : undefined}>
              <Text className="text-sm text-slate-400" style={[isRTL && { marginRight: 4 }]}>{currencySymbol}</Text>
              <TextInput
                className="text-sm text-slate-700 min-w-[60px]"
                style={[isRTL ? { marginRight: 4 } : { marginLeft: 4 }, inputRtlStyle]}
                value={item.price ? item.price.toString() : ""}
                onChangeText={(v) => updateItem(originalIndex, "price", v)}
                placeholder={t("priceList.pricePlaceholder")}
                placeholderTextColor="#cbd5e1"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Unit */}
            <View className="flex-row items-center flex-1" style={isRTL ? { direction: "rtl" as const } : undefined}>
              <Text className="text-xs text-slate-400" style={isRTL ? { marginLeft: 4 } : { marginRight: 4 }}>/</Text>
              <TextInput
                className="text-sm text-slate-700 min-w-[60px]"
                value={item.unit || ""}
                onChangeText={(v) => updateItem(originalIndex, "unit", v)}
                placeholder={t("priceList.unitPlaceholder")}
                placeholderTextColor="#cbd5e1"
                style={inputRtlStyle}
              />
            </View>

            {/* Delete */}
            <Pressable
              onPress={() => deleteItem(originalIndex)}
              className="h-11 w-11 items-center justify-center rounded-lg"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              accessibilityLabel={t("priceList.deleteItem")}
              accessibilityHint={t("priceList.deleteItemConfirm")}
              accessibilityRole="button"
            >
              <Trash2 size={16} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      );
    },
    [getOriginalIndex, updateItem, deleteItem, t, currencySymbol, isRTL, rtlText],
  );

  // ─── Render ───────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header — RTL: title on right, back arrow mirrored */}
      <View
        className="flex-row items-center px-4 py-3 border-b border-slate-200"
        style={rtlHeaderDirection}
      >
        <Pressable
          onPress={handleBack}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => [
            { opacity: pressed ? 0.6 : 1 },
            isRTL ? { marginLeft: 12 } : { marginRight: 12 },
          ]}
          accessibilityLabel={t("quoteEditor.goBack")}
          accessibilityRole="button"
        >
          <View style={backArrowStyle}>
            <ArrowLeft size={22} color="#ea580c" />
          </View>
        </Pressable>
        <View className="flex-1" style={rtlTitleWrapStyle}>
          <Text className="text-lg font-bold text-slate-900" style={rtlText}>
            {t("priceList.title")}
          </Text>
        </View>
        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || savePriceList.isPending}
          className={`h-11 px-4 items-center justify-center rounded-lg ${
            hasChanges ? "bg-orange-600" : "bg-slate-200"
          }`}
          style={({ pressed }) => ({
            opacity: pressed || savePriceList.isPending ? 0.7 : 1,
          })}
        >
          {savePriceList.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              className={`text-sm font-semibold ${
                hasChanges ? "text-white" : "text-slate-400"
              }`}
            >
              {t("common.save")}
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Search + Add — RTL: search row direction, input text right-aligned */}
        <View
          className="px-4 pt-3 pb-2 flex-row items-center gap-2"
          style={isRTL ? { direction: "rtl" as const } : undefined}
        >
          <View
            className="flex-1 flex-row items-center rounded-full bg-slate-100 px-4 h-10"
            style={isRTL ? { direction: "rtl" as const } : undefined}
          >
            <Search size={16} color="#94a3b8" />
            <TextInput
              className="flex-1 text-sm text-slate-900"
              style={[
                isRTL ? { textAlign: "right" as const, writingDirection: "rtl" as const } : undefined,
                isRTL ? { marginRight: 8 } : { marginLeft: 8 },
              ]}
              placeholder={t("priceList.searchPlaceholder")}
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            onPress={addItem}
            className="h-11 w-11 items-center justify-center rounded-full bg-orange-600"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            accessibilityLabel={t("priceList.addItem")}
            accessibilityRole="button"
          >
            <Plus size={18} color="#ffffff" />
          </Pressable>
        </View>

        {/* Item Count — RTL: text on right */}
        <View className="px-5 pb-2" style={rtlTitleWrapStyle}>
          <Text className="text-xs text-slate-400" style={rtlText}>
            {items.length === 0
              ? t("priceList.itemCount_zero")
              : items.length === 1
                ? t("priceList.itemCount_one", { count: 1 })
                : t("priceList.itemCount_other", { count: items.length })}
          </Text>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#ea580c" size="large" />
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <DollarSign size={40} color="#cbd5e1" />
            <Text className="mt-3 text-base font-medium text-slate-400" style={rtlText}>
              {search ? t("priceList.noMatchSearch") : t("priceList.noItems")}
            </Text>
            {!search && (
              <Text className="mt-1 text-sm text-slate-300 text-center" style={rtlText}>
                {t("priceList.noItemsMsg")}
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
