"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Copy, ExternalLink, Flame, Heart, RefreshCw, ShoppingCart, UsersRound } from "lucide-react";
import { useRecipeProfile } from "@/components/recipe-profile-context";
import { RecipeImageFrame } from "@/components/recipe/recipe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  addRecipeIngredientToGroceryList,
  addRecipeIngredientsToGroceryList,
  findRecipeById,
  isRecipeSaved,
  removeSavedRecipe,
  upsertSavedRecipe
} from "@/lib/storage";
import type { RecipeIngredient, RecipeRecord, SavedRecipe } from "@/lib/schemas";
import { formatIngredientForCopy, getShoppingName, isKosherMeatSearch, shoppingLinksForIngredient } from "@/lib/shopping";
import { formatMinutes, titleCase } from "@/lib/utils";

type RecipeDetailClientProps = {
  id: string;
};

function recipeDetailNotes(notes: string) {
  return notes
    .replace(/,\s*and built from Walmart\/Wegmans-friendly ingredients with specialty kosher sourcing where it helps\.?/i, ".")
    .trim();
}

function recipeDetailStoreLinks(ingredient: RecipeIngredient) {
  const shoppingName = getShoppingName(ingredient);
  if (!isKosherMeatSearch(shoppingName)) return [];
  return shoppingLinksForIngredient(ingredient).filter((link) => link.store !== "walmart" && link.store !== "wegmans");
}

