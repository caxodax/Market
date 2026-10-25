"use server";

import { cookies } from "next/headers";
import { createServerComponentClient } from "@marketos/database";
import { assertAuthorizedTenantAdmin } from "./actions";
import type {
  CashRegister,
  CashRegisterSession,
  CashMovement,
  OpenShiftPayload,
  CloseShiftPayload,
  CashMovementPayload,
  VerifyPinPayload,
  ShiftSummary,
  POSActionResult,
} from "@marketos/types";

// ── Supabase helper ──────────────────────────────────────────────────────────
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerComponentClient({
    get(name: string) {
      return cookieStore.get(name);
    },
    set(name: string, value: string, options: unknown) {
      try {
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
      } catch {
        // Ignored in read-only server component contexts
      }
    },
    remove(name: string, options: unknown) {
      try {
        cookieStore.set(name, "", options as Parameters<typeof cookieStore.set>[2]);
      } catch {}
    },
  });
}

// ── PIN — Hash / Verify usando Web Crypto (sin dependencias externas) ─────────
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArr = Array.from(new Uint8Array(derived));
  const saltArr = Array.from(salt);
  // Formato: salt_hex:hash_hex
  return (
    saltArr.map((b) => b.toString(16).padStart(2, "0")).join("") +
    ":" +
    hashArr.map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const attempt = Array.from(new Uint8Array(derived))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return attempt === hashHex;
  } catch {
    return false;
  }
}

// ── Verificar PIN de acceso a caja ───────────────────────────────────────────
export async function verifyRegisterPin(
  payload: VerifyPinPayload
): Promise<POSActionResult> {
  const supabase = await getSupabase();

  const { data: register, error } = await supabase
    .from("cash_registers")
    .select("pin_hash, is_active")
    .eq("id", payload.register_id)
    .single();

  if (error || !register) return { success: false, error: "Caja no encontrada" };
  if (!register.is_active) return { success: false, error: "Caja inactiva" };
  // Sin PIN configurado → acceso libre
  if (!register.pin_hash) return { success: true };

  const valid = await verifyPin(payload.pin, register.pin_hash);
  return valid
    ? { success: true }
    : { success: false, error: "PIN incorrecto" };
}

// ── Configurar PIN de caja ───────────────────────────────────────────────────
export async function setRegisterPin(
  registerId: string,
  newPin: string
): Promise<POSActionResult> {
  if (!/^\d{4,6}$/.test(newPin)) {
    return { success: false, error: "El PIN debe ser 4-6 dígitos numéricos" };
  }
  try {
    const supabase = await getSupabase();
    const { data: reg, error: regError } = await supabase
      .from("cash_registers")
      .select("tenant_id")
      .eq("id", registerId)
      .single();

    if (regError || !reg) {
      return { success: false, error: "Caja no encontrada" };
    }

    await assertAuthorizedTenantAdmin(reg.tenant_id);

    const pin_hash = await hashPin(newPin);
    const { error } = await supabase
      .from("cash_registers")
      .update({ pin_hash })
      .eq("id", registerId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al configurar PIN";
    return { success: false, error: message };
  }
}

// ── Obtener cajas activas del tenant ─────────────────────────────────────────
export async function getCashRegisters(
  tenantId: string,
  storeId: string
): Promise<CashRegister[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  // Para cada caja, buscar sesión activa
  const registers = await Promise.all(
    (data ?? []).map(async (reg) => {
      const { data: session } = await supabase
        .from("cash_register_sessions")
        .select("*")
        .eq("register_id", reg.id)
        .is("closed_at", null)
        .maybeSingle();
      return { ...reg, active_session: session ?? null } as CashRegister;
    })
  );

  return registers;
}

// ── Crear nueva caja ─────────────────────────────────────────────────────────
export async function createCashRegister(
  tenantId: string,
  storeId: string,
  name: string,
  description?: string,
  isVirtual = false
): Promise<POSActionResult<CashRegister>> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("cash_registers")
      .insert({ tenant_id: tenantId, store_id: storeId, name, description, is_virtual: isVirtual })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as CashRegister };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear caja";
    return { success: false, error: message };
  }
}

// ── Abrir turno ──────────────────────────────────────────────────────────────
export async function openShift(
  tenantId: string,
  payload: OpenShiftPayload
): Promise<POSActionResult<CashRegisterSession>> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const supabase = await getSupabase();

    // Verificar que no haya turno abierto
    const { data: existing } = await supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("register_id", payload.register_id)
      .is("closed_at", null)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "La caja ya tiene un turno abierto" };
    }

    const { data, error } = await supabase
      .from("cash_register_sessions")
      .insert({
        register_id: payload.register_id,
        tenant_id: tenantId,
        cashier_user_id: payload.cashier_user_id,
        cashier_name: payload.cashier_name,
        opening_balance: payload.opening_balance,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as CashRegisterSession };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al abrir turno";
    return { success: false, error: message };
  }
}

