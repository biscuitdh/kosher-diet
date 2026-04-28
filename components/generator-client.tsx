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
  filterSuggestionsForProfile,
  mainIngredientSuggestions,
  occasionSuggestions,
  type Suggestion
} from "@/lib/generator-suggestions";
import { finderSearchFromSearchParams, finderSearchToSearchParams } from "@/lib/finder-url";
import { pickRandomCatalogRecipe, searchCatalogRecipes, type CatalogRecipeRecord } from "@/lib/catalog";
import {
  COOKING_DEVICE_LABELS,
  COOKING_DEVICE_VALUES,
  FIXED_SAFETY_PROFILE,
  finderSearchSchema,
  generationRequestSchema,
  type CookingDevice,
  type FinderSearch,
  type Recipe
} from "@/lib/schemas";
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
    search.cookingDevice !== "any" ? COOKING_DEVICE_LABELS[search.cookingDevice] : "",
    search.maxCaloriesPerServing ? `<=${search.maxCaloriesPerServing} cal` : "",
    search.maxTotalTimeMinutes ? `<=${search.maxTotalTimeMinutes} min` : "",
    search.cuisinePreference,
    `${search.servings} servings`
  ].filter(Boolean);

  return parts.join(" · ");
}

const VIEWED_CATALOG_IDS_KEY = "koshertable.viewedCatalogIds.v1";

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

