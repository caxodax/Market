"use client";

import React, { useState, useMemo } from "react";
import {
  PaymentProof,
  Order,
  TenantSettings,
  TenantModuleId,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { reviewPaymentAction } from "@/app/admin/actions";
import { toast } from "sonner";
import {
  FileCheck2,
  ExternalLink,
  Eye,
  CheckCircle,
  Loader2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { EmptyState } from "./ui/empty-state";

const OrderDetailsModal = dynamic(
  () => import("./order-details-modal").then((m) => m.OrderDetailsModal)
);

interface PaymentsViewProps {
  initialPayments: PaymentProof[];
  initialOrders: Order[];
  settings: TenantSettings;
  activeModuleIds?: TenantModuleId[];
}

export function PaymentsView({
  initialPayments,
  initialOrders,
  settings,
  activeModuleIds = [],
}: PaymentsViewProps) {
  const [payments, setPayments] = useState<PaymentProof[]>(initialPayments);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (statusFilter !== "ALL" && payment.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const relatedOrder = orders.find((o) => o.id === payment.order_id);
      const matchRef = payment.reference_number?.toLowerCase().includes(q);
      const matchBank = payment.bank_name?.toLowerCase().includes(q);
      const matchMethod = payment.method?.toLowerCase().includes(q);
      const matchOrder = relatedOrder?.order_number?.toLowerCase().includes(q);
      const matchCustomer = relatedOrder?.customer_name?.toLowerCase().includes(q);
      return Boolean(matchRef || matchBank || matchMethod || matchOrder || matchCustomer);
    });
  }, [payments, orders, statusFilter, searchQuery]);

  const pendingCount = useMemo(
    () => payments.filter((p) => p.status === "PENDING").length,
    [payments]
  );
  const approvedCount = useMemo(
    () => payments.filter((p) => p.status === "APPROVED").length,
    [payments]
  );
  const rejectedCount = useMemo(
    () => payments.filter((p) => p.status === "REJECTED").length,
    [payments]
  );

  const handleReview = async (paymentId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(paymentId);
    // Optimistic UI update
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status } : p))
    );

    try {
      const res = await reviewPaymentAction(settings.tenant_id, paymentId, status);
      if (res?.success) {
        toast.success(
          status === "APPROVED"
            ? "¡Comprobante de pago aprobado con éxito!"
            : "Comprobante rechazado correctamente."
        );
      } else {
        toast.error(res?.error || "Error al actualizar comprobante.");
        // Revert on error
        setPayments(initialPayments);
      }
    } catch {
      toast.error("Error de comunicación al revisar el pago");
      setPayments(initialPayments);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-view-enter">
      {/* 1. Header & KPI Cards: Big Number / Small Label */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setStatusFilter("PENDING")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "PENDING"
              ? "border-amber-500/50 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md"
              : "border-border bg-card hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Por Validar
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Pendientes
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {pendingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Requieren atención inmediata</span>
          </p>
        </div>

        <div
          onClick={() => setStatusFilter("APPROVED")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "APPROVED"
              ? "border-emerald-500/50 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md"
              : "border-border bg-card hover:border-emerald-500/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Aprobados
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Conciliados
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {approvedCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Fondos verificados y confirmados</span>
          </p>
        </div>

        <div
          onClick={() => setStatusFilter("REJECTED")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "REJECTED"
              ? "border-destructive/50 bg-destructive/5 ring-2 ring-destructive/20 shadow-md"
              : "border-border bg-card hover:border-destructive/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Rechazados
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              No Válidos
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {rejectedCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span>Comprobantes con inconsistencias</span>
          </p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por referencia, banco, cliente u orden..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: `Todos (${payments.length})` },
            { id: "PENDING", label: `Por Validar (${pendingCount})` },
            { id: "APPROVED", label: `Aprobados (${approvedCount})` },
            { id: "REJECTED", label: `Rechazados (${rejectedCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === pill.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Payments List */}
      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={
            statusFilter === "PENDING"
              ? "¡Al día! No hay comprobantes por conciliar"
              : "No se encontraron comprobantes"
          }
          description={
            statusFilter === "PENDING"
              ? "Todos los pagos registrados han sido verificados. Comparte el catálogo con tus clientes para seguir vendiendo."
              : "No hay registros con los filtros de búsqueda o estado seleccionados."
          }
          action={
            statusFilter !== "ALL" || searchQuery
              ? {
                  label: "Restablecer Filtros",
                  onClick: () => {
                    setStatusFilter("ALL");
                    setSearchQuery("");
                  },
                }
              : {
                  label: "Ver Pedidos del Día",
                  href: "/admin/orders",
                }
          }
        />
      ) : (
        <div className="grid gap-3.5">
          {filteredPayments.map((payment) => {
            const relatedOrder = orders.find((o) => o.id === payment.order_id);

            return (
              <div
                key={payment.id}
                className="p-5 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-primary/30 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm sm:text-base font-black text-foreground">
                      {relatedOrder?.order_number || payment.order_id}
                    </span>
                    <span
                      className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        payment.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : payment.status === "REJECTED"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>

                  <div className="text-sm text-foreground/90 space-y-1.5">
                    <p className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-foreground font-black">Método:</strong>{" "}
                      <span className="font-semibold">{payment.method} • {payment.bank_name}</span>
                    </p>
                    <p className="flex items-center gap-2 flex-wrap">
                      <strong className="text-foreground font-black">Referencia:</strong>{" "}
                      <span className="font-mono font-black text-sm text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                        {payment.reference_number}
                      </span>
                    </p>
                    <p className="flex items-center gap-2 flex-wrap pt-0.5">
                      <strong className="text-foreground font-black">Monto Reportado:</strong>{" "}
                      <span className="font-mono font-black text-base sm:text-lg text-foreground">
                        {payment.currency === "USD"
                          ? formatCurrency(payment.amount, "USD")
                          : payment.currency === "VES"
                          ? `Bs. ${payment.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                          : formatCurrency(payment.amount, payment.currency as any)}
                      </span>
                    </p>
                  </div>

                  {payment.proof_image_url && (
                    <div className="pt-1">
                      <a
                        href={payment.proof_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ver captura de comprobante</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {relatedOrder && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForModal(relatedOrder)}
                      className="px-3.5 py-2 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Eye className="w-4 h-4 text-primary" />
                      <span>Ver Pedido</span>
                    </button>
                  )}

                  {payment.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={processingId === payment.id}
                        onClick={() => handleReview(payment.id, "REJECTED")}
                        className="px-3.5 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs sm:text-sm font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                      >
                        Rechazar
                      </button>

                      <button
                        type="button"
                        disabled={processingId === payment.id}
                        onClick={() => handleReview(payment.id, "APPROVED")}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs sm:text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span>Aprobar Pago</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrderForModal && (
        <OrderDetailsModal
          order={selectedOrderForModal}
          isOpen={Boolean(selectedOrderForModal)}
          onClose={() => setSelectedOrderForModal(null)}
          settings={settings}
          activeModuleIds={activeModuleIds}
        />
      )}
    </div>
  );
}
