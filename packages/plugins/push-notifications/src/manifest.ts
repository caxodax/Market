import type { PluginManifest } from "@marketos/types";

export const PUSH_NOTIFICATIONS_MANIFEST: PluginManifest = {
  id: "push_notifications",
  name: "Web Push & Campañas PWA",
  description:
    "Módulo de notificaciones push web para Progressive Web Apps (PWA) y navegadores móviles/escritorio. Permite difusiones de marketing segmentadas (todos los suscriptores, clientes con compras, clientes sin compras) y avisos automáticos de cambio de estado de pedidos en tiempo real bajo el estándar VAPID.",
  version: "1.0.0",
  category: "growth_operations",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "BellRing",
  required_ports: [],
};
