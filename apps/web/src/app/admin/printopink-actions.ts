"use server";

import { MarketOSRepository } from "@marketos/database";
import type {
  PrintopinkCalculation,
  CreatePrintopinkCalculationInput,
  UpdatePrintopinkCalculationInput,
  PrintopinkQuote,
  CreatePrintopinkQuoteInput,
  PrintopinkQuoteStatus,
} from "@marketos/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertAuthorizedTenantAdmin } from "./actions";
import { assertTenantModuleActive } from "./admin-context";

/**
 * Revalidación segura compatible con Next.js 16 (tag + cacheLife profile)
 * y con alcance estricto multi-tenant (Ley 3.2).
 */
function safeRevalidatePrintopinkTag(tenantId: string) {
  try {
    (revalidateTag as unknown as (tag: string, profile?: string) => void)(
      `tenant:${tenantId}:printopink`,
      "max"
    );
  } catch {
    // Ignored in non-request contexts
  }
}

// =============================================================================
// 1. FICHAS DE COSTEO RÁPIDO (printopink_calculations)
// =============================================================================

export async function getPrintopinkCalculationsAction(
  tenantId: string
): Promise<{ success: boolean; data?: PrintopinkCalculation[]; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    await assertTenantModuleActive(tenantId, "printopink_calculator");

    const calculations = await MarketOSRepository.getPrintopinkCalculations(tenantId);
    return { success: true, data: calculations };
  } catch (error) {
    console.error("[printopink-actions] Error getPrintopinkCalculationsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cálculos de taller",
    };
  }
}

export async function savePrintopinkCalculationAction(
  input: CreatePrintopinkCalculationInput
): Promise<{ success: boolean; data?: PrintopinkCalculation; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(input.tenantId);
    await assertTenantModuleActive(input.tenantId, "printopink_calculator");

    const result = await MarketOSRepository.savePrintopinkCalculation(input);

    safeRevalidatePrintopinkTag(input.tenantId);
    revalidatePath("/admin/printopink-calculator");

    return { success: true, data: result };
  } catch (error) {
    console.error("[printopink-actions] Error savePrintopinkCalculationAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar ficha de costeo",
    };
  }
}

export async function updatePrintopinkCalculationAction(
  input: UpdatePrintopinkCalculationInput
): Promise<{ success: boolean; data?: PrintopinkCalculation; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(input.tenantId);
    await assertTenantModuleActive(input.tenantId, "printopink_calculator");

    const result = await MarketOSRepository.updatePrintopinkCalculation(input);

    safeRevalidatePrintopinkTag(input.tenantId);
    revalidatePath("/admin/printopink-calculator");

    return { success: true, data: result };
  } catch (error) {
    console.error("[printopink-actions] Error updatePrintopinkCalculationAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar ficha de costeo",
    };
  }
}

export async function deletePrintopinkCalculationAction(
  tenantId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    await assertTenantModuleActive(tenantId, "printopink_calculator");

    const ok = await MarketOSRepository.deletePrintopinkCalculation(tenantId, id);
    if (!ok) throw new Error("No se pudo eliminar el cálculo");

    safeRevalidatePrintopinkTag(tenantId);
    revalidatePath("/admin/printopink-calculator");

    return { success: true };
  } catch (error) {
    console.error("[printopink-actions] Error deletePrintopinkCalculationAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar cálculo",
    };
  }
}

// =============================================================================
// 2. COTIZACIONES RÁPIDAS (printopink_quotes)
// =============================================================================

export async function getPrintopinkQuotesAction(
  tenantId: string
): Promise<{ success: boolean; data?: PrintopinkQuote[]; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    await assertTenantModuleActive(tenantId, "printopink_calculator");

    const quotes = await MarketOSRepository.getPrintopinkQuotes(tenantId);
    return { success: true, data: quotes };
  } catch (error) {
    console.error("[printopink-actions] Error getPrintopinkQuotesAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cotizaciones",
    };
  }
}

export async function createPrintopinkQuoteAction(
  input: CreatePrintopinkQuoteInput
): Promise<{ success: boolean; data?: PrintopinkQuote; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(input.tenantId);
    await assertTenantModuleActive(input.tenantId, "printopink_calculator");

    const quote = await MarketOSRepository.createPrintopinkQuote(input);

    safeRevalidatePrintopinkTag(input.tenantId);
    revalidatePath("/admin/printopink-calculator");

    return { success: true, data: quote };
  } catch (error) {
    console.error("[printopink-actions] Error createPrintopinkQuoteAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar cotización",
    };
  }
}

export async function updatePrintopinkQuoteStatusAction(
  tenantId: string,
  quoteId: string,
  status: PrintopinkQuoteStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    await assertTenantModuleActive(tenantId, "printopink_calculator");

    const ok = await MarketOSRepository.updatePrintopinkQuoteStatus(tenantId, quoteId, status);
    if (!ok) throw new Error("No se pudo actualizar el estado de la cotización");

    safeRevalidatePrintopinkTag(tenantId);
    revalidatePath("/admin/printopink-calculator");

    return { success: true };
  } catch (error) {
    console.error("[printopink-actions] Error updatePrintopinkQuoteStatusAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar estado",
    };
  }
}
