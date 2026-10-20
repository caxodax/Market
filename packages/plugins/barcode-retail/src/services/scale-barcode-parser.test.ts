import { describe, it, expect } from "vitest";
import { validateEan13Checksum, parseScaleBarcode } from "./scale-barcode-parser";

describe("Scale Barcode Parser & GS1 EAN-13 Validation", () => {
  it("correctly validates legitimate EAN-13 barcodes", () => {
    // 7591031000015 (Valid Venezuelan Polar product)
    // 1st (odd): 7, 9, 0, 1, 0, 0 -> sum = 17 * 1 = 17
    // 2nd (even): 5, 1, 3, 0, 0, 1 -> sum = 10 * 3 = 30
    // Total sum = 47. Remainder = 7. 10 - 7 = 3 (wait, polar example check digit is calculated by formula)
    // Let's test with a mathematically computed EAN-13:
    // Barcode: 4006381333931 (Stabilo Boss highlighter)
    expect(validateEan13Checksum("4006381333931")).toBe(true);
    // Invalid check digit:
    expect(validateEan13Checksum("4006381333932")).toBe(false);
  });

  it("identifies standard non-scale barcodes as normal products", () => {
    const res = parseScaleBarcode("7591234567890");
    expect(res.isScaleBarcode).toBe(false);
    expect(res.rawBarcode).toBe("7591234567890");
  });

  it("parses GS1 prefix 20 variable weight barcodes accurately (e.g. 450 grams)", () => {
    // 20 (prefix) + 01452 (item) + 00450 (450g)
    // Let's calculate checksum for 200145200450:
    // 2*1 + 0*3 + 0*1 + 1*3 + 4*1 + 5*3 + 2*1 + 0*3 + 0*1 + 4*3 + 5*1 + 0*3
    // = 2 + 0 + 0 + 3 + 4 + 15 + 2 + 0 + 0 + 12 + 5 + 0 = 43
    // 43 % 10 = 3 -> Check digit = 10 - 3 = 7
    const scaleBarcode = "2001452004507";
    const res = parseScaleBarcode(scaleBarcode);

    expect(res.isScaleBarcode).toBe(true);
    expect(res.prefix).toBe("20");
    expect(res.itemCode).toBe("01452");
    expect(res.mode).toBe("WEIGHT");
    expect(res.weightKg).toBe(0.45);
    expect(res.isValidChecksum).toBe(true);
  });

  it("parses GS1 prefix 23 embedded price barcodes accurately (e.g. 5.25 USD)", () => {
    // 23 (prefix) + 09876 (item) + 00525 ($5.25)
    // 2*1 + 3*3 + 0*1 + 9*3 + 8*1 + 7*3 + 6*1 + 0*3 + 0*1 + 5*3 + 2*1 + 5*3
    // = 2 + 9 + 0 + 27 + 8 + 21 + 6 + 0 + 0 + 15 + 2 + 15 = 105
    // 105 % 10 = 5 -> Check digit = 10 - 5 = 5
    const priceBarcode = "2309876005255";
    const res = parseScaleBarcode(priceBarcode);

    expect(res.isScaleBarcode).toBe(true);
    expect(res.prefix).toBe("23");
    expect(res.itemCode).toBe("09876");
    expect(res.mode).toBe("PRICE");
    expect(res.embeddedPrice).toBe(5.25);
    expect(res.isValidChecksum).toBe(true);
  });

  it("handles malformed or empty barcode strings safely without throwing", () => {
    expect(parseScaleBarcode("").isScaleBarcode).toBe(false);
    expect(parseScaleBarcode("123").isScaleBarcode).toBe(false);
    expect(parseScaleBarcode("invalid_barcode").isScaleBarcode).toBe(false);
  });
});
