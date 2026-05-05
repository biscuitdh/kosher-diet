"use client";

import { STORAGE_KEYS } from "@/lib/constants";
import { mergeLocalAndCloudSnapshots } from "@/lib/sync-merge";
import {
  DEFAULT_RECIPE_PROFILE,
  loadLocalDataSnapshot,
  normalizeSnapshotToHousehold,
  saveLocalDataSnapshot,
  type LocalDataChangeDetail,
  type LocalDataSnapshot
} from "@/lib/storage";
import {
  groceryListItemSchema,
  recipeProfileSchema,
  savedRecipeSchema,
  type GroceryListItem,
  type RecipeProfile,
  type SavedRecipe
} from "@/lib/schemas";

export type SyncUser = {
  id: string;
  email?: string;
};

export type FirebaseSession = {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  user: SyncUser;
};

export type SyncStatus = "offline" | "anonymous" | "syncing" | "synced" | "error";

type FirebaseConfig = {
  apiKey: string;
  projectId: string;
  googleClientId: string;
};

type FirebaseAuthResponse = {
  idToken?: unknown;
  refreshToken?: unknown;
  expiresIn?: unknown;
  localId?: unknown;
  email?: unknown;
};

type FirebaseRefreshResponse = {
  id_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  user_id?: unknown;
};

type FirestoreValue = { stringValue: string } | { booleanValue: boolean };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreListResponse = {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleIdentityServices = {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: unknown) => void;
      }) => GoogleTokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let googleIdentityServicesPromise: Promise<void> | undefined;

function isLocalhost() {
  if (!isBrowser()) return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function localAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_KOSHERTABLE_LOCAL_AUTH_BYPASS === "true"
    && isLocalhost();
}

export function createLocalAuthBypassSession(): FirebaseSession {
  return {
    idToken: "local-dev-auth-bypass",
    refreshToken: "local-dev-auth-bypass",
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: {
      id: "local-dev",
      email: "local-dev@koshertable.local"
    }
  };
}

export function firebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );
}

function config(): FirebaseConfig | undefined {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!apiKey || !projectId || !googleClientId) return undefined;
  return { apiKey, projectId, googleClientId };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authUrl(method: string) {
  const nextConfig = config();
  if (!nextConfig) throw new Error("Firebase is not configured.");
  return `https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(nextConfig.apiKey)}`;
}

function refreshUrl() {
  const nextConfig = config();
  if (!nextConfig) throw new Error("Firebase is not configured.");
  return `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(nextConfig.apiKey)}`;
}

function firestoreBaseUrl() {
  const nextConfig = config();
  if (!nextConfig) throw new Error("Firebase is not configured.");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(nextConfig.projectId)}/databases/(default)/documents`;
}

function pathSegment(value: string) {
  return encodeURIComponent(value.replaceAll("/", "-"));
}

function documentPathFromName(name: string) {
  const marker = "/documents/";
  const markerIndex = name.indexOf(marker);
  return markerIndex >= 0 ? `/${name.slice(markerIndex + marker.length)}` : `/${name}`;
}

async function parseError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}

async function authRequest<T>(method: string, body: unknown): Promise<T> {
  const response = await fetch(authUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await parseError(response, `Firebase Auth request failed with ${response.status}`));
  return (await response.json()) as T;
}

function loadGoogleIdentityServices() {
  if (!isBrowser()) throw new Error("Google sign-in requires a browser.");
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (googleIdentityServicesPromise) return googleIdentityServicesPromise;

  googleIdentityServicesPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-koshertable-google-identity]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Google sign-in.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.koshertableGoogleIdentity = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load Google sign-in.")), { once: true });
    document.head.appendChild(script);
  });

  return googleIdentityServicesPromise;
}

async function getGoogleAccessToken(googleClientId: string) {
  await loadGoogleIdentityServices();
  const tokenApi = window.google?.accounts?.oauth2;
  if (!tokenApi) throw new Error("Google sign-in did not initialize.");

  return new Promise<string>((resolve, reject) => {
    const client = tokenApi.initTokenClient({
      client_id: googleClientId,
      scope: "openid email profile",
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google did not return an access token."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Google sign-in was cancelled or blocked."))
    });

    client.requestAccessToken({ prompt: "select_account" });
  });
}

async function firestoreRequest<T>(path: string, init: RequestInit, session: FirebaseSession, options: { allowMissing?: boolean } = {}): Promise<T | undefined> {
  const response = await fetch(`${firestoreBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });

  if (response.status === 404 && options.allowMissing) return undefined;
  if (!response.ok) throw new Error(await parseError(response, `Firestore request failed with ${response.status}`));
  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : undefined;
}