export function RecipeDetailClient({ id }: RecipeDetailClientProps) {
  const { selectedProfile } = useRecipeProfile();
  const [record, setRecord] = useState<RecipeRecord | SavedRecipe | undefined>();
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copiedItem, setCopiedItem] = useState("");
  const [groceryMessage, setGroceryMessage] = useState("");

  useEffect(() => {
    const found = findRecipeById(id);
    setRecord(found);
    setIsSaved(isRecipeSaved(id, selectedProfile.id));
    setLoaded(true);
  }, [id, selectedProfile.id]);

  const totalTime = useMemo(() => {
    if (!record) return 0;
    return record.recipe.prepTimeMinutes + record.recipe.cookTimeMinutes;
  }, [record]);

  function toggleIngredient(index: number) {
    setCheckedIngredients((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSave() {
    if (!record) return;
    const profileId = selectedProfile.id;
    if (isSaved) {
      removeSavedRecipe(record.id, profileId);
      setIsSaved(false);
      return;
    }
    upsertSavedRecipe({
      id: record.id,
      recipe: record.recipe,
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString(),
      imagePath: record.imagePath,
      profileId,
      source: record.source
    });
    setIsSaved(true);
  }

  function addGroceries() {
    if (!record) return;
    const result = addRecipeIngredientsToGroceryList(record, selectedProfile.id);
    setGroceryMessage(`Grocery list updated: ${result.added} added, ${result.updated} updated.`);
  }

  function addIngredient(ingredient: RecipeIngredient) {
    if (!record) return;
    const result = addRecipeIngredientToGroceryList(ingredient, record, selectedProfile.id);
    setGroceryMessage(`${ingredient.name} ${result.added ? "added to" : "updated in"} groceries.`);
  }

  async function copyText(text: string, copiedLabel: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(copiedLabel);
      window.setTimeout(() => setCopiedItem(""), 1800);
    } catch {
      setCopiedItem("");
    }
  }

  if (loaded && !record) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Recipe not found</CardTitle>
          <CardDescription>The local catalog and saved recipes do not have a recipe with this ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/find">Find a recipe</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!record) {
    return null;
  }

  const shoppingIngredients = record.recipe.ingredients.filter((ingredient) => !ingredient.pantryStaple);
  const pantryIngredients = record.recipe.ingredients.filter((ingredient) => ingredient.pantryStaple);
  const ingredientListText = record.recipe.ingredients.map(formatIngredientForCopy).join("\n");

  return (
    <article className="mx-auto max-w-[1900px] space-y-6">
      <Button asChild variant="ghost">
        <Link href="/">
          <ArrowLeft />
          Back
        </Link>
      </Button>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)] 2xl:gap-6">
        <RecipeImageFrame
          src={record.imagePath}
          alt=""
          width={640}
          height={480}
          priority
          data-testid="recipe-detail-image-frame"
          className="mx-auto w-full max-w-[38rem] self-start rounded-lg border bg-card shadow-soft xl:mx-0 xl:max-w-none"
        />

        <div
          data-testid="recipe-detail-summary-panel"
          className="self-start space-y-3 rounded-lg border bg-card/70 p-4 shadow-soft sm:p-5 xl:p-6"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{titleCase(record.recipe.kosherType)}</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl xl:text-[2.05rem]">{record.recipe.title}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{recipeDetailNotes(record.recipe.notes)}</p>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md border bg-background/70 p-2.5">
              <Clock className="mb-1 size-3.5 text-primary" />
              <p className="font-semibold">{formatMinutes(totalTime)}</p>
              <p className="text-muted-foreground">Total</p>
            </div>
            <div className="rounded-md border bg-background/70 p-2.5">
              <UsersRound className="mb-1 size-3.5 text-primary" />
              <p className="font-semibold">{record.recipe.servings}</p>
              <p className="text-muted-foreground">Servings</p>
            </div>
            <div className="rounded-md border bg-background/70 p-2.5">
              <Flame className="mb-1 size-3.5 text-primary" />
              <p className="font-semibold">
                {record.recipe.estimatedCaloriesPerServing ? `~${record.recipe.estimatedCaloriesPerServing}` : "n/a"}
              </p>
              <p className="text-muted-foreground">Cal/serving</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              onClick={toggleSave}
              variant={isSaved ? "default" : "outline"}
              aria-pressed={isSaved}
            >
              <Heart fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? "Favorited" : "Favorite"}
            </Button>
            <Button type="button" onClick={addGroceries} variant="outline">
              <ShoppingCart />
              Add all ingredients
            </Button>
            <Button asChild variant="outline">
              <Link href={`/generate?variation=${record.id}`}>
                <RefreshCw />
                Find variations
              </Link>
            </Button>
          </div>
          {groceryMessage ? (
            <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
              {groceryMessage}
            </div>
          ) : null}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            Shopping
          </CardTitle>
          <CardDescription>Add ingredients to groceries, with specialty kosher meat links where useful.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={() => copyText(ingredientListText, "full-list")}>
            <Copy />
            {copiedItem === "full-list" ? "Copied list" : "Copy full list"}
          </Button>

          <div className="space-y-3">
            {shoppingIngredients.map((ingredient, index) => {
              const links = recipeDetailStoreLinks(ingredient);
              const copyLabel = `ingredient-${index}`;
              const addLabel = `Add ${getShoppingName(ingredient)} to groceries`;

              return (
                <div key={`${ingredient.name}-shopping-${index}`} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{formatIngredientForCopy(ingredient)}</p>
                      {ingredient.substitutionNote ? <p className="text-xs text-muted-foreground">{ingredient.substitutionNote}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {links.map((link) => (
                        <Button key={`${ingredient.name}-${link.store}`} asChild variant="outline" size="sm">
                          <a href={link.href} target="_blank" rel="noreferrer">
                            {link.label}
                            <ExternalLink />
                          </a>
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11"
                        onClick={() => addIngredient(ingredient)}
                        aria-label={addLabel}
                        title="Add to groceries"
                      >
                        <ShoppingCart />
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => copyText(formatIngredientForCopy(ingredient), copyLabel)}>
                        <Copy />
                        {copiedItem === copyLabel ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {pantryIngredients.length > 0 ? (
            <div className="rounded-lg border bg-secondary/45 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Likely pantry staples</p>
              <p>{pantryIngredients.map(formatIngredientForCopy).join(", ")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <CardDescription>Tap items as you prep.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.recipe.ingredients.map((ingredient, index) => (
              <div key={`${ingredient.name}-${index}`} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox checked={checkedIngredients.has(index)} onCheckedChange={() => toggleIngredient(index)} aria-label={`Check ${ingredient.name}`} />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left focus-ring"
                  onClick={() => toggleIngredient(index)}
                >
                  <span className={checkedIngredients.has(index) ? "text-muted-foreground line-through" : ""}>
                    <span className="font-medium">{ingredient.quantity} {ingredient.unit}</span>{" "}
                    <span>{ingredient.name}</span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => addIngredient(ingredient)}
                  aria-label={`Add ${getShoppingName(ingredient)} to groceries`}
                  title="Add to groceries"
                >
                  <ShoppingCart />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
            <CardDescription>Prep {formatMinutes(record.recipe.prepTimeMinutes)}. Cook {formatMinutes(record.recipe.cookTimeMinutes)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {record.recipe.instructions.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="pt-1 leading-7">{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </article>
  );
}
