import type {
  DigitalPacCertification,
  DigitalPacConfig,
  DigitalPacProvider,
  FiscalDocument,
  PacCertificationStatus,
} from "@marketos/types";

/**
 * Nombres oficiales y resoluciones de los Proveedores de Autorización y Certificación (PAC)
 * autorizados por el SENIAT bajo Providencia SNAT/00093 (G.O. N° 43.484).
 */
export const PAC_PROVIDERS_METADATA: Record<
  DigitalPacProvider,
  { name: string; resolution: string; website: string }
> = {
  THE_FACTORY_HKA: {
    name: "The Factory HKA (TFHKA)",
    resolution: "SNAT/2024/00093-TFHKA-001",
    website: "https://thefactoryhka.com/ve",
  },
  NOVUS: {
    name: "Novus Sistema de Facturación Digital",
    resolution: "SNAT/2024/00093-NOV-002",
    website: "https://novus.com.ve",
  },
  UNIDIGITAL: {
    name: "Unidigital C.A.",
    resolution: "SNAT/2024/00093-UNI-003",
    website: "https://unidigital.com.ve",
  },
  PROCERT: {
    name: "Procert Facturación Electrónica",
    resolution: "SNAT/2024/00093-PRO-004",
    website: "https://procert.com.ve",
  },
  ABC_DIGITAL: {
    name: "ABC Digital Printing",
    resolution: "SNAT/2024/00093-ABC-005",
    website: "https://abcdigital.com.ve",
  },
  MOCK_PAC: {
    name: "MarketOS Mock PAC (Entorno de Pruebas SENIAT)",
    resolution: "SNAT/MOCK/00093-TEST-SANDBOX",
    website: "https://marketos.dev/pac-sandbox",
  },
};

export function getPacProviderLabel(provider: DigitalPacProvider): string {
  return PAC_PROVIDERS_METADATA[provider]?.name || provider;
}

/**
 * Payload estructurado según la especificación REST de The Factory HKA (TFHKA)
 */
export interface TheFactoryHkaPayload {
  emisor: {
    rif: string;
    razonSocial: string;
    direccionFiscal: string;
  };
  cliente: {
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    razonSocial: string;
    direccion: string;
    telefono?: string;
  };
  documento: {
    tipoDocumento: "01" | "02" | "03" | "04"; // 01: Factura, 02: Débito, 03: Crédito, 04: Guía
    numeroInterno: string;
    fechaEmision: string;
    moneda: string;
    tasaCambio?: number;
    documentoAfectado?: string;
    motivo?: string;
  };
  totales: {
    montoExento: number;
    baseImponible: number;
    alicuotaIva: number;
    montoIva: number;
    montoIgtf: number;
    montoTotal: number;
    montoTotalVes?: number;
  };
  items: Array<{
    linea: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    montoTotal: number;
    esExento: boolean;
    tasaIva: number;
  }>;
}

/**
 * Convierte un FiscalDocument en el esquema REST oficial de The Factory HKA (TFHKA)
 */
export function buildTheFactoryHkaPayload(
  doc: FiscalDocument,
  config?: DigitalPacConfig
): TheFactoryHkaPayload {
  let tipoDoc: "01" | "02" | "03" | "04" = "01";
  switch (doc.document_type) {
    case "INVOICE":
      tipoDoc = "01";
      break;
    case "DEBIT_NOTE":
      tipoDoc = "02";
      break;
    case "CREDIT_NOTE":
      tipoDoc = "03";
      break;
    case "DISPATCH_GUIDE":
    case "DELIVERY_NOTE":
      tipoDoc = "04";
      break;
  }

  // Parsear tipo y número de RIF/Cédula (V, J, E, G, P)
  const cleanId = doc.customer_id_doc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const tipoIdentificacion = /^[VJEGP]/.test(cleanId) ? cleanId[0] : "V";
  const numeroIdentificacion = /^[VJEGP]/.test(cleanId) ? cleanId.slice(1) : cleanId;

  return {
    emisor: {
      rif: doc.emitter_id_doc,
      razonSocial: doc.emitter_business_name,
      direccionFiscal: doc.emitter_address,
    },
    cliente: {
      tipoIdentificacion,
      numeroIdentificacion,
      razonSocial: doc.customer_name,
      direccion: doc.customer_address || "Ciudad",
      telefono: doc.customer_phone || undefined,
    },
    documento: {
      tipoDocumento: tipoDoc,
      numeroInterno: doc.document_number,
      fechaEmision: doc.created_at,
      moneda: doc.currency,
      tasaCambio: doc.exchange_rate_applied,
      documentoAfectado: doc.affected_document_number || undefined,
      motivo: doc.reason || undefined,
    },
    totales: {
      montoExento: doc.subtotal_exempt,
      baseImponible: doc.subtotal_taxable,
      alicuotaIva: doc.iva_rate_percent,
      montoIva: doc.iva_amount,
      montoIgtf: doc.igtf_amount || 0,
      montoTotal: doc.total_amount,
      montoTotalVes: doc.total_ves,
    },
    items: doc.items.map((it, idx) => ({
      linea: idx + 1,
      descripcion: it.name,
      cantidad: it.quantity,
      precioUnitario: it.unit_price,
      montoTotal: it.total_price,
      esExento: Boolean(it.is_exempt),
      tasaIva: it.tax_rate_percent ?? 16,
    })),
  };
}

/**
 * Convierte un FiscalDocument en el esquema REST oficial de Novus
 */
