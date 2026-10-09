"use client";

import React, { useState } from "react";
import { Coupon, CreateCouponInput, UpdateCouponInput, DiscountType } from "@marketos/types";
import {
  createCouponAction,
  updateCouponAction,
  toggleCouponAction,
  deleteCouponAction,
} from "../app/admin/actions";
import { formatCurrency } from "@marketos/utils";
import {
  Ticket,
  Plus,
  Calendar,
  DollarSign,
  Percent,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  Copy,
  Check,
  Power,
  Sparkles,
  Pencil,
} from "lucide-react";

interface CouponManagerProps {
  tenantId: string;
  initialCoupons: Coupon[];
}

export function CouponManager({ tenantId, initialCoupons }: CouponManagerProps) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("FIXED_USD");
  const [discountValue, setDiscountValue] = useState<number | "">("");
  const [minOrderAmount, setMinOrderAmount] = useState<number | "">("");
  const [maxDiscountUsd, setMaxDiscountUsd] = useState<number | "">("");
  const [usageLimit, setUsageLimit] = useState<number | "">("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCopy = (couponCode: string) => {
    try {
      navigator.clipboard.writeText(couponCode);
      setCopiedCode(couponCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (e) {
      console.warn("Could not copy coupon code", e);
    }
  };

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setCode("");
    setDescription("");
    setDiscountType("FIXED_USD");
    setDiscountValue("");
    setMinOrderAmount("");
    setMaxDiscountUsd("");
    setUsageLimit("");
    setStartsAt("");
    setExpiresAt("");
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDescription(coupon.description || "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(coupon.discount_value);
    setMinOrderAmount(coupon.min_order_amount_usd || "");
    setMaxDiscountUsd(coupon.max_discount_usd || "");
    setUsageLimit(coupon.usage_limit || "");
    setStartsAt(coupon.starts_at ? coupon.starts_at.slice(0, 10) : "");
    setExpiresAt(coupon.expires_at ? coupon.expires_at.slice(0, 10) : "");
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmitCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Indica el código del cupón");
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      setError("Indica una cantidad de descuento válida mayor a 0");
      return;
    }

    if (startsAt && expiresAt && new Date(startsAt) > new Date(expiresAt)) {
      setError("La fecha de inicio no puede ser posterior a la fecha de vencimiento");
      return;
    }

    setLoading(true);
    setError(null);

    const cleanCode = code.trim().toUpperCase();
    const isoStarts = startsAt ? new Date(startsAt + "T00:00:00").toISOString() : null;
    const isoExpires = expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null;

    if (editingCoupon) {
      const input: UpdateCouponInput = {
        tenantId,
        couponId: editingCoupon.id,
        code: cleanCode,
        description: description.trim() || undefined,
        discountType,
        discountValue: Number(discountValue),
        minOrderAmountUsd: minOrderAmount ? Number(minOrderAmount) : 0,
        maxDiscountUsd: maxDiscountUsd ? Number(maxDiscountUsd) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        startsAt: isoStarts,
        expiresAt: isoExpires,
      };

      const res = await updateCouponAction(input);
      setLoading(false);

      if (res.success && res.coupon) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === editingCoupon.id ? res.coupon! : c))
        );
        setIsModalOpen(false);
      } else {
        setError(res.error || "Error al actualizar el cupón");
      }
    } else {
      const input: CreateCouponInput = {
        tenantId,
        code: cleanCode,
        description: description.trim() || undefined,
        discountType,
        discountValue: Number(discountValue),
        minOrderAmountUsd: minOrderAmount ? Number(minOrderAmount) : 0,
        maxDiscountUsd: maxDiscountUsd ? Number(maxDiscountUsd) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        startsAt: isoStarts,
        expiresAt: isoExpires,
      };

      const res = await createCouponAction(input);
      setLoading(false);

      if (res.success && res.coupon) {
        setCoupons((prev) => [res.coupon!, ...prev]);
        setIsModalOpen(false);
      } else {
        setError(res.error || "Error al crear el cupón");
      }
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    setTogglingId(coupon.id);
    const newStatus = !coupon.is_active;
    const res = await toggleCouponAction(tenantId, coupon.id, newStatus);
    setTogglingId(null);

    if (res.success && res.coupon) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: newStatus } : c))
      );
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este cupón? Esta acción no se puede deshacer.")) {
      return;
    }

    setDeletingId(couponId);
    const res = await deleteCouponAction(tenantId, couponId);
    setDeletingId(null);

    if (res.success) {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    }
  };

  const isExpired = (expiresAtStr?: string | null) => {
    if (!expiresAtStr) return false;
    const expiry = new Date(expiresAtStr).getTime();
    return !isNaN(expiry) && Date.now() > expiry;
  };

  const isScheduled = (startsAtStr?: string | null) => {
    if (!startsAtStr) return false;
    const starts = new Date(startsAtStr).getTime();
    return !isNaN(starts) && Date.now() < starts;
  };

  return (
    <div className="space-y-5 animate-in fade-in w-full max-w-full">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs w-full">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary shrink-0" />
              <span>Gestión de Cupones & Descuentos</span>
            </h2>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              {coupons.length} Registrados
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crea códigos promocionales con fecha de inicio, fecha de vencimiento y edición libre.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Crear Nuevo Cupón</span>
        </button>
      </div>

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-border bg-card space-y-3 w-full">
          <Ticket className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-foreground">No tienes cupones creados</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Crea tu primer cupón para premiar a tus clientes con descuentos fijos o en porcentaje en su carrito de compras.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Cupón</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 w-full">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.expires_at);
            const scheduled = isScheduled(coupon.starts_at);
            const isDeleting = deletingId === coupon.id;
            const isToggling = togglingId === coupon.id;

            return (
              <div
                key={coupon.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 sm:space-y-4 shadow-xs w-full ${
                  !coupon.is_active || expired
                    ? "bg-muted/30 border-border opacity-85"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                {/* Header: Code & Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 tracking-wider truncate">
                        {coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(coupon.code)}
                        className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                        title="Copiar código del cupón"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="shrink-0">
                      {scheduled ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          Programado
                        </span>
                      ) : expired ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                          Vencido
                        </span>
                      ) : coupon.is_active ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Activo
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          Pausado
                        </span>
                      )}
                    </div>
                  </div>

                  {coupon.description && (
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                      {coupon.description}
                    </p>
                  )}
                </div>

                {/* Details Card */}
                <div className="p-3 rounded-xl bg-background border border-border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Descuento:</span>
                    <strong className="font-bold text-foreground text-sm">
                      {coupon.discount_type === "FIXED_USD" ? (
                        <span className="text-emerald-600">
                          -${coupon.discount_value.toFixed(2)} USD
                        </span>
                      ) : (
                        <span className="text-primary">
                          {coupon.discount_value}% OFF
                          {coupon.max_discount_usd && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              (Tope: ${coupon.max_discount_usd})
                            </span>
                          )}
                        </span>
                      )}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Compra Mínima:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {coupon.min_order_amount_usd > 0
                        ? formatCurrency(coupon.min_order_amount_usd, "USD")
                        : "Sin mínimo"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Usos registrados:</span>
                    <span className="font-mono text-muted-foreground">
                      {coupon.usage_count} {coupon.usage_limit ? `/ ${coupon.usage_limit}` : "usos"}
                    </span>
                  </div>

                  {/* Dates: Starts and Expires */}
                  <div className="pt-2 border-t border-border/60 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary shrink-0" />
                        <span>Inicio:</span>
                      </span>
                      <span className="font-medium text-foreground">
                        {coupon.starts_at
                          ? new Date(coupon.starts_at).toLocaleDateString("es-VE", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Inmediato"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span>Vence:</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          expired ? "text-destructive font-bold" : "text-foreground"
                        }`}
                      >
                        {coupon.expires_at
                          ? new Date(coupon.expires_at).toLocaleDateString("es-VE", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Sin fecha límite"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions: Pause, Edit, Delete */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(coupon)}
                    disabled={isToggling}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                      coupon.is_active
                        ? "bg-muted hover:bg-muted/80 text-muted-foreground border-border"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{coupon.is_active ? "Pausar" : "Reactivar"}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(coupon)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition-colors cursor-pointer"
                      title="Editar cupón"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(coupon.id)}
                      disabled={isDeleting}
                      className="inline-flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Eliminar cupón"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline sm:ml-1">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE & EDIT COUPON MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {editingCoupon ? `Editar Cupón (${editingCoupon.code})` : "Crear Nuevo Cupón"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {editingCoupon
                      ? "Modifica el descuento, fechas de vigencia y límites."
                      : "Configura el código, valor y fechas de activación."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCoupon} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Code */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Código del Cupón *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                  }
                  placeholder="Ej: BIENVENIDO2026, PROMO15"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  El cliente escribirá este código en el carrito antes de pagar.
                </p>
              </div>

              {/* Discount Type Selector */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Tipo de Descuento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType("FIXED_USD")}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      discountType === "FIXED_USD"
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Monto Fijo ($ USD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType("PERCENTAGE")}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      discountType === "PERCENTAGE"
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span>Porcentaje (%)</span>
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Cantidad de Descuento *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-muted-foreground font-bold">
                    {discountType === "FIXED_USD" ? "$" : "%"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={discountValue}
                    onChange={(e) =>
                      setDiscountValue(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    placeholder={discountType === "FIXED_USD" ? "Ej: 5.00" : "Ej: 10"}
                    className="w-full h-10 pl-8 pr-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* DATES: Start Date & Expiration Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Fecha de Inicio (Válido desde)</span>
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Déjalo vacío para activar de inmediato.
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-destructive" />
                    <span>Fecha de Vencimiento</span>
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Déjalo vacío si no tiene caducidad.
                  </p>
                </div>
              </div>

              {/* Min Order Amount & Usage Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Compra Mínima ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) =>
                      setMinOrderAmount(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {discountType === "PERCENTAGE" ? (
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1.5">
                      Tope Máximo Descuento ($)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={maxDiscountUsd}
                      onChange={(e) =>
                        setMaxDiscountUsd(e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                      placeholder="Sin tope"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1.5">
                      Límite de Usos Totales
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={usageLimit}
                      onChange={(e) =>
                        setUsageLimit(e.target.value === "" ? "" : parseInt(e.target.value))
                      }
                      placeholder="Ilimitado"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Descripción o Motivo (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Descuento especial de inauguración"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingCoupon ? "Guardando..." : "Creando..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{editingCoupon ? "Guardar Cambios" : "Crear Cupón"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
