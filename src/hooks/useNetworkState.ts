import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Returns whether the app is currently offline (no network connectivity).
 * Uses NetInfo for reliable detection on iOS, Android, and web.
 */
export function useNetworkState(): boolean {
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleState = (state: NetInfoState) => {
      setIsOffline(
        state.isConnected === false || state.isInternetReachable === false,
      );
    };

    NetInfo.fetch().then(handleState);
    const unsubscribe = NetInfo.addEventListener(handleState);
    return () => unsubscribe();
  }, []);

  return isOffline;
}
