"use client";

import React, { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "../index";

export interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  aspectRatio?: "square" | "video" | "portrait" | "wide" | "auto";
  containerClassName?: string;
  priority?: boolean;
}

const ASPECT_MAP: Record<string, string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  wide: "aspect-[16/9]",
  auto: "",
};

/**
 * OptimizedImage: Componente de imagen de alto rendimiento y cero CLS.
 * - Elimina el Cumulative Layout Shift (CLS) reservando el aspect-ratio en el contenedor.
 * - Efecto Skeleton Shimmer CSS mientras descarga el asset.
 * - Soporte nativo para decoding="async" y loading="lazy" (o eager si priority=true).
 * - Transición suave de opacidad (opacity-0 a opacity-100 en 300ms).
 * - Fallback elegante ante URLs rotas o caídas de red.
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  aspectRatio = "auto",
  containerClassName = "",
  className = "",
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src || undefined);

  useEffect(() => {
    setCurrentSrc(src || undefined);
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
    }
  };

  const aspectClass = ASPECT_MAP[aspectRatio] || "";

  if (!currentSrc || (hasError && !fallbackSrc)) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center bg-muted/40 text-muted-foreground/50 overflow-hidden",
          aspectClass,
          containerClassName
        )}
        aria-label={alt}
      >
        <ImageIcon className="w-6 h-6 opacity-40" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", aspectClass, containerClassName)}>
      {/* Shimmer skeleton mientras descarga */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton-shimmer z-10" />
      )}

      {/* Imagen renderizada de forma asíncrona con transición de opacidad */}
      <img
        src={currentSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </div>
  );
}
