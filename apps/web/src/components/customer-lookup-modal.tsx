"use client";

import React, { useState } from "react";
import { CustomerAccountSummary, TenantSettings } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { lookupCustomerAction } from "../app/actions";
import { BottomSheetModal } from "./bottom-sheet-modal";
import {
  X,
  Search,
  Award,
  ShoppingBag,
  TrendingUp,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface CustomerLookupModalProps {
  tenantId: string;
  settings: TenantSettings;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerLookupModal({
  tenantId,
  settings,
  isOpen,
  onClose,
}: CustomerLookupModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [data, setData] = useState<CustomerAccountSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSearched(true);

    try {
      const res = await lookupCustomerAction(tenantId, query);
      if (res.success && res.summary) {
        setData(res.summary);
      } else {
        setData(null);
      }
    } catch (err) {
      setErrorMsg("Error al consultar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "DELIVERING":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "READY":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "PREPARING":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "PAYMENT_PENDING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      bodyClassName="space-y-5"
      customHeader={
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">
                Mis Pedidos y Puntos de Fidelidad
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Consulta tu historial de compras y beneficios en {settings.business_name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >
          {/* Lookup Input */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ingresa tu teléfono (ej. 04241234567) o correo"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-4 pr-10 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Buscar</span>
            </button>
          </form>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Results View */}
          {data && (
            <div className="space-y-4 animate-in fade-in">
              {/* Customer summary card */}
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">
                      {data.customer.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Tel: {data.customer.phone}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Cliente Frecuente
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/10">
                  <div className="p-3 rounded-xl bg-card border border-border text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Puntos Acumulados
                      </span>
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {data.loyaltyPoints} <span className="text-xs font-semibold text-muted-foreground">pts</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-500 mb-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Total en Compras
                      </span>
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      ${data.totalSpentUsd.toFixed(2)}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  💡 Acumulas 1 punto por cada $1 gastado en pedidos validados.
                </p>
              </div>

              {/* Order history */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                  <span>Historial de Pedidos ({data.orders.length})</span>
                </h5>

                {data.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-xl">
                    No tienes pedidos registrados aún.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {data.orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
                              {order.order_number}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("es-VE")} •{" "}
                            {order.delivery_type === "DELIVERY"
                              ? "🛵 Delivery"
                              : "🏪 Retiro Tienda"}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-primary">
                            {formatCurrency(order.total_usd, "USD")}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Bs. {order.total_ves.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {searched && !loading && !data && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card space-y-2">
              <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
              <h4 className="text-xs font-bold text-foreground">
                No se encontraron pedidos con este número
              </h4>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Verifica que hayas colocado el mismo teléfono utilizado al momento de realizar tu compra.
              </p>
            </div>
          )}
    </BottomSheetModal>
  );
}
