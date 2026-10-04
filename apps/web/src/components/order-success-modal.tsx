"use client";

import React from "react";
import { Order, TenantSettings } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { CheckCircle2, MessageCircle, X, Clock } from "lucide-react";

interface OrderSuccessModalProps {
  order: Order | null;
  settings: TenantSettings;
  onClose: () => void;
}

export function OrderSuccessModal({
  order,
  settings,
  onClose,
}: OrderSuccessModalProps) {
  if (!order) return null;

  // WhatsApp click-to-chat link
  const message = encodeURIComponent(
    `¡Hola ${settings.business_name}! 👋\n\nAcabo de realizar un pedido a través de su catálogo digital:\n` +
      `📦 *Pedido:* ${order.order_number}\n` +
      `💵 *Total:* $${order.total_usd.toFixed(2)} USD (Bs. ${order.total_ves.toFixed(2)})\n` +
      `📍 *Entrega:* ${order.delivery_type === "PICKUP" ? "Retiro en Tienda" : "Delivery a Domicilio"}\n\n` +
      `Adjunto mi comprobante para que puedan validarlo y comenzar a prepararlo. ¡Muchas gracias!`
  );

  const whatsappUrl = `https://wa.me/${settings.whatsapp_number}?text=${message}`;

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
        </div>

        {/* Order Details box */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-2 text-left">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto Total USD:</span>
            <span className="font-bold text-foreground">
              {formatCurrency(order.total_usd, "USD")}
            </span>
          </div>
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
        </div>

        {/* Direct WhatsApp Call to Action */}
        <div className="space-y-2 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Notificar a WhatsApp</span>
          </a>

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
