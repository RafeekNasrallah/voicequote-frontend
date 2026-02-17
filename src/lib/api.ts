import axios from "axios";
import { getToken } from "./auth";

// Base URL for the backend API
// Change this to your backend IP/URL for physical device testing
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

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
