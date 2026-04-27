"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Flame, RefreshCw, Save, ShoppingCart, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { withBasePath } from "@/lib/assets";
import { findRecipeById, loadSavedRecipes, removeSavedRecipe, upsertSavedRecipe } from "@/lib/storage";
import type { RecipeRecord, SavedRecipe } from "@/lib/schemas";
import { formatIngredientForCopy, shoppingLinksForIngredient } from "@/lib/shopping";
import { formatMinutes, titleCase } from "@/lib/utils";

type RecipeDetailClientProps = {
  id: string;
};

export function RecipeDetailClient({ id }: RecipeDetailClientProps) {
  const [record, setRecord] = useState<RecipeRecord | SavedRecipe | undefined>();
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copiedItem, setCopiedItem] = useState("");

  useEffect(() => {
    const found = findRecipeById(id);
    setRecord(found);
    setIsSaved(loadSavedRecipes().some((recipe) => recipe.id === id));
    setLoaded(true);
  }, [id]);

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
    if (isSaved) {
      removeSavedRecipe(record.id);
      setIsSaved(false);
      return;
    }
    upsertSavedRecipe({
      id: record.id,
      recipe: record.recipe,
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString(),
      imagePath: record.imagePath,
      source: record.source
    });
    setIsSaved(true);
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
            <Link href="/generate">Find a recipe</Link>
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
    <article className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost">
        <Link href="/">
          <ArrowLeft />
          Back
        </Link>
      </Button>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
          <div className="aspect-[4/3] bg-muted">
            <Image src={withBasePath(record.imagePath)} alt="" width={900} height={675} priority className="size-full object-cover" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{titleCase(record.recipe.kosherType)}</Badge>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{record.recipe.title}</h1>
            <p className="text-base leading-7 text-muted-foreground">{record.recipe.notes}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <Clock className="mb-2 size-4 text-primary" />
              <p className="font-semibold">{formatMinutes(totalTime)}</p>
              <p className="text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <UsersRound className="mb-2 size-4 text-primary" />
              <p className="font-semibold">{record.recipe.servings}</p>
              <p className="text-muted-foreground">Servings</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <Flame className="mb-2 size-4 text-primary" />
              <p className="font-semibold">
                {record.recipe.estimatedCaloriesPerServing ? `~${record.recipe.estimatedCaloriesPerServing}` : "n/a"}
              </p>
              <p className="text-muted-foreground">Cal/serving</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <Check className="mb-2 size-4 text-primary" />
              <p className="font-semibold">{checkedIngredients.size}/{record.recipe.ingredients.length}</p>
              <p className="text-muted-foreground">Checked</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={toggleSave} size="lg" variant={isSaved ? "secondary" : "default"}>
              <Save />
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/generate?variation=${record.id}`}>
                <RefreshCw />
                Find variations
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            Shopping
          </CardTitle>
          <CardDescription>Open quick searches for anything you do not have locally.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={() => copyText(ingredientListText, "full-list")}>
            <Copy />
            {copiedItem === "full-list" ? "Copied list" : "Copy full list"}
          </Button>

          <div className="space-y-3">
            {shoppingIngredients.map((ingredient, index) => {
              const links = shoppingLinksForIngredient(ingredient);
              const copyLabel = `ingredient-${index}`;

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
              <label key={`${ingredient.name}-${index}`} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox checked={checkedIngredients.has(index)} onCheckedChange={() => toggleIngredient(index)} aria-label={`Check ${ingredient.name}`} />
                <span className={checkedIngredients.has(index) ? "text-muted-foreground line-through" : ""}>
                  <span className="font-medium">{ingredient.quantity} {ingredient.unit}</span>{" "}
                  <span>{ingredient.name}</span>
                </span>
              </label>
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