function parseAuthResponse(value: FirebaseAuthResponse): FirebaseSession | undefined {
  if (typeof value.idToken !== "string" || typeof value.refreshToken !== "string" || typeof value.localId !== "string") return undefined;
  const expiresIn = typeof value.expiresIn === "string" ? Number(value.expiresIn) : 3600;
  return {
    idToken: value.idToken,
    refreshToken: value.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    user: {
      id: value.localId,
      email: typeof value.email === "string" ? normalizeEmail(value.email) : undefined
    }
  };
}

function parseRefreshResponse(value: FirebaseRefreshResponse, previous: FirebaseSession): FirebaseSession | undefined {
  if (typeof value.id_token !== "string" || typeof value.refresh_token !== "string") return undefined;
  const expiresIn = typeof value.expires_in === "string" ? Number(value.expires_in) : 3600;
  return {
    idToken: value.id_token,
    refreshToken: value.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    user: {
      id: typeof value.user_id === "string" ? value.user_id : previous.user.id,
      email: previous.user.email
    }
  };
}

function readSessionFromStorage() {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.firebaseSession);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as FirebaseSession;
    if (!parsed.idToken || !parsed.refreshToken || !parsed.user?.id) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveSessionToStorage(session: FirebaseSession | undefined) {
  if (!isBrowser()) return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.firebaseSession);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.firebaseSession, JSON.stringify(session));
}

export async function signInWithGoogle() {
  if (!isBrowser()) throw new Error("Google sign-in requires a browser.");
  const nextConfig = config();
  if (!nextConfig) throw new Error("Add Firebase and Google OAuth public config to enable sync.");
  const accessToken = await getGoogleAccessToken(nextConfig.googleClientId);
  const session = parseAuthResponse(await authRequest<FirebaseAuthResponse>("accounts:signInWithIdp", {
    postBody: new URLSearchParams({
      access_token: accessToken,
      providerId: "google.com"
    }).toString(),
    requestUri: window.location.origin,
    returnIdpCredential: true,
    returnSecureToken: true
  }));
  if (!session) throw new Error("Firebase did not return a usable Google session.");
  saveSessionToStorage(session);
  return session;
}

export async function loadStoredSession() {
  const session = readSessionFromStorage();
  if (!session) return undefined;
  return refreshSessionIfNeeded(session);
}

export async function refreshSessionIfNeeded(session: FirebaseSession) {
  if (session.expiresAt - 60 > Math.floor(Date.now() / 1000)) return session;
  const response = await fetch(refreshUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    })
  });
  if (!response.ok) throw new Error(await parseError(response, `Firebase token refresh failed with ${response.status}`));
  const nextSession = parseRefreshResponse(await response.json() as FirebaseRefreshResponse, session);
  if (!nextSession) throw new Error("Could not refresh Firebase session.");
  saveSessionToStorage(nextSession);
  return nextSession;
}

function stringField(value: string): FirestoreValue {
  return { stringValue: value };
}

function booleanField(value: boolean): FirestoreValue {
  return { booleanValue: value };
}

function readStringField(document: FirestoreDocument, key: string) {
  const value = document.fields?.[key];
  return value && "stringValue" in value ? value.stringValue : undefined;
}

function readBooleanField(document: FirestoreDocument, key: string) {
  const value = document.fields?.[key];
  return value && "booleanValue" in value ? value.booleanValue : undefined;
}

function profileDocument(profile: RecipeProfile): FirestoreDocument {
  return {
    fields: {
      id: stringField(profile.id),
      name: stringField(profile.name),
      createdAt: stringField(profile.createdAt),
      updatedAt: stringField(profile.updatedAt)
    }
  };
}

function favoriteDocument(recipe: SavedRecipe): FirestoreDocument {
  return {
    fields: {
      profileId: stringField(recipe.profileId),
      recipeId: stringField(recipe.id),
      recordJson: stringField(JSON.stringify(recipe)),
      updatedAt: stringField(recipe.updatedAt)
    }
  };
}

