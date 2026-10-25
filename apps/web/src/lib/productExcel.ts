"use client";

import ExcelJS from "exceljs";
import type { Category } from "@marketos/types";

export interface ParsedProductRow {
  name: string;
  categoryName: string;
  priceUsd: number;
  stock: number;
  sku?: string;
  barcode?: string;
  description?: string;
}

export interface ParseProductsResult {
  validRows: ParsedProductRow[];
  errors: { row: number; error: string }[];
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function styleHeaderRow(row: ExcelJS.Row, height = 28) {
  row.height = height;
  row.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
}

async function triggerDownload(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Generates and downloads the official MarketOS Product Import Template (.xlsx)
 */
export async function downloadProductImportTemplate(categories: Category[] = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MarketOS Inventory Engine";
  workbook.created = new Date();

  // ── Sheet 1: Plantilla de Productos ──────────────────────────────────────────
  const ws = workbook.addWorksheet("Productos", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { header: "Nombre Producto (*)", key: "name", width: 32 },
    { header: "Categoría (*)", key: "category", width: 22 },
    { header: "Precio USD (*)", key: "price_usd", width: 16 },
    { header: "Stock Inicial (*)", key: "stock", width: 16 },
    { header: "SKU / Código Interno", key: "sku", width: 20 },
    { header: "Código de Barra EAN/UPC", key: "barcode", width: 24 },
    { header: "Descripción", key: "description", width: 36 },
  ];

  styleHeaderRow(ws.getRow(1), 30);

  // Example row 1
  const ex1 = ws.addRow({
    name: "Harina Pan Blanca 1kg",
    category: categories[0]?.name || "Víveres",
    price_usd: 1.45,
    stock: 50,
    sku: "PAN-001",
    barcode: "7591001234567",
    description: "Harina de maíz blanco precocida tradicional",
  });
  ex1.height = 22;
  ex1.getCell("price_usd").numFmt = '"$"#,##0.00';
  ex1.getCell("stock").numFmt = "#,##0";
  ex1.eachCell((c) => {
    c.border = thinBorder;
  });

  // Example row 2
  const ex2 = ws.addRow({
    name: "Arroz Mary Tradicional 1kg",
    category: categories[1]?.name || categories[0]?.name || "Granos",
    price_usd: 1.20,
    stock: 40,
    sku: "ARR-002",
    barcode: "7591002345678",
    description: "Arroz blanco de grano entero enriquecido",
  });
  ex2.height = 22;
  ex2.getCell("price_usd").numFmt = '"$"#,##0.00';
  ex2.getCell("stock").numFmt = "#,##0";
  ex2.eachCell((c) => {
    c.border = thinBorder;
  });

  // ── Sheet 2: Guía & Categorías Disponibles ─────────────────────────────────────
  const wsGuide = workbook.addWorksheet("Instrucciones y Categorías", {
    views: [{ showGridLines: true }],
  });

  wsGuide.columns = [
    { header: "Campo", key: "field", width: 26 },
    { header: "Requerido", key: "required", width: 14 },
    { header: "Formato / Regla", key: "rules", width: 45 },
  ];

  styleHeaderRow(wsGuide.getRow(1), 28);

  const guideRows = [
    { field: "Nombre Producto", required: "Sí (*)", rules: "Texto. Mínimo 2 caracteres." },
    { field: "Categoría", required: "Sí (*)", rules: "Nombre de la categoría. Si no existe, se asignará a General." },
    { field: "Precio USD", required: "Sí (*)", rules: "Numérico mayor a 0 (ej. 1.45 o 12.00). Use punto decimal." },
    { field: "Stock Inicial", required: "Sí (*)", rules: "Entero mayor o igual a 0 (ej. 10, 50, 100)." },
    { field: "SKU", required: "No", rules: "Código alfanumérico interno para control de inventario." },
    { field: "Código de Barra", required: "No", rules: "EAN-13, UPC o código para lectura por escáner POS." },
    { field: "Descripción", required: "No", rules: "Texto libre informativo para la ficha del cliente." },
  ];

  guideRows.forEach((r, i) => {
    const row = wsGuide.addRow(r);
    row.height = 20;
    row.getCell("field").font = { bold: true };
    row.getCell("required").alignment = { horizontal: "center" };
    row.eachCell((c) => {
      c.border = thinBorder;
    });
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  // Available categories list
  wsGuide.addRow({});
  const catTitle = wsGuide.addRow(["CATEGORÍAS EXISTENTES EN TU TIENDA:", "", ""]);
  catTitle.getCell(1).font = { bold: true, color: { argb: "FF0F172A" } };

  categories.forEach((cat) => {
    const r = wsGuide.addRow([`• ${cat.name}`, "", ""]);
    r.getCell(1).font = { color: { argb: "FF334155" } };
  });

  await triggerDownload(workbook, "Plantilla_Carga_Productos_MarketOS.xlsx");
}

/**
 * Parses an uploaded .xlsx or .csv Excel file into validated product rows
 */
export async function parseProductsExcel(file: File): Promise<ParseProductsResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      validRows: [],
      errors: [{ row: 0, error: "El archivo no contiene ninguna hoja válida." }],
    };
  }

  const validRows: ParsedProductRow[] = [];
  const errors: { row: number; error: string }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;

    const rawName = row.getCell(1).value;
    const rawCategory = row.getCell(2).value;
    const rawPrice = row.getCell(3).value;
    const rawStock = row.getCell(4).value;
    const rawSku = row.getCell(5).value;
    const rawBarcode = row.getCell(6).value;
    const rawDesc = row.getCell(7).value;

    const name = String(rawName || "").trim();
    if (!name) {
      // Empty row, skip silently if completely empty
      if (!rawCategory && !rawPrice && !rawStock) return;
      errors.push({ row: rowNumber, error: "El nombre del producto es obligatorio." });
      return;
    }

    const categoryName = String(rawCategory || "").trim() || "General";

    // Clean price
    let priceUsd = 0;
    if (typeof rawPrice === "number") {
      priceUsd = rawPrice;
    } else if (rawPrice && typeof rawPrice === "object" && "result" in rawPrice) {
      priceUsd = Number(rawPrice.result);
    } else {
      const cleanPriceStr = String(rawPrice || "").replace(/[^0-9.,]/g, "").replace(",", ".");
      priceUsd = parseFloat(cleanPriceStr);
    }

    if (isNaN(priceUsd) || priceUsd <= 0) {
      errors.push({ row: rowNumber, error: `Precio inválido para "${name}". Debe ser un número mayor a 0.` });
      return;
    }

    // Clean stock
    let stock = 0;
    if (typeof rawStock === "number") {
      stock = Math.floor(rawStock);
    } else if (rawStock && typeof rawStock === "object" && "result" in rawStock) {
      stock = Math.floor(Number(rawStock.result));
    } else {
      const cleanStockStr = String(rawStock || "").replace(/[^0-9]/g, "");
      stock = parseInt(cleanStockStr, 10);
      if (isNaN(stock)) stock = 0;
    }

    if (stock < 0) {
      errors.push({ row: rowNumber, error: `Stock inválido para "${name}". Debe ser mayor o igual a 0.` });
      return;
    }

    const sku = rawSku ? String(rawSku).trim() : undefined;
    const barcode = rawBarcode ? String(rawBarcode).trim() : undefined;
    const description = rawDesc ? String(rawDesc).trim() : undefined;

    validRows.push({
      name,
      categoryName,
      priceUsd: Number(priceUsd.toFixed(2)),
      stock,
      sku: sku || undefined,
      barcode: barcode || undefined,
      description: description || undefined,
    });
  });

  return { validRows, errors };
}
