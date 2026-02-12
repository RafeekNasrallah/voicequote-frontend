import { Loader2 } from "lucide-react-native";
import { useEffect } from "react";
import { Modal, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

interface ProcessingModalProps {
  visible: boolean;
}

export default function ProcessingModal({
  visible,
}: ProcessingModalProps) {
  const { t } = useTranslation();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1, // infinite
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [visible, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-8 items-center rounded-2xl bg-white px-10 py-8 shadow-lg">
          <Animated.View style={spinStyle}>
            <Loader2 size={40} color="#0f172a" />
          </Animated.View>
          <Text className="mt-4 text-center text-base font-semibold text-slate-900">
            {t("processing.processingRecording")}
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-400">
            {t("processing.mayTakeAMoment")}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
