import { buildRecipeUserPrompt, summarizeSafetyFailure } from "@/lib/ai/prompt";
import { callRecipeProvider } from "@/lib/ai/provider";
import { FIXED_SAFETY_PROFILE, generationRequestSchema, profileSchema, recipeSchema, type GenerationRequest, type Recipe } from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

export type GenerateRecipeSuccess = {
  ok: true;
  recipe: Recipe;
  warnings: string[];
};

export type GenerateRecipeFailure = {
  ok: false;
  error: string;
  code: "VALIDATION_ERROR" | "UNSAFE_RECIPE" | "PROVIDER_ERROR";
};

export type GenerateRecipeResult = GenerateRecipeSuccess | GenerateRecipeFailure;

function extractJson(rawText: string) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? trimmed;
}

async function attemptGenerate(input: GenerationRequest, retryContext?: string) {
  const userPrompt = buildRecipeUserPrompt(input, retryContext);
  const result = await callRecipeProvider(userPrompt);
  const parsedJson = JSON.parse(extractJson(result.rawText)) as unknown;
  return recipeSchema.parse(parsedJson);
}

export async function generateRecipe(input: unknown): Promise<GenerateRecipeResult> {
  const parsedInput = generationRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Recipe request is invalid. Check servings and form fields."
    };
  }

  const request = {
    ...parsedInput.data,
    profile: createServerSafetyProfile()
  };
  let firstRecipe: Recipe | undefined;

  try {
    firstRecipe = await attemptGenerate(request);
    const firstSafety = validateRecipeSafety(firstRecipe, request.profile);
    if (firstSafety.ok) {
      return { ok: true, recipe: firstRecipe, warnings: firstSafety.warnings };
    }

    const retryContext = summarizeSafetyFailure(firstRecipe, request);
    const retryRecipe = await attemptGenerate(request, retryContext || "unsafe ingredient found");
    const retrySafety = validateRecipeSafety(retryRecipe, request.profile);
    if (retrySafety.ok) {
      return { ok: true, recipe: retryRecipe, warnings: retrySafety.warnings };
    }

    return {
      ok: false,
      code: "UNSAFE_RECIPE",
      error: "The generated recipe failed kosher or allergy validation and was blocked."
    };
  } catch (error) {
    if (firstRecipe) {
      return {
        ok: false,
        code: "UNSAFE_RECIPE",
        error: "The generated recipe could not be safely validated and was blocked."
      };
    }

    console.error("Recipe generation failed", error);
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      error: "Recipe generation failed. Check provider configuration and try again."
    };
  }
}

function createServerSafetyProfile() {
  return profileSchema.parse(FIXED_SAFETY_PROFILE);
}
