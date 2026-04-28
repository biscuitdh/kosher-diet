import type { Metadata } from "next";
import { FavoritesClient } from "@/components/favorites-client";

export const metadata: Metadata = {
  title: "Favorites"
};

export default function FavoritesPage() {
  return <FavoritesClient />;
}
