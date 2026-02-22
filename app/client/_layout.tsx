import { Slot } from "expo-router";

export default function ClientLayout() {
  // Keep client routes in the parent router context to avoid first-render
  // nested navigator race conditions on fast taps.
  return <Slot />;
}
