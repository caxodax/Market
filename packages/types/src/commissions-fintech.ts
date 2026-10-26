export interface SalesAgent {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  commission_rate_percent: number;
  phone?: string;
  email?: string;
  is_active: boolean;
  total_sales_count?: number;
  total_sales_volume?: number;
  total_commission_earned?: number;
  created_at: string;
  updated_at?: string;
}

export type CommissionStatus = "PENDING" | "PAID" | "CANCELLED";

export interface CommissionRecord {
  id: string;
  tenant_id: string;
  sales_agent_id: string;
  agent_name: string;
  order_id?: string;
  document_number?: string;
  sale_amount: number;
  commission_percent: number;
  commission_amount: number;
  currency: "USD" | "VES";
  status: CommissionStatus;
  notes?: string;
  paid_at?: string;
  created_at: string;
}

export type FintechPaymentProvider =
  | "CASHEA"
  | "BIOPAGO_BDV"
  | "SPIDI"
  | "WAYUPAY"
  | "PAGO_MOVIL";

export interface FintechPaymentLink {
  id: string;
  tenant_id: string;
  provider: FintechPaymentProvider;
  url: string;
  qr_data: string;
  amount: number;
  currency: "USD" | "VES";
  reference: string;
  description: string;
  customer_name?: string;
  customer_phone?: string;
  expires_at?: string;
  created_at: string;
}

export interface GeneratePaymentLinkInput {
  tenantId: string;
  tenantName: string;
  orderId: string;
  provider: FintechPaymentProvider;
  amountUsd: number;
  exchangeRateBcv?: number;
  customerName?: string;
  customerPhone?: string;
  merchantCredentials?: {
    casheaMerchantId?: string;
    biopagoTerminalId?: string;
    spidiApiKey?: string;
  };
}
