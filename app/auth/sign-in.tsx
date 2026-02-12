import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

// Required for OAuth session completion on web
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Warm up the browser for OAuth
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  // Email/Password sign in
  const handleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    if (!email.trim() || !password.trim()) {
      Alert.alert(t("auth.missingFields"), t("auth.enterEmailPassword"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      } else {
        console.warn("Sign in not complete:", result.status);
        Alert.alert(t("auth.signInIssue"), t("auth.signInIssueMsg"));
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        t("auth.signInError");
      Alert.alert(t("auth.signInFailed"), message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, email, password, signIn, setActive, t]);

  // Google OAuth sign in
  const handleGoogleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setIsGoogleLoading(true);
    try {
      const { createdSessionId, setActive: ssoSetActive } =
        await startSSOFlow({
          strategy: "oauth_google",
        });

      if (createdSessionId) {
        await ssoSetActive!({ session: createdSessionId });
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        t("auth.googleSignInError");
      Alert.alert(t("auth.googleSignInFailed"), message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [isLoaded, startSSOFlow, t]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 items-center justify-center px-6 py-12">
          {/* Card Container */}
          <View className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm border border-slate-100">
            {/* Logo */}
            <Text className="text-center text-3xl font-bold text-slate-900">
              {t("common.appName")}
            </Text>

            {/* Title */}
            <Text className="mt-2 text-center text-base text-slate-500">
              {t("auth.welcomeBack")}
            </Text>

            {/* Email Input */}
            <View className="mt-8">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">
                {t("auth.email")}
              </Text>
              <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-4 h-12">
                <Mail size={18} color="#94a3b8" />
                <TextInput
                  className="ml-3 flex-1 text-base text-slate-900"
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!isLoading && !isGoogleLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mt-4">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">
                {t("auth.password")}
              </Text>
              <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-4 h-12">
                <Lock size={18} color="#94a3b8" />
                <TextInput
                  className="ml-3 flex-1 text-base text-slate-900"
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading && !isGoogleLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94a3b8" />
                  ) : (
                    <Eye size={18} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Sign In Button */}
            <Pressable
              className="mt-6 h-12 items-center justify-center rounded-lg bg-slate-900"
              onPress={handleSignIn}
              disabled={isLoading || isGoogleLoading}
              style={({ pressed }) => ({
                opacity: pressed || isLoading ? 0.8 : 1,
              })}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {t("auth.signIn")}
                </Text>
              )}
            </Pressable>

            {/* Divider */}
            <View className="my-6 flex-row items-center">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="mx-4 text-sm text-slate-400">{t("common.or")}</Text>
              <View className="flex-1 h-px bg-slate-200" />
            </View>

            {/* Google Sign In */}
            <Pressable
              className="h-12 flex-row items-center justify-center rounded-lg border border-slate-200 bg-white"
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              style={({ pressed }) => ({
                opacity: pressed || isGoogleLoading ? 0.8 : 1,
              })}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <Text className="text-lg font-bold text-slate-600">G</Text>
                  <Text className="ml-2 text-base font-semibold text-slate-700">
                    {t("auth.signInWithGoogle")}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Sign Up Link */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-sm text-slate-500">
                {t("auth.noAccount")}{" "}
              </Text>
              <Pressable onPress={() => router.push("/auth/sign-up")}>
                <Text className="text-sm font-semibold text-slate-900">
                  {t("auth.signUp")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