function DeviceChips({ value, onChange }: { value: CookingDevice; onChange: (value: CookingDevice) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Cooking device</p>
      <div className="flex flex-wrap gap-2">
        {COOKING_DEVICE_VALUES.map((device) => {
          const active = device === value;
          return (
            <button
              key={device}
              type="button"
              onClick={() => onChange(device)}
              aria-pressed={active}
              className={cn(
                "min-h-8 rounded-md border px-3 py-1 text-xs font-semibold transition-colors focus-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              )}
            >
              {COOKING_DEVICE_LABELS[device]}
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

type GeneratorClientProps = {
  mode?: "brief" | "matches";
};

export function GeneratorClient({ mode = "brief" }: GeneratorClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const variationId = searchParams.get("variation");
  const profile = FIXED_SAFETY_PROFILE;
  const [recipeName, setRecipeName] = useState("");
  const [occasion, setOccasion] = useState("Weeknight dinner");
  const [cuisinePreference, setCuisinePreference] = useState("Mediterranean");
  const [mainIngredient, setMainIngredient] = useState("chicken, salmon, eggs, or seasonal vegetables");
  const [availableIngredients, setAvailableIngredients] = useState("");
  const [servings, setServings] = useState("2");
  const [kosherForPassover, setKosherForPassover] = useState(false);
  const [cookingDevice, setCookingDevice] = useState<CookingDevice>("any");
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
    setKosherForPassover(search.kosherForPassover);
    setCookingDevice(search.cookingDevice);
    setMaxCaloriesPerServing(search.maxCaloriesPerServing);
    setMaxTotalTimeMinutes(search.maxTotalTimeMinutes);
    setVariationOf(undefined);
  }, []);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
    const urlSearch = finderSearchFromSearchParams(new URLSearchParams(searchParamString));

    if (urlSearch) {
      applyFinderSearch(urlSearch);
    }

    if (variationId) {
      const record = findRecipeById(variationId);
      if (record) {
        setVariationOf(record.recipe);
        if (!urlSearch) {
          setRecipeName("");
          setOccasion("Variation request");
          setCuisinePreference("Keep the same spirit, change the details");
          setMainIngredient(record.recipe.ingredients[0]?.name.replace(/\([^)]*\)/g, "").trim() || "safe seasonal ingredients");
          setAvailableIngredients("");
          setKosherForPassover(false);
          setCookingDevice("any");
          setMaxCaloriesPerServing(undefined);
          setMaxTotalTimeMinutes(undefined);
        }
      }
      setDraftLoaded(true);
      return;
    }

    if (!urlSearch) {
      const draft = loadFinderDraft();
      if (draft) applyFinderSearch(draft);
    }

    setDraftLoaded(true);
  }, [applyFinderSearch, searchParamString, variationId]);

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
      kosherForPassover,
      cookingDevice,
      maxCaloriesPerServing,
      maxTotalTimeMinutes
    }),
    [
      availableIngredients,
      cuisinePreference,
      cookingDevice,
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

  useEffect(() => {
    if (!draftLoaded || variationOf || mode !== "matches") return;
    const timeout = window.setTimeout(() => {
      saveRecentSearch(finderSearch);
      setRecentSearches(loadRecentSearches());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [draftLoaded, finderSearch, mode, variationOf]);

  function rememberCurrentSearch() {
    saveRecentSearch(finderSearch);
    setRecentSearches(loadRecentSearches());
  }

  function finderHref(path: "/find" | "/generate", search: FinderSearch) {
    const params = finderSearchToSearchParams(search);
    if (variationId) params.set("variation", variationId);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  function openFind(search: FinderSearch, replace = false) {
    const href = finderHref("/find", search);
    if (replace) router.replace(href);
    else router.push(href);
  }

  function refreshMatches() {
    const nextSeed = globalThis.crypto?.randomUUID?.() ?? `${searchSeed}-${Date.now()}`;
    window.sessionStorage.setItem("koshertable.finderSeed.v1", nextSeed);
    setSearchSeed(nextSeed);
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

  function submitBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const request = generationRequestSchema.safeParse({
      occasion,
      recipeName,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      kosherForPassover,
      cookingDevice,
      maxCaloriesPerServing,
      maxTotalTimeMinutes,
      variationOf
    });

    if (!request.success) {
      setError(request.error.errors[0]?.message ?? "Recipe search is invalid.");
      return;
    }

    const nextSearch = finderSearchSchema.parse(request.data);
    saveFinderDraft(nextSearch);
    saveRecentSearch(nextSearch);
    setRecentSearches(loadRecentSearches());
    openFind(nextSearch);
  }

  const matchesSection = (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Browse</h1>
          <p className="text-muted-foreground">Search nightshade-free, tomato-free kosher meals for two from the bundled catalog.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refreshMatches}>
            <Shuffle className="size-4" />
            Shuffle
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Browse</CardTitle>
          <CardDescription>{recipeMatches.length} clickable matches from the local catalog.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 rounded-lg border bg-background/65 p-3 lg:grid-cols-3">
            <div className="flex min-h-[5.25rem] items-center justify-between gap-4 rounded-md border border-input bg-background px-3 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground" htmlFor="browseKosherForPassover">
                  Kosher for Passover
                </label>
                <p className="text-xs leading-5 text-muted-foreground">Strict no chametz or kitniyot.</p>
              </div>
              <Switch
                id="browseKosherForPassover"
                checked={kosherForPassover}
                onCheckedChange={setKosherForPassover}
                aria-label="Browse kosher for Passover"
              />
            </div>
            <LimitChips label="Calories" value={maxCaloriesPerServing} options={calorieFilters} onChange={setMaxCaloriesPerServing} />
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
              <p>No matches under those filters. Loosen Passover, calorie, or time filters, or adjust the Find brief.</p>
              {maxCaloriesPerServing || maxTotalTimeMinutes ? (
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
                data-testid="recent-search"
                onClick={() => {
                  setError("");
                  applyFinderSearch(search);
                  saveFinderDraft(search);
                  openFind(search, true);
                }}
                className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-secondary focus-ring"
              >
                <span className="block text-sm font-semibold">{summarizeSearch(search)}</span>
                {search.availableIngredients ? (
                  <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">{search.availableIngredients}</span>
                ) : null}
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );

  if (mode === "matches") {
    return <div className="mx-auto max-w-5xl space-y-5">{matchesSection}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Find</h1>
        <p className="text-muted-foreground">Set the meal constraints before opening matching catalog recipes.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Find
          </CardTitle>
          <CardDescription>Be specific when you care. Use Surprise Me when you do not. Both are valid adult strategies.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submitBrief}>
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

            <div className="flex items-start justify-between gap-4 rounded-lg border bg-background p-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="kosherForPassover">
                  Kosher for Passover
                </label>
                <p className="text-xs leading-5 text-muted-foreground">Strict mode: no chametz and no kitniyot.</p>
              </div>
              <Switch id="kosherForPassover" checked={kosherForPassover} onCheckedChange={setKosherForPassover} aria-label="Kosher for Passover" />
            </div>

            <div className="rounded-lg border bg-background/65 p-3">
              <DeviceChips value={cookingDevice} onChange={setCookingDevice} />
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

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="availableIngredients">
                Ingredients on hand or want to include
              </label>
              <Textarea
                id="availableIngredients"
                value={availableIngredients}
                onChange={(event) => setAvailableIngredients(event.target.value)}
                placeholder="Carrots, onions, quinoa, fresh herbs..."
              />
              <SuggestionChips
                label="Ingredients on hand"
                suggestions={filteredAvailableIngredientSuggestions}
                onPick={(value) => setAvailableIngredients((current) => appendSuggestion(current, value))}
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
