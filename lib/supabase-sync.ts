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

export type SupabaseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: SyncUser;
};

export type SyncStatus = "offline" | "anonymous" | "syncing" | "synced" | "error";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type AuthUserResponse = {
  id?: unknown;
  email?: unknown;
};

type AuthTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  user?: AuthUserResponse;
};

type ProfileRow = {
  user_id: string;
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type FavoriteRow = {
  user_id: string;
  profile_id: string;
  recipe_id: string;
  record: unknown;
  updated_at: string;
};

type GroceryRow = {
  user_id: string;
  profile_id: string;
  item_id: string;
  ingredient_key: string;
  record: unknown;
  checked: boolean;
  updated_at: string;
};

type PreferenceRow = {
  user_id: string;
  selected_recipe_profile_id: string | null;
  updated_at: string;
};

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function config(): SupabaseConfig | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return undefined;
  return { url, anonKey };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeUser(value: AuthUserResponse | undefined): SyncUser | undefined {
  if (!value || typeof value.id !== "string") return undefined;
  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : undefined
  };
}

function parseTokenResponse(value: AuthTokenResponse): Omit<SupabaseSession, "user"> | undefined {
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") return undefined;
  const expiresAt =
    typeof value.expires_at === "number"
      ? value.expires_at
      : Math.floor(Date.now() / 1000) + (typeof value.expires_in === "number" ? value.expires_in : 3600);

  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt
  };
}

function readSessionFromStorage() {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.supabaseSession);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as SupabaseSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveSessionToStorage(session: SupabaseSession | undefined) {
  if (!isBrowser()) return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.supabaseSession);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.supabaseSession, JSON.stringify(session));
}

async function request<T>(path: string, init: RequestInit, session?: SupabaseSession): Promise<T> {
  const nextConfig = config();
  if (!nextConfig) throw new Error("Supabase is not configured.");
  const response = await fetch(`${nextConfig.url}${path}`, {
    ...init,
    headers: {
      apikey: nextConfig.anonKey,
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function getUser(session: Pick<SupabaseSession, "accessToken">): Promise<SyncUser> {
  const user = await request<AuthUserResponse>("/auth/v1/user", { method: "GET" }, session as SupabaseSession);
  const parsed = safeUser(user);
  if (!parsed) throw new Error("Supabase did not return a user.");
  return parsed;
}

export async function sendMagicLink(email: string) {
  const redirectTo = isBrowser() ? `${window.location.origin}/` : undefined;
  await request<void>("/auth/v1/otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
    })
  });
}

export async function consumeMagicLinkSessionFromUrl() {
  if (!isBrowser() || !window.location.hash.includes("access_token")) return undefined;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = parseTokenResponse({
    access_token: hash.get("access_token") ?? undefined,
    refresh_token: hash.get("refresh_token") ?? undefined,
    expires_at: hash.get("expires_at") ? Number(hash.get("expires_at")) : undefined,
    expires_in: hash.get("expires_in") ? Number(hash.get("expires_in")) : undefined
  });
  if (!token) return undefined;
  const user = await getUser(token);
  const session = { ...token, user };
  saveSessionToStorage(session);
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  return session;
}

export async function loadStoredSession() {
  const session = readSessionFromStorage();
  if (!session) return undefined;
  return refreshSessionIfNeeded(session);
}

export async function refreshSessionIfNeeded(session: SupabaseSession) {
  if (session.expiresAt - 60 > Math.floor(Date.now() / 1000)) return session;
  const token = await request<AuthTokenResponse>("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });
  const parsed = parseTokenResponse(token);
  const user = safeUser(token.user) ?? (parsed ? await getUser(parsed) : undefined);
  if (!parsed || !user) throw new Error("Could not refresh Supabase session.");
  const nextSession = { ...parsed, user };
  saveSessionToStorage(nextSession);
  return nextSession;
}

function profileRow(session: SupabaseSession, profile: RecipeProfile): ProfileRow {
  return {
    user_id: session.user.id,
    id: profile.id,
    name: profile.name,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };
}

function favoriteRow(session: SupabaseSession, recipe: SavedRecipe): FavoriteRow {
  return {
    user_id: session.user.id,
    profile_id: recipe.profileId,
    recipe_id: recipe.id,
    record: recipe,
    updated_at: recipe.updatedAt
  };
}

function groceryRow(session: SupabaseSession, item: GroceryListItem): GroceryRow {
  return {
    user_id: session.user.id,
    profile_id: item.profileId,
    item_id: item.id,
    ingredient_key: item.ingredientKey,
    record: item,
    checked: item.checked,
    updated_at: item.updatedAt
  };
}

function rowQuery(session: SupabaseSession) {
  return `user_id=eq.${encodeURIComponent(session.user.id)}`;
}

async function getRows<T>(session: SupabaseSession, table: string) {
  return request<T[]>(`/rest/v1/${table}?${rowQuery(session)}&select=*`, { method: "GET" }, session);
}

async function upsertRows<T>(session: SupabaseSession, table: string, rows: T[], conflict: string) {
  if (rows.length === 0) return;
  await request<void>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  }, session);
}