// ── Obtener resumen del turno (para Cierre X y Cierre Z) ─────────────────────
export async function getShiftSummary(
  sessionId: string
): Promise<ShiftSummary | null> {
  const supabase = await getSupabase();

  const { data: session, error } = await supabase
    .from("cash_register_sessions")
    .select("*, register:cash_registers(name)")
    .eq("id", sessionId)
    .single();

  if (error || !session) return null;

  if (session.tenant_id) {
    await assertAuthorizedTenantAdmin(session.tenant_id);
  }

  const { data: movements } = await supabase
    .from("cash_movements")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");

  const expected =
    Number(session.opening_balance) +
    Number(session.total_sales_usd) +
    Number(session.total_cash_in) -
    Number(session.total_cash_out);

  const closingBalance =
    session.closing_balance != null ? Number(session.closing_balance) : expected;

  return {
    register_name: (session.register as { name: string } | null)?.name ?? "—",
    cashier_name: session.cashier_name,
    opened_at: session.opened_at,
    closed_at: session.closed_at ?? new Date().toISOString(),
    opening_balance: Number(session.opening_balance),
    closing_balance: closingBalance,
    expected_balance: expected,
    difference: closingBalance - expected,
    total_sales_usd: Number(session.total_sales_usd),
    total_cash_in: Number(session.total_cash_in),
    total_cash_out: Number(session.total_cash_out),
    transaction_count: Number(session.transaction_count),
    close_type: (session.close_type as "X" | "Z") ?? "X",
    movements: (movements ?? []) as CashMovement[],
  };
}

// ── Cierre Z — Cerrar turno definitivamente ──────────────────────────────────
export async function closeShift(
  payload: CloseShiftPayload
): Promise<POSActionResult<{ expected_balance: number; difference: number }>> {
  try {
    const supabase = await getSupabase();

    const { data: session } = await supabase
      .from("cash_register_sessions")
      .select("tenant_id, opening_balance, total_sales_usd, total_cash_in, total_cash_out")
      .eq("id", payload.session_id)
      .is("closed_at", null) // solo si aún está abierto
      .single();

    if (!session) {
      return { success: false, error: "Turno no encontrado o ya cerrado" };
    }

    if (session.tenant_id) {
      await assertAuthorizedTenantAdmin(session.tenant_id);
    }

    const expected =
      Number(session.opening_balance) +
      Number(session.total_sales_usd) +
      Number(session.total_cash_in) -
      Number(session.total_cash_out);

    const difference = Number(payload.closing_balance) - expected;

    const { error } = await supabase
      .from("cash_register_sessions")
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: payload.closing_balance,
        expected_balance: expected,
        difference,
        close_type: payload.close_type,
        notes: payload.notes ?? null,
      })
      .eq("id", payload.session_id);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { expected_balance: expected, difference } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al cerrar turno";
    return { success: false, error: message };
  }
}

// ── Registrar movimiento de caja (entrada/salida manual) ─────────────────────
export async function addCashMovement(
  tenantId: string,
  payload: CashMovementPayload
): Promise<POSActionResult> {
  if (payload.amount_usd <= 0) {
    return { success: false, error: "El monto debe ser mayor a 0" };
  }

  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const supabase = await getSupabase();

    // 1. Insertar movimiento
    const { error: movError } = await supabase
      .from("cash_movements")
      .insert({ ...payload, tenant_id: tenantId });

    if (movError) return { success: false, error: movError.message };

    // 2. Actualizar totales en la sesión vía función PG atómica
    const field =
      payload.type === "IN" ? "total_cash_in" : "total_cash_out";

    const { error: rpcError } = await supabase.rpc("increment_session_amount", {
      p_session_id: payload.session_id,
      p_field: field,
      p_amount: payload.amount_usd,
    });

    if (rpcError) return { success: false, error: rpcError.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar movimiento";
    return { success: false, error: message };
  }
}

// ── Historial de sesiones de una caja ────────────────────────────────────────
export async function getRegisterSessions(
  registerId: string,
  limit = 10
): Promise<CashRegisterSession[]> {
  const supabase = await getSupabase();

  const { data: reg } = await supabase
    .from("cash_registers")
    .select("tenant_id")
    .eq("id", registerId)
    .single();

  if (reg?.tenant_id) {
    await assertAuthorizedTenantAdmin(reg.tenant_id);
  }

  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("*")
    .eq("register_id", registerId)
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CashRegisterSession[];
}

// ── Marcar ticket como impreso ───────────────────────────────────────────────
export async function markTicketPrinted(
  sessionId: string
): Promise<POSActionResult> {
  try {
    const supabase = await getSupabase();
    const { data: session } = await supabase
      .from("cash_register_sessions")
      .select("tenant_id")
      .eq("id", sessionId)
      .single();

    if (session?.tenant_id) {
      await assertAuthorizedTenantAdmin(session.tenant_id);
    }

    const { error } = await supabase
      .from("cash_register_sessions")
      .update({ ticket_printed: true })
      .eq("id", sessionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al marcar ticket";
    return { success: false, error: message };
  }
}
