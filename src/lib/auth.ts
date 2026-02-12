import * as SecureStore from "expo-secure-store";

// Clerk token cache using expo-secure-store
// This persists tokens securely across app restarts
export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("SecureStore getToken error:", error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore saveToken error:", error);
    }
  },
};

// Global reference for getting the session token
// This will be set by the ClerkProvider in the root layout
let _getToken: (() => Promise<string | null>) | null = null;

export function setGetToken(fn: () => Promise<string | null>) {
  _getToken = fn;
}

export async function getToken(): Promise<string | null> {
  if (_getToken) {
    return _getToken();
  }
  return null;
}
