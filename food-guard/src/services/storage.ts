import * as SQLite from "expo-sqlite";
import { createProfile, type Profile } from "@/types/Profile";
import type { ManualNote, Product } from "@/types/Product";
import type { ScanResult } from "@/types/ScanResult";

type FoodGuardDatabase = SQLite.SQLiteDatabase;

let databasePromise: Promise<FoodGuardDatabase> | null = null;

export async function getDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync("food_guard.db");
  return databasePromise;
}

export async function initStorage() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      product_barcode TEXT NOT NULL,
      profile_id TEXT,
      text TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const count = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM profiles");
  if ((count?.count ?? 0) === 0) {
    const profile = createProfile("Alex");
    await saveProfile(profile, true);
  }
}

export async function getProfiles() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data: string }>("SELECT data FROM profiles ORDER BY selected DESC, updated_at DESC");
  return rows.map((row) => JSON.parse(row.data) as Profile);
}

export async function getSelectedProfile() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM profiles WHERE selected = 1 LIMIT 1");
  if (row) return JSON.parse(row.data) as Profile;
  const profiles = await getProfiles();
  return profiles[0];
}

export async function saveProfile(profile: Profile, selected = false) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const nextProfile = { ...profile, updatedAt: now };

  if (selected) {
    await db.runAsync("UPDATE profiles SET selected = 0");
  }

  await db.runAsync(
    `INSERT INTO profiles (id, data, selected, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, selected = excluded.selected, updated_at = excluded.updated_at`,
    nextProfile.id,
    JSON.stringify(nextProfile),
    selected ? 1 : 0,
    now
  );

  return nextProfile;
}

export async function selectProfile(profileId: string) {
  const db = await getDatabase();
  await db.runAsync("UPDATE profiles SET selected = CASE WHEN id = ? THEN 1 ELSE 0 END", profileId);
}

export async function deleteProfile(profileId: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM profiles WHERE id = ?", profileId);
  const selected = await getSelectedProfile();
  if (!selected) {
    const profiles = await getProfiles();
    if (profiles[0]) await selectProfile(profiles[0].id);
  }
}

export async function saveProduct(product: Product, favorite?: boolean) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const previous = await getProduct(product.barcode);
  const favoriteValue = favorite === undefined ? await isFavorite(product.barcode) : favorite;
  const nextProduct: Product = {
    ...previous,
    ...product,
    manualNotes: product.manualNotes ?? previous?.manualNotes,
    updatedAt: now
  };

  await db.runAsync(
    `INSERT INTO products (barcode, data, favorite, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(barcode) DO UPDATE SET data = excluded.data, favorite = excluded.favorite, updated_at = excluded.updated_at`,
    product.barcode,
    JSON.stringify(nextProduct),
    favoriteValue ? 1 : 0,
    now
  );

  return nextProduct;
}

export async function getProduct(barcode: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM products WHERE barcode = ?", barcode);
  return row ? (JSON.parse(row.data) as Product) : undefined;
}

export async function listProducts() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data: string; favorite: number }>(
    "SELECT data, favorite FROM products ORDER BY updated_at DESC"
  );
  return rows.map((row) => ({
    product: JSON.parse(row.data) as Product,
    favorite: row.favorite === 1
  }));
}

export async function setFavorite(barcode: string, favorite: boolean) {
  const db = await getDatabase();
  await db.runAsync("UPDATE products SET favorite = ? WHERE barcode = ?", favorite ? 1 : 0, barcode);
}

export async function isFavorite(barcode: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ favorite: number }>("SELECT favorite FROM products WHERE barcode = ?", barcode);
  return row?.favorite === 1;
}

export async function saveScan(scan: ScanResult) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO scans (id, data, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
    scan.id,
    JSON.stringify(scan),
    scan.createdAt
  );
  return scan;
}

export async function getScan(scanId: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM scans WHERE id = ?", scanId);
  return row ? (JSON.parse(row.data) as ScanResult) : undefined;
}

export async function listScans(limit = 100) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data: string }>("SELECT data FROM scans ORDER BY created_at DESC LIMIT ?", limit);
  return rows.map((row) => JSON.parse(row.data) as ScanResult);
}

export async function saveManualNote(note: ManualNote) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO notes (id, product_barcode, profile_id, text, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET text = excluded.text, data = excluded.data, updated_at = excluded.updated_at`,
    note.id,
    note.productBarcode,
    note.profileId ?? null,
    note.text,
    JSON.stringify(note),
    note.createdAt,
    note.updatedAt
  );

  const product = await getProduct(note.productBarcode);
  if (product) {
    const existing = product.manualNotes?.filter((item) => item.id !== note.id) ?? [];
    await saveProduct({ ...product, manualNotes: [note, ...existing] });
  }

  return note;
}

export async function listManualNotes(productBarcode: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM notes WHERE product_barcode = ? ORDER BY created_at DESC",
    productBarcode
  );
  return rows.map((row) => JSON.parse(row.data) as ManualNote);
}

export function createManualNote(productBarcode: string, text: string, profileId?: string): ManualNote {
  const now = new Date().toISOString();
  return {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productBarcode,
    profileId,
    text,
    createdAt: now,
    updatedAt: now
  };
}
