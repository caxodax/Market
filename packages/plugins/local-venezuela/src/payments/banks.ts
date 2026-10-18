export interface VenezuelanBank {
  code: string;
  name: string;
  shortName: string;
}

export const VENEZUELAN_BANKS: VenezuelanBank[] = [
  { code: "0102", name: "Banco de Venezuela, S.A. Banco Universal", shortName: "Banco de Venezuela" },
  { code: "0104", name: "Venezolano de Crédito, S.A. Banco Universal", shortName: "Venezolano de Crédito" },
  { code: "0105", name: "Mercantil, C.A. Banco Universal", shortName: "Mercantil" },
  { code: "0108", name: "Banco Provincial, S.A. Banco Universal", shortName: "BBVA Provincial" },
  { code: "0114", name: "Bancaribe C.A. Banco Universal", shortName: "Bancaribe" },
  { code: "0115", name: "Banco Exterior, C.A. Banco Universal", shortName: "Banco Exterior" },
  { code: "0128", name: "Banco Caroní, C.A. Banco Universal", shortName: "Banco Caroní" },
  { code: "0134", name: "Banesco Banco Universal, C.A.", shortName: "Banesco" },
  { code: "0137", name: "Banco Sofitasa Banco Universal, C.A.", shortName: "Banco Sofitasa" },
  { code: "0138", name: "Banco Plaza, C.A. Banco Universal", shortName: "Banco Plaza" },
  { code: "0151", name: "BFC Banco Fondo Común, C.A. Banco Universal", shortName: "Banco Fondo Común" },
  { code: "0156", name: "100% Banco, Banco Universal C.A.", shortName: "100% Banco" },
  { code: "0157", name: "DelSur, Banco Universal C.A.", shortName: "DelSur" },
  { code: "0163", name: "Banco del Tesoro, C.A. Banco Universal", shortName: "Banco del Tesoro" },
  { code: "0166", name: "Banco Agrícola de Venezuela, C.A. Banco Universal", shortName: "Banco Agrícola" },
  { code: "0168", name: "Bancrecer, S.A. Banco Microfinanciero", shortName: "Bancrecer" },
  { code: "0169", name: "Mi Banco, Banco Microfinanciero C.A.", shortName: "Mi Banco" },
  { code: "0171", name: "Banco Activo, C.A. Banco Universal", shortName: "Banco Activo" },
  { code: "0172", name: "Bancamiga Banco Universal, C.A.", shortName: "Bancamiga" },
  { code: "0174", name: "Banplus Banco Universal, C.A.", shortName: "Banplus" },
  { code: "0175", name: "Banco Bicentenario del Pueblo, Banco Universal C.A.", shortName: "Banco Bicentenario" },
  { code: "0177", name: "Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)", shortName: "BANFANB" },
  { code: "0191", name: "Banco Nacional de Crédito, C.A. Banco Universal", shortName: "BNC" },
];

export function getBankByCode(code: string): VenezuelanBank | undefined {
  return VENEZUELAN_BANKS.find((b) => b.code === code.trim());
}

export function getBankByName(name: string): VenezuelanBank | undefined {
  const normalized = name.toLowerCase().trim();
  return VENEZUELAN_BANKS.find(
    (b) =>
      b.shortName.toLowerCase().includes(normalized) ||
      b.name.toLowerCase().includes(normalized)
  );
}

/**
 * Validates Venezuelan mobile phone prefixes (0412, 0414, 0424, 0416, 0426)
 */
export function isValidVenezuelanMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // Support 04XX (11 digits) or 584XX (12 digits)
  if (digits.length === 11 && digits.startsWith("0")) {
    const prefix = digits.substring(0, 4);
    return ["0412", "0414", "0424", "0416", "0426"].includes(prefix);
  }
  if (digits.length === 12 && digits.startsWith("58")) {
    const prefix = "0" + digits.substring(2, 5);
    return ["0412", "0414", "0424", "0416", "0426"].includes(prefix);
  }
  return false;
}

/**
 * Validates Venezuelan ID Document (Cédula o RIF: V, E, J, G followed by numbers)
 */
export function isValidCedulaOrRif(doc: string): boolean {
  const trimmed = doc.trim().toUpperCase().replace(/[-.]/g, "");
  if (!trimmed) return false;
  const match = trimmed.match(/^([VEJG])(\d{6,9})$/);
  return Boolean(match);
}

/**
 * Validates Pago Móvil payment submission data
 */
export function validatePagoMovilInput(input: {
  phone: string;
  idDoc: string;
  reference: string;
}): { valid: boolean; error?: string } {
  if (!isValidVenezuelanMobile(input.phone)) {
    return {
      valid: false,
      error: "Número de teléfono inválido. Debe comenzar con 0412, 0414, 0424, 0416 o 0426.",
    };
  }

  if (!isValidCedulaOrRif(input.idDoc)) {
    return {
      valid: false,
      error: "Documento de identidad inválido. Debe tener formato V, E, J o G seguido de su número.",
    };
  }

  const cleanRef = input.reference.replace(/\D/g, "");
  if (cleanRef.length < 4) {
    return {
      valid: false,
      error: "El número de referencia debe contener al menos los últimos 4 dígitos del comprobante.",
    };
  }

  return { valid: true };
}
