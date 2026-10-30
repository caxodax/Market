"use client";

import React, { useState } from "react";
import { Category, Product } from "@marketos/types";
import { createCategoryAction, deleteCategoryAction } from "../app/admin/actions";
import {
  X,
  Tags,
  Plus,
  Trash2,
  Loader2,
  Package,
  CheckCircle2,
  AlertCircle,
  FolderTree,
} from "lucide-react";

interface CategoryManagerModalProps {
  tenantId: string;
  categories: Category[];
  products: (Product & { stock: number })[];
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged: (updatedCategories: Category[]) => void;
}

export function CategoryManagerModal({
  tenantId,
  categories,
  products,
  isOpen,
  onClose,
  onCategoriesChanged,
}: CategoryManagerModalProps) {
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [newCatName, setNewCatName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize when categories prop updates
  React.useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  if (!isOpen) return null;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await createCategoryAction(tenantId, cleanName);
      if (res.success && res.category) {
        const nextList = [...localCategories, res.category];
        setLocalCategories(nextList);
        onCategoriesChanged(nextList);
        setNewCatName("");
        setSuccessMsg(`Categoría "${cleanName}" creada exitosamente.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "No se pudo crear la categoría");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al registrar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    const productCount = products.filter((p) => p.category_id === category.id).length;
    if (productCount > 0) {
      const confirmed = window.confirm(
        `Esta categoría tiene ${productCount} producto(s) asignado(s). ¿Estás seguro de que deseas eliminarla?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `¿Deseas eliminar la categoría "${category.name}"?`
      );
      if (!confirmed) return;
    }

    setDeletingId(category.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await deleteCategoryAction(tenantId, category.id);
      if (res.success) {
        const nextList = localCategories.filter((c) => c.id !== category.id);
        setLocalCategories(nextList);
        onCategoriesChanged(nextList);
        setSuccessMsg(`Categoría eliminada.`);
        setTimeout(() => setSuccessMsg(null), 2500);
      } else {
        setErrorMsg(res.error || "No se pudo eliminar la categoría");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al eliminar la categoría");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Gestión de Categorías
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Organiza las secciones del catálogo para tus clientes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Create category input */}
          <form onSubmit={handleCreateCategory} className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              Nueva Categoría
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ej. Tarjetas de Presentación, Pendones, Varios..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 h-10 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newCatName.trim()}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Crear</span>
              </button>
            </div>
          </form>

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Existing Categories list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Categorías Registradas</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {localCategories.length} categorías
              </span>
            </div>

            {localCategories.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-1">
                <Tags className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium">No hay categorías aún en este comercio.</p>
                <p className="text-[11px] text-muted-foreground/80">
                  Escribe un nombre arriba para crear tu primera categoría.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 divide-y divide-border/50 border border-border rounded-2xl overflow-hidden bg-background">
                {localCategories.map((cat, index) => {
                  const prodCount = products.filter((p) => p.category_id === cat.id).length;
                  const isDeleting = deletingId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[11px] font-mono text-muted-foreground w-5 text-center">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {cat.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            slug: {cat.slug}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
                          <Package className="w-3 h-3" />
                          <span>{prodCount} prod.</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Eliminar categoría"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
