"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Heart, ShoppingCart, Sparkles } from "lucide-react";
import { useRecipeProfile } from "@/components/recipe-profile-context";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addRecipeIngredientsToGroceryList, loadSavedRecipesForProfile, removeSavedRecipe } from "@/lib/storage";
import { CLOUD_DATA_LOADED_EVENT } from "@/lib/constants";
import type { SavedRecipe } from "@/lib/schemas";

export function FavoritesClient() {
  const { selectedProfile } = useRecipeProfile();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [groceryMessage, setGroceryMessage] = useState("");

  useEffect(() => {
    setSavedRecipes(loadSavedRecipesForProfile(selectedProfile.id));
    setGroceryMessage("");
  }, [selectedProfile.id]);

  useEffect(() => {
    function refreshFromCloud() {
      setSavedRecipes(loadSavedRecipesForProfile(selectedProfile.id));
    }

    window.addEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
    return () => window.removeEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
  }, [selectedProfile.id]);

  const handleUnfavorite = useCallback(
    (record: SavedRecipe) => {
      removeSavedRecipe(record.id, selectedProfile.id);
      setSavedRecipes(loadSavedRecipesForProfile(selectedProfile.id));
    },
    [selectedProfile.id]
  );

  const handleAddGroceries = useCallback(
    (record: SavedRecipe) => {
      const result = addRecipeIngredientsToGroceryList(record, selectedProfile.id);
      setGroceryMessage(`${record.recipe.title}: ${result.added} added, ${result.updated} updated in groceries.`);
    },
    [selectedProfile.id]
  );

  return (
    <div className="mx-auto max-w-[2200px] space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Favorites</h1>
          <p className="text-muted-foreground">Saved recipes appear here on every signed-in device.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/find">
            <BookOpen />
            Browse
          </Link>
        </Button>
      </div>

      {groceryMessage ? (
        <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
          {groceryMessage}
        </div>
      ) : null}

      {savedRecipes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7">
          {savedRecipes.map((record) => (
            <RecipeCard
              key={`${record.profileId}-${record.id}`}
              record={record}
              action={
                <div className="grid gap-2">
                  <Button type="button" variant="outline" className="w-full" onClick={() => handleAddGroceries(record)}>
                    <ShoppingCart />
                    Add groceries
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => handleUnfavorite(record)}>
                    <Heart fill="currentColor" />
                    Unfavorite
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-secondary">
              <Heart className="size-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No favorites yet</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Favorite recipes from the catalog and they will appear here.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/find">
                  <BookOpen />
                  Browse recipes
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  <Sparkles />
                  Find ideas
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
