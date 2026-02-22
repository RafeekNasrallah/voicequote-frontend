import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, Crown, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Linking,
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
import api from "@/src/lib/api";
import {
  isRevenueCatConfigured,
  REVENUECAT_ENTITLEMENT_ID,
} from "@/src/lib/revenueCat";

const RTL_LANGUAGES = ["ar", "he"];

type BillingUnit = "day" | "week" | "month" | "year";

interface BillingPeriod {
  unit: BillingUnit;
  value: number;
}

const PACKAGE_TYPE_TO_PERIOD: Record<string, BillingPeriod> = {
  WEEKLY: { unit: "week", value: 1 },
  MONTHLY: { unit: "month", value: 1 },
  TWO_MONTH: { unit: "month", value: 2 },
  THREE_MONTH: { unit: "month", value: 3 },
  SIX_MONTH: { unit: "month", value: 6 },
  ANNUAL: { unit: "year", value: 1 },
};

function parseIso8601Period(period: string | null): BillingPeriod | null {
  if (!period) return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/i.exec(period);
  if (!match) return null;

  const years = Number(match[1] ?? 0);
  const months = Number(match[2] ?? 0);
  const weeks = Number(match[3] ?? 0);
  const days = Number(match[4] ?? 0);

  if (years > 0) return { unit: "year", value: years };
  if (months > 0) return { unit: "month", value: months };
  if (weeks > 0) return { unit: "week", value: weeks };
  if (days > 0) return { unit: "day", value: days };
  return null;
}

function normalizePeriodUnit(periodUnit: string | null | undefined): BillingUnit | null {
  switch ((periodUnit ?? "").toUpperCase()) {
    case "DAY":
      return "day";
    case "WEEK":
      return "week";
    case "MONTH":
      return "month";
    case "YEAR":
      return "year";
    default:
      return null;
  }
}

