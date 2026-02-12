/**
 * Helpers for detecting and handling network/offline errors from API calls.
 * Used to show a friendly "no connection" message and retry option.
 */

/**
 * Returns true if the error is likely a network/connectivity issue
 * (offline, timeout, connection refused, etc.).
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number };
  };

  // Axios: no response from server (offline, timeout, DNS, etc.)
  if (err.code === "ERR_NETWORK") return true;
  if (err.message && typeof err.message === "string") {
    const m = err.message.toLowerCase();
    if (m.includes("network error") || m.includes("network request failed")) return true;
    if (m.includes("timeout") || m.includes("time out")) return true;
  }

  return false;
}
