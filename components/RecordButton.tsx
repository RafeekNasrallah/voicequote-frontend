import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { Mic, Square } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

interface RecordButtonProps {
  onRecordingComplete: (uri: string) => void;
}

export default function RecordButton({
  onRecordingComplete,
}: RecordButtonProps) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { t } = useTranslation();

  // expo-audio recorder hook
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const isRecording = recorderState.isRecording;

  // Timer state (manual since recorderState.durationMillis can be laggy)
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
    })();
  }, []);

  // Pulse animation
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Start pulsing when recording
  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withTiming(1.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.4, { duration: 200 });
    }
  }, [isRecording, pulseScale, pulseOpacity]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const startRecording = useCallback(async () => {
    try {
      if (!permissionGranted) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert(
            t("recording.permissionRequired"),
            t("recording.microphoneAccess")
          );
          return;
        }
        setPermissionGranted(true);
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert(t("recording.recordingError"), t("recording.failedToStart"));
    }
  }, [permissionGranted, audioRecorder, t]);

  const stopRecording = useCallback(async () => {
    try {
      await audioRecorder.stop();

      // Reset audio mode
      await setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = audioRecorder.uri;
      if (uri) {
        onRecordingComplete(uri);
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
      Alert.alert(t("recording.recordingError"), t("recording.failedToStop"));
    }
  }, [audioRecorder, onRecordingComplete, t]);

  const handlePress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <View className="items-center">
      {/* Pulse ring (behind button) */}
      <View className="relative items-center justify-center" style={{ width: 148, height: 148 }}>
        {isRecording && (
          <Animated.View
            style={[
              pulseStyle,
              {
                position: "absolute",
                width: 148,
                height: 148,
                borderRadius: 74,
                backgroundColor: "#ea580c",
              },
            ]}
          />
        )}

        {/* Main button */}
        <Pressable onPress={handlePress}>
          {({ pressed }) => (
            <View
              className={`h-32 w-32 items-center justify-center rounded-full ${
                isRecording ? "bg-orange-600" : "bg-slate-900"
              }`}
              style={{
                opacity: pressed ? 0.9 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              {isRecording ? (
                <Square size={40} color="#ffffff" fill="#ffffff" />
              ) : (
                <Mic size={44} color="#ffffff" />
              )}
            </View>
          )}
        </Pressable>
      </View>

      {/* Timer / Label */}
      <Text
        className={`mt-4 text-lg font-semibold ${
          isRecording ? "text-orange-600" : "text-slate-400"
        }`}
      >
        {isRecording ? formatTime(duration) : t("recording.tapToRecord")}
      </Text>
    </View>
  );
}
