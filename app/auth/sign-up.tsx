import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Mail, Lock, Eye, EyeOff, User, ShieldCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const { t } = useTranslation();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Step 1: Create the sign-up
  const handleSignUp = useCallback(async () => {
    if (!isLoaded) return;

    if (!email.trim() || !password.trim()) {
      Alert.alert(t("auth.missingFields"), t("auth.enterEmailPassword"));
      return;
    }

    setIsLoading(true);
    try {
      await signUp.create({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        emailAddress: email.trim(),
        password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Move to verification step
      setPendingVerification(true);
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        t("auth.signUpError");
      Alert.alert(t("auth.signUpFailed"), message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, firstName, lastName, email, password, signUp, t]);

  // Step 2: Verify the email code
  const handleVerifyCode = useCallback(async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      Alert.alert(t("auth.missingCode"), t("auth.enterVerificationCode"));
      return;
    }

    setIsVerifying(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      } else {
        console.warn("Verification not complete:", result.status);
        Alert.alert(t("auth.verificationIssue"), t("auth.verificationIssueMsg"));
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        t("auth.invalidCode");
      Alert.alert(t("auth.verificationFailed"), message);
    } finally {
      setIsVerifying(false);
    }
  }, [isLoaded, code, signUp, setActive, t]);

  // Resend the verification code
  const handleResendCode = useCallback(async () => {
    if (!isLoaded) return;

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      Alert.alert(t("auth.codeSent"), t("auth.codeSentMsg"));
    } catch (err: any) {
      Alert.alert(t("common.error"), t("auth.resendFailed"));
    }
  }, [isLoaded, signUp, t]);

  // ─── Verification Code Screen ─────────────────────────────
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center justify-center px-6 py-12">
            <View className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8">
              {/* Icon */}
              <View className="items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <ShieldCheck size={32} color="#ea580c" />
                </View>
              </View>

              {/* Title */}
              <Text className="mt-4 text-center text-2xl font-bold text-slate-900">
                {t("auth.checkEmail")}
              </Text>
              <Text className="mt-2 text-center text-sm text-slate-500">
                {t("auth.verificationSent")}{"\n"}
                <Text className="font-semibold text-slate-700">{email}</Text>
              </Text>

              {/* Code Input */}
              <View className="mt-8">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">
                  {t("auth.verificationCode")}
                </Text>
                <TextInput
                  className="h-14 rounded-lg border border-slate-200 bg-white px-4 text-center text-2xl font-bold tracking-widest text-slate-900"
                  placeholder="000000"
                  placeholderTextColor="#cbd5e1"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isVerifying}
                />
              </View>

              {/* Verify Button — app primary orange */}
              <Pressable
                className="mt-6 h-12 items-center justify-center rounded-lg bg-orange-600"
                onPress={handleVerifyCode}
                disabled={isVerifying}
                style={({ pressed }) => ({
                  opacity: pressed || isVerifying ? 0.9 : 1,
                })}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t("auth.verifyEmail")}
                  </Text>
                )}
              </Pressable>

              {/* Resend */}
              <View className="mt-4 flex-row items-center justify-center">
                <Text className="text-sm text-slate-500">
                  {t("auth.didntReceiveCode")}{" "}
                </Text>
                <Pressable onPress={handleResendCode}>
                  <Text className="text-sm font-semibold text-orange-600">
                    {t("auth.resend")}
                  </Text>
                </Pressable>
              </View>

              {/* Back */}
              <Pressable
                className="mt-4 items-center"
                onPress={() => setPendingVerification(false)}
              >
                <Text className="text-sm text-slate-400">
                  {t("auth.backToSignUp")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Sign Up Form Screen ──────────────────────────────────
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8">
            {/* Logo */}
            <Text className="text-center text-3xl font-bold text-slate-900">
              {t("common.appName")}
            </Text>
            <Text className="mt-1 text-center text-sm font-medium text-orange-600">
              {t("auth.createAccount")}
            </Text>

            {/* Name Row */}
            <View className="mt-8 flex-row gap-3">
              {/* First Name */}
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">
                  {t("auth.firstName")}
                </Text>
                <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-4 h-12">
                  <User size={18} color="#ea580c" />
                  <TextInput
                    className="ml-3 flex-1 text-base text-slate-900"
                    placeholder={t("auth.firstNamePlaceholder")}
                    placeholderTextColor="#94a3b8"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Last Name */}
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">
                  {t("auth.lastName")}
                </Text>
                <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-3 h-12">
                  <TextInput
                    className="flex-1 text-base text-slate-900"
                    placeholder={t("auth.lastNamePlaceholder")}
                    placeholderTextColor="#94a3b8"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              </View>
            </View>

            {/* Email Input */}
            <View className="mt-4">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">
                {t("auth.email")}
              </Text>
              <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-4 h-12">
                <Mail size={18} color="#ea580c" />
                <TextInput
                  className="ml-3 flex-1 text-base text-slate-900"
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mt-4">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">
                {t("auth.password")}
              </Text>
              <View className="flex-row items-center rounded-lg border border-slate-200 bg-white px-4 h-12">
                <Lock size={18} color="#ea580c" />
                <TextInput
                  className="ml-3 flex-1 text-base text-slate-900"
                  placeholder={t("auth.createPasswordPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                  accessibilityLabel={t("auth.password")}
                  accessibilityRole="button"
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94a3b8" />
                  ) : (
                    <Eye size={18} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Sign Up Button — app primary orange */}
            <Pressable
              className="mt-6 h-12 items-center justify-center rounded-lg bg-orange-600"
              onPress={handleSignUp}
              disabled={isLoading}
              style={({ pressed }) => ({
                opacity: pressed || isLoading ? 0.9 : 1,
              })}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {t("auth.createAccountBtn")}
                </Text>
              )}
            </Pressable>

            {/* Sign In Link */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-sm text-slate-500">
                {t("auth.hasAccount")}{" "}
              </Text>
              <Pressable onPress={() => router.back()}>
                <Text className="text-sm font-semibold text-orange-600">
                  {t("auth.signIn")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
