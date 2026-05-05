import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalAuthBypassSession,
  firebaseConfigured,
  loadStoredSession,
  localAuthBypassEnabled,
  saveSessionToStorage,
  type FirebaseSession
} from "@/lib/firebase-sync";

const FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_KOSHERTABLE_LOCAL_AUTH_BYPASS"
] as const;

type FirebaseEnvKey = (typeof FIREBASE_ENV_KEYS)[number];

function stubFirebaseEnv(values: Partial<Record<FirebaseEnvKey, string>> = {}) {
  for (const key of FIREBASE_ENV_KEYS) {
    vi.stubEnv(key, "");
  }

  for (const [key, value] of Object.entries(values) as Array<[FirebaseEnvKey, string]>) {
    vi.stubEnv(key, value);
  }
}

describe("firebase sync helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    stubFirebaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps anonymous localStorage mode when Firebase env vars are missing", () => {
    expect(firebaseConfigured()).toBe(false);
  });

  it("requires a Google OAuth client ID for sync sign-in", () => {
    stubFirebaseEnv({
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "koshertable-prod"
    });

    expect(firebaseConfigured()).toBe(false);
  });

  it("detects configured Firebase public client settings", () => {
    stubFirebaseEnv({
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "koshertable-prod",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com"
    });

    expect(firebaseConfigured()).toBe(true);
  });

  it("enables an explicit localhost-only local auth bypass", () => {
    stubFirebaseEnv({
      NEXT_PUBLIC_KOSHERTABLE_LOCAL_AUTH_BYPASS: "true"
    });

    expect(firebaseConfigured()).toBe(false);
    expect(localAuthBypassEnabled()).toBe(true);
    expect(createLocalAuthBypassSession()).toMatchObject({
      idToken: "local-dev-auth-bypass",
      refreshToken: "local-dev-auth-bypass",
      user: {
        id: "local-dev",
        email: "local-dev@koshertable.local"
      }
    });
  });

  it("stores and restores a non-expired Firebase session without network refresh", async () => {
    const session: FirebaseSession = {
      idToken: "id-token",
      refreshToken: "refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "firebase-user-id",
        email: "jessica@example.com"
      }
    };

    saveSessionToStorage(session);

    await expect(loadStoredSession()).resolves.toEqual(session);
  });
});
