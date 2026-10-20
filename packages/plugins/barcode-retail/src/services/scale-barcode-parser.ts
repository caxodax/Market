import { ScaleBarcodeParsed } from "@marketos/types";

/**
 * Calculates and validates the official GS1 EAN-13 check digit (Modulo 10 / Luhn variant).
 */
export function validateEan13Checksum(barcode: string): boolean {
  if (!barcode || barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i]!, 10);
    // In EAN-13, odd indices (1-indexed: 1, 3, 5...) are multiplied by 1; even (2, 4, 6...) by 3.
    // In 0-indexed: index 0 is 1st (odd) -> *1; index 1 is 2nd (even) -> *3
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const remainder = sum % 10;
  const expectedCheckDigit = remainder === 0 ? 0 : 10 - remainder;
  const actualCheckDigit = parseInt(barcode[12]!, 10);

  return expectedCheckDigit === actualCheckDigit;
}

/**
 * Parses GS1 Variable Measure Barcodes (EAN-13 with prefixes 20-29).
 * Standard supermarket format:
 * [20] (Prefix, 2 digits)
 * [IIIII] (Item SKU / Internal Code, 5 digits)
 * [WWWWW] (Weight in grams or embedded price, 5 digits)
 * [C] (Check digit, 1 digit)
 *
 * Example: '2001452004508' -> Item '01452', 450 grams (0.450 kg)
 */
export function parseScaleBarcode(barcode: string): ScaleBarcodeParsed {
  const cleanBarcode = barcode ? barcode.trim() : "";

  if (!cleanBarcode || cleanBarcode.length !== 13 || !/^\d{13}$/.test(cleanBarcode)) {
    return {
      isScaleBarcode: false,
      prefix: "",
      rawBarcode: cleanBarcode,
      itemCode: "",
      mode: "WEIGHT",
      isValidChecksum: false,
    };
  }

  const prefix = cleanBarcode.slice(0, 2);
  const isScalePrefix = /^2[0-9]$/.test(prefix);

  if (!isScalePrefix) {
    return {
      isScaleBarcode: false,
      prefix,
      rawBarcode: cleanBarcode,
      itemCode: "",
      mode: "WEIGHT",
      isValidChecksum: validateEan13Checksum(cleanBarcode),
    };
  }

  const isValidChecksum = validateEan13Checksum(cleanBarcode);
  // Standard format: Prefix(2) + ItemCode(5) + Weight/Price(5) + Check(1)
  const itemCode = cleanBarcode.slice(2, 7);
  const valuePayload = cleanBarcode.slice(7, 12);
  const numericVal = parseInt(valuePayload, 10);

  // If prefix is 20, 21, 22 -> typically Weight in Grams
  // If prefix is 23, 24 -> typically Embedded Price in cents
  const isPriceMode = prefix === "23" || prefix === "24";

  if (isPriceMode) {
    return {
      isScaleBarcode: true,
      prefix,
      rawBarcode: cleanBarcode,
      itemCode,
      mode: "PRICE",
      embeddedPrice: numericVal / 100, // e.g. 525 cents -> 5.25
      isValidChecksum,
    };
  }

  // Weight mode: payload is grams -> convert to kilograms (e.g. 450g -> 0.45 kg)
  return {
    isScaleBarcode: true,
    prefix,
    rawBarcode: cleanBarcode,
    itemCode,
    mode: "WEIGHT",
    weightKg: numericVal / 1000,
    isValidChecksum,
  };
}
