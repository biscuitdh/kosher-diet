import catalogRecipeImagesJson from "@/lib/catalog-recipe-images.json";

export type CatalogRecipeImageManifest = Record<string, string>;

const catalogRecipeImages = catalogRecipeImagesJson as CatalogRecipeImageManifest;

const catalogRecipeImagePattern = /^\/images\/recipes\/catalog\/catalog-\d{4}\.webp$/;

export function isCatalogRecipeImagePath(path: string) {
  return catalogRecipeImagePattern.test(path);
}

export function resolveCatalogRecipeImagePath(
  recipeId: string,
  fallbackPath: string,
  manifest: CatalogRecipeImageManifest = catalogRecipeImages
) {
  const imagePath = manifest[recipeId];
  return imagePath && isCatalogRecipeImagePath(imagePath) ? imagePath : fallbackPath;
}

export function listCatalogRecipeImageManifest() {
  return catalogRecipeImages;
}
