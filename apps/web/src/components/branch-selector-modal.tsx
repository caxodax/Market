"use client";

import React, { useState } from "react";
import { Store } from "@marketos/types";
import { BottomSheetModal } from "./bottom-sheet-modal";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  X,
  Phone,
  Clock,
  Sparkles,
  Loader2,
  Store as StoreIcon,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

// Default reference coordinates for Barquisimeto & Cabudare stores if not in DB
const STORE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "NS-01": { lat: 10.054, lng: -69.298 }, // Nueva Segovia, Barquisimeto
  "CBD-01": { lat: 10.029, lng: -69.261 }, // Cabudare Intercomunal
  "EST-01": { lat: 10.062, lng: -69.285 }, // Los Leones / Este
};

// Haversine formula to calculate distance in km
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

interface BranchSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  selectedStore: Store;
  onSelectStore: (store: Store, distanceKm?: number) => void;
}

export function BranchSelectorModal({
  isOpen,
  onClose,
  stores,
  selectedStore,
  onSelectStore,
}: BranchSelectorModalProps) {
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const applyCoordinates = (
    lat: number,
    lng: number,
    sourceLabel?: string
  ) => {
    const calculated: Record<string, number> = {};
    let nearestStore: Store | null = null;
    let minDistance = Infinity;

    for (const store of stores) {
      // Fallback coordinates based on code or index
      const coords =
        STORE_COORDINATES[store.code] ||
        (store.code.includes("NS")
          ? { lat: 10.054, lng: -69.298 }
          : { lat: 10.029, lng: -69.261 });

      const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
      calculated[store.id] = dist;

      if (dist < minDistance) {
        minDistance = dist;
        nearestStore = store;
      }
    }

    setDistances(calculated);
    setDetectingGps(false);

    if (nearestStore !== null) {
      const matchedStore: Store = nearestStore;
      onSelectStore(matchedStore, minDistance);
      const tag = sourceLabel ? ` (${sourceLabel})` : "";
      setGpsMessage(
        `¡Ubicación detectada${tag}! Tu sucursal más cercana es ${matchedStore.name} (${minDistance} km).`
      );
    }
  };

  const fetchFallbackIpLocation = async (): Promise<boolean> => {
    try {
      // 1. Intentar endpoint interno first-party
      const res = await fetch("/api/geo", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          applyCoordinates(data.lat, data.lng, data.city || "Red");
          return true;
        }
      }
    } catch {
      // Fallback a cliente
    }

    try {
      // 2. Intentar servicio público cliente
      const res2 = await fetch("https://ipwho.is/", { cache: "no-store" });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.latitude && data2.longitude) {
          applyCoordinates(data2.latitude, data2.longitude, data2.city || "Red");
          return true;
        }
      }
    } catch {
      // Ambos fallaron
    }

    return false;
  };

  // Detect nearest branch using Browser Geolocation with IP Fallback
  const handleDetectGps = async () => {
    setDetectingGps(true);
    setGpsMessage(null);

    if (typeof window === "undefined" || !navigator.geolocation) {
      const resolved = await fetchFallbackIpLocation();
      if (!resolved) {
        setDetectingGps(false);
        setGpsMessage("Tu navegador no soporta geolocalización. Selecciona tu sede de la lista.");
      }
      return;
    }

    // 1. Intentar con navegador (modo standard accuracy: mucho más confiable en laptops/desktops sin GPS de hardware)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          "GPS"
        );
      },
      async (error) => {
        // Si el usuario denegó expresamente o el hardware no tiene satélite/proveedor disponible
        const resolved = await fetchFallbackIpLocation();
        if (!resolved) {
          setDetectingGps(false);
          if (error.code === error.PERMISSION_DENIED) {
            setGpsMessage(
              "Permiso de ubicación no concedido en el navegador. Haz clic en el candado 🔒 de tu barra de direcciones para habilitarlo, o selecciona tu sede directamente."
            );
          } else if (error.code === error.TIMEOUT) {
            setGpsMessage(
              "Tiempo de espera agotado buscando señal GPS. Por favor selecciona tu sede de la lista."
            );
          } else {
            setGpsMessage(
              "No se pudo determinar tu posición por GPS. Por favor selecciona tu sede de la lista."
            );
          }
        }
      },
      {
        enableHighAccuracy: false, // Standard accuracy no exige chip GPS dedicado y funciona con Wi-Fi/red
        timeout: 6000,
        maximumAge: 300000, // Usa ubicación reciente en caché si existe (5 min)
      }
    );
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      bodyClassName="p-5 space-y-4"
      customHeader={
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <StoreIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Selecciona tu Sucursal
              </h2>
              <p className="text-xs text-muted-foreground">
                Elige la sede para consultar stock y calcular el delivery más rápido.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >
          {/* GPS Quick Action Button */}
          <button
            onClick={handleDetectGps}
            disabled={detectingGps}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 hover:from-emerald-600/20 hover:to-blue-600/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-between transition-all cursor-pointer group shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                {detectingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <Navigation className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div className="text-left">
                <span className="block font-bold text-foreground">
                  {detectingGps
                    ? "Calculando distancias satelitales..."
                    : "Detectar sucursal más cercana con GPS"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Ajusta automáticamente stock y delivery a tu ubicación actual
                </span>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
          </button>

          {gpsMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in transition-all ${
                gpsMessage.startsWith("¡Ubicación")
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "bg-muted/70 border-border text-muted-foreground"
              }`}
            >
              {gpsMessage.startsWith("¡Ubicación") ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{gpsMessage}</span>
            </div>
          )}

          {/* Stores List */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Sedes Disponibles ({stores.length})
            </h3>

            {stores.map((store) => {
              const isSelected = store.id === selectedStore.id;
              const distance = distances[store.id];

              return (
                <button
                  key={store.id}
                  onClick={() => {
                    onSelectStore(store, distance);
                    onClose();
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                    isSelected
                      ? "bg-primary/5 border-primary shadow-sm"
                      : "bg-card border-border hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {store.name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {store.code}
                      </span>
                      {distance !== undefined && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          📍 a {distance} km
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{store.address}</span>
                    </p>

                    {store.phone && (
                      <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{store.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Activa</span>
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Modal Footer note */}
          <div className="pt-2 text-center text-[11px] text-muted-foreground border-t border-border">
            <span>Los precios se mantienen iguales en todas las sucursales según la tasa oficial del día.</span>
          </div>
    </BottomSheetModal>
  );
}
