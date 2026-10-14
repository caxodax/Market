"use client";

import React, { useState, useEffect } from "react";
import type { DeliveryZone, Driver, ExchangeRate } from "@marketos/types";
import {
  MapPin,
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Phone,
  MessageCircle,
  Clock,
  DollarSign,
  X,
  Loader2,
  Bike,
  Car,
  Navigation,
  RefreshCw,
  Power,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@marketos/utils";
import {
  createDeliveryZoneAction,
  updateDeliveryZoneAction,
  toggleDeliveryZoneStatusAction,
  createDriverAction,
  updateDriverAction,
  toggleDriverStatusAction,
} from "../app/admin/actions";

interface DeliveryManagerProps {
  tenantId: string;
  initialDeliveryZones: DeliveryZone[];
  initialDrivers: Driver[];
  exchangeRate?: ExchangeRate;
}

export function DeliveryManager({
  tenantId,
  initialDeliveryZones = [],
  initialDrivers = [],
  exchangeRate,
}: DeliveryManagerProps) {
  const [activeSection, setActiveSection] = useState<"ZONES" | "DRIVERS">("ZONES");
  const [zones, setZones] = useState<DeliveryZone[]>(initialDeliveryZones);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Notifications
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Zone Modal State
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zonePriceUsd, setZonePriceUsd] = useState("0");
  const [zoneEstimatedTime, setZoneEstimatedTime] = useState("30-45 min");
  const [zoneCoverageDescription, setZoneCoverageDescription] = useState("");
  const [zoneIsActive, setZoneIsActive] = useState(true);
  const [zoneSortOrder, setZoneSortOrder] = useState(1);
  const [zoneLoading, setZoneLoading] = useState(false);

  // Driver Modal State
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("+58 4");
  const [driverVehicleType, setDriverVehicleType] = useState<"MOTO" | "CARRO" | "BICICLETA">("MOTO");
  const [driverPlateNumber, setDriverPlateNumber] = useState("");
  const [driverIsActive, setDriverIsActive] = useState(true);
  const [driverLoading, setDriverLoading] = useState(false);

  // Open Zone Create
  const handleOpenCreateZone = () => {
    setEditingZone(null);
    setZoneName("");
    setZonePriceUsd("2.00");
    setZoneEstimatedTime("30-45 min");
    setZoneCoverageDescription("");
    setZoneIsActive(true);
    setZoneSortOrder(zones.length + 1);
    setIsZoneModalOpen(true);
  };

  // Open Zone Edit
  const handleOpenEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZonePriceUsd(zone.price_usd.toString());
    setZoneEstimatedTime(zone.estimated_time);
    setZoneCoverageDescription(zone.coverage_description || "");
    setZoneIsActive(zone.is_active);
    setZoneSortOrder(zone.sort_order || 1);
    setIsZoneModalOpen(true);
  };

  // Submit Zone Form
  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) {
      setAlert({ type: "error", text: "El nombre de la zona es obligatorio." });
      return;
    }

    setZoneLoading(true);
    try {
      if (editingZone) {
        // Update
        const res = await updateDeliveryZoneAction({
          tenantId,
          zoneId: editingZone.id,
          name: zoneName.trim(),
          priceUsd: parseFloat(zonePriceUsd) || 0,
          estimatedTime: zoneEstimatedTime.trim() || "30-45 min",
          coverageDescription: zoneCoverageDescription.trim() || null,
          isActive: zoneIsActive,
          sortOrder: zoneSortOrder,
        });

        if (!res.success || !res.zone) {
          throw new Error(res.error || "No se pudo actualizar la zona.");
        }

        setZones((prev) =>
          prev.map((z) => (z.id === editingZone.id ? (res.zone as DeliveryZone) : z))
        );
        setAlert({ type: "success", text: `Zona "${zoneName}" actualizada con éxito.` });
      } else {
        // Create
        const res = await createDeliveryZoneAction({
          tenantId,
          name: zoneName.trim(),
          priceUsd: parseFloat(zonePriceUsd) || 0,
          estimatedTime: zoneEstimatedTime.trim() || "30-45 min",
          coverageDescription: zoneCoverageDescription.trim() || null,
          isActive: zoneIsActive,
          sortOrder: zoneSortOrder,
        });

        if (!res.success || !res.zone) {
          throw new Error(res.error || "No se pudo crear la zona.");
        }

        setZones((prev) => [...prev, res.zone as DeliveryZone]);
        setAlert({ type: "success", text: `Zona "${zoneName}" creada exitosamente.` });
      }

      setIsZoneModalOpen(false);
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Error al procesar la zona." });
    } finally {
      setZoneLoading(false);
    }
  };

  // Soft Delete / Toggle Zone
  const handleToggleZone = async (zone: DeliveryZone) => {
    const nextStatus = !zone.is_active;
    const actionLabel = nextStatus ? "reactivada" : "desactivada (eliminada lógicamente)";

    try {
      const res = await toggleDeliveryZoneStatusAction(tenantId, zone.id, nextStatus);
      if (res.success) {
        setZones((prev) =>
          prev.map((z) => (z.id === zone.id ? { ...z, is_active: nextStatus } : z))
        );
        setAlert({
          type: "success",
          text: `Zona "${zone.name}" ${actionLabel}. ${
            nextStatus
              ? "Ahora está visible para los clientes."
              : "Ya no aparecerá en el catálogo ni checkout."
          }`,
        });
      } else {
        throw new Error(res.error || "No se pudo cambiar el estado de la zona.");
      }
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Error al cambiar estado." });
    }
  };

  // Open Driver Create
  const handleOpenCreateDriver = () => {
    setEditingDriver(null);
    setDriverName("");
    setDriverPhone("+58 4");
    setDriverVehicleType("MOTO");
    setDriverPlateNumber("");
    setDriverIsActive(true);
    setIsDriverModalOpen(true);
  };

  // Open Driver Edit
  const handleOpenEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverName(driver.name);
    setDriverPhone(driver.phone);
    setDriverVehicleType(driver.vehicle_type);
    setDriverPlateNumber(driver.plate_number || "");
    setDriverIsActive(driver.is_active);
    setIsDriverModalOpen(true);
  };

  // Submit Driver Form
  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim() || !driverPhone.trim()) {
      setAlert({ type: "error", text: "Nombre y teléfono son obligatorios." });
      return;
    }

    setDriverLoading(true);
    try {
      if (editingDriver) {
        // Update
        const res = await updateDriverAction({
          tenantId,
          driverId: editingDriver.id,
          name: driverName.trim(),
          phone: driverPhone.trim(),
          vehicleType: driverVehicleType,
          plateNumber: driverPlateNumber.trim() || null,
          isActive: driverIsActive,
        });

        if (!res.success || !res.driver) {
          throw new Error(res.error || "No se pudo actualizar el repartidor.");
        }

        setDrivers((prev) =>
          prev.map((d) => (d.id === editingDriver.id ? (res.driver as Driver) : d))
        );
        setAlert({ type: "success", text: `Repartidor "${driverName}" actualizado.` });
      } else {
        // Create
        const res = await createDriverAction({
          tenantId,
          name: driverName.trim(),
          phone: driverPhone.trim(),
          vehicleType: driverVehicleType,
          plateNumber: driverPlateNumber.trim() || null,
          isActive: driverIsActive,
        });

        if (!res.success || !res.driver) {
          throw new Error(res.error || "No se pudo registrar el repartidor.");
        }

        setDrivers((prev) => [...prev, res.driver as Driver]);
        setAlert({ type: "success", text: `Repartidor "${driverName}" registrado exitosamente.` });
      }

      setIsDriverModalOpen(false);
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Error al procesar el repartidor." });
    } finally {
      setDriverLoading(false);
    }
  };

  // Soft Delete / Toggle Driver
  const handleToggleDriver = async (driver: Driver) => {
    const nextStatus = !driver.is_active;
    const actionLabel = nextStatus ? "reactivado" : "desactivado (retirado de servicio)";

    try {
      const res = await toggleDriverStatusAction(tenantId, driver.id, nextStatus);
      if (res.success) {
        setDrivers((prev) =>
          prev.map((d) => (d.id === driver.id ? { ...d, is_active: nextStatus } : d))
        );
        setAlert({
          type: "success",
          text: `Repartidor "${driver.name}" ${actionLabel}.`,
        });
      } else {
        throw new Error(res.error || "No se pudo cambiar el estado del repartidor.");
      }
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Error al cambiar estado." });
    }
  };

  // Filtered Zones
  const filteredZones = zones.filter((z) => {
    const matchesSearch =
      !searchQuery.trim() ||
      z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (z.coverage_description &&
        z.coverage_description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && z.is_active) ||
      (statusFilter === "INACTIVE" && !z.is_active);

    return matchesSearch && matchesStatus;
  });

  // Filtered Drivers
  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      !searchQuery.trim() ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.plate_number && d.plate_number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && d.is_active) ||
      (statusFilter === "INACTIVE" && !d.is_active);

    return matchesSearch && matchesStatus;
  });

  // KPIs
  const activeZonesCount = zones.filter((z) => z.is_active).length;
  const freeZonesCount = zones.filter((z) => z.is_active && z.price_usd === 0).length;
  const activeDriversCount = drivers.filter((d) => d.is_active).length;
  const bcvRate = exchangeRate?.value || 60;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Alert */}
      {alert && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            alert.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/80 border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alert.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{alert.text}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Zonas Activas */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Zonas de Cobertura</span>
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {activeZonesCount}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              / {zones.length} total
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {zones.length - activeZonesCount} desactivadas (históricas)
          </p>
        </div>

        {/* Zonas Gratuitas */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Zonas Gratuitas</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {freeZonesCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tarifa $0.00 de cortesía local
          </p>
        </div>

        {/* Repartidores Activos */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Repartidores en Flota</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {activeDriversCount}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              / {drivers.length} total
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Personal disponible para despachos
          </p>
        </div>

        {/* Tasa BCV aplicada */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Tasa Oficial de Tarifas</span>
            <Navigation className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            Bs. {bcvRate.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Conversión en vivo para cobros en Bs
          </p>
        </div>
      </div>

      {/* Sub-tabs selector & Global Create button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection("ZONES")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === "ZONES"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Zonas & Tarifas ({zones.length})</span>
          </button>

          <button
            onClick={() => setActiveSection("DRIVERS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === "DRIVERS"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Repartidores & Motorizados ({drivers.length})</span>
          </button>
        </div>

        <div>
          {activeSection === "ZONES" ? (
            <button
              onClick={handleOpenCreateZone}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Zona de Delivery</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateDriver}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Repartidor</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeSection === "ZONES"
                ? "Buscar zona o calles de cobertura..."
                : "Buscar por nombre, teléfono o placa..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: "ALL", label: "Todos" },
            { id: "ACTIVE", label: "Activos" },
            { id: "INACTIVE", label: "Desactivados" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: DELIVERY ZONES */}
      {activeSection === "ZONES" && (
        <div className="space-y-4">
          {filteredZones.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-xs">No se encontraron zonas de delivery</p>
              <button
                onClick={handleOpenCreateZone}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear la primera zona ahora</span>
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredZones.map((zone) => {
                const vesPrice = Number((zone.price_usd * bcvRate).toFixed(2));
                return (
                  <div
                    key={zone.id}
                    className={`p-4 rounded-2xl border bg-card transition-all flex flex-col justify-between space-y-3 shadow-xs relative ${
                      zone.is_active
                        ? "border-border hover:border-primary/40"
                        : "border-destructive/30 bg-destructive/5 opacity-80"
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Top row: Name & Price */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-sm text-foreground tracking-tight">
                            {zone.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground font-medium">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>{zone.estimated_time || "30-45 min"}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {zone.price_usd === 0 ? (
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              GRATIS
                            </span>
                          ) : (
                            <div>
                              <span className="font-mono text-xs font-black text-primary block">
                                ${zone.price_usd.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                ~ Bs. {vesPrice.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {zone.coverage_description ? (
                        <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50">
                          {zone.coverage_description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          Sin notas o referencias de cobertura detalladas.
                        </p>
                      )}
                    </div>

                    {/* Bottom Status & Actions */}
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <div>
                        {zone.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activa en Tienda</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <Power className="w-3 h-3" />
                            <span>Desactivada</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditZone(zone)}
                          className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs transition-colors cursor-pointer"
                          title="Modificar datos o precio de la zona"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleZone(zone)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            zone.is_active
                              ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
                              : "border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          }`}
                          title={
                            zone.is_active
                              ? "Desactivar zona (eliminación lógica: los clientes no la verán)"
                              : "Reactivar zona de delivery"
                          }
                        >
                          {zone.is_active ? (
                            <Trash2 className="w-3.5 h-3.5" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DRIVERS & VEHICLES */}
      {activeSection === "DRIVERS" && (
        <div className="space-y-4">
          {filteredDrivers.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-xs">No se encontraron repartidores registrados</p>
              <button
                onClick={handleOpenCreateDriver}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar el primer repartidor ahora</span>
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDrivers.map((driver) => {
                const whatsappLink = `https://wa.me/${driver.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hola ${driver.name}, te escribo desde la administración para coordinar entregas de pedidos.`
                )}`;

                return (
                  <div
                    key={driver.id}
                    className={`p-4 rounded-2xl border bg-card transition-all flex flex-col justify-between space-y-3 shadow-xs relative ${
                      driver.is_active
                        ? "border-border hover:border-primary/40"
                        : "border-destructive/30 bg-destructive/5 opacity-80"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Driver Name & Vehicle Icon */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-primary shrink-0 shadow-xs">
                            {driver.vehicle_type === "MOTO" && <Bike className="w-5 h-5" />}
                            {driver.vehicle_type === "CARRO" && <Car className="w-5 h-5" />}
                            {driver.vehicle_type === "BICICLETA" && <Bike className="w-5 h-5" />}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-foreground">
                              {driver.name}
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {driver.vehicle_type}{" "}
                              {driver.plate_number ? `• Placa: ${driver.plate_number}` : ""}
                            </span>
                          </div>
                        </div>

                        <div>
                          {driver.is_active ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Activo
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Phone & Contact Shortcuts */}
                      <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{driver.phone}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                            title="Abrir chat de WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`tel:${driver.phone}`}
                            className="p-1 rounded-md bg-muted hover:bg-neutral-200 text-foreground transition-colors"
                            title="Llamar directamente"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-border flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditDriver(driver)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
                        title="Modificar datos del repartidor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleToggleDriver(driver)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          driver.is_active
                            ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
                            : "border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                        }`}
                        title={
                          driver.is_active
                            ? "Desactivar repartidor (no podrá ser asignado a órdenes)"
                            : "Reactivar repartidor"
                        }
                      >
                        {driver.is_active ? (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Desactivar</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reactivar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREAR / EDITAR ZONA DE DELIVERY */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-black text-foreground">
                    {editingZone ? "Modificar Zona de Delivery" : "Nueva Zona de Cobertura"}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configura el nombre, tarifa en dólares y referencias de entrega.
                </p>
              </div>
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleZoneSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Nombre de la Zona / Sector *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Este de Barquisimeto / Santa Rosa"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Price & Estimated Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Tarifa Delivery ($USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="0.00"
                      value={zonePriceUsd}
                      onChange={(e) => setZonePriceUsd(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl border border-input bg-background font-mono font-bold focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Coloca 0 para entrega GRATIS
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Tiempo Estimado de Entrega
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 30-45 min"
                    value={zoneEstimatedTime}
                    onChange={(e) => setZoneEstimatedTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Coverage Description */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Calles, Avenidas o Sectores Incluidos
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej. Av. Lara, Los Leones, Turbio, Santa Rosa, perímetro este hasta la redoma..."
                  value={zoneCoverageDescription}
                  onChange={(e) => setZoneCoverageDescription(e.target.value)}
                  className="w-full p-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Is Active Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <span className="font-bold text-foreground text-xs block">
                    Zona Habilitada en el Catálogo
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Si está desactivada, no se mostrará a los clientes al momento de pagar.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={zoneIsActive}
                  onChange={(e) => setZoneIsActive(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={zoneLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {zoneLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingZone ? "Actualizar Zona" : "Crear Zona"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR REPARTIDOR */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-black text-foreground">
                    {editingDriver ? "Modificar Repartidor" : "Registrar Repartidor"}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registra datos de contacto y vehículo para asignaciones de pedidos.
                </p>
              </div>
              <button
                onClick={() => setIsDriverModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDriverSubmit} className="space-y-4 text-xs">
              {/* Driver Name */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Nombre Completo del Repartidor *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Carlos Mendoza"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Phone & Vehicle Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Teléfono Móvil (WhatsApp) *
                  </label>
                  <input
                    type="text"
                    placeholder="+58 412-1234567"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background font-mono focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Tipo de Vehículo
                  </label>
                  <select
                    value={driverVehicleType}
                    onChange={(e) => setDriverVehicleType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="MOTO">🛵 Motocicleta</option>
                    <option value="CARRO">🚗 Carro / Automóvil</option>
                    <option value="BICICLETA">🚲 Bicicleta</option>
                  </select>
                </div>
              </div>

              {/* Plate Number */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Número de Placa (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. AD3X91"
                  value={driverPlateNumber}
                  onChange={(e) => setDriverPlateNumber(e.target.value.toUpperCase())}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-mono font-bold uppercase focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Is Active Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <span className="font-bold text-foreground text-xs block">
                    Repartidor en Servicio Activo
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Si se desactiva, queda en el historial pero no se le podrán asignar nuevos pedidos.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={driverIsActive}
                  onChange={(e) => setDriverIsActive(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={driverLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {driverLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingDriver ? "Actualizar Repartidor" : "Registrar"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
