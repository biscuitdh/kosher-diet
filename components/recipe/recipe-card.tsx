"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Clock, Flame, UsersRound } from "lucide-react";
import { RecipeImageFrame } from "@/components/recipe/recipe-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RecipeRecord, SavedRecipe } from "@/lib/schemas";
import { formatMinutes, titleCase } from "@/lib/utils";

type RecipeCardProps = {
  record: RecipeRecord | SavedRecipe;
  action?: ReactNode;
};

export function RecipeCard({ record, action }: RecipeCardProps) {
  const totalTime = record.recipe.prepTimeMinutes + record.recipe.cookTimeMinutes;
  const href = record.id.startsWith("catalog-") ? `/recipes/${record.id}` : `/recipes/local?id=${encodeURIComponent(record.id)}`;
  const cardContents = (
    <>
      <RecipeImageFrame
        src={record.imagePath}
        alt=""
        width={600}
        height={450}
        data-testid="recipe-card-image-frame"
      />
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{titleCase(record.recipe.kosherType)}</Badge>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{record.recipe.title}</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatMinutes(totalTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersRound className="size-3.5" />
            {record.recipe.servings} servings
          </span>
          {record.recipe.estimatedCaloriesPerServing ? (
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3.5" />
              ~{record.recipe.estimatedCaloriesPerServing} cal
            </span>
          ) : null}
        </div>
      </CardContent>
    </>
  );

  if (action) {
    return (
      <Card className="h-full overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg">
        <Link href={href} className="block focus-ring">
          {cardContents}
        </Link>
        <div className="border-t p-4">{action}</div>
      </Card>
    );
  }

  return (
    <Link href={href} className="block focus-ring rounded-lg">
      <Card className="h-full overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg">
        {cardContents}
      </Card>
    </Link>
  );
}