export default function PaywallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const languageIsRTL = RTL_LANGUAGES.includes((i18n.language || "").split("-")[0]);
  const isRTL = I18nManager.isRTL || languageIsRTL;
  const rtlText = isRTL
    ? { textAlign: "right" as const, writingDirection: "rtl" as const }
    : undefined;
  const rtlHeaderDirection = isRTL ? { direction: "rtl" as const } : undefined;
  const rtlTitleWrapStyle = isRTL
    ? { flexDirection: "row" as const, justifyContent: "flex-end" as const, width: "100%" as const, direction: "ltr" as const }
    : undefined;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [configError, setConfigError] = useState(false);

  const syncSubscriptionAndClose = useCallback(async () => {
    try {
      await api.post("/api/me/sync-subscription");
    } catch {
      // Sync may fail if REVENUECAT_API_SECRET not set; webhook will eventually update
    }
    queryClient.invalidateQueries({ queryKey: ["me"] });
    router.back();
  }, [queryClient, router]);

  const loadOfferings = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setLoading(false);
      setOffering(null);
      return;
    }
    try {
      setLoading(true);
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOffering(offerings.current);
      } else {
        setOffering(null);
      }
    } catch (e: unknown) {
      const err = e as { code?: number | string; message?: string };
      const isConfigError =
        err?.code === 23 ||
        err?.code === "23" ||
        String(err?.message ?? "").toLowerCase().includes("configuration");
      if (isConfigError) setConfigError(true);
      console.error("Error fetching offerings", e);
      setOffering(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const selectedPackage: PurchasesPackage | null = offering
    ? (offering.availablePackages.find(
        (pkg) =>
          pkg.packageType === "MONTHLY" ||
          pkg.identifier.toLowerCase().includes("monthly"),
      ) ??
      offering.monthly ??
      offering.annual ??
      offering.sixMonth ??
      offering.threeMonth ??
      offering.twoMonth ??
      offering.weekly ??
      offering.availablePackages[0] ??
      null)
    : null;

  const billingPeriod: BillingPeriod | null = selectedPackage
    ? (parseIso8601Period(selectedPackage.product.subscriptionPeriod) ??
      PACKAGE_TYPE_TO_PERIOD[selectedPackage.packageType] ??
      null)
    : null;

  const getPeriodLabel = useCallback(
    (period: BillingPeriod | null) => {
      if (!period) return t("paywall.billingCycle");
      const count = Math.max(1, period.value);
      switch (period.unit) {
        case "day":
          return t("paywall.periodDay", { count });
        case "week":
          return t("paywall.periodWeek", { count });
        case "month":
          return t("paywall.periodMonth", { count });
        case "year":
          return t("paywall.periodYear", { count });
        default:
          return t("paywall.billingCycle");
      }
    },
    [t],
  );

  const periodLabel = getPeriodLabel(billingPeriod);
  const renewalPriceLine =
    selectedPackage != null
      ? t("paywall.renewalPrice", {
          price: selectedPackage.product.priceString,
          period: periodLabel,
        })
      : null;

  const introPriceLine =
    selectedPackage != null && renewalPriceLine != null
      ? (() => {
          const intro = selectedPackage.product.introPrice;
          if (!intro) return null;

          const unit = normalizePeriodUnit(intro.periodUnit);
          if (!unit) return null;
          const durationCount = Math.max(
            1,
            intro.cycles * Math.max(1, intro.periodNumberOfUnits),
          );
          const duration = getPeriodLabel({ unit, value: durationCount });

          if (intro.price === 0) {
            return t("paywall.freeTrialDisclosure", {
              duration,
              renewal: renewalPriceLine,
            });
          }

          return t("paywall.introPriceDisclosure", {
            introPrice: intro.priceString,
            duration,
            renewal: renewalPriceLine,
          });
        })()
      : null;

  const privacyPolicyUrl =
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://www.getquotio.com/privacy";
  const termsOfUseUrl =
    process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ?? "https://www.getquotio.com/terms";

  const openUrl = useCallback(
    (url: string, title: string) => {
      if (!url || !url.startsWith("http")) {
        Alert.alert(
          t("common.error"),
          t("settings.urlNotConfigured", { title }),
        );
        return;
      }
      Linking.openURL(url).catch(() => {
        Alert.alert(t("common.error"), t("paywall.openLinkFailed"));
      });
    },
    [t],
  );

  const handlePurchase = useCallback(async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]) {
        await syncSubscriptionAndClose();
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
  }, [selectedPackage, syncSubscriptionAndClose, t]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const customerInfo: CustomerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]) {
        await syncSubscriptionAndClose();
        Alert.alert(
          t("paywall.restoreSuccess"),
          t("paywall.restoreSuccessMsg"),
        );
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
  }, [syncSubscriptionAndClose, t]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header — RTL: close on right, title centered (in wrapper) */}
      <View
        className="flex-row items-center justify-between bg-white px-4 py-3 border-b border-slate-100 shadow-sm"
        style={rtlHeaderDirection}
      >
        <View className="w-10" />
        <View className="flex-1 items-center justify-center" style={rtlTitleWrapStyle}>
          <Text className="text-lg font-bold text-slate-900" style={rtlText}>
            {t("paywall.title")}
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-slate-100"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          accessibilityLabel={t("common.cancel")}
          accessibilityRole="button"
        >
          <X size={22} color="#64748b" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#ea580c" />
            <Text className="mt-3 text-sm text-slate-500" style={rtlText}>
              {t("paywall.loading")}
            </Text>
          </View>
        ) : (
          <>
            {/* Hero section — RTL: subtitle alignment */}
            <View className="mx-6 mt-8 mb-6 items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                <Crown size={32} color="#d97706" />
              </View>
              <Text className="text-center text-sm text-slate-500" style={rtlText}>
                {t("paywall.subtitle")}
              </Text>
            </View>

            {/* Benefits card — RTL: row direction, icon margin, text alignment */}
            <View className="mx-6 mb-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <Text className="mb-4 text-sm font-semibold text-slate-700" style={rtlText}>
                {t("paywall.benefitsTitle")}
              </Text>
              {[
                t("paywall.benefit1"),
                t("paywall.benefit2"),
                t("paywall.benefit3"),
              ].map((label, i) => (
                <View
                  key={i}
                  className="mb-4 flex-row items-center last:mb-0"
                  style={isRTL ? { direction: "rtl" as const } : undefined}
                >
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full bg-emerald-100"
                    style={isRTL ? { marginLeft: 16 } : { marginRight: 16 }}
                  >
                    <Check size={14} color="#16a34a" strokeWidth={3} />
                  </View>
                  <Text className="flex-1 text-sm text-slate-700" style={rtlText}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Subscribe CTA */}
            {selectedPackage ? (
              <View className="mx-6 mb-4">
                <Pressable
                  onPress={handlePurchase}
                  disabled={purchasing}
                  className="h-14 items-center justify-center rounded-2xl bg-orange-600 shadow-md active:shadow-sm"
                  style={({ pressed }) => ({
                    opacity: pressed || purchasing ? 0.9 : 1,
                  })}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-base font-bold text-white" style={rtlText}>
                      {t("paywall.subscribeFor", {
                        price: selectedPackage.product.priceString,
                        period: periodLabel,
                      })}
                    </Text>
                  )}
                </Pressable>
                <Text className="mt-3 text-center text-xs text-slate-400" style={rtlText}>
                  {renewalPriceLine}
                </Text>
                {introPriceLine ? (
                  <Text className="mt-2 text-center text-xs text-slate-400" style={rtlText}>
                    {introPriceLine}
                  </Text>
                ) : null}
                <Text className="mt-2 text-center text-xs text-slate-400" style={rtlText}>
                  {t("paywall.autoRenewDisclosure")}
                </Text>
                <Text className="mt-2 text-center text-xs text-slate-400" style={rtlText}>
                  {t("paywall.manageDisclosure")}
                </Text>
              </View>
            ) : configError ? (
              <View className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <Text className="mb-1 text-sm font-semibold text-amber-800" style={rtlText}>
                  {t("paywall.configErrorTitle")}
                </Text>
                <Text className="text-sm text-amber-700" style={rtlText}>
                  {t("paywall.configErrorMsg")}
                </Text>
              </View>
            ) : (
              !loading && (
                <Text className="mx-6 mb-6 text-center text-sm text-slate-500" style={rtlText}>
                  {t("paywall.noOffers")}
                </Text>
              )
            )}

            {/* Legal links — RTL: row direction */}
            <View
              className="mx-6 mb-2 flex-row items-center justify-center"
              style={isRTL ? { direction: "rtl" as const } : undefined}
            >
              <Pressable
                onPress={() => openUrl(termsOfUseUrl, t("paywall.termsOfUse"))}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-xs text-slate-500 underline" style={rtlText}>
                  {t("paywall.termsOfUse")}
                </Text>
              </Pressable>
              <Text className="mx-2 text-xs text-slate-400">|</Text>
              <Pressable
                onPress={() => openUrl(privacyPolicyUrl, t("paywall.privacyPolicy"))}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-xs text-slate-500 underline" style={rtlText}>
                  {t("paywall.privacyPolicy")}
                </Text>
              </Pressable>
            </View>

            {/* Restore */}
            <Pressable
              onPress={handleRestore}
              disabled={restoring}
              className="mx-6 h-12 items-center justify-center rounded-xl"
              style={({ pressed }) => ({
                opacity: pressed || restoring ? 0.7 : 1,
              })}
            >
              {restoring ? (
                <ActivityIndicator size="small" color="#64748b" />
              ) : (
                <Text className="text-sm font-medium text-slate-500 underline" style={rtlText}>
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
