"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/assets";
import { RECIPE_IMAGE_PLACEHOLDERS } from "@/lib/constants";

type RecipeImageProps = Omit<ImageProps, "src" | "alt" | "onError"> & {
  src: string;
  alt?: string;
  fallbackSrc?: string;
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
