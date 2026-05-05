"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCAL_DATA_CHANGED_EVENT } from "@/lib/constants";
import {
  DEFAULT_RECIPE_PROFILE,
  emitCloudDataLoaded,
  getSelectedRecipeProfile,
  normalizeStoredHouseholdData,
  type LocalDataChangeDetail
} from "@/lib/storage";
import {
  createLocalAuthBypassSession,
  firebaseConfigured,
  loadStoredSession,
  localAuthBypassEnabled,
  pushLocalChangeToCloud,
  saveSessionToStorage,
  signInWithGoogle,
  synchronizeLocalAndCloud,
  type FirebaseSession,
  type SyncStatus
} from "@/lib/firebase-sync";
import type { RecipeProfile } from "@/lib/schemas";

type RecipeProfileContextValue = {
  selectedProfile: RecipeProfile;
  refreshProfiles: () => void;
  syncConfigured: boolean;
  syncStatus: SyncStatus;
  syncError: string;
  session: FirebaseSession | undefined;
  signInWithGoogleAccount: () => Promise<void>;
  signOut: () => void;
};

const RecipeProfileContext = createContext<RecipeProfileContextValue | undefined>(undefined);

export function RecipeProfileProvider({ children }: { children: ReactNode }) {
  const [selectedProfile, setSelectedProfile] = useState<RecipeProfile>(DEFAULT_RECIPE_PROFILE);
  const [localAuthBypass, setLocalAuthBypass] = useState(false);
  const [session, setSession] = useState<FirebaseSession | undefined>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseConfigured() ? "syncing" : "offline");
  const [syncError, setSyncError] = useState("");
  const syncConfigured = localAuthBypass ? false : firebaseConfigured();

  const refreshProfiles = useCallback(() => {
    normalizeStoredHouseholdData();
    const selected = getSelectedRecipeProfile();
    setSelectedProfile(selected);
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  useEffect(() => {
    const enabled = localAuthBypassEnabled();
    setLocalAuthBypass(enabled);
    if (!enabled) return;
    setSession(createLocalAuthBypassSession());
    setSyncStatus("synced");
    setSyncError("");
  }, []);

  const synchronize = useCallback(
    async (nextSession: FirebaseSession) => {
      setSyncStatus("syncing");
      setSyncError("");
      try {
        await synchronizeLocalAndCloud(nextSession);
        refreshProfiles();
        setSyncStatus("synced");
        return true;
      } catch (error) {
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "Could not sync account data.");
        saveSessionToStorage(undefined);
        setSession(undefined);
        return false;
      }
    },
    [refreshProfiles]
  );

  useEffect(() => {
    if (localAuthBypassEnabled()) return;
    if (!syncConfigured) return;
    let cancelled = false;

    async function loadSession() {
      setSyncStatus("syncing");
      try {
        const storedSession = await loadStoredSession();
        if (cancelled) return;
        if (!storedSession) {
          setSyncStatus("anonymous");
          return;
        }
        const synchronized = await synchronize(storedSession);
        if (cancelled) return;
        if (synchronized) setSession(storedSession);
      } catch (error) {
        if (cancelled) return;
        saveSessionToStorage(undefined);
        setSession(undefined);
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "Could not restore Firebase session.");
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [syncConfigured, synchronize]);

  useEffect(() => {
    if (!session || !syncConfigured) return;
    const activeSession = session;

    function syncLocalChange(event: Event) {
      const detail = (event as CustomEvent<LocalDataChangeDetail>).detail;
      if (!detail) return;
      void pushLocalChangeToCloud(activeSession, detail)
        .then((nextSession) => {
          if (nextSession !== activeSession) setSession(nextSession);
          setSyncStatus("synced");
        })
        .catch((error) => {
          setSyncStatus("error");
          setSyncError(error instanceof Error ? error.message : "Could not sync the latest change.");
        });
    }

    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, syncLocalChange);
    return () => window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, syncLocalChange);
  }, [session, syncConfigured]);

  const signInWithGoogleAccount = useCallback(
    async () => {
      if (localAuthBypass) {
        setSession(createLocalAuthBypassSession());
        setSyncStatus("synced");
        setSyncError("");
        return;
      }
      if (!syncConfigured) {
        setSyncStatus("offline");
        setSyncError("Add Firebase config and NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable sync.");
        return;
      }
      setSyncStatus("syncing");
      setSyncError("");
      try {
        const nextSession = await signInWithGoogle();
        const synchronized = await synchronize(nextSession);
        if (synchronized) {
          setSession(nextSession);
        } else {
          saveSessionToStorage(undefined);
          setSession(undefined);
        }
      } catch (error) {
        saveSessionToStorage(undefined);
        setSession(undefined);
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "Could not sign in with Google.");
      }
    },
    [localAuthBypass, syncConfigured, synchronize]
  );

  const signOut = useCallback(() => {
    saveSessionToStorage(undefined);
    if (localAuthBypass) {
      setSession(createLocalAuthBypassSession());
      setSyncStatus("synced");
      setSyncError("");
      refreshProfiles();
      emitCloudDataLoaded();
      return;
    }
    setSession(undefined);
    setSyncStatus(syncConfigured ? "anonymous" : "offline");
    setSyncError("");
    refreshProfiles();
    emitCloudDataLoaded();
  }, [localAuthBypass, refreshProfiles, syncConfigured]);

  const value = useMemo(
    () => ({
      selectedProfile,
      refreshProfiles,
      syncConfigured,
      syncStatus,
      syncError,
      session,
      signInWithGoogleAccount,
      signOut
    }),
    [refreshProfiles, selectedProfile, session, signInWithGoogleAccount, signOut, syncConfigured, syncError, syncStatus]
  );

  return createElement(RecipeProfileContext.Provider, { value }, children);
}

export function useRecipeProfile() {
  const value = useContext(RecipeProfileContext);
  if (!value) throw new Error("useRecipeProfile must be used within RecipeProfileProvider");
  return value;
}
