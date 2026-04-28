import type { Metadata } from "next";
import { GroceryListClient } from "@/components/grocery-list-client";

export const metadata: Metadata = {
  title: "Groceries"
};

export default function GroceriesPage() {
  return <GroceryListClient />;
}
