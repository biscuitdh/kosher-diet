import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firebaseConfigured, loadStoredSession, saveSessionToStorage, type FirebaseSession } from "@/lib/firebase-sync";

describe("firebase sync helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps anonymous localStorage mode when Firebase env vars are missing", () => {
    expect(firebaseConfigured()).toBe(false);
  });

  it("requires a Google OAuth client ID for sync sign-in", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "koshertable-prod");

    expect(firebaseConfigured()).toBe(false);
  });

  it("detects configured Firebase public client settings", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "koshertable-prod");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id.apps.googleusercontent.com");

    expect(firebaseConfigured()).toBe(true);
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