function groceryDocument(item: GroceryListItem): FirestoreDocument {
  return {
    fields: {
      profileId: stringField(item.profileId),
      itemId: stringField(item.id),
      ingredientKey: stringField(item.ingredientKey),
      recordJson: stringField(JSON.stringify(item)),
      checked: booleanField(item.checked),
      updatedAt: stringField(item.updatedAt)
    }
  };
}

function preferenceDocument() {
  return {
    fields: {
      selectedRecipeProfileId: stringField(DEFAULT_RECIPE_PROFILE.id),
      updatedAt: stringField(new Date().toISOString())
    }
  };
}

function parseProfileDocument(document: FirestoreDocument) {
  const parsed = recipeProfileSchema.safeParse({
    id: readStringField(document, "id"),
    name: readStringField(document, "name"),
    createdAt: readStringField(document, "createdAt"),
    updatedAt: readStringField(document, "updatedAt")
  });
  return parsed.success ? parsed.data : undefined;
}

function parseFavoriteDocument(document: FirestoreDocument) {
  const recordJson = readStringField(document, "recordJson");
  if (!recordJson) return undefined;
  try {
    const parsed = savedRecipeSchema.safeParse(JSON.parse(recordJson));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function parseGroceryDocument(document: FirestoreDocument) {
  const recordJson = readStringField(document, "recordJson");
  if (!recordJson) return undefined;
  try {
    const parsed = groceryListItemSchema.safeParse(JSON.parse(recordJson));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function assertAllowed(session: FirebaseSession) {
  const email = session.user.email;
  if (!email) throw new Error("Firebase account email is missing.");
  const allowed = await firestoreRequest<FirestoreDocument>(`/allowed_users/${pathSegment(email)}`, { method: "GET" }, session, { allowMissing: true });
  if (!allowed) throw new Error("This email is not on the KosherTable access list.");
}

async function listCollection(session: FirebaseSession, collectionPath: string) {
  const documents: FirestoreDocument[] = [];
  let pageToken = "";
  do {
    const separator = collectionPath.includes("?") ? "&" : "?";
    const pageQuery = pageToken ? `${separator}pageToken=${encodeURIComponent(pageToken)}` : "";
    const response = await firestoreRequest<FirestoreListResponse>(`${collectionPath}${pageQuery}`, { method: "GET" }, session);
    documents.push(...(response?.documents ?? []));
    pageToken = response?.nextPageToken ?? "";
  } while (pageToken);
  return documents;
}

async function patchDocument(session: FirebaseSession, documentPath: string, document: FirestoreDocument) {
  await firestoreRequest<void>(documentPath, {
    method: "PATCH",
    body: JSON.stringify(document)
  }, session);
}

async function deleteDocument(session: FirebaseSession, documentPath: string) {
  await firestoreRequest<void>(documentPath, { method: "DELETE" }, session, { allowMissing: true });
}

async function listGroceryDocuments(session: FirebaseSession) {
  return listCollection(session, "/households/default/groceryItems?pageSize=300");
}

export async function fetchCloudSnapshot(session: FirebaseSession): Promise<LocalDataSnapshot> {
  const refreshedSession = await refreshSessionIfNeeded(session);
  await assertAllowed(refreshedSession);
  const [profileDocuments, favoriteDocuments, groceryDocuments, preferenceDocuments] = await Promise.all([
    listCollection(refreshedSession, "/households/default/profiles?pageSize=20"),
    listCollection(refreshedSession, "/households/default/favorites?pageSize=150"),
    listCollection(refreshedSession, "/households/default/groceryItems?pageSize=300"),
    listCollection(refreshedSession, "/households/default/preferences?pageSize=5")
  ]);

  return {
    profiles: profileDocuments.flatMap((document) => {
      const profile = parseProfileDocument(document);
      return profile ? [profile] : [];
    }),
    selectedProfileId: readStringField(preferenceDocuments[0] ?? {}, "selectedRecipeProfileId") ?? "",
    savedRecipes: favoriteDocuments.flatMap((document) => {
      const recipe = parseFavoriteDocument(document);
      return recipe ? [recipe] : [];
    }),
    groceryItems: groceryDocuments.flatMap((document) => {
      const item = parseGroceryDocument(document);
      return item ? [item] : [];
    })
  };
}

export async function upsertCloudSnapshot(session: FirebaseSession, snapshot: LocalDataSnapshot) {
  const refreshedSession = await refreshSessionIfNeeded(session);
  await assertAllowed(refreshedSession);
  const normalized = normalizeSnapshotToHousehold(snapshot);
  await Promise.all([
    ...normalized.profiles.map((profile) => patchDocument(refreshedSession, `/households/default/profiles/${pathSegment(profile.id)}`, profileDocument(profile))),
    ...normalized.savedRecipes.map((recipe) => patchDocument(refreshedSession, `/households/default/favorites/${pathSegment(recipe.id)}`, favoriteDocument(recipe))),
    ...normalized.groceryItems.map((item) => patchDocument(refreshedSession, `/households/default/groceryItems/${pathSegment(item.id)}`, groceryDocument(item))),
    patchDocument(refreshedSession, "/households/default/preferences/current", preferenceDocument())
  ]);
}

export async function synchronizeLocalAndCloud(session: FirebaseSession) {
  const cloudSnapshot = await fetchCloudSnapshot(session);
  const mergedSnapshot = mergeLocalAndCloudSnapshots(loadLocalDataSnapshot(), cloudSnapshot);
  saveLocalDataSnapshot(mergedSnapshot);
  await upsertCloudSnapshot(session, mergedSnapshot);
  return mergedSnapshot;
}

export async function pushLocalChangeToCloud(session: FirebaseSession, detail: LocalDataChangeDetail) {
  const refreshedSession = await refreshSessionIfNeeded(session);
  if (refreshedSession !== session) saveSessionToStorage(refreshedSession);
  await assertAllowed(refreshedSession);

  if (detail.type === "profiles-updated" || detail.type === "selected-profile") {
    await Promise.all([
      patchDocument(refreshedSession, `/households/default/profiles/${pathSegment(DEFAULT_RECIPE_PROFILE.id)}`, profileDocument(DEFAULT_RECIPE_PROFILE)),
      patchDocument(refreshedSession, "/households/default/preferences/current", preferenceDocument())
    ]);
    return refreshedSession;
  }

  if (detail.type === "favorite-upsert") {
    const record = { ...detail.record, profileId: DEFAULT_RECIPE_PROFILE.id };
    await patchDocument(refreshedSession, `/households/default/favorites/${pathSegment(record.id)}`, favoriteDocument(record));
    return refreshedSession;
  }

  if (detail.type === "favorite-remove") {
    await deleteDocument(refreshedSession, `/households/default/favorites/${pathSegment(detail.id)}`);
    return refreshedSession;
  }

  if (detail.type === "grocery-upsert") {
    const item = { ...detail.item, profileId: DEFAULT_RECIPE_PROFILE.id };
    await patchDocument(refreshedSession, `/households/default/groceryItems/${pathSegment(item.id)}`, groceryDocument(item));
    return refreshedSession;
  }

  if (detail.type === "grocery-remove") {
    await deleteDocument(refreshedSession, `/households/default/groceryItems/${pathSegment(detail.id)}`);
    return refreshedSession;
  }

  if (detail.type === "grocery-clear-checked") {
    const removedIds = new Set(detail.ids ?? []);
    const removedIngredientKeys = new Set(detail.ingredientKeys ?? []);
    const documents = await listGroceryDocuments(refreshedSession);
    await Promise.all(
      documents
        .filter((document) => {
          const itemId = readStringField(document, "itemId") ?? "";
          const ingredientKey = readStringField(document, "ingredientKey") ?? "";
          return readBooleanField(document, "checked") || removedIds.has(itemId) || removedIngredientKeys.has(ingredientKey);
        })
        .map((document) => document.name ? deleteDocument(refreshedSession, documentPathFromName(document.name)) : Promise.resolve())
    );
    return refreshedSession;
  }

  const documents = await listGroceryDocuments(refreshedSession);
  await Promise.all(documents.map((document) => document.name ? deleteDocument(refreshedSession, documentPathFromName(document.name)) : Promise.resolve()));
  return refreshedSession;
}
