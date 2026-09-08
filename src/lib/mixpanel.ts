import { Mixpanel } from "mixpanel-react-native";

const TOKEN = "2a9150b97ea23dc338156aa8408bd575";

// Singleton instance
let _mp: Mixpanel | null = null;

export async function getMixpanel(): Promise<Mixpanel> {
  if (!_mp) {
    _mp = new Mixpanel(TOKEN, /* useNativeDeviceInfo */ true);
    await _mp.init();
  }
  return _mp;
}

// ─── Identity ────────────────────────────────────────────────────────────────

export async function identifyUser(
  userId: string,
  props?: { email?: string; name?: string; plan?: string }
) {
  const mp = await getMixpanel();
  mp.identify(userId);
  if (props) {
    mp.getPeople().set({
      ...(props.email && { $email: props.email }),
      ...(props.name && { $name: props.name }),
      ...(props.plan && { plan: props.plan }),
    });
  }
}

export async function resetUser() {
  const mp = await getMixpanel();
  mp.reset();
}

// ─── Generic track ────────────────────────────────────────────────────────────

export async function track(
  event: string,
  props?: Record<string, unknown>
) {
  const mp = await getMixpanel();
  mp.track(event, props ?? {});
}

// ─── Typed event catalogue ────────────────────────────────────────────────────

export const mp = {
  appOpened: (firstOpen: boolean) =>
    track("app_opened", { first_open: firstOpen }),

  screenViewed: (screenName: string) =>
    track("screen_viewed", { screen_name: screenName }),

  signupStarted: (method: "email" | "google" | "apple") =>
    track("signup_started", { method }),

  signupCompleted: (method: "email" | "google" | "apple", userId: string) =>
    track("signup_completed", { method, user_id: userId }),

  loginCompleted: (method: "email" | "google" | "apple", userId: string) =>
    track("login_completed", { method, user_id: userId }),

  analysisStarted: (source: "record" | "upload") =>
    track("analysis_started", { source }),

  analysisCompleted: (props: {
    duration_s?: number;
    swing_count?: number;
    tokens_used?: number;
  }) => track("analysis_completed", props),

  paywallViewed: () =>
    track("paywall_viewed"),

  subscriptionStarted: (plan: string) =>
    track("subscription_started", { plan }),

  subscriptionConfirmed: (plan: string, platform: "apple" | "google") =>
    track("subscription_confirmed", { plan, platform }),

  drillViewed: (drillId: string, topic: string) =>
    track("drill_viewed", { drill_id: drillId, topic }),

  videoUploaded: () =>
    track("video_uploaded"),
};