async function deleteRows(session: SupabaseSession, table: string, filters: string) {
  await request<void>(`/rest/v1/${table}?${rowQuery(session)}&${filters}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  }, session);
}

export async function fetchCloudSnapshot(session: SupabaseSession): Promise<LocalDataSnapshot> {
  const [profileRows, favoriteRows, groceryRows, preferenceRows] = await Promise.all([
    getRows<ProfileRow>(session, "koshertable_recipe_profiles"),
    getRows<FavoriteRow>(session, "koshertable_favorite_recipes"),
    getRows<GroceryRow>(session, "koshertable_grocery_items"),
    getRows<PreferenceRow>(session, "koshertable_user_preferences")
  ]);

  return {
    profiles: profileRows.flatMap((row) => {
      const parsed = recipeProfileSchema.safeParse({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
      return parsed.success ? [parsed.data] : [];
    }),
    selectedProfileId: preferenceRows[0]?.selected_recipe_profile_id ?? "",
    savedRecipes: favoriteRows.flatMap((row) => {
      const parsed = savedRecipeSchema.safeParse(row.record);
      return parsed.success ? [parsed.data] : [];
    }),
    groceryItems: groceryRows.flatMap((row) => {
      const parsed = groceryListItemSchema.safeParse(row.record);
      return parsed.success ? [parsed.data] : [];
    })
  };
}

export async function upsertCloudSnapshot(session: SupabaseSession, snapshot: LocalDataSnapshot) {
  const normalized = normalizeSnapshotToHousehold(snapshot);
  await Promise.all([
    upsertRows(session, "koshertable_recipe_profiles", normalized.profiles.map((profile) => profileRow(session, profile)), "user_id,id"),
    upsertRows(session, "koshertable_favorite_recipes", normalized.savedRecipes.map((recipe) => favoriteRow(session, recipe)), "user_id,profile_id,recipe_id"),
    upsertRows(session, "koshertable_grocery_items", normalized.groceryItems.map((item) => groceryRow(session, item)), "user_id,item_id"),
    upsertRows(
      session,
      "koshertable_user_preferences",
      [{
        user_id: session.user.id,
        selected_recipe_profile_id: DEFAULT_RECIPE_PROFILE.id,
        updated_at: new Date().toISOString()
      }],
      "user_id"
    )
  ]);
  await Promise.all([
    deleteRows(session, "koshertable_recipe_profiles", `id=neq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}`),
    deleteRows(session, "koshertable_favorite_recipes", `profile_id=neq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}`),
    deleteRows(session, "koshertable_grocery_items", `profile_id=neq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}`)
  ]);
}

export async function synchronizeLocalAndCloud(session: SupabaseSession) {
  const cloudSnapshot = await fetchCloudSnapshot(session);
  const mergedSnapshot = mergeLocalAndCloudSnapshots(loadLocalDataSnapshot(), cloudSnapshot);
  saveLocalDataSnapshot(mergedSnapshot);
  await upsertCloudSnapshot(session, mergedSnapshot);
  return mergedSnapshot;
}

export async function pushLocalChangeToCloud(session: SupabaseSession, detail: LocalDataChangeDetail) {
  const refreshedSession = await refreshSessionIfNeeded(session);
  if (refreshedSession !== session) saveSessionToStorage(refreshedSession);

  if (detail.type === "profiles-updated") {
    await upsertRows(
      refreshedSession,
      "koshertable_recipe_profiles",
      [profileRow(refreshedSession, DEFAULT_RECIPE_PROFILE)],
      "user_id,id"
    );
    return refreshedSession;
  }

  if (detail.type === "selected-profile") {
    await upsertRows(
      refreshedSession,
      "koshertable_user_preferences",
      [{
        user_id: refreshedSession.user.id,
        selected_recipe_profile_id: DEFAULT_RECIPE_PROFILE.id,
        updated_at: new Date().toISOString()
      }],
      "user_id"
    );
    return refreshedSession;
  }

  if (detail.type === "favorite-upsert") {
    await upsertRows(
      refreshedSession,
      "koshertable_favorite_recipes",
      [favoriteRow(refreshedSession, { ...detail.record, profileId: DEFAULT_RECIPE_PROFILE.id })],
      "user_id,profile_id,recipe_id"
    );
    return refreshedSession;
  }

  if (detail.type === "favorite-remove") {
    await deleteRows(
      refreshedSession,
      "koshertable_favorite_recipes",
      `profile_id=eq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}&recipe_id=eq.${encodeURIComponent(detail.id)}`
    );
    return refreshedSession;
  }

  if (detail.type === "grocery-upsert") {
    await upsertRows(
      refreshedSession,
      "koshertable_grocery_items",
      [groceryRow(refreshedSession, { ...detail.item, profileId: DEFAULT_RECIPE_PROFILE.id })],
      "user_id,item_id"
    );
    return refreshedSession;
  }

  if (detail.type === "grocery-remove") {
    await deleteRows(
      refreshedSession,
      "koshertable_grocery_items",
      `profile_id=eq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}&item_id=eq.${encodeURIComponent(detail.id)}`
    );
    return refreshedSession;
  }

  if (detail.type === "grocery-clear-checked") {
    await deleteRows(refreshedSession, "koshertable_grocery_items", `profile_id=eq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}&checked=eq.true`);
    return refreshedSession;
  }

  await deleteRows(refreshedSession, "koshertable_grocery_items", `profile_id=eq.${encodeURIComponent(DEFAULT_RECIPE_PROFILE.id)}`);
  return refreshedSession;
}
