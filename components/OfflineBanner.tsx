import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useNetworkState } from "@/src/hooks/useNetworkState";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const isOffline = useNetworkState();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  // When coming back online, refetch so lists and data stay in sync
  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      queryClient.refetchQueries({ type: "active" });
    }
    wasOffline.current = isOffline;
  }, [isOffline, queryClient]);

  if (!isOffline) return null;

  const handleRetry = () => {
    queryClient.refetchQueries({ type: "active" });
  };

  return (
    <View className="bg-amber-500 px-4 py-2.5 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <WifiOff size={18} color="#1e293b" />
        <Text className="ml-2 text-sm font-semibold text-slate-900">
          {t("errors.noConnection")}
        </Text>
      </View>
      <Pressable
        onPress={handleRetry}
        className="bg-slate-900 px-3 py-1.5 rounded-lg"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Text className="text-xs font-semibold text-white">
          {t("errors.retry")}
        </Text>
      </Pressable>
    </View>
  );
}
