"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Badge,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@marketos/ui";
import {
  Monitor,
  Plus,
  KeyRound,
  Lock,
  ArrowRight,
  Wifi,
  WifiOff,
  Globe,
  Coins,
  X,
} from "lucide-react";
import { createCashRegister, setRegisterPin } from "@/app/admin/pos-actions";
import { RegisterSelectModal } from "./register-select-modal";
import { OpenShiftModal } from "./open-shift-modal";
import { CloseShiftModal } from "./close-shift-modal";
import { CashMovementModal } from "./cash-movement-modal";
import type { CashRegister, UserProfile } from "@marketos/types";

interface Props {
  initialRegisters: CashRegister[];
  tenantId: string;
  storeId: string;
  currentUser: UserProfile;
}

export function POSDashboardView({
  initialRegisters,
  tenantId,
  storeId,
  currentUser,
}: Props) {
  const [registers, setRegisters] = useState<CashRegister[]>(initialRegisters);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [newRegisterDesc, setNewRegisterDesc] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [creating, setCreating] = useState(false);

  // Pin modal
  const [pinTargetRegister, setPinTargetRegister] = useState<CashRegister | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  // Operational Modals
  const [openShiftTarget, setOpenShiftTarget] = useState<CashRegister | null>(null);
  const [closeShiftSessionId, setCloseShiftSessionId] = useState<string | null>(null);
  const [movementTarget, setMovementTarget] = useState<{ sessionId: string; name: string } | null>(null);

  // Selector modal
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

  async function handleCreateRegister() {
    if (!newRegisterName.trim()) return;
    setCreating(true);
    const res = await createCashRegister(
      tenantId,
      storeId,
      newRegisterName.trim(),
      newRegisterDesc.trim() || undefined,
      isVirtual
    );
    if (res.success && res.data) {
      setRegisters((prev) => [...prev, res.data!]);
      setIsCreateModalOpen(false);
      setNewRegisterName("");
      setNewRegisterDesc("");
      setIsVirtual(false);
    }
    setCreating(false);
  }

  async function handleSetPin() {
    if (!pinTargetRegister) return;
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError("El PIN debe tener entre 4 y 6 dígitos numéricos.");
      return;
    }
    setSettingPin(true);
    const res = await setRegisterPin(pinTargetRegister.id, newPin);
    if (res.success) {
      setPinTargetRegister(null);
      setNewPin("");
      setPinError("");
    } else {
      setPinError(res.error || "Error al actualizar PIN.");
    }
    setSettingPin(false);
  }

  const activeCount = registers.filter((r) => r.active_session).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Monitor className="h-6 w-6 text-emerald-600" />
              Multi-Caja & Turnos POS
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50/50">
              v1.0.0
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Control de terminales físicas, apertura de turnos, arqueos con Cierre Z e inventario sincronizado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSelectModalOpen(true)}
            className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 text-xs"
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            Acceso Rápido Cajero
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nueva Caja
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-none border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Cajas Registradas</CardDescription>
            <CardTitle className="text-2xl font-bold">{registers.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Terminales habilitadas en esta sucursal
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Turnos Abiertos en Vivo</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">{activeCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {activeCount === 1 ? "1 cajero en operación" : `${activeCount} cajeros en operación`}
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Arqueo Inmutable</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              Cierre Z
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Impresión 80mm y respaldo en base de datos
          </CardContent>
        </Card>
      </div>

      {/* Registers Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-foreground">Terminales de Venta</h2>
          <span className="text-xs text-muted-foreground">Sucursal Principal</span>
        </div>

        {registers.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
            <Monitor className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-sm">Aún no hay cajas creadas</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Crea tu primera caja para asignar cajeros mediante PIN numérico y llevar el control del efectivo en tienda.
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Crear Primera Caja
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registers.map((reg) => {
              const session = reg.active_session;
              const isOpen = Boolean(session);

              return (
                <Card
                  key={reg.id}
                  className={`border transition-all ${
                    isOpen
                      ? "border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-xs"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {reg.is_virtual ? (
                          <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <Globe className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className={`p-2 rounded-xl ${
                            isOpen
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            <Monitor className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground">{reg.name}</CardTitle>
                          {reg.description && (
                            <p className="text-xs text-muted-foreground">{reg.description}</p>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant={isOpen ? "default" : "secondary"}
                        className={isOpen ? "bg-emerald-600 text-white" : ""}
                      >
                        {isOpen ? (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Wifi className="w-3 h-3" /> Turno Abierto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px]">
                            <WifiOff className="w-3 h-3" /> Cerrada
                          </span>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-xs">
                    {isOpen && session ? (
                      <div className="p-3 bg-card border rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Cajero a cargo:</span>
                          <span className="font-semibold text-foreground">{session.cashier_name}</span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Fondo inicial:</span>
                          <span className="font-semibold">${Number(session.opening_balance).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Ventas turno:</span>
                          <span className="font-bold text-emerald-600">
                            ${Number(session.total_sales_usd).toFixed(2)} ({session.transaction_count})
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground pt-1 border-t">
                          <span>Apertura:</span>
                          <span>{new Date(session.opened_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/40 rounded-xl text-center text-muted-foreground text-[11px]">
                        Sin turno activo. Inicia turno para comenzar a cobrar.
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 flex flex-col gap-2">
                    {/* Botones operativos */}
                    {isOpen && session ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMovementTarget({ sessionId: session.id, name: reg.name })}
                          className="text-xs"
                        >
                          <Coins className="w-3.5 h-3.5 mr-1" />
                          Movimiento
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setCloseShiftSessionId(session.id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1" />
                          Cierre / Arqueo
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setOpenShiftTarget(reg)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      >
                        Abrir Turno
                      </Button>
                    )}

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between w-full pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setPinTargetRegister(reg);
                          setNewPin("");
                          setPinError("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Configurar PIN
                      </button>

                      <Link href={`/admin/pos/${reg.id}`}>
                        <span className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          Historial
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Crear Nueva Caja */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Nueva Caja Registradora
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Añade una terminal de cobro física o virtual para tu tienda.
                </p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="text-xs font-semibold text-foreground">
                  Nombre de la Caja
                </label>
                <Input
                  id="reg-name"
                  value={newRegisterName}
                  onChange={(e) => setNewRegisterName(e.target.value)}
                  placeholder="Ej: Caja 1 (Entrada), Caja 2 (Rápida)"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-desc" className="text-xs font-semibold text-foreground">
                  Descripción u Ubicación (Opcional)
                </label>
                <Input
                  id="reg-desc"
                  value={newRegisterDesc}
                  onChange={(e) => setNewRegisterDesc(e.target.value)}
                  placeholder="Ej: Mostrador pasillo central"
                  className="text-xs"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is-virtual-check"
                  checked={isVirtual}
                  onChange={(e) => setIsVirtual(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="is-virtual-check" className="text-xs text-muted-foreground cursor-pointer">
                  Marcar como Caja Virtual/Web (para separar ventas online del piso de venta)
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-1/2 text-xs">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateRegister}
                disabled={!newRegisterName.trim() || creating}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {creating ? "Creando..." : "Crear Caja"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar PIN */}
      {Boolean(pinTargetRegister) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  PIN de {pinTargetRegister?.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Establece un código numérico de 4 a 6 dígitos para restringir el acceso a esta caja.
                </p>
              </div>
              <button onClick={() => setPinTargetRegister(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label htmlFor="pin-input" className="text-xs font-semibold text-foreground">
                  Nuevo PIN Numérico (4 a 6 dígitos)
                </label>
                <Input
                  id="pin-input"
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value);
                    setPinError("");
                  }}
                  placeholder="••••"
                  className="text-center font-mono text-lg tracking-widest font-bold"
                />
              </div>
              {pinError && <p className="text-xs font-medium text-destructive">{pinError}</p>}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setPinTargetRegister(null)} className="w-1/2 text-xs">
                Cancelar
              </Button>
              <Button
                onClick={handleSetPin}
                disabled={newPin.length < 4 || settingPin}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {settingPin ? "Guardando..." : "Guardar PIN"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selector Modal rápido */}
      <RegisterSelectModal
        registers={registers}
        open={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        onSuccess={(reg) => {
          setIsSelectModalOpen(false);
          if (reg.active_session) {
            setCloseShiftSessionId(reg.active_session.id);
          } else {
            setOpenShiftTarget(reg);
          }
        }}
      />

      {/* Modal: Abrir Turno */}
      {openShiftTarget && (
        <OpenShiftModal
          register={openShiftTarget}
          tenantId={tenantId}
          cashierUserId={currentUser.id}
          cashierName={currentUser.full_name || currentUser.email || "Cajero"}
          open={Boolean(openShiftTarget)}
          onClose={() => setOpenShiftTarget(null)}
          onSuccess={(newSession) => {
            setRegisters((prev) =>
              prev.map((r) =>
                r.id === openShiftTarget.id ? { ...r, active_session: newSession } : r
              )
            );
            setOpenShiftTarget(null);
          }}
        />
      )}

      {/* Modal: Cierre Z / Arqueo */}
      {closeShiftSessionId && (
        <CloseShiftModal
          sessionId={closeShiftSessionId}
          open={Boolean(closeShiftSessionId)}
          onClose={() => setCloseShiftSessionId(null)}
          onSuccess={() => {
            setRegisters((prev) =>
              prev.map((r) =>
                r.active_session?.id === closeShiftSessionId
                  ? { ...r, active_session: null }
                  : r
              )
            );
            setCloseShiftSessionId(null);
          }}
        />
      )}

      {/* Modal: Movimiento Manual */}
      {movementTarget && (
        <CashMovementModal
          sessionId={movementTarget.sessionId}
          tenantId={tenantId}
          userId={currentUser.id}
          registerName={movementTarget.name}
          open={Boolean(movementTarget)}
          onClose={() => setMovementTarget(null)}
          onSuccess={() => {
            setMovementTarget(null);
          }}
        />
      )}
    </div>
  );
}
