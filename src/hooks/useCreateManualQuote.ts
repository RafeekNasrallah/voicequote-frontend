import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import api from "@/src/lib/api";

interface CreateManualQuoteResponse {
  quoteId: number;
}

interface CreateManualQuoteParams {
  name?: string | null;
}

/**
 * useCreateManualQuote - Create an empty quote without recording (Phase 36).
 * Calls POST /api/quotes with optional name, then navigates to the quote editor.
 */
export function useCreateManualQuote() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (params?: CreateManualQuoteParams) => {
      const { data } = await api.post<CreateManualQuoteResponse>("/api/quotes", {
        name: params?.name?.trim() || null,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["recentQuotes"] });
      queryClient.invalidateQueries({ queryKey: ["quoteStats"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push(`/quote/${data.quoteId}` as any);
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const data = error?.response?.data;
      if (status === 403) {
        const code = data?.code;
        if (code === "QUOTA_EXCEEDED") {
          router.push("/paywall" as any);
          return;
        }
      }
      if (__DEV__) {
        console.error("Create quote failed:", status, data ?? error?.message);
      }
      const serverMessage = typeof data?.error === "string" ? data.error : null;
      let message = t("errors.createQuoteFailed");
      if (serverMessage && serverMessage.length < 160) message = serverMessage;
      else if (!error?.response) message = t("errors.noConnection");
      Alert.alert(t("common.error"), message);
    },
  });
}
