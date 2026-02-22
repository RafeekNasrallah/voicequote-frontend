import axios from "axios";
import { getToken } from "./auth";

function isPrivateIp(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const devFallbackUrl = "http://localhost:3000";
  const candidate = envUrl || (__DEV__ ? devFallbackUrl : "");

  if (!candidate) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL for production build. Configure a public HTTPS backend URL.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      `Invalid EXPO_PUBLIC_API_URL: "${candidate}". Expected a full URL like https://api.example.com`,
    );
  }

  if (!__DEV__) {
    const host = parsed.hostname.toLowerCase();
    const localHost =
      host === "localhost" || host === "0.0.0.0" || host.endsWith(".local");
    const privateHost = localHost || isPrivateIp(host);

    if (parsed.protocol !== "https:") {
      throw new Error(
        `Invalid EXPO_PUBLIC_API_URL for production: "${candidate}". Production builds require HTTPS.`,
      );
    }

    if (privateHost) {
      throw new Error(
        `Invalid EXPO_PUBLIC_API_URL for production: "${candidate}". Production builds cannot use localhost/LAN/private hosts.`,
      );
    }
  }

  return candidate.replace(/\/+$/, "");
}

const BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // default; long-running requests (e.g. process-quote) can override
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Clerk Bearer token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Silently fail - user might not be authenticated yet
      console.warn("Failed to get auth token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - Clerk will handle re-auth
      console.warn("Unauthorized request - token may be expired");
    }
    return Promise.reject(error);
  },
);

export default api;
