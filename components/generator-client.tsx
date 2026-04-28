"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Clock, Dice5, Flame, Search, Shuffle, Sparkles, UsersRound } from "lucide-react";
import { RecipeImage } from "@/components/recipe/recipe-image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { pickRandomCatalogRecipe, searchCatalogRecipes, type CatalogRecipeRecord } from "@/lib/catalog";
import { FIXED_SAFETY_PROFILE, generationRequestSchema, type FinderSearch, type Recipe } from "@/lib/schemas";
import { findRecipeById, loadFinderDraft, loadRecentSearches, saveFinderDraft, saveRecentSearch } from "@/lib/storage";
import { cn, formatMinutes, titleCase } from "@/lib/utils";
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

function summarizeSearch(search: FinderSearch) {
  const parts = [
    search.recipeName || search.mainIngredient || "Meal ideas",
    search.kosherForPassover ? "Passover" : "",
    search.maxCaloriesPerServing ? `<=${search.maxCaloriesPerServing} cal` : "",
    search.maxTotalTimeMinutes ? `<=${search.maxTotalTimeMinutes} min` : "",
    search.cuisinePreference,
    `${search.servings} servings`
  ].filter(Boolean);

  return parts.join(" · ");
}

const VIEWED_CATALOG_IDS_KEY = "koshertable.viewedCatalogIds.v1";

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadViewedCatalogIds() {
  try {
    return JSON.parse(window.sessionStorage.getItem(VIEWED_CATALOG_IDS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function rememberViewedCatalogId(id: string) {
  const next = [id, ...loadViewedCatalogIds().filter((existingId) => existingId !== id)].slice(0, 30);
  window.sessionStorage.setItem(VIEWED_CATALOG_IDS_KEY, JSON.stringify(next));
}

function exactTitleRequested(record: CatalogRecipeRecord, recipeName: string) {
  const queryTitle = normalizeTitle(recipeName);
  return Boolean(queryTitle && normalizeTitle(record.recipe.title) === queryTitle);
}

const calorieFilters = [
  { label: "Any", value: undefined },
  { label: "≤400", value: 400 },
  { label: "≤500", value: 500 },
  { label: "≤650", value: 650 }
] as const;

const timeFilters = [
  { label: "Any", value: undefined },
  { label: "≤30 min", value: 30 },
  { label: "≤45 min", value: 45 },
  { label: "≤60 min", value: 60 }
] as const;

function LimitChips({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: number | undefined;
  options: readonly { label: string; value: number | undefined }[];
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={`${label}-${option.label}`}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                "min-h-8 rounded-md border px-3 py-1 text-xs font-semibold transition-colors focus-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecipeMatchCard({
  record,
  compact = false,
  onOpen
}: {
  record: CatalogRecipeRecord;
  compact?: boolean;
  onOpen: (record: CatalogRecipeRecord) => void;
}) {
  const totalTime = record.recipe.prepTimeMinutes + record.recipe.cookTimeMinutes;

  return (
    <button
      type="button"
      data-testid="recipe-match-card"
      onClick={() => onOpen(record)}
      aria-label={`View ${record.recipe.title}`}
      className={cn(
        "group grid w-full overflow-hidden rounded-lg border bg-background text-left shadow-soft transition hover:-translate-y-0.5 hover:bg-secondary/55 hover:shadow-lg focus-ring",
        compact ? "grid-cols-[5.5rem_1fr]" : "sm:grid-cols-[8rem_1fr]"
      )}
    >
      <div className={cn("relative overflow-hidden bg-muted", compact ? "h-full min-h-24" : "aspect-[4/3] sm:aspect-auto")}>
        <RecipeImage src={record.imagePath} alt="" width={360} height={270} className="size-full object-cover transition duration-300 group-hover:scale-105" />
      </div>
      <div className="min-w-0 space-y-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[0.65rem]">
            {titleCase(record.recipe.kosherType)}
          </Badge>
          {record.catalog.kosherForPassover ? (
            <Badge variant="outline" className="text-[0.65rem]">
              Passover
            </Badge>
          ) : null}
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{record.recipe.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{record.catalog.occasion}</span>
          <span className="inline-flex items-center gap-1">
            <UsersRound className="size-3.5" />
            {record.recipe.servings}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatMinutes(totalTime)}
          </span>
          {record.recipe.estimatedCaloriesPerServing ? (
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3.5" />~{record.recipe.estimatedCaloriesPerServing}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function GeneratorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const variationId = searchParams.get("variation");
  const profile = FIXED_SAFETY_PROFILE;
  const [recipeName, setRecipeName] = useState("");
  const [occasion, setOccasion] = useState("Weeknight dinner");
  const [cuisinePreference, setCuisinePreference] = useState("Mediterranean");
  const [mainIngredient, setMainIngredient] = useState("chicken, salmon, eggs, or seasonal vegetables");
  const [availableIngredients, setAvailableIngredients] = useState("");
  const [servings, setServings] = useState("2");
  const [extraNotes, setExtraNotes] = useState("");
  const [kosherForPassover, setKosherForPassover] = useState(false);
  const [maxCaloriesPerServing, setMaxCaloriesPerServing] = useState<number | undefined>();
  const [maxTotalTimeMinutes, setMaxTotalTimeMinutes] = useState<number | undefined>();
  const [variationOf, setVariationOf] = useState<Recipe | undefined>();
  const [error, setError] = useState("");
  const [searchSeed, setSearchSeed] = useState("initial");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [recentSearches, setRecentSearches] = useState<FinderSearch[]>([]);

  const applyFinderSearch = useCallback((search: FinderSearch) => {
    setRecipeName(search.recipeName);
    setOccasion(search.occasion);
    setCuisinePreference(search.cuisinePreference);
    setMainIngredient(search.mainIngredient);
    setAvailableIngredients(search.availableIngredients);
    setServings(String(search.servings));
    setExtraNotes(search.extraNotes);
    setKosherForPassover(search.kosherForPassover);
    setMaxCaloriesPerServing(search.maxCaloriesPerServing);
    setMaxTotalTimeMinutes(search.maxTotalTimeMinutes);
    setVariationOf(undefined);
  }, []);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());

    if (!variationId) {
      const draft = loadFinderDraft();
      if (draft) applyFinderSearch(draft);
      setDraftLoaded(true);
      return;
    }

    const record = findRecipeById(variationId);
    if (record) {
      setVariationOf(record.recipe);
      setRecipeName("");
      setOccasion("Variation request");
      setCuisinePreference("Keep the same spirit, change the details");
      setMainIngredient(record.recipe.ingredients[0]?.name.replace(/\([^)]*\)/g, "").trim() || "safe seasonal ingredients");
      setAvailableIngredients("");
      setExtraNotes(`Find a distinct catalog variation of "${record.recipe.title}" while preserving kosher and allergy safety.`);
    }
    setDraftLoaded(true);
  }, [applyFinderSearch, variationId]);

  useEffect(() => {
    const storedSeed = window.sessionStorage.getItem("koshertable.finderSeed.v1");
    if (storedSeed) {
      setSearchSeed(storedSeed);
      return;
    }
    const nextSeed = globalThis.crypto?.randomUUID?.() ?? String(Math.random());
    window.sessionStorage.setItem("koshertable.finderSeed.v1", nextSeed);
    setSearchSeed(nextSeed);
  }, []);

  const filteredMainIngredientSuggestions = filterSuggestionsForProfile(mainIngredientSuggestions, profile, { kosherForPassover });
  const filteredAvailableIngredientSuggestions = filterSuggestionsForProfile(availableIngredientSuggestions, profile, { kosherForPassover });
  const finderSearch = useMemo<FinderSearch>(
    () => ({
      recipeName,
      occasion,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      extraNotes,
      kosherForPassover,
      maxCaloriesPerServing,
      maxTotalTimeMinutes
    }),
    [
      availableIngredients,
      cuisinePreference,
      extraNotes,
      kosherForPassover,
      mainIngredient,
      maxCaloriesPerServing,
      maxTotalTimeMinutes,
      occasion,
      recipeName,
      servings
    ]
  );
  const catalogQuery = useMemo(
    () => ({
      ...finderSearch,
      variationOf
    }),
    [finderSearch, variationOf]
  );
  const recipeMatches = useMemo(
    () =>
      searchCatalogRecipes(catalogQuery, 18, {
        seed: searchSeed,
        varyWithinTopMatches: true,
        poolSize: 24
      }).filter((record) => validateRecipeSafety(record.recipe, profile).ok),
    [catalogQuery, profile, searchSeed]
  );

  useEffect(() => {
    if (!draftLoaded || variationOf) return;
    const timeout = window.setTimeout(() => saveFinderDraft(finderSearch), 300);
    return () => window.clearTimeout(timeout);
  }, [draftLoaded, finderSearch, variationOf]);

  function rememberCurrentSearch() {
    saveRecentSearch(finderSearch);
    setRecentSearches(loadRecentSearches());
  }

  function refreshMatches() {
    setSearchSeed(globalThis.crypto?.randomUUID?.() ?? `${searchSeed}-${Date.now()}`);
  }

  function clearLimits() {
    setMaxCaloriesPerServing(undefined);
    setMaxTotalTimeMinutes(undefined);
  }

  function openRecipe(record: CatalogRecipeRecord) {
    rememberViewedCatalogId(record.id);
    router.push(`/recipes/${record.id}`);
  }

  function surprise() {
    setError("");
    const match = pickRandomCatalogRecipe(catalogQuery);
    if (!match) {
      setError("No matching catalog recipe was found.");
      return;
    }
    rememberCurrentSearch();
    openRecipe(match);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const request = generationRequestSchema.safeParse({
      occasion,
      recipeName,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      extraNotes,
      kosherForPassover,
      maxCaloriesPerServing,
      maxTotalTimeMinutes,
      variationOf
    });

    if (!request.success) {
      setError(request.error.errors[0]?.message ?? "Recipe search is invalid.");
      return;
    }

    const nextSeed = globalThis.crypto?.randomUUID?.() ?? `${searchSeed}-${Date.now()}`;
    const pool = searchCatalogRecipes(request.data, 18, { seed: nextSeed, varyWithinTopMatches: true, poolSize: 24 });
    const safePool = pool.filter((record) => validateRecipeSafety(record.recipe, profile).ok);
    const exactMatch = safePool.find((match) => exactTitleRequested(match, request.data.recipeName));

    if (safePool.length === 0) {
      setError("No matching catalog recipe was found.");
      return;
    }

    if (request.data.recipeName && exactMatch) {
      setSearchSeed(nextSeed);
    } else {
      const viewedCatalogIds = new Set(loadViewedCatalogIds());
      const firstFreshMatch = safePool.find((match) => !viewedCatalogIds.has(match.id));
      setSearchSeed(`${nextSeed}-${firstFreshMatch?.id ?? safePool[0]?.id ?? "matches"}`);
    }

    rememberCurrentSearch();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Find meal ideas</h1>
        <p className="text-muted-foreground">
          Search nightshade-free, tomato-free kosher meals for two from the bundled catalog.
        </p>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div>
              <CardTitle>Recipe matches</CardTitle>
              <CardDescription>{recipeMatches.length} clickable matches from the local catalog.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshMatches}>
              <Shuffle className="size-4" />
              Shuffle
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 rounded-lg border bg-background/65 p-3 sm:grid-cols-2">
              <LimitChips
                label="Calories"
                value={maxCaloriesPerServing}
                options={calorieFilters}
                onChange={setMaxCaloriesPerServing}
              />
              <LimitChips label="Total time" value={maxTotalTimeMinutes} options={timeFilters} onChange={setMaxTotalTimeMinutes} />
            </div>
            {recipeMatches.length > 0 ? (
              recipeMatches.map((record) => (
                <RecipeMatchCard
                  key={record.id}
                  record={record}
                  compact
                  onOpen={(match) => {
                    rememberCurrentSearch();
                    openRecipe(match);
                  }}
                />
              ))
            ) : (
              <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <p>No matches under those limits. Loosen the search, turn off Passover, or use Surprise Me.</p>
                {(maxCaloriesPerServing || maxTotalTimeMinutes) ? (
                  <Button type="button" variant="outline" size="sm" onClick={clearLimits}>
                    Clear calorie/time filters
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {recentSearches.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent searches</CardTitle>
              <CardDescription>Tap to restore the finder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentSearches.map((search, index) => (
                <button
                  key={`${summarizeSearch(search)}-${index}`}
                  type="button"
                  onClick={() => {
                    setError("");
                    applyFinderSearch(search);
                  }}
                  className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-secondary focus-ring"
                >
                  <span className="block text-sm font-semibold">{summarizeSearch(search)}</span>
                  {search.availableIngredients || search.extraNotes ? (
                    <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">
                      {[search.availableIngredients, search.extraNotes].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
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

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="recipeName">
                Search by recipe name
              </label>
              <Input
                id="recipeName"
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
                placeholder="Try salmon, feta, chicken, couscous..."
              />
            </div>

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

            <div className="flex items-start justify-between gap-4 rounded-lg border bg-background p-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="kosherForPassover">
                  Kosher for Passover
                </label>
                <p className="text-xs leading-5 text-muted-foreground">
                  Strict mode: no chametz and no kitniyot.
                </p>
              </div>
              <Switch id="kosherForPassover" checked={kosherForPassover} onCheckedChange={setKosherForPassover} aria-label="Kosher for Passover" />
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
