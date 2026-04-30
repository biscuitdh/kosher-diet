"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/assets";
import { RECIPE_IMAGE_PLACEHOLDERS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type RecipeImageProps = Omit<ImageProps, "src" | "alt" | "onError"> & {
  src: string;
  alt?: string;
  fallbackSrc?: string;
};

type RecipeImageFrameProps = Omit<RecipeImageProps, "className"> & {
  className?: string;
  imageClassName?: string;
  "data-testid"?: string;
};

export function RecipeImage({ src, alt = "", fallbackSrc = RECIPE_IMAGE_PLACEHOLDERS[0], ...props }: RecipeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <Image
      {...props}
      src={withBasePath(currentSrc)}
      alt={alt}
      unoptimized
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}

export function RecipeImageFrame({
  className,
  imageClassName,
  width = 600,
  height = 450,
  "data-testid": testId,
  ...props
}: RecipeImageFrameProps) {
  return (
    <div data-testid={testId} className={cn("aspect-[4/3] overflow-hidden bg-muted", className)}>
      <RecipeImage
        {...props}
        width={width}
        height={height}
        className={cn("block size-full object-cover", imageClassName)}
      />
    </div>
  );
}
