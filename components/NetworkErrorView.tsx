import { WifiOff } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface NetworkErrorViewProps {
  onRetry: () => void;
  /** Optional: use a compact style (e.g. inside a card) */
  compact?: boolean;
}

export default function NetworkErrorView({ onRetry, compact }: NetworkErrorViewProps) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <View className="items-center justify-center rounded-xl bg-white py-8 px-6 border border-slate-100">
        <WifiOff size={32} color="#94a3b8" />
        <Text className="mt-2 text-sm text-slate-600 text-center">
          {t("errors.somethingWentWrong")}
        </Text>
        <Pressable
          onPress={onRetry}
          className="mt-4 h-11 items-center justify-center rounded-lg bg-slate-900 px-5"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-sm font-semibold text-white">{t("errors.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <WifiOff size={48} color="#94a3b8" />
      <Text className="mt-4 text-base font-medium text-slate-700 text-center">
        {t("errors.noConnection")}
      </Text>
      <Text className="mt-2 text-sm text-slate-500 text-center">
        {t("errors.somethingWentWrong")}
      </Text>
      <Pressable
        onPress={onRetry}
        className="mt-6 h-11 items-center justify-center rounded-lg bg-slate-900 px-6"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Text className="text-base font-semibold text-white">{t("errors.retry")}</Text>
      </Pressable>
    </View>
  );
}
