"use client";

import React, { useState } from "react";
import { Store } from "@marketos/types";
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

  // Detect nearest branch using HTML5 Geolocation API
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    setDetectingGps(true);
    setGpsMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

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

          const dist = calculateDistanceKm(
            userLat,
            userLng,
            coords.lat,
            coords.lng
          );
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
          setGpsMessage(
            `¡Ubicación detectada! Tu sucursal más cercana es ${matchedStore.name} (${minDistance} km).`
          );
        }
      },
      (error) => {
        setDetectingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsMessage("Permiso de ubicación denegado. Puedes elegir tu sucursal manualmente.");
        } else {
          setGpsMessage("No se pudo obtener tu ubicación. Por favor selecciona tu sede.");
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
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
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
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
            <div className="p-3 rounded-xl bg-muted border border-border text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{gpsMessage}</span>
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/20 text-center text-[11px] text-muted-foreground">
          <span>Los precios se mantienen iguales en todas las sucursales según la tasa oficial del día.</span>
        </div>
      </div>
    </div>
  );
}
