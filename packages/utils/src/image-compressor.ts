/**
 * High-Fidelity Client-Side Image Compressor for MarketOS
 * Resizes large images (e.g. 10MB mobile camera photos) to crisp web dimensions (max 1200px)
 * and encodes to WebP/JPEG at optimal quality (0.85) with zero noticeable loss in clarity.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (0.85 optimal)
  targetFormat?: "image/webp" | "image/jpeg";
}

export interface CompressionResult {
  file: File;
  blob: Blob;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  width: number;
  height: number;
}

/**
 * Format bytes to human readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Compresses an image file in the browser canvas
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    targetFormat = "image/webp",
  } = options;

  // If running on server or file is not an image, return original
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return {
      file,
      blob: file,
      previewUrl: "",
      originalSize: file.size,
      compressedSize: file.size,
      savedBytes: 0,
      savedPercent: 0,
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio-preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del canvas"));
          return;
        }

        // Apply high quality bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Error al convertir la imagen a Blob"));
              return;
            }

            // Create compressed File object with same base name + .webp
            const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const ext = targetFormat === "image/webp" ? ".webp" : ".jpg";
            const compressedFile = new File([blob], `${baseName}${ext}`, {
              type: targetFormat,
              lastModified: Date.now(),
            });

            const originalSize = file.size;
            const compressedSize = compressedFile.size;
            const savedBytes = Math.max(0, originalSize - compressedSize);
            const savedPercent =
              originalSize > 0
                ? Math.round((savedBytes / originalSize) * 100)
                : 0;

            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              blob,
              previewUrl,
              originalSize,
              compressedSize,
              savedBytes,
              savedPercent,
              width,
              height,
            });
          },
          targetFormat,
          quality
        );
      };

      img.onerror = (err) => {
        reject(new Error("Error al cargar la imagen para compresión"));
      };
    };

    reader.onerror = (err) => {
      reject(new Error("Error al leer el archivo de imagen"));
    };
  });
}
