"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChefHat, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withBasePath } from "@/lib/assets";
import { listCatalogRecipes } from "@/lib/catalog";
import { loadGeneratedRecipes, loadSavedRecipes } from "@/lib/storage";
import type { RecipeRecord, SavedRecipe } from "@/lib/schemas";

export function DashboardClient() {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [generatedRecipes, setGeneratedRecipes] = useState<RecipeRecord[]>([]);

  useEffect(() => {
    setSavedRecipes(loadSavedRecipes());
    setGeneratedRecipes(loadGeneratedRecipes());
  }, []);

  const catalogRecipes = useMemo(() => listCatalogRecipes().slice(0, 12), []);

  const visibleRecipes = useMemo(() => {
    const savedIds = new Set(savedRecipes.map((recipe) => recipe.id));
    const localRecipes = [...savedRecipes, ...generatedRecipes.filter((recipe) => !savedIds.has(recipe.id))].slice(0, 12);
    return localRecipes.length > 0 ? localRecipes : catalogRecipes;
  }, [catalogRecipes, generatedRecipes, savedRecipes]);

  const showingCatalog = savedRecipes.length === 0 && generatedRecipes.length === 0;

  return (
    <div className="space-y-8">
      <section className="grid items-stretch gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border bg-card p-5 shadow-soft sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="safe">
              <ShieldCheck className="mr-1 size-3.5" />
              Nightshade & Tomato Safe ✅
            </Badge>
            <Badge variant="secondary">1,000 bundled ideas</Badge>
          </div>
          <div className="mt-6 max-w-2xl space-y-4">
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Kosher meal ideas for two, ready to shop.</h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              Browse nightshade-free, tomato-free recipes with quick ordering links for Walmart, Wegmans, and kosher meat sources.
            </p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/generate">
                <Sparkles />
                Find Meal Ideas
              </Link>
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="aspect-[16/10] bg-muted">
            <Image src={withBasePath("/images/table-hero.svg")} alt="" width={1200} height={750} priority className="size-full object-cover" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="size-5 text-primary" />
              Safe Shopping Catalog
            </CardTitle>
            <CardDescription>
              Strict kosher rules, deterministic ingredient blocking, meals for two, and local recipe data ready for mobile testing.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{showingCatalog ? "Recipe catalog" : "Saved recipes"}</h2>
            <p className="text-sm text-muted-foreground">
              {showingCatalog ? "A starter set of safe meal ideas is ready before anything is saved." : "Cards include kosher type, safety badge, and meal timing."}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/generate">
              <Plus />
              New
            </Link>
          </Button>
        </div>

        {visibleRecipes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleRecipes.map((record) => (
              <RecipeCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-secondary">
                <Sparkles className="size-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No catalog recipes available</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  The bundled catalog did not load. Use the finder to try again.
                </p>
              </div>
              <Button asChild>
                <Link href="/generate">Find Meal Ideas</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
