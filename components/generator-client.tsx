"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Dice5, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  appendSuggestion,
  availableIngredientSuggestions,
  cuisineSuggestions,
  extraNoteSuggestions,
  filterSuggestionsForProfile,
  mainIngredientSuggestions,
  occasionSuggestions,
  type Suggestion
} from "@/lib/generator-suggestions";
import { findBestCatalogRecipe, pickRandomCatalogRecipe, searchCatalogRecipes } from "@/lib/catalog";
import { FIXED_SAFETY_PROFILE, generationRequestSchema, type Recipe } from "@/lib/schemas";
import { findRecipeById } from "@/lib/storage";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

function SuggestionChips({
  label,
  suggestions,
  onPick
}: {
  label: string;
  suggestions: Suggestion[];
  onPick: (value: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1" aria-label={`${label} suggestions`}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.value}
          type="button"
          onClick={() => onPick(suggestion.value)}
          className="min-h-8 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-ring"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

export function GeneratorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = FIXED_SAFETY_PROFILE;
  const [occasion, setOccasion] = useState("Weeknight dinner");
  const [cuisinePreference, setCuisinePreference] = useState("Mediterranean");
  const [mainIngredient, setMainIngredient] = useState("chicken or seasonal vegetables");
  const [availableIngredients, setAvailableIngredients] = useState("");
  const [servings, setServings] = useState("4");
  const [extraNotes, setExtraNotes] = useState("");
  const [variationOf, setVariationOf] = useState<Recipe | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    const variationId = searchParams.get("variation");
    if (!variationId) return;
    const record = findRecipeById(variationId);
    if (!record) return;
    setVariationOf(record.recipe);
    setOccasion("Variation request");
    setCuisinePreference("Keep the same spirit, change the details");
    setMainIngredient(record.recipe.ingredients[0]?.name.replace(/\([^)]*\)/g, "").trim() || "safe seasonal ingredients");
    setAvailableIngredients("");
    setExtraNotes(`Find a distinct catalog variation of "${record.recipe.title}" while preserving kosher and allergy safety.`);
  }, [searchParams]);

  const filteredMainIngredientSuggestions = filterSuggestionsForProfile(mainIngredientSuggestions, profile);
  const filteredAvailableIngredientSuggestions = filterSuggestionsForProfile(availableIngredientSuggestions, profile);
  const catalogQuery = useMemo(
    () => ({
      occasion,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      extraNotes,
      variationOf
    }),
    [availableIngredients, cuisinePreference, extraNotes, mainIngredient, occasion, servings, variationOf]
  );
  const previewMatches = useMemo(() => searchCatalogRecipes(catalogQuery, 3), [catalogQuery]);

  function surprise() {
    setError("");
    const match = pickRandomCatalogRecipe(catalogQuery);
    if (!match) {
      setError("No matching catalog recipe was found.");
      return;
    }
    router.push(`/recipes/${match.id}`);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const request = generationRequestSchema.safeParse({
      occasion,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      extraNotes,
      variationOf
    });

    if (!request.success) {
      setError(request.error.errors[0]?.message ?? "Recipe search is invalid.");
      return;
    }

    const record = findBestCatalogRecipe(request.data);
    if (!record) {
      setError("No matching catalog recipe was found.");
      return;
    }

    const safety = validateRecipeSafety(record.recipe, profile);
    if (!safety.ok) {
      setError("Safety validation blocked this catalog recipe. The catalog needs review before showing it.");
      return;
    }

    router.push(`/recipes/${record.id}`);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <Badge variant="safe">
          <ShieldCheck className="mr-1 size-3.5" />
          Nightshade & Tomato Safe ✅
        </Badge>
        <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Find meal ideas</h1>
        <p className="text-muted-foreground">
          Search the bundled recipe catalog without an AI call, API key, or database bill.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Catalog guardrails</CardTitle>
            <CardDescription>
              {profile.kosherPreference === "strict" ? "Strict kosher mode" : "Standard kosher mode"} with {profile.allergies.length} fixed allergy filters across 1,000 local recipes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.allergies.slice(0, 10).map((allergy) => (
              <Badge key={allergy} variant="secondary">
                {allergy}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Alert variant="safe">
          <AlertTitle>Free testing mode</AlertTitle>
          <AlertDescription>Finds recipes locally. The AI backend is still in the codebase, but this page does not need it.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Best matches</CardTitle>
            <CardDescription>Live preview from the local catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewMatches.map((record) => (
              <div key={record.id} className="rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">{record.recipe.title}</p>
                <p className="text-xs text-muted-foreground">{record.catalog.occasion} · {record.recipe.servings} servings</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Recipe brief
          </CardTitle>
          <CardDescription>Be specific when you care. Use Surprise Me when you do not. Both are valid adult strategies.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Search blocked</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {variationOf ? (
              <Alert>
                <AlertTitle>Variation mode</AlertTitle>
                <AlertDescription>Finding a distinct catalog variation of {variationOf.title}.</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="occasion">
                  Occasion
                </label>
                <Input id="occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} placeholder="Shabbat dinner" />
                <SuggestionChips label="Occasion" suggestions={occasionSuggestions} onPick={setOccasion} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="cuisinePreference">
                  Cuisine preference
                </label>
                <Input
                  id="cuisinePreference"
                  value={cuisinePreference}
                  onChange={(event) => setCuisinePreference(event.target.value)}
                  placeholder="Sephardi, Ashkenazi, Mediterranean"
                />
                <SuggestionChips label="Cuisine" suggestions={cuisineSuggestions} onPick={setCuisinePreference} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mainIngredient">
                  Main protein or veggie
                </label>
                <Input
                  id="mainIngredient"
                  value={mainIngredient}
                  onChange={(event) => setMainIngredient(event.target.value)}
                  placeholder="Chicken, lentils, mushrooms"
                />
                <SuggestionChips label="Main ingredient" suggestions={filteredMainIngredientSuggestions} onPick={setMainIngredient} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="servings">
                  Servings
                </label>
                <Select value={servings} onValueChange={setServings}>
                  <SelectTrigger id="servings">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 10, 12].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="availableIngredients">
                Ingredients on hand or want to include
              </label>
              <Textarea
                id="availableIngredients"
                value={availableIngredients}
                onChange={(event) => setAvailableIngredients(event.target.value)}
                placeholder="Carrots, onions, rice, leftover chicken..."
              />
              <SuggestionChips
                label="Ingredients on hand"
                suggestions={filteredAvailableIngredientSuggestions}
                onPick={(value) => setAvailableIngredients((current) => appendSuggestion(current, value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="extraNotes">
                Extra notes
              </label>
              <Textarea
                id="extraNotes"
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder="Low cleanup, make ahead, no cilantro, kid-friendly..."
              />
              <SuggestionChips
                label="Extra notes"
                suggestions={extraNoteSuggestions}
                onPick={(value) => setExtraNotes((current) => appendSuggestion(current, value))}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={surprise}>
                <Dice5 />
                Surprise Me
              </Button>
              <Button type="submit" size="lg">
                <Search />
                Find Recipe
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
