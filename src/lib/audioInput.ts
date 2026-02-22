import { createAudioPlayer } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";

export const MAX_AUDIO_DURATION_SEC = 600; // 10 minutes

const PLAYER_LOAD_TIMEOUT_MS = 8000;
const PLAYER_POLL_INTERVAL_MS = 100;

export interface AudioInput {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  wave: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/mp4",
};

const SUPPORTED_CONTENT_TYPES = new Set<string>([
  "audio/mpeg",
  "audio/mp3",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExtension(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return null;
  return clean.slice(dot + 1).trim().toLowerCase();
}

function normalizeContentType(mimeType?: string | null): string | null {
  if (!mimeType) return null;
  const normalized = mimeType.trim().toLowerCase().split(";")[0];
  if (!normalized.startsWith("audio/")) return null;

  if (normalized === "audio/mp3") return "audio/mpeg";
  if (normalized === "audio/x-m4a") return "audio/mp4";
  if (normalized === "audio/x-wav") return "audio/wav";
  if (normalized === "audio/aac" || normalized === "audio/mp4a-latm") {
    return "audio/mp4";
  }
  if (SUPPORTED_CONTENT_TYPES.has(normalized)) return normalized;
  return null;
}

function mapContentTypeToExt(contentType?: string | null): string | null {
  if (!contentType) return null;
  const normalized = contentType.trim().toLowerCase().split(";")[0];
  for (const [ext, mappedType] of Object.entries(EXT_TO_CONTENT_TYPE)) {
    if (mappedType === normalized) return ext;
  }
  return null;
}

export function inferAudioUploadMetadata(input: AudioInput): {
  ext: string;
  contentType: string;
} {
  const mimeType = normalizeContentType(input.mimeType);
  const extFromName = getExtension(input.fileName);
  const extFromUri = getExtension(input.uri);
  const extFromMime = mapContentTypeToExt(mimeType);
  const extCandidate = extFromName || extFromUri || extFromMime;
  const ext =
    extCandidate && EXT_TO_CONTENT_TYPE[extCandidate]
      ? extCandidate
      : extFromMime || "m4a";
  const contentType = mimeType || EXT_TO_CONTENT_TYPE[ext] || "audio/mp4";

  return { ext, contentType };
}

export async function pickAudioFromDevice(): Promise<AudioInput | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

export async function getAudioDurationSeconds(
  uri: string,
): Promise<number | null> {
  const player = createAudioPlayer({ uri }, { updateInterval: 200 });

  try {
    const maxIterations = Math.ceil(
      PLAYER_LOAD_TIMEOUT_MS / PLAYER_POLL_INTERVAL_MS,
    );

    for (let i = 0; i < maxIterations; i += 1) {
      if (player.isLoaded) {
        const duration = Number(player.duration);
        if (!Number.isFinite(duration) || duration < 0) return null;
        return duration;
      }
      await sleep(PLAYER_POLL_INTERVAL_MS);
    }

    return null;
  } catch {
    return null;
  } finally {
    try {
      player.remove();
    } catch {}
  }
}
