import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface SkeletonProps {
  width?: number | `${number}%` | "auto";
  height?: number;
  borderRadius?: number;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  className = "",
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "#e2e8f0",
        opacity,
      }}
    />
  );
}

export function QuoteCardSkeleton() {
  return (
    <View className="mb-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">
      <View className="flex-row items-center justify-between">
        <Skeleton width="60%" height={18} borderRadius={6} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
      <View className="mt-3 flex-row items-center">
        <Skeleton width={80} height={14} borderRadius={4} />
        <View style={{ marginLeft: 12 }}>
          <Skeleton width={60} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export function ClientCardSkeleton() {
  return (
    <View className="mb-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">
      <View className="flex-row items-center">
        <Skeleton width={44} height={44} borderRadius={22} />
        <View className="ml-3 flex-1">
          <Skeleton width="50%" height={16} borderRadius={4} />
          <View style={{ marginTop: 6 }}>
            <Skeleton width="70%" height={12} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function QuotesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <QuoteCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ClientsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ClientCardSkeleton key={i} />
      ))}
    </View>
  );
}
