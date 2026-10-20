/**
 * Barcode Retail, Supermercados & Bodegones Domain Types
 * Core-isolated: Pure decimals, zero country or currency references.
 */

export interface ProductBarcode {
  id: string;
  tenant_id: string;
  product_id: string;
  barcode: string;
  pack_name: string; // e.g. 'UNIDAD', 'SIX_PACK', 'DOCENA', 'BULTO_24', 'CAJA', 'DISPLAY'
  units_per_pack: number;
  price_usd: number | null; // null = use units_per_pack * product.price_usd
  is_primary: boolean;
  created_at?: string;
}

export interface ScaleBarcodeParsed {
  isScaleBarcode: boolean;
  prefix: string; // e.g. '20', '21'
  rawBarcode: string;
  itemCode: string; // 4-5 digit product SKU
  mode: "WEIGHT" | "PRICE";
  weightKg?: number; // e.g. 0.450 kg
  embeddedPrice?: number; // e.g. 5.25 USD
  isValidChecksum: boolean;
}

export interface WarehouseLocation {
  aisle: string; // Pasillo (e.g. '01', '02')
  shelf: string; // Estante (e.g. 'A', 'B')
  bin: string;   // Nivel / Gaveta (e.g. '01', '02')
}

export interface PickingItem {
  orderItemId: string;
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  packName?: string;
  unitsPerPack?: number;
  location: WarehouseLocation;
  isPicked?: boolean;
}

export interface PackagingConversionResult {
  totalUnits: number;
  equivalentPacks: number;
  remainderUnits: number;
  packName: string;
  unitsPerPack: number;
}
