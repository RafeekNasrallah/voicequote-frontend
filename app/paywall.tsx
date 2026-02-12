import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

const ENTITLEMENT_ID = "Esti Pro";

export default function PaywallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadOfferings = useCallback(async () => {
    try {
      setLoading(true);
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOffering(offerings.current);
      } else {
        setOffering(null);
      }
    } catch (e) {
      console.error("Error fetching offerings", e);
      setOffering(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const monthlyPackage: PurchasesPackage | null = offering
    ? (offering.availablePackages.find(
        (pkg) =>
          pkg.packageType === "MONTHLY" ||
          pkg.identifier.toLowerCase().includes("monthly"),
      ) ??
      offering.availablePackages[0] ??
      null)
    : null;

  const handlePurchase = useCallback(async () => {
    if (!monthlyPackage) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
        router.back();
      }
    } catch (e: any) {
      if (e.userCancelled !== true) {
        Alert.alert(
          t("common.error"),
          e.message || t("paywall.purchaseFailed"),
        );
      }
    } finally {
      setPurchasing(false);
    }
  }, [monthlyPackage, queryClient, router, t]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const customerInfo: CustomerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
        Alert.alert(
          t("paywall.restoreSuccess"),
          t("paywall.restoreSuccessMsg"),
        );
        router.back();
      } else {
        Alert.alert(
          t("paywall.restoreNoSubscription"),
          t("paywall.restoreNoSubscriptionMsg"),
        );
      }
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message || t("paywall.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  }, [queryClient, router, t]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
        <View className="w-10" />
        <Text className="text-lg font-bold text-slate-900">
          {t("paywall.title")}
        </Text>
        <Pressable
          onPress={handleClose}
          className="h-10 w-10 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <X size={24} color="#0f172a" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#ea580c" />
            <Text className="mt-3 text-sm text-slate-500">
              {t("paywall.loading")}
            </Text>
          </View>
        ) : (
          <>
            {/* Benefits */}
            <View className="mb-8">
              <Text className="mb-4 text-base font-semibold text-slate-900">
                {t("paywall.benefitsTitle")}
              </Text>
              {[
                t("paywall.benefit1"),
                t("paywall.benefit2"),
                t("paywall.benefit3"),
              ].map((label, i) => (
                <View key={i} className="mb-3 flex-row items-center">
                  <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <Check size={14} color="#16a34a" />
                  </View>
                  <Text className="flex-1 text-sm text-slate-700">{label}</Text>
                </View>
              ))}
            </View>

            {/* Price & Subscribe */}
            {monthlyPackage ? (
              <View className="mb-6">
                <Pressable
                  onPress={handlePurchase}
                  disabled={purchasing}
                  className="h-12 items-center justify-center rounded-xl bg-orange-600"
                  style={({ pressed }) => ({
                    opacity: pressed || purchasing ? 0.85 : 1,
                  })}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      {t("paywall.subscribeFor", {
                        price: monthlyPackage.product.priceString,
                      })}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              !loading && (
                <Text className="mb-6 text-center text-sm text-slate-500">
                  {t("paywall.noOffers")}
                </Text>
              )
            )}

            {/* Restore */}
            <Pressable
              onPress={handleRestore}
              disabled={restoring}
              className="h-12 items-center justify-center rounded-xl border border-slate-200"
              style={({ pressed }) => ({
                opacity: pressed || restoring ? 0.7 : 1,
              })}
            >
              {restoring ? (
                <ActivityIndicator size="small" color="#64748b" />
              ) : (
                <Text className="text-base font-semibold text-slate-600">
                  {t("paywall.restorePurchases")}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
