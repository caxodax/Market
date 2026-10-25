"use client";

import React from "react";
import { Store, DeliveryZone } from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import {
  Truck,
  Store as StoreIcon,
  AlertCircle,
  Loader2,
  MapPin,
  User,
  Phone,
  Navigation,
  ExternalLink,
} from "lucide-react";

export interface CheckoutStepDeliveryProps {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  ciPrefix: "V" | "E" | "J" | "G";
  setCiPrefix: (v: "V" | "E" | "J" | "G") => void;
  ciNumber: string;
  setCiNumber: (v: string) => void;
  deliveryType: "PICKUP" | "DELIVERY";
  setDeliveryType: (v: "PICKUP" | "DELIVERY") => void;
  selectedZoneId: string;
  setSelectedZoneId: (v: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  deliveryReference: string;
  setDeliveryReference: (v: string) => void;
  deliveryZones: DeliveryZone[];
  selectedStore: Store;
  gpsCoords: { lat: number; lng: number; accuracy: number } | null;
  setGpsCoords: (v: { lat: number; lng: number; accuracy: number } | null) => void;
  isLocatingGps: boolean;
  gpsError: string | null;
  onGetGpsCoordinates: () => void;
  isDeliveryActive: boolean;
  isVenezuelaActive: boolean;
  subtotalUsd: number;
  exchangeRate: number;
}

export function CheckoutStepDelivery({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  ciPrefix,
  setCiPrefix,
  ciNumber,
  setCiNumber,
  deliveryType,
  setDeliveryType,
  selectedZoneId,
  setSelectedZoneId,
  deliveryAddress,
  setDeliveryAddress,
  deliveryReference,
  setDeliveryReference,
  deliveryZones,
  selectedStore,
  gpsCoords,
  setGpsCoords,
  isLocatingGps,
  gpsError,
  onGetGpsCoordinates,
  isDeliveryActive,
  isVenezuelaActive,
  subtotalUsd,
  exchangeRate,
}: CheckoutStepDeliveryProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Customer Information Card */}
      <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-primary" />
            Datos del Cliente
          </label>
          <span className="text-[10px] text-muted-foreground font-medium">
            Requeridos para tu orden
          </span>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
              Nombre y Apellido *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Carmen Rodríguez"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div
            className={`grid gap-2.5 ${
              isVenezuelaActive ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {/* Cédula / RIF (Solo si local_venezuela activo) */}
            {isVenezuelaActive && (
              <div>
                <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                  Cédula o RIF *
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={ciPrefix}
                    onChange={(e) =>
                      setCiPrefix(e.target.value as "V" | "E" | "J" | "G")
                    }
                    className="h-11 px-2.5 rounded-xl border border-input bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-primary shrink-0 cursor-pointer"
                    title="Prefijo documento"
                  >
                    <option value="V">V-</option>
                    <option value="E">E-</option>
                    <option value="J">J-</option>
                    <option value="G">G-</option>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    placeholder="Ej. 12345678"
                    value={ciNumber}
                    onChange={(e) =>
                      setCiNumber(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Teléfono / WhatsApp */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3.5" />
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="Ej. 04121234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Mode Card */}
      {isDeliveryActive ? (
        <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5 text-primary" />
            Modalidad de Entrega
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Retiro en Tienda Pill */}
            <button
              type="button"
              onClick={() => setDeliveryType("PICKUP")}
              className={`min-h-[58px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                deliveryType === "PICKUP"
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <StoreIcon className="w-4 h-4 shrink-0" />
              <div className="text-center">
                <span className="text-xs block leading-tight">Retiro en Tienda</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {selectedStore.name}
                </span>
              </div>
            </button>

            {/* Envío a Domicilio Pill */}
            <button
              type="button"
              onClick={() => setDeliveryType("DELIVERY")}
              className={`min-h-[58px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                deliveryType === "DELIVERY"
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <div className="text-center">
                <span className="text-xs block leading-tight">Envío a Domicilio</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {deliveryZones.length} zonas activas
                </span>
              </div>
            </button>
          </div>

          {/* Delivery Fields when DELIVERY selected */}
          {deliveryType === "DELIVERY" && (
            <div className="space-y-3 pt-1 border-t border-border animate-in fade-in">
              <div>
                <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                  Zona de Cobertura Delivery *
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.estimated_time || "45 min"}) —{" "}
                      {z.price_usd === 0
                        ? "Envío GRATIS"
                        : `$${z.price_usd.toFixed(2)} USD`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Satellite GPS Pin Button */}
              <div className="space-y-1.5">
                {!gpsCoords ? (
                  <button
                    type="button"
                    onClick={onGetGpsCoordinates}
                    disabled={isLocatingGps}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all active:scale-[0.99] cursor-pointer"
                  >
                    {isLocatingGps ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Buscando señal satelital GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4 text-primary" />
                        <span>📍 Fijar mi Ubicación GPS Actual</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-emerald-700 dark:text-emerald-300 text-xs truncate">
                          Pin GPS capturado para el motorizado
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 underline font-medium hover:text-emerald-700 flex items-center gap-1"
                        >
                          <span>Ver mi punto en Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGpsCoords(null)}
                      className="text-xs text-muted-foreground hover:text-rose-500 px-2 py-1 font-semibold rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Descartar coordenada"
                    >
                      ✕ Quitar
                    </button>
                  </div>
                )}

                {gpsError && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{gpsError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                  Dirección Exacta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Urbanización, Avenida/Calle, Edificio o N° de casa"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                  Punto de Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Color de reja, negocio cercano o indicaciones al motorizado"
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <StoreIcon className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-foreground block">
              Modalidad: Retiro en Tienda
            </span>
            <span className="text-muted-foreground text-[11px]">
              {selectedStore.name}
            </span>
          </div>
        </div>
      )}

      {/* Subtotal preview banner */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Subtotal de compra:</span>
        <div className="text-right">
          <span className="font-black text-sm text-foreground">
            {formatCurrency(subtotalUsd, "USD")}
          </span>
          {isVenezuelaActive && (
            <span className="block text-[10px] font-semibold text-muted-foreground">
              Bs. {convertUsdToVes(subtotalUsd, exchangeRate).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
