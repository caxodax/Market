"use server";

import {
  MarketOSRepository,
  CreateOrderInput,
  SubmitPaymentInput,
} from "@marketos/database";
import { revalidatePath } from "next/cache";

export async function createOrderAction(input: CreateOrderInput) {
  try {
    const order = await MarketOSRepository.createOrder(input);
    revalidatePath("/");
    return { success: true, order };
  } catch (error) {
    console.error("Error creating order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al procesar el pedido",
    };
  }
}

export async function submitPaymentProofAction(input: SubmitPaymentInput) {
  try {
    const payment = await MarketOSRepository.submitPaymentProof(input);
    revalidatePath("/");
    return { success: true, payment };
  } catch (error) {
    console.error("Error submitting payment proof:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar el comprobante de pago",
    };
  }
}