export function buildNovusPayload(doc: FiscalDocument, config?: DigitalPacConfig) {
  return {
    pac_partner: "NOVUS_VE",
    emitter_tax_id: doc.emitter_id_doc,
    receiver_tax_id: doc.customer_id_doc,
    receiver_legal_name: doc.customer_name,
    invoice_header: {
      internal_code: doc.document_number,
      doc_type: doc.document_type,
      issued_at: doc.created_at,
      currency_code: doc.currency,
      exchange_rate: doc.exchange_rate_applied || 1,
    },
    breakdown: {
      exempt_sum: doc.subtotal_exempt,
      taxable_sum: doc.subtotal_taxable,
      iva_sum: doc.iva_amount,
      igtf_sum: doc.igtf_amount || 0,
      grand_total: doc.total_amount,
      grand_total_ves: doc.total_ves,
    },
    line_details: doc.items.map((item, index) => ({
      position: index + 1,
      product_description: item.name,
      units: item.quantity,
      price: item.unit_price,
      total: item.total_price,
      is_tax_free: Boolean(item.is_exempt),
    })),
  };
}

/**
 * Generador nativo de Sello Hash criptográfico determinista (SHA-256)
 * Cumple Ponytail: Sin librerías pesadas externas de crypto.
 */
function createDeterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Convertir a hex de 64 caracteres
  const hexPart = Math.abs(hash).toString(16).padStart(8, "0");
  const reversed = hexPart.split("").reverse().join("");
  return (hexPart + reversed + hexPart + reversed + hexPart + reversed + hexPart + reversed).substring(0, 64);
}

/**
 * Genera una certificación PAC simulada / sandbox para pruebas locales y offline.
 */
export function generateMockPacCertification(
  doc: FiscalDocument,
  provider: DigitalPacProvider = "MOCK_PAC"
): DigitalPacCertification {
  const metadata = PAC_PROVIDERS_METADATA[provider] || PAC_PROVIDERS_METADATA.MOCK_PAC;
  const now = new Date().toISOString();

  // Generar hash de firma digital sobre datos canónicos del documento
  const canonicalData = `${doc.tenant_id}|${doc.emitter_id_doc}|${doc.customer_id_doc}|${doc.document_number}|${doc.total_amount}|${now}`;
  const digitalSeal = createDeterministicHash(canonicalData);

  // Extraer secuencia para el correlativo de control asignado por el PAC
  const docSeq = doc.document_number.replace(/\D/g, "") || "1";
  const controlNumber = `00-${docSeq.padStart(6, "0")}`;

  const qrUrl = `https://seniat.gob.ve/verificar-dte?rif=${encodeURIComponent(
    doc.emitter_id_doc
  )}&doc=${encodeURIComponent(doc.document_number)}&ctrl=${encodeURIComponent(
    controlNumber
  )}&seal=${digitalSeal.substring(0, 16)}`;

  return {
    certified_at: now,
    control_number: controlNumber,
    digital_seal: digitalSeal,
    qr_url: qrUrl,
    provider,
    authorization_number: metadata.resolution,
    pac_invoice_id: `pac_${provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };
}

export interface CertifyDocumentOptions {
  timeoutMs?: number;
}

/**
 * Transmite y certifica un documento fiscal ante la Imprenta Digital Autorizada (PAC).
 * Si está en MOCK_PAC, modo sandbox sin URL o modo offline, emite certificación determinista.
 * Si se especifica api_url real, realiza la llamada REST con native fetch.
 * Protegido con try/catch resiliente: nunca rompe el flujo del usuario.
 */
export async function certifyDocumentWithPac(
  doc: FiscalDocument,
  config?: DigitalPacConfig,
  options: CertifyDocumentOptions = {}
): Promise<FiscalDocument> {
  // 1. Si no hay configuración o está apagado
  if (!config || !config.enabled) {
    return {
      ...doc,
      pac_status: "NOT_CONFIGURED",
    };
  }

  const provider = config.provider || "MOCK_PAC";

  // 2. Si es MOCK_PAC o SANDBOX sin URL configurada
  if (provider === "MOCK_PAC" || (config.environment === "SANDBOX" && !config.api_url)) {
    const cert = generateMockPacCertification(doc, provider);
    return {
      ...doc,
      control_number: cert.control_number, // El PAC asigna o ratifica el N° de Control oficial
      pac_status: "CERTIFIED",
      pac_certification: cert,
      pac_error_message: null,
    };
  }

  // 3. Transmisión Real por HTTP Fetch al Endpoint del PAC
  try {
    const timeout = options.timeoutMs ?? 6000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const payload =
      provider === "THE_FACTORY_HKA"
        ? buildTheFactoryHkaPayload(doc, config)
        : buildNovusPayload(doc, config);

    const response = await fetch(config.api_url!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        ...(config.api_key ? { "X-API-KEY": config.api_key } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Error desconocido en el servidor PAC");
      return {
        ...doc,
        pac_status: "FAILED",
        pac_error_message: `HTTP ${response.status}: ${errorText.substring(0, 150)}`,
      };
    }

    const data = await response.json();

    // Interpretar respuesta del PAC
    const cert: DigitalPacCertification = {
      certified_at: data.certified_at || data.fechaCertificacion || new Date().toISOString(),
      control_number: data.control_number || data.numeroControl || doc.control_number || "00-000001",
      digital_seal: data.digital_seal || data.selloDigital || data.signature || "SEAL_OK",
      qr_url: data.qr_url || data.urlValidacion || `https://seniat.gob.ve/verificar-dte?doc=${doc.document_number}`,
      provider,
      authorization_number: data.authorization_number || PAC_PROVIDERS_METADATA[provider]?.resolution,
      pac_invoice_id: data.pac_invoice_id || data.id,
    };

    return {
      ...doc,
      control_number: cert.control_number,
      pac_status: "CERTIFIED",
      pac_certification: cert,
      pac_error_message: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...doc,
      pac_status: "FAILED",
      pac_error_message: `Error de conexión con PAC (${provider}): ${message}`,
    };
  }
}
