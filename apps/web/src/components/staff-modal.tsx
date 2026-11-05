"use client";

import React, { useState } from "react";
import {
  UserProfile,
  UserRole,
  STAFF_PERMISSIBLE_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
} from "@marketos/types";
import { inviteStaffMemberAction } from "../app/admin/actions";
import {
  X,
  UserPlus,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Mail,
  User,
  Phone,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("TENANT_CASHIER");
  const [customPermissions, setCustomPermissions] = useState<string[]>(
    DEFAULT_ROLE_PERMISSIONS["TENANT_CASHIER"] || []
  );
  const [showPermissionsSection, setShowPermissionsSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setCustomPermissions(DEFAULT_ROLE_PERMISSIONS[newRole] || []);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg("El nombre y correo electrónico son obligatorios");
      return;
    }

    if (password && password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres");
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
        password: password.trim() || undefined,
        customPermissions,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">
                Asignar Colaborador y Rol
              </h3>
              <p className="text-xs text-foreground/80 font-medium">
                Control de acceso basado en roles (RBAC)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-extrabold text-foreground">
              Nombre Completo *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ej. María Gómez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-extrabold text-foreground">
              Correo Electrónico *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="maria@shopmarket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-extrabold text-foreground">
                Contraseña de Acceso *
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Generar Clave Segura</span>
              </button>
            </div>
            <div className="relative">
              <Key className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres (ej. Colaborador2026*)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-foreground/80 font-medium">
              El colaborador usará este correo y contraseña para iniciar sesión en la tienda.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-extrabold text-foreground">
              Teléfono / WhatsApp (opcional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                placeholder="+58 412 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-extrabold text-foreground">
              Rol en el Comercio *
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-2xs"
            >
              <option value="TENANT_CASHIER">Cajero / Operador de Ventas</option>
              <option value="TENANT_MANAGER">Encargado de Sucursal</option>
              <option value="TENANT_INVENTORY">Encargado de Inventario</option>
              <option value="TENANT_DELIVERY">Repartidor / Delivery</option>
              {(callerRole === "PLATFORM_SUPER_ADMIN" || callerRole === "TENANT_OWNER") && (
                <option value="TENANT_OWNER">Dueño del Comercio (Admin)</option>
              )}
            </select>
            <p className="text-xs text-foreground/80 font-medium pt-0.5">
              {ROLE_LABELS[role]?.desc}
            </p>
          </div>

          {/* Granular Module Permissions Accordion */}
          <div className="pt-2 border-t border-border space-y-2">
            <button
              type="button"
              onClick={() => setShowPermissionsSection(!showPermissionsSection)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted border border-border text-xs sm:text-sm font-bold text-foreground transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Permisos de Módulos (Sidebar)</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {customPermissions.length} activos
                </span>
              </div>
              {showPermissionsSection ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showPermissionsSection && (
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-foreground/80 font-medium">
                    Elige los módulos a los que tendrá acceso:
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomPermissions(STAFF_PERMISSIBLE_MODULES.map((m) => m.id))
                      }
                      className="font-bold text-foreground hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => setCustomPermissions([])}
                      className="font-bold text-muted-foreground hover:underline cursor-pointer"
                    >
                      Ninguno
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomPermissions(DEFAULT_ROLE_PERMISSIONS[role] || [])
                      }
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {STAFF_PERMISSIBLE_MODULES.map((m) => {
                    const checked = customPermissions.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          checked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-foreground font-bold"
                            : "bg-background border-border text-foreground/75 hover:border-border/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCustomPermissions((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id]
                            )
                          }
                          className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                        />
                        <span className="truncate text-xs font-semibold">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-black hover:opacity-90 transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
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
