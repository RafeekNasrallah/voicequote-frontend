import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import api from "@/src/lib/api";

interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
}

interface ProcessQuoteResponse {
  quoteId: number;
  pdfUrl?: string;
}

interface CreateQuoteParams {
  localUri: string;
}

/**
 * useCreateQuote - TanStack Mutation hook
 *
 * Full flow:
 * 1. POST /api/upload-url  -> Get signed S3 upload URL + file key
 * 2. PUT to S3             -> Upload the audio file directly
 * 3. POST /api/process-quote -> Tell backend to process the audio
 * 4. Redirect              -> Navigate to the new quote editor
 */
export function useCreateQuote() {
  const router = useRouter();
  const { i18n } = useTranslation();

  return useMutation({
    mutationFn: async ({ localUri }: CreateQuoteParams) => {
      // Use the current i18n language for transcription
      const language = i18n.language || "en";

      // Step 1: Get a signed upload URL from the backend
      let uploadData: UploadUrlResponse;
      try {
        const res = await api.post<UploadUrlResponse>(
          "/api/upload-url",
          {
            ext: "m4a",
            contentType: "audio/mp4",
          }
        );
        uploadData = res.data;
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
        const status = e?.response?.status;
        console.error("Create quote error (step 1 upload-url):", status, msg ?? e?.response?.data);
        throw e;
      }

      const { uploadUrl, fileKey } = uploadData;

      // Step 2: Upload the audio file to S3 using the signed URL
      const fileResponse = await fetch(localUri);
      const blob = await fileResponse.blob();

      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "audio/mp4",
        },
        body: blob,
      });

      if (!uploadResult.ok) {
        console.error("Create quote error (step 2 S3 upload):", uploadResult.status, uploadResult.statusText);
        throw new Error(
          `Upload failed with status ${uploadResult.status}`
        );
      }

      // Step 3: Tell backend to process the uploaded audio
      let processData: ProcessQuoteResponse;
      try {
        const res = await api.post<ProcessQuoteResponse>(
          "/api/process-quote",
          {
            fileKey,
            language,
          }
        );
        processData = res.data;
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
        const status = e?.response?.status;
        console.error("Create quote error (step 3 process-quote):", status, msg ?? e?.response?.data);
        throw e;
      }

      console.log("Process quote response:", JSON.stringify(processData));
      return processData;
    },
    onSuccess: (data) => {
      // Step 4: Navigate to the new quote editor
      console.log("Navigating to quote with data:", JSON.stringify(data));
      router.push(`/quote/${data.quoteId}` as any);
    },
    onError: (error: any) => {
      console.error("Create quote failed:", error?.message);
      if (error?.response) {
        console.error("Backend status:", error.response.status);
        console.error("Backend response:", JSON.stringify(error.response.data));
      }
    },
  });
}
