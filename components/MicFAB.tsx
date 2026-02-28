import { Mic } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import RecordingModal from "./RecordingModal";
import ProcessingModal from "./ProcessingModal";
import { useCreateManualQuote } from "@/src/hooks/useCreateManualQuote";
import { useCreateQuote } from "@/src/hooks/useCreateQuote";
import { type AudioInput } from "@/src/lib/audioInput";
import { isNetworkError } from "@/src/lib/networkError";

interface MicFABProps {
  style?: object;
}

export default function MicFAB({ style }: MicFABProps) {
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useTranslation();
  const createQuote = useCreateQuote();
  const createManualQuote = useCreateManualQuote();

  const handleRecordingComplete = useCallback(
    (audio: AudioInput) => {
      createQuote.mutate(
        {
          localUri: audio.uri,
          fileName: audio.fileName ?? null,
          mimeType: audio.mimeType ?? null,
        },
        {
          onSuccess: () => {
            // Refresh the quotes list and stats after a new quote is created
            queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["quoteStats"] });
          },
          onError: (error: any) => {
            if (error?.fileTooLarge || error?.fileTooLong) {
              return; // useCreateQuote already showed the alert
            }
            if (error?.response?.status === 403) {
              const code = error?.response?.data?.code;
              if (code === "QUOTA_EXCEEDED") {
                Alert.alert(
                  t("errors.quotaExceededTitle"),
                  t("errors.quotaExceededMessage"),
                  [
                    {
                      text: t("errors.quotaExceededManualEntry"),
                      onPress: () => createManualQuote.mutate(undefined),
                    },
                    {
                      text: t("errors.quotaExceededUpgrade"),
                      onPress: () => router.push("/paywall" as any),
                    },
                    { text: t("common.cancel"), style: "cancel" },
                  ],
                );
                return;
              }
            }
            if (isNetworkError(error)) {
              Alert.alert(
                t("errors.noConnection"),
                t("errors.somethingWentWrong")
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
        }
      );
    },
    [createQuote, createManualQuote, queryClient, router, t]
  );

  return (
    <>
      {/* Recording Modal */}
      <RecordingModal
        visible={recordingModalVisible}
        onClose={() => setRecordingModalVisible(false)}
        onRecordingComplete={handleRecordingComplete}
      />

      {/* Processing Modal */}
      <ProcessingModal visible={createQuote.isPending || createManualQuote.isPending} />

      {/* FAB Button */}
      <Pressable
        onPress={() => setRecordingModalVisible(true)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-orange-600"
        style={[
          {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
          },
          style,
        ]}
        accessibilityLabel={t("recording.tapToRecord")}
        accessibilityRole="button"
      >
        {({ pressed }: { pressed: boolean }) => (
          <Mic size={24} color="#ffffff" style={{ opacity: pressed ? 0.7 : 1 }} />
        )}
      </Pressable>
    </>
  );
}
