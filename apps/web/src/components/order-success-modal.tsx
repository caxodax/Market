"use client";

import React from "react";
import { Order, TenantSettings, TenantModuleId } from "@marketos/types";
import {
  formatCurrency,
  generateCustomerOrderWhatsAppLink,
} from "@marketos/utils";
import { CheckCircle2, MessageCircle, X, Clock, ShoppingBag, Eye, ShieldCheck } from "lucide-react";

interface OrderSuccessModalProps {
  order: Order | null;
  settings: TenantSettings;
  onClose: () => void;
  onViewTicket?: (order: Order) => void;
  activeModuleIds?: TenantModuleId[];
}

export function OrderSuccessModal({
  order,
  settings,
  onClose,
  onViewTicket,
  activeModuleIds = [],
}: OrderSuccessModalProps) {
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  if (!order) return null;

  // Formatted WhatsApp order link
  const whatsappUrl = generateCustomerOrderWhatsAppLink({
    tenantPhone: settings.whatsapp_number || settings.phone,
    businessName: settings.business_name,
    order,
    isVenezuelaActive,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 text-xs font-semibold mb-2">
            <Clock className="w-3 h-3" />
            Pendiente de Validación
          </span>
          <h3 className="text-xl font-black text-foreground">
            ¡Pedido Registrado con Éxito!
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Tu orden ha sido asignada con el número:
          </p>
          <p className="font-mono text-lg font-bold text-primary mt-1">
            {order.order_number}
          </p>

          {isVenezuelaActive && order.customer_id_number && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-xs font-mono font-bold text-primary">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cédula: {order.customer_id_number}</span>
            </div>
          )}
        </div>

        {/* Order Details box */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-2 text-left">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto Total USD:</span>
            <span className="font-bold text-foreground">
              {formatCurrency(order.total_usd, "USD")}
            </span>
          </div>
          {isVenezuelaActive && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto Total en Bolívares:</span>
                <span className="font-bold text-primary">
                  Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tasa aplicada:</span>
                <span className="font-mono text-muted-foreground">
                  Bs. {order.exchange_rate_applied.toFixed(2)}/USD
                </span>
              </div>
            </>
          )}
        </div>

        {/* Ordered Items Preview */}
        {order.items && order.items.length > 0 && (
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-2 text-left">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
              <span>Productos en tu orden ({order.items.reduce((acc, it) => acc + it.quantity, 0)}):</span>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-border/50 pr-1">
              {order.items.map((item, idx) => (
                <div key={item.id || idx} className="py-1.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="font-bold text-primary shrink-0">{item.quantity}x</span>
                    <span className="text-foreground truncate">{item.product_name}</span>
                  </div>
                  <span className="font-semibold text-foreground shrink-0">
                    {formatCurrency(item.total_price_usd, "USD")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct WhatsApp Call to Action & Ticket Viewer */}
        <div className="space-y-2 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Notificar a WhatsApp</span>
          </a>

          {onViewTicket && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewTicket(order);
              }}
              className="w-full h-11 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Ver Ticket Digital y Código QR</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted"
          >
            Volver al Catálogo
          </button>
        </div>
      </div>
    </div>
  );
}
