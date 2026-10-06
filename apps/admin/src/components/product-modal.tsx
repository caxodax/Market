"use client";

import React, { useState, useRef } from "react";
import { Product, Category } from "@marketos/types";
import { compressImage, formatFileSize, CompressionResult } from "@marketos/utils";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  uploadProductImageAction,
} from "../app/actions";
import {
  X,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  Trash2,
  Loader2,
  Package,
  Image as ImageIcon,
  DollarSign,
  Boxes,
} from "lucide-react";

interface ProductModalProps {
  tenantId: string;
  categories: Category[];
  product?: (Product & { stock: number }) | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (product: Product & { stock: number }) => void;
  onDeleted?: (productId: string) => void;
}

export function ProductModal({
  tenantId,
  categories,
  product,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: ProductModalProps) {
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(
    product?.category_id || categories[0]?.id || ""
  );
  const [priceUsd, setPriceUsd] = useState(
    product ? product.price_usd.toString() : ""
  );
  const [stock, setStock] = useState(
    product ? product.stock.toString() : "20"
  );
  const [sku, setSku] = useState(product?.sku || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [description, setDescription] = useState(product?.description || "");
  const [isActive, setIsActive] = useState(
    product ? product.is_active : true
  );

  // Image & Compression State
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressionMetrics, setCompressionMetrics] =
    useState<CompressionResult | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local file selection with instant compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setCompressing(true);

    try {
      // Compress with high-fidelity canvas utility
      const result = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        targetFormat: "image/webp",
      });

      setSelectedFile(result.file);
      setCompressionMetrics(result);
      setImageUrl(result.previewUrl);
    } catch (err) {
      console.error("Compression error:", err);
      setErrorMsg("Error al optimizar la imagen");
    } finally {
      setCompressing(false);
    }
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del producto es obligatorio");
      return;
    }
    const numPrice = parseFloat(priceUsd);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg("El precio debe ser un número válido");
      return;
    }
    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setErrorMsg("El stock debe ser un número válido");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      let finalImageUrl = imageUrl;

      // If a new compressed file was selected, upload to Cloudflare R2
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("tenantId", tenantId);

        const uploadRes = await uploadProductImageAction(formData);
        if (!uploadRes.success || !uploadRes.url) {
          throw new Error(uploadRes.error || "Error al subir la imagen a R2");
        }
        finalImageUrl = uploadRes.url;
      }

      if (isEditing && product) {
        const res = await updateProductAction({
          tenantId,
          productId: product.id,
          name,
          categoryId,
          priceUsd: numPrice,
          stock: numStock,
          sku: sku || undefined,
          barcode: barcode || undefined,
          description: description || undefined,
          imageUrl: finalImageUrl,
          isActive,
        });

        if (!res.success || !res.product) {
          throw new Error(res.error || "Error al actualizar el producto");
        }
        onSaved(res.product);
      } else {
        const res = await createProductAction({
          tenantId,
          name,
          categoryId,
          priceUsd: numPrice,
          initialStock: numStock,
          sku: sku || undefined,
          barcode: barcode || undefined,
          description: description || undefined,
          imageUrl: finalImageUrl || undefined,
        });

        if (!res.success || !res.product) {
          throw new Error(res.error || "Error al crear el producto");
        }
        onSaved(res.product);
      }

      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar producto");
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!product || !confirm(`¿Estás seguro de desactivar el producto "${product.name}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await deleteProductAction(tenantId, product.id);
      if (res.success) {
        if (onDeleted) onDeleted(product.id);
        onClose();
      } else {
        setErrorMsg("Error al eliminar producto");
      }
    } catch (err) {
      setErrorMsg("Error al eliminar producto");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">
                {isEditing ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Catálogo digital en Cloudflare R2 y Supabase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          {/* Image Upload Box with Live Compressor */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Fotografía del Producto</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Compresor WebP optimizado
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-border bg-muted/20">
              {/* Thumbnail Preview */}
              <div className="relative w-28 h-28 rounded-xl border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                {compressing ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>

              {/* Upload controls & compression stats */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing || saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold border border-primary/20 transition-colors disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{imageUrl ? "Cambiar Imagen" : "Subir Fotografía"}</span>
                </button>

                <p className="text-[10px] text-muted-foreground">
                  Se comprime automáticamente en el navegador a formato WebP HD sin perder nitidez.
                </p>

                {/* Compression metrics badge */}
                {compressionMetrics && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Optimizado:{" "}
                      <strong>{formatFileSize(compressionMetrics.originalSize)}</strong> →{" "}
                      <strong>{formatFileSize(compressionMetrics.compressedSize)}</strong>{" "}
                      ({compressionMetrics.savedPercent}% reducido)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name & Category */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Nombre del Producto *
              </label>
              <input
                type="text"
                placeholder="Ej. Harina PAN 1kg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Categoría *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Precio USD ($) *
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1.25"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  required
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Stock en Tienda *
              </label>
              <div className="relative">
                <Boxes className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="number"
                  min="0"
                  placeholder="20"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
            </div>
          </div>

          {/* SKU & Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Código / SKU (opcional)
              </label>
              <input
                type="text"
                placeholder="PAN-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Código de Barra (opcional)
              </label>
              <input
                type="text"
                placeholder="7591011000012"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Descripción breve (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre el producto, peso, presentación..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Active status toggle (if editing) */}
          {isEditing && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isActiveToggle"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="isActiveToggle" className="text-xs font-medium text-foreground">
                Producto visible en el catálogo de clientes
              </label>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Desactivar</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || compressing}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isEditing ? "Guardar Cambios" : "Crear Producto"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
