"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Heart, ShoppingCart, Sparkles } from "lucide-react";
import { RecipeProfileSelector } from "@/components/recipe-profile-selector";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addRecipeIngredientsToGroceryList, getSelectedRecipeProfile, loadSavedRecipesForProfile, removeSavedRecipe } from "@/lib/storage";
import type { RecipeProfile, SavedRecipe } from "@/lib/schemas";

export function FavoritesClient() {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<RecipeProfile | undefined>();
  const [groceryMessage, setGroceryMessage] = useState("");

  useEffect(() => {
    const profile = getSelectedRecipeProfile();
    setSelectedProfile(profile);
    setSavedRecipes(loadSavedRecipesForProfile(profile.id));
  }, []);

  const handleProfileChange = useCallback((profile: RecipeProfile) => {
    setSelectedProfile(profile);
    setSavedRecipes(loadSavedRecipesForProfile(profile.id));
    setGroceryMessage("");
  }, []);

  const handleUnfavorite = useCallback(
    (record: SavedRecipe) => {
      const profileId = selectedProfile?.id;
      if (!profileId) return;
      removeSavedRecipe(record.id, profileId);
      setSavedRecipes(loadSavedRecipesForProfile(profileId));
    },
    [selectedProfile?.id]
  );

  const handleAddGroceries = useCallback(
    (record: SavedRecipe) => {
      const profileId = selectedProfile?.id;
      if (!profileId) return;
      const result = addRecipeIngredientsToGroceryList(record, profileId);
      setGroceryMessage(`${record.recipe.title}: ${result.added} added, ${result.updated} updated in groceries.`);
    },
    [selectedProfile?.id]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Favorites</h1>
          <p className="text-muted-foreground">
            Saved recipes for {selectedProfile?.name ?? "the active profile"}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/find">
            <BookOpen />
            Browse
          </Link>
        </Button>
      </div>

      <RecipeProfileSelector onProfileChange={handleProfileChange} />

      {groceryMessage ? (
        <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
          {groceryMessage}
        </div>
      ) : null}

      {savedRecipes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                Favorite recipes from the catalog and they will appear here for this profile.
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
