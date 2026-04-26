"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Dice5, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiGenerateResponseSchema, FIXED_SAFETY_PROFILE, generationRequestSchema, recipeSchema, type GenerationRequest, type Recipe } from "@/lib/schemas";
import { checkClientAiRateLimit, createRecipeRecord, findRecipeById, recordClientAiCall, upsertGeneratedRecipe } from "@/lib/storage";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

const SURPRISES = [
  {
    occasion: "Shabbat lunch",
    cuisinePreference: "Levantine-inspired",
    mainIngredient: "chicken thighs",
    availableIngredients: "fresh herbs, lemons, rice",
    extraNotes: "Make it bright, herb-heavy, and safe without peppers."
  },
  {
    occasion: "Weeknight dinner",
    cuisinePreference: "Mediterranean",
    mainIngredient: "lentils and sweet potatoes",
    availableIngredients: "carrots, onions, garlic",
    extraNotes: "One-pan or low cleanup preferred."
  },
  {
    occasion: "Holiday side dish",
    cuisinePreference: "Ashkenazi-inspired",
    mainIngredient: "root vegetables",
    availableIngredients: "parsnips, sweet potatoes, fresh herbs",
    extraNotes: "No white potatoes; use sweet potato or parsnip."
  },
  {
    occasion: "Light dairy-free lunch",
    cuisinePreference: "Modern Israeli",
    mainIngredient: "chickpeas",
    availableIngredients: "cucumbers, parsley, lemon",
    extraNotes: "Fresh herbs, lemon, no tomato salad shortcuts."
  }
];

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
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [variationOf, setVariationOf] = useState<Recipe | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

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
    setExtraNotes(`Regenerate a distinct variation of "${record.recipe.title}" while preserving kosher and allergy safety.`);
  }, [searchParams]);

  const rateLimit = checkClientAiRateLimit();
  const filteredMainIngredientSuggestions = filterSuggestionsForProfile(mainIngredientSuggestions, profile);
  const filteredAvailableIngredientSuggestions = filterSuggestionsForProfile(availableIngredientSuggestions, profile);

  function surprise() {
    const pick = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
    setOccasion(pick.occasion);
    setCuisinePreference(pick.cuisinePreference);
    setMainIngredient(pick.mainIngredient);
    setAvailableIngredients(pick.availableIngredients);
    setExtraNotes(pick.extraNotes);
    setSurpriseMe(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setWarnings([]);

    const limit = checkClientAiRateLimit();
    if (!limit.allowed) {
      setError(`Client-side AI limit reached. Try again after ${new Date(limit.resetAt).toLocaleTimeString()}.`);
      return;
    }

    const request = generationRequestSchema.safeParse({
      occasion,
      cuisinePreference,
      mainIngredient,
      availableIngredients,
      servings: Number(servings),
      extraNotes,
      surpriseMe,
      variationOf
    });

    if (!request.success) {
      setError(request.error.errors[0]?.message ?? "Generation request is invalid.");
      return;
    }

    setLoading(true);
    recordClientAiCall();

    try {
      const response = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toClientGenerationPayload(request.data))
      });
      const data = apiGenerateResponseSchema.parse(await response.json());

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "Recipe generation failed.");
        return;
      }

      const recipe = recipeSchema.parse(data.recipe);
      const safety = validateRecipeSafety(recipe, profile);
      if (!safety.ok) {
        setError("Client-side validation blocked the recipe because a forbidden ingredient was detected.");
        return;
      }

      const record = createRecipeRecord(recipe, "generated");
      upsertGeneratedRecipe(record);
      setWarnings(data.safety.warnings ?? []);
      router.push(`/recipes/${record.id}`);
    } catch {
      setError("Recipe generation failed. Check network/provider configuration and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <Badge variant="safe">
          <ShieldCheck className="mr-1 size-3.5" />
          Nightshade & Tomato Safe ✅
        </Badge>
        <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Generate meal ideas</h1>
        <p className="text-muted-foreground">
          The server includes the strict kosher/allergy prompt on every request, validates JSON, then blocks unsafe ingredients.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Current guardrails</CardTitle>
            <CardDescription>
              {profile.kosherPreference === "strict" ? "Strict kosher mode" : "Standard kosher mode"} with {profile.allergies.length} fixed allergy filters.
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
          <AlertTitle>AI rate limit</AlertTitle>
          <AlertDescription>{rateLimit.remaining} client-side generation attempts remaining in the current 10-minute window.</AlertDescription>
        </Alert>
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
                <AlertTitle>Generation blocked</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {warnings.length > 0 ? (
              <Alert>
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>{warnings.join(" ")}</AlertDescription>
              </Alert>
            ) : null}

            {variationOf ? (
              <Alert>
                <AlertTitle>Variation mode</AlertTitle>
                <AlertDescription>Generating a distinct variation of {variationOf.title}.</AlertDescription>
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

            {loading ? (
              <div className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={surprise} disabled={loading}>
                <Dice5 />
                Surprise Me
              </Button>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Generate Recipe
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function toClientGenerationPayload(request: GenerationRequest) {
  return {
    occasion: request.occasion,
    cuisinePreference: request.cuisinePreference,
    mainIngredient: request.mainIngredient,
    availableIngredients: request.availableIngredients,
    servings: request.servings,
    extraNotes: request.extraNotes,
    surpriseMe: request.surpriseMe,
    variationOf: request.variationOf
  };
}
