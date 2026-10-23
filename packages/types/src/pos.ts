/**
 * Plugin: pos_registers — Multi-Caja & Turnos POS
 * Tipos TypeScript para cajas, sesiones, movimientos y arqueo.
 */

export type CloseType = "X" | "Z";
export type CashMovementType = "IN" | "OUT";

// ── Entidades de BD ────────────────────────────────────────────────────────────

export interface CashRegister {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  description?: string | null;
  /** pin_hash nunca viaja al cliente — solo existe en servidor */
  is_virtual: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Join opcional: sesión activa (closed_at IS NULL) */
  active_session?: CashRegisterSession | null;
}

export interface CashRegisterSession {
  id: string;
  register_id: string;
  tenant_id: string;
  cashier_user_id: string;
  cashier_name: string;
  opened_at: string;
  closed_at?: string | null;
  opening_balance: number;
  closing_balance?: number | null;
  expected_balance?: number | null;
  difference?: number | null;
  total_sales_usd: number;
  total_cash_in: number;
  total_cash_out: number;
  transaction_count: number;
  close_type?: CloseType | null;
  notes?: string | null;
  ticket_printed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashMovement {
  id: string;
  session_id: string;
  tenant_id: string;
  type: CashMovementType;
  amount_usd: number;
  reason: string;
  created_by: string;
  created_at: string;
}

// ── Payloads para Server Actions ───────────────────────────────────────────────

export interface OpenShiftPayload {
  register_id: string;
  opening_balance: number;
  cashier_user_id: string;
  cashier_name: string;
}

export interface CloseShiftPayload {
  session_id: string;
  closing_balance: number;
  close_type: CloseType;
  notes?: string;
}

export interface CashMovementPayload {
  session_id: string;
  type: CashMovementType;
  amount_usd: number;
  reason: string;
  created_by: string;
}

export interface VerifyPinPayload {
  register_id: string;
  /** PIN en texto plano — bcrypt.compare en servidor */
  pin: string;
}

// ── Resumen de turno para arqueo / ticket ──────────────────────────────────────

export interface ShiftSummary {
  register_name: string;
  cashier_name: string;
  opened_at: string;
  closed_at: string;
  opening_balance: number;
  closing_balance: number;
  expected_balance: number;
  difference: number;
  total_sales_usd: number;
  total_cash_in: number;
  total_cash_out: number;
  transaction_count: number;
  close_type: CloseType;
  movements: CashMovement[];
}

// ── Resultado genérico de Server Action ───────────────────────────────────────

export type POSActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };
