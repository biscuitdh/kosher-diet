"use server";

import { generateRecipe } from "@/lib/ai/generate";

export async function generateRecipeAction(input: unknown) {
  return generateRecipe(input);
}
