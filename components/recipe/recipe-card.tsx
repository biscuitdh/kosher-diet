"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Flame, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { withBasePath } from "@/lib/assets";
import type { RecipeRecord, SavedRecipe } from "@/lib/schemas";
import { formatMinutes, titleCase } from "@/lib/utils";

type RecipeCardProps = {
  record: RecipeRecord | SavedRecipe;
};

export function RecipeCard({ record }: RecipeCardProps) {
  const totalTime = record.recipe.prepTimeMinutes + record.recipe.cookTimeMinutes;
  const href = record.id.startsWith("catalog-") ? `/recipes/${record.id}` : `/recipes/local?id=${encodeURIComponent(record.id)}`;

  return (
    <Link href={href} className="block focus-ring rounded-lg">
      <Card className="h-full overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <Image src={withBasePath(record.imagePath)} alt="" width={600} height={450} className="size-full object-cover" />
        </div>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{titleCase(record.recipe.kosherType)}</Badge>
              <Badge variant="safe">
                <ShieldCheck className="mr-1 size-3.5" />
                Allergy-safe
              </Badge>
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
      </Card>
    </Link>
  );
}
