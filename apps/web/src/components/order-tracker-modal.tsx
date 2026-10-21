"use client";

import React, { useState, useEffect } from "react";
import { Order, TenantSettings } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { trackOrderAction } from "../app/actions";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { CustomerOrderTicketModal } from "./customer-order-ticket-modal";
import {
  X,
  Search,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Loader2,
  Calendar,
  Eye,
  ShoppingBag,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  initialQuery?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  CREATED: {
    label: "Creado",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    desc: "Pedido recibido en el sistema",
  },
  PAYMENT_PENDING: {
    label: "Pago por Validar",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    desc: "Esperando confirmación del comprobante",
  },
  PAYMENT_APPROVED: {
    label: "Pago Aprobado",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    desc: "Pago verificado exitosamente",
  },
  PREPARING: {
    label: "En Preparación",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    desc: "Empacando tus productos en tienda",
  },
  READY: {
    label: "Listo para Entrega",
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    desc: "Listo para despacho o retiro",
  },
  DELIVERING: {
    label: "En Camino",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    desc: "Repartidor en ruta a tu dirección",
  },
  COMPLETED: {
    label: "Entregado",
    color: "bg-emerald-600 text-white border-transparent",
    desc: "Pedido entregado con éxito",
  },
  CANCELLED: {
    label: "Cancelado",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    desc: "Pedido cancelado o pago rechazado",
  },
};

export function OrderTrackerModal({
  isOpen,
  onClose,
  settings,
  initialQuery,
}: OrderTrackerModalProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-fill and search if initialQuery or saved credentials exist
  useEffect(() => {
    if (!isOpen) return;

    const targetQuery = initialQuery?.trim();
    if (targetQuery) {
      setQuery(targetQuery);
      setLoading(true);
      setSearched(true);
      trackOrderAction(settings.tenant_id, targetQuery)
        .then((res) => {
          if (res.success) {
            const list = res.orders || [];
            setOrders(list);
            if (list.length === 1) {
              setSelectedOrderForDetails(list[0]);
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    try {
      const savedCi =
        localStorage.getItem(`marketos_customer_ci_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_ci");
      const savedPhone =
        localStorage.getItem(`marketos_customer_phone_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_phone");

      const defaultQuery = savedCi || savedPhone;

      if (defaultQuery && !query) {
        setQuery(defaultQuery);
        setLoading(true);
        setSearched(true);
        trackOrderAction(settings.tenant_id, defaultQuery.trim()).then((res) => {
          if (res.success) {
            setOrders(res.orders || []);
          }
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    } catch {}
  }, [isOpen, initialQuery, settings.tenant_id]);

  // Periodic background polling every 4 seconds when tracker is open and active
  useEffect(() => {
    if (!isOpen || !query.trim() || !searched) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await trackOrderAction(settings.tenant_id, query.trim());
        if (isMounted && res.success && res.orders) {
          setOrders(res.orders);
          if (selectedOrderForDetails) {
            const fresh = res.orders.find((o) => o.id === selectedOrderForDetails.id);
            if (fresh) setSelectedOrderForDetails(fresh);
          }
        }
      } catch {
        // silent polling
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, query, searched, selectedOrderForDetails?.id, settings.tenant_id]);

  const handleManualRefresh = async () => {
    if (!query.trim()) return;
    setIsRefreshing(true);
    try {
      const res = await trackOrderAction(settings.tenant_id, query.trim());
      if (res.success && res.orders) {
        setOrders(res.orders);
        if (selectedOrderForDetails) {
          const fresh = res.orders.find((o) => o.id === selectedOrderForDetails.id);
          if (fresh) setSelectedOrderForDetails(fresh);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await trackOrderAction(settings.tenant_id, query.trim());
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BottomSheetModal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="max-w-lg"
        bodyClassName="p-0 flex flex-col"
        customHeader={
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Rastrear mis Pedidos
              </h2>
              <p className="text-xs text-muted-foreground">
                Ingresa tu Cédula, teléfono o código de pedido (ej. ORD-289699)
              </p>
            </div>
            <button
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        }
      >
        {/* Search bar */}
        <div className="p-4 border-b border-border bg-background">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                required
                placeholder="Cédula (V-12345678), Teléfono o N° Pedido..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-input bg-muted/30 text-xs focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Buscar</span>
              )}
            </button>
          </form>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {orders.length > 0 && (
            <div className="flex items-center justify-between pb-1 text-xs">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{orders.length} {orders.length === 1 ? "pedido en seguimiento" : "pedidos en seguimiento"}</span>
              </span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10 cursor-pointer"
                title="Actualizar estado de pedidos"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
              </button>
            </div>
          )}

          {searched && !loading && orders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No se encontraron pedidos asociados</p>
              <p className="text-[11px] mt-1">Verifica que tu cédula, teléfono o número de orden coincidan.</p>
            </div>
          )}

          {orders.map((ord) => {
            const statusInfo =
              STATUS_LABELS[ord.status] || {
                label: ord.status,
                color: "bg-muted text-muted-foreground border-border",
                desc: "Estado del pedido",
              };

            return (
              <div
                key={ord.id}
                className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-foreground">
                      {ord.order_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    {ord.customer_id_number && (
                      <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>{ord.customer_id_number}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-black text-primary">
                    {formatCurrency(ord.total_usd, "USD")}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {statusInfo.desc}
                </p>

                {/* Items Purchased Preview */}
                {ord.items && ord.items.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      <span>Artículos ordenados ({ord.items.reduce((acc, it) => acc + it.quantity, 0)}):</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {ord.items.map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(ord.created_at).toLocaleDateString("es-VE")}</span>
                    <span className="mx-1">•</span>
                    <span>
                      {ord.delivery_type === "DELIVERY"
                        ? "Delivery a Domicilio"
                        : "Retiro en Tienda"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderForDetails(ord)}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-bold text-xs bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Ticket</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheetModal>

      {/* Dedicated Customer Order Ticket Modal */}
      {selectedOrderForDetails && (
        <CustomerOrderTicketModal
          order={selectedOrderForDetails}
          isOpen={!!selectedOrderForDetails}
          onClose={() => setSelectedOrderForDetails(null)}
          settings={settings}
        />
      )}
    </>
  );
}
