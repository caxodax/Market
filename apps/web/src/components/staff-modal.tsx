"use client";

import React, { useState } from "react";
import { UserProfile, UserRole } from "@marketos/types";
import { inviteStaffMemberAction } from "../app/admin/actions";
import {
  X,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Mail,
  User,
  Phone,
} from "lucide-react";

interface StaffModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onStaffAdded: (profile: UserProfile) => void;
  callerRole?: UserRole;
}

export const ROLE_LABELS: Record<UserRole, { label: string; desc: string }> = {
  TENANT_OWNER: {
    label: "Dueño del Comercio",
    desc: "Control total de finanzas, productos, usuarios y configuración.",
  },
  TENANT_MANAGER: {
    label: "Encargado de Sucursal",
    desc: "Gestión de pedidos, inventario, precios y despacho.",
  },
  TENANT_CASHIER: {
    label: "Cajero / Operador",
    desc: "Validación de comprobantes de pago y toma de pedidos.",
  },
  TENANT_INVENTORY: {
    label: "Control de Inventario",
    desc: "Ajuste de stock, recepción de mercancía y conteo.",
  },
  TENANT_DELIVERY: {
    label: "Repartidor / Motorizado",
    desc: "Entrega y actualización de estado en ruta.",
  },
  PLATFORM_SUPER_ADMIN: {
    label: "Super Admin Plataforma",
    desc: "Acceso maestro a todos los tenants de MarketOS.",
  },
  CUSTOMER: {
    label: "Cliente",
    desc: "Usuario comprador en el catálogo PWA.",
  },
};

export function StaffModal({
  tenantId,
  isOpen,
  onClose,
  onStaffAdded,
  callerRole,
}: StaffModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("TENANT_CASHIER");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg("El nombre y correo electrónico son obligatorios");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await inviteStaffMemberAction({
        tenantId,
        fullName,
        email,
        phone: phone || undefined,
        role,
      });

      if (!res.success || !res.profile) {
        throw new Error(res.error || "Error al invitar al colaborador");
      }

      onStaffAdded(res.profile);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar colaborador");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">
                Asignar Colaborador y Rol
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Control de acceso basado en roles (RBAC)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Nombre Completo *
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ej. María Gómez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Correo Electrónico *
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <input
                type="email"
                placeholder="maria@shopmarket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Teléfono / WhatsApp (opcional)
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <input
                type="tel"
                placeholder="+58 412 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Rol en el Comercio *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="TENANT_CASHIER">Cajero / Operador de Ventas</option>
              <option value="TENANT_MANAGER">Encargado de Sucursal</option>
              <option value="TENANT_INVENTORY">Encargado de Inventario</option>
              <option value="TENANT_DELIVERY">Repartidor / Delivery</option>
              {(callerRole === "PLATFORM_SUPER_ADMIN" || callerRole === "TENANT_OWNER") && (
                <option value="TENANT_OWNER">Dueño del Comercio (Admin)</option>
              )}
            </select>
            <p className="text-[10px] text-muted-foreground pt-0.5">
              {ROLE_LABELS[role]?.desc}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Asignar Rol</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
