import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../login/actions";
import { getRegisterSessions } from "../../pos-actions";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@marketos/ui";
import { ArrowLeft, History, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  params: Promise<{ registerId: string }>;
}

export const dynamic = "force-dynamic";

export default async function RegisterDetailPage({ params }: Props) {
  const { registerId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  let sessions: any[] = [];
  try {
    sessions = await getRegisterSessions(registerId, 20);
  } catch (err) {
    console.error("[MarketOS POS] Error fetching sessions:", err);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/pos">
            <Button variant="outline" size="sm" className="text-xs">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Volver a Cajas
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              Historial de Turnos & Arqueos
            </h1>
            <p className="text-xs text-muted-foreground">Registro de cierres X / Z y auditoría de balance</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas 20 Sesiones</CardTitle>
            <CardDescription className="text-xs">
              Listado histórico de aperturas y cierres registrados para esta terminal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No hay turnos registrados aún en esta caja.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {sessions.map((s) => {
                  const isClosed = Boolean(s.closed_at);
                  const diff = Number(s.difference || 0);
                  const isExact = Math.abs(diff) < 0.01;

                  return (
                    <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{s.cashier_name}</span>
                          <Badge variant={isClosed ? "secondary" : "default"} className={!isClosed ? "bg-emerald-600 text-white" : ""}>
                            {!isClosed ? "Turno Activo" : `Cierre ${s.close_type || "Z"}`}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          Apertura: {new Date(s.opened_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                          {s.closed_at && (
                            <> · Cierre: {new Date(s.closed_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</>
                          )}
                        </div>
                        {s.notes && <div className="text-muted-foreground italic">"{s.notes}"</div>}
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-muted-foreground">Ventas ({s.transaction_count || 0})</div>
                          <div className="font-semibold text-emerald-600 text-sm">
                            ${Number(s.total_sales_usd || 0).toFixed(2)}
                          </div>
                        </div>

                        {isClosed && (
                          <div className="min-w-[100px]">
                            <div className="text-muted-foreground">Diferencia</div>
                            <div className={`font-bold flex items-center justify-end gap-1 ${
                              isExact ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-blue-600"
                            }`}>
                              {isExact ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  $0.00
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
