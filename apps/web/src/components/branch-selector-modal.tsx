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
  Sparkles,
  Loader2,
  Store as StoreIcon,
  ChevronRight,
  AlertCircle,
  Compass,
} from "lucide-react";

// Default reference coordinates for Barquisimeto & Cabudare stores if not in DB
const STORE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "NS-01": { lat: 10.054, lng: -69.298 }, // Calle 3 entre Carreras 1 y 2, Nueva Segovia, Barquisimeto
  "CBD-01": { lat: 10.029, lng: -69.261 }, // Cabudare Intercomunal
  "EST-01": { lat: 10.062, lng: -69.285 }, // Los Leones / Este
};

// Sectores metropolitanos de Barquisimeto y Cabudare para selección rápida y precisa
export const METROPOLITAN_SECTORS = [
  {
    id: "norte",
    name: "Zona Norte",
    detail: "El Cují / Tamaca / Carorita",
    icon: "🧭",
    coords: { lat: 10.140, lng: -69.312 }, // ~9.7 km de Sucursal Nueva Segovia
  },
  {
    id: "este",
    name: "Este / Nueva Segovia",
    detail: "Nueva Segovia / Los Leones / Lara",
    icon: "🏢",
    coords: { lat: 10.058, lng: -69.295 }, // ~0.6 km de Sucursal Nueva Segovia
  },
  {
    id: "centro",
    name: "Centro",
    detail: "Carrera 19 / Av. Vargas / 20",
    icon: "🏙️",
    coords: { lat: 10.068, lng: -69.317 }, // ~2.6 km de Sucursal Nueva Segovia
  },
  {
    id: "oeste",
    name: "Oeste",
    detail: "Obelisco / Pedro León Torres",
    icon: "🌳",
    coords: { lat: 10.066, lng: -69.355 }, // ~6.4 km de Sucursal Nueva Segovia
  },
  {
    id: "cabudare",
    name: "Cabudare",
    detail: "Valle Hondo / La Mora / Intercomunal",
    icon: "🛵",
    coords: { lat: 10.030, lng: -69.260 }, // ~5.0 km de Sucursal Nueva Segovia
  },
];

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
  onSelectStore: (store: Store, distanceKm?: number, sectorName?: string) => void;
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
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);

  if (!isOpen) return null;

  const applyCoordinates = (
    lat: number,
    lng: number,
    sourceLabel?: string,
    sectorId?: string
  ) => {
    const calculated: Record<string, number> = {};
    let nearestStore: Store | null = null;
    let minDistance = Infinity;

    for (const store of stores) {
      // Coordinates from store record or known store code
      const coords =
        (store as any).latitude && (store as any).longitude
          ? { lat: Number((store as any).latitude), lng: Number((store as any).longitude) }
          : STORE_COORDINATES[store.code] || null;

      if (!coords) continue;

      const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
      calculated[store.id] = dist;

      if (dist < minDistance) {
        minDistance = dist;
        nearestStore = store;
      }
    }

    setDistances(calculated);
    setDetectingGps(false);
    if (sectorId) {
      setActiveSectorId(sectorId);
    }

    if (nearestStore !== null) {
      const matchedStore: Store = nearestStore;
      onSelectStore(matchedStore, minDistance, sourceLabel);

      // Sanity check: Barquisimeto metro perimeter is within ~35 km
      if (minDistance > 35) {
        setGpsMessage(
          `Detectamos una ubicación fuera del área metropolitana de Barquisimeto (~${minDistance} km). Se asignó ${matchedStore.name} para tus compras y envíos a familiares en la ciudad.`
        );
      } else {
        const tag = sourceLabel ? ` (${sourceLabel})` : "";
        setGpsMessage(
          `¡Ubicación detectada${tag}! Te encuentras a ~${minDistance} km de ${matchedStore.name}. Delivery y stock calculados con precisión.`
        );
      }
    }
  };

  // Detect nearest branch using Hardware GPS (High Accuracy)
  // IMPORTANT (Ponytail + ECC): In Venezuela, NEVER use IP geolocation fallback for retail delivery.
  // Mobile 4G NAT IPs route through Valencia or Caracas, creating 140km+ errors.
  const handleDetectGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsMessage(
        "Tu dispositivo o navegador no soporta GPS. Selecciona tu sector abajo para calcular delivery al instante."
      );
      return;
    }

    setDetectingGps(true);
    setGpsMessage(null);
    setActiveSectorId(null);

    // 1. Intentar primero con hardware GPS de alta precisión (satelital del teléfono)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          "GPS Satelital"
        );
      },
      (error) => {
        // 2. Si alta precisión falla por timeout/interiores, intentar standard Wi-Fi accuracy antes de rendirse
        if (error.code !== error.PERMISSION_DENIED) {
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              applyCoordinates(
                pos2.coords.latitude,
                pos2.coords.longitude,
                "GPS"
              );
            },
            () => {
              setDetectingGps(false);
              setGpsMessage(
                "No se pudo sincronizar la señal de satélite en este momento. Selecciona tu sector abajo (ej. Zona Norte, Este, Centro) para continuar."
              );
            },
            {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            }
          );
        } else {
          setDetectingGps(false);
          setGpsMessage(
            "Permiso de ubicación no concedido en el navegador. Haz clic en el candado 🔒 de tu barra de direcciones para habilitarlo, o toca tu sector abajo."
          );
        }
      },
      {
        enableHighAccuracy: true, // Fuerza encendido del sensor GPS real del teléfono móvil
        timeout: 10000,
        maximumAge: 0,
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
      {/* GPS High-Accuracy Action Button */}
      <button
        onClick={handleDetectGps}
        disabled={detectingGps}
        className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 hover:from-emerald-600/20 hover:to-blue-600/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-between transition-all cursor-pointer group shadow-xs disabled:opacity-50"
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
                ? "Conectando con satélites GPS..."
                : "Detectar mi ubicación exacta con GPS"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Calcula la distancia real de despacho desde tu teléfono
            </span>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
      </button>

      {/* GPS or Feedback Status Message */}
      {gpsMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in transition-all ${
            gpsMessage.startsWith("¡Ubicación")
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 shadow-xs"
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

      {/* Quick Sector Selector (Zero-latency touch for Barquisimeto / Cabudare) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-primary" />
            O selecciona tu sector directo
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-medium">1 toque</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {METROPOLITAN_SECTORS.map((sector) => {
            const isSectorActive = activeSectorId === sector.id;
            return (
              <button
                key={sector.id}
                type="button"
                onClick={() => {
                  applyCoordinates(
                    sector.coords.lat,
                    sector.coords.lng,
                    sector.name,
                    sector.id
                  );
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSectorActive
                    ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                    : "bg-card hover:bg-muted/60 border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{sector.icon}</span>
                  <span className="font-bold text-xs text-foreground truncate">
                    {sector.name}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  {sector.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
                const sectorObj = METROPOLITAN_SECTORS.find((s) => s.id === activeSectorId);
                onSelectStore(store, distance, sectorObj?.name);
                onClose();
              }}
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                isSelected
                  ? "bg-primary/5 border-primary shadow-xs"
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
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        distance <= 35
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {distance <= 35 ? `📍 a ${distance} km` : "📍 Despacho en Barquisimeto"}
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
