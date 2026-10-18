"use client";

import ExcelJS from "exceljs";
import {
  Order,
  SalesAnalytics,
  TenantSettings,
  ExchangeRate,
} from "@marketos/types";
import {
  formatCaracasDateTime,
  formatCaracasDate,
  getCaracasDateKey,
} from "@marketos/utils";

export interface ExportReportOptions {
  settings: TenantSettings;
  orders: Order[];
  analytics: SalesAnalytics | null;
  exchangeRate: ExchangeRate;
  dateRange: "today" | "week" | "month" | "all";
  activeModuleIds?: string[];
}

/**
 * Creates and initializes a stylized ExcelJS Workbook with store metadata
 */
function createMarketOSWorkbook(businessName: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = `MarketOS Commerce - ${businessName}`;
  wb.lastModifiedBy = "MarketOS Analytics";
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

/**
 * Common borders for financial sheets
 */
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

const totalDoubleBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "double", color: { argb: "FF0F172A" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

/**
 * Style table header rows with dark slate corporate theme
 */
function styleHeaderRow(row: ExcelJS.Row, height = 26) {
  row.height = height;
  row.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate 900
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
}

/**
 * Trigger download in the browser
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
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
 * Generates and downloads an Executive Multi-Sheet Excel Report (.xlsx)
 * Sheets:
 * 1. Resumen Ejecutivo (Financial KPIs, Payment Methods, Top Products)
 * 2. Detalle de Pedidos (Full Audit Trail with Caracas Timestamps)
 * 3. Desglose Diario (Daily trend)
 */
export async function exportSalesReportsToExcel(options: ExportReportOptions) {
  const { settings, orders, analytics, exchangeRate, dateRange, activeModuleIds = [] } = options;
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");

  const workbook = createMarketOSWorkbook(settings.business_name);
  const rateValue = exchangeRate.value || 1;

  const RANGE_LABELS: Record<string, string> = {
    today: "Hoy",
    week: "Últimos 7 Días",
    month: "Este Mes",
    all: "Histórico Completo",
  };
  const rangeTitle = RANGE_LABELS[dateRange] || "Período";

  // ==========================================
  // PESTAÑA 1: RESUMEN EJECUTIVO & KPIS
  // ==========================================
  const wsSummary = workbook.addWorksheet("Resumen Ejecutivo", {
    views: [{ showGridLines: true }],
  });

  // Título Principal
  wsSummary.mergeCells("A1:F1");
  const titleCell = wsSummary.getCell("A1");
  titleCell.value = `${settings.business_name.toUpperCase()} - REPORTE FINANCIERO Y VENTAS`;
  titleCell.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  wsSummary.getRow(1).height = 32;

  // Subtítulo con Metadatos del Período
  wsSummary.mergeCells("A2:F2");
  const subCell = wsSummary.getCell("A2");
  subCell.value = isVenezuelaActive
    ? `Período: ${rangeTitle}  |  Generado: ${formatCaracasDateTime(new Date())}  |  Zona Horaria: America/Caracas (UTC-4)  |  Tasa Oficial: Bs. ${rateValue.toFixed(2)}`
    : `Período: ${rangeTitle}  |  Generado: ${new Date().toLocaleString()}  |  Moneda Base: USD`;
  subCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF334155" } };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  wsSummary.getRow(2).height = 22;

  wsSummary.getRow(3).height = 10;

  // SECCIÓN 1: KPIs CLAVE
  const kpiSection = wsSummary.getRow(4);
  kpiSection.getCell(1).value = "MÉTRICAS CLAVE DEL NEGOCIO";
  kpiSection.getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
  kpiSection.height = 24;

  const totalRevenueUsd = analytics?.totalRevenueUsd ?? orders.reduce((sum, o) => {
    return ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED"].includes(o.status)
      ? sum + o.total_usd
      : sum;
  }, 0);

  const totalRevenueVes = analytics?.totalRevenueVes ?? totalRevenueUsd * rateValue;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const activeOrders = orders.filter((o) =>
    ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING"].includes(o.status)
  ).length;
  const pendingPaymentOrders = orders.filter((o) => o.status === "PAYMENT_PENDING" || o.status === "CREATED").length;
  const deliveryOrders = orders.filter((o) => o.delivery_type === "DELIVERY").length;
  const pickupOrders = orders.filter((o) => o.delivery_type === "PICKUP").length;
  const totalUnits = orders.reduce((acc, o) => acc + (o.items?.reduce((s, it) => s + it.quantity, 0) || 0), 0);
  const avgTicket = orders.length > 0 ? totalRevenueUsd / (completedOrders + activeOrders || 1) : 0;

  const kpis = [
    { label: "Ventas Totales Facturadas (USD)", value: totalRevenueUsd, numFmt: '"$"#,##0.00', highlight: true },
    ...(isVenezuelaActive
      ? [{ label: "Ventas Totales Facturadas (VES)", value: totalRevenueVes, numFmt: '"Bs. "#,##0.00', highlight: true }]
      : []),
    { label: "Total de Pedidos en el Período", value: orders.length, numFmt: "#,##0" },
    { label: "Pedidos Entregados con Éxito", value: completedOrders, numFmt: "#,##0" },
    { label: "Pedidos en Proceso / Ruta", value: activeOrders, numFmt: "#,##0" },
    { label: "Pedidos por Validar Pago", value: pendingPaymentOrders, numFmt: "#,##0" },
    { label: "Ticket Promedio por Pedido", value: avgTicket, numFmt: '"$"#,##0.00' },
    { label: "Unidades Totales Vendidas", value: totalUnits, numFmt: "#,##0" },
    { label: "Despachos a Domicilio (Delivery)", value: deliveryOrders, numFmt: "#,##0" },
    { label: "Retiros en Sucursal / Tienda", value: pickupOrders, numFmt: "#,##0" },
  ];

  kpis.forEach((kpi, idx) => {
    const row = wsSummary.getRow(5 + idx);
    row.height = 20;

    const labelCell = row.getCell(1);
    labelCell.value = kpi.label;
    labelCell.font = { name: "Segoe UI", size: 10, bold: kpi.highlight || false, color: { argb: "FF334155" } };
    labelCell.alignment = { vertical: "middle" };

    const valueCell = row.getCell(2);
    valueCell.value = kpi.value;
    valueCell.font = {
      name: "Segoe UI",
      size: 10,
      bold: true,
      color: kpi.highlight ? { argb: "FF15803D" } : { argb: "FF0F172A" },
    };
    valueCell.alignment = { vertical: "middle", horizontal: "right" };
    if (kpi.numFmt) valueCell.numFmt = kpi.numFmt;

    labelCell.border = thinBorder;
    valueCell.border = thinBorder;

    if (kpi.highlight) {
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
      valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
    }
  });

  // SECCIÓN 2: MÉTODOS DE PAGO
  let curRowIdx = 5 + kpis.length + 2;
  const pmTitle = wsSummary.getRow(curRowIdx);
  pmTitle.getCell(1).value = "DESGLOSE POR MÉTODO DE PAGO";
  pmTitle.getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
  curRowIdx++;

  const pmHeaderRow = wsSummary.getRow(curRowIdx);
  pmHeaderRow.getCell(1).value = "Método de Pago";
  pmHeaderRow.getCell(2).value = "Pedidos";
  pmHeaderRow.getCell(3).value = "Monto USD ($)";
  pmHeaderRow.getCell(4).value = "Monto VES (Bs)";
  pmHeaderRow.getCell(5).value = "% Participación";
  styleHeaderRow(pmHeaderRow);
  curRowIdx++;

  const pmBreakdown = analytics?.revenueByMethod || [];
  pmBreakdown.forEach((pm, i) => {
    const r = wsSummary.getRow(curRowIdx);
    r.height = 20;
    r.getCell(1).value = pm.label;
    r.getCell(2).value = pm.count;
    r.getCell(2).numFmt = "#,##0";
    r.getCell(3).value = pm.totalUsd;
    r.getCell(3).numFmt = '"$"#,##0.00';
    r.getCell(4).value = pm.totalVes;
    r.getCell(4).numFmt = '"Bs. "#,##0.00';

    const pct = totalRevenueUsd > 0 ? pm.totalUsd / totalRevenueUsd : 0;
    r.getCell(5).value = pct;
    r.getCell(5).numFmt = "0.0%";

    r.alignment = { vertical: "middle" };
    r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
    r.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
    r.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder;
      if (i % 2 === 1) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    }
    curRowIdx++;
  });

  // SECCIÓN 3: TOP PRODUCTOS
  curRowIdx += 2;
  const prodTitle = wsSummary.getRow(curRowIdx);
  prodTitle.getCell(1).value = "TOP PRODUCTOS MÁS VENDIDOS";
  prodTitle.getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
  curRowIdx++;

  const prodHeaderRow = wsSummary.getRow(curRowIdx);
  prodHeaderRow.getCell(1).value = "#";
  prodHeaderRow.getCell(2).value = "Producto";
  prodHeaderRow.getCell(3).value = "Unidades Vendidas";
  prodHeaderRow.getCell(4).value = "Ingresos USD ($)";
  prodHeaderRow.getCell(5).value = "% del Total";
  styleHeaderRow(prodHeaderRow);
  curRowIdx++;

  const topProducts = analytics?.topSellingProducts || [];
  topProducts.forEach((prod, i) => {
    const r = wsSummary.getRow(curRowIdx);
    r.height = 20;
    r.getCell(1).value = i + 1;
    r.getCell(2).value = prod.productName;
    r.getCell(3).value = prod.quantitySold;
    r.getCell(3).numFmt = "#,##0";
    r.getCell(4).value = prod.totalRevenueUsd;
    r.getCell(4).numFmt = '"$"#,##0.00';

    const pct = totalRevenueUsd > 0 ? prod.totalRevenueUsd / totalRevenueUsd : 0;
    r.getCell(5).value = pct;
    r.getCell(5).numFmt = "0.0%";

    r.alignment = { vertical: "middle" };
    r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
    r.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder;
      if (i % 2 === 1) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    }
    curRowIdx++;
  });

  // Auto-ajustar anchos en Resumen
  wsSummary.columns = [
    { width: 34 },
    { width: 20 },
    { width: 20 },
    { width: 22 },
    { width: 18 },
    { width: 16 },
  ];

  // ==========================================
  // PESTAÑA 2: DETALLE DE PEDIDOS (AUDITORÍA)
  // ==========================================
  const wsOrders = workbook.addWorksheet("Detalle de Pedidos", {
    views: [{ showGridLines: true }],
  });

  wsOrders.columns = [
    { header: "#", key: "index", width: 6 },
    { header: "N° Pedido", key: "order_number", width: 16 },
    { header: isVenezuelaActive ? "Fecha / Hora (Caracas)" : "Fecha / Hora", key: "date", width: 22 },
    { header: "Cliente", key: "customer_name", width: 26 },
    { header: "Teléfono", key: "customer_phone", width: 16 },
    { header: "Modalidad", key: "delivery_type", width: 14 },
    { header: "Sucursal", key: "store_name", width: 22 },
    { header: "Método de Pago", key: "payment_method", width: 18 },
    { header: "Referencia / Banco", key: "reference", width: 20 },
    { header: "Estado", key: "status", width: 18 },
    { header: "Cant. Ítems", key: "items_count", width: 12 },
    { header: "Subtotal ($)", key: "subtotal_usd", width: 14 },
    { header: "Descuento ($)", key: "discount_usd", width: 14 },
    { header: "Delivery ($)", key: "delivery_fee_usd", width: 14 },
    { header: "Total USD ($)", key: "total_usd", width: 15 },
    ...(isVenezuelaActive
      ? [
          { header: "Total VES (Bs)", key: "total_ves", width: 18 },
          { header: "Tasa BCV", key: "exchange_rate", width: 12 },
        ]
      : []),
  ];

  styleHeaderRow(wsOrders.getRow(1), 28);

  const STATUS_SPANISH: Record<string, string> = {
    CREATED: "Iniciado",
    PAYMENT_PENDING: "Por Verificar",
    PAYMENT_APPROVED: "Pago Aprobado",
    PREPARING: "En Preparación",
    READY: "Listo p/ Despacho",
    DELIVERING: "En Ruta",
    COMPLETED: "Entregado",
    CANCELLED: "Cancelado",
  };

  orders.forEach((o, i) => {
    const formattedCaracasDate = isVenezuelaActive ? formatCaracasDateTime(o.created_at) : new Date(o.created_at).toLocaleString();
    const itemsCount = o.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
    const isCompleted = o.status === "COMPLETED";
    const isDelivering = o.status === "DELIVERING";
    const isCancelled = o.status === "CANCELLED";

    const discountUsd = o.discount_usd || 0;
    const deliveryFeeUsd = o.delivery_fee_usd || 0;
    const subtotalUsd = Math.max(0, o.total_usd + discountUsd - deliveryFeeUsd);

    const row = wsOrders.addRow({
      index: i + 1,
      order_number: o.order_number,
      date: formattedCaracasDate,
      customer_name: o.customer_name || "Cliente General",
      customer_phone: o.customer_phone || "N/A",
      delivery_type: o.delivery_type === "DELIVERY" ? "Delivery" : "Retiro Tienda",
      store_name: o.store_name || "Principal",
      payment_method: o.payment_method || "N/A",
      reference: o.payment_reference || "N/A",
      status: STATUS_SPANISH[o.status] || o.status,
      items_count: itemsCount,
      subtotal_usd: subtotalUsd,
      discount_usd: discountUsd,
      delivery_fee_usd: deliveryFeeUsd,
      total_usd: o.total_usd,
      ...(isVenezuelaActive ? { total_ves: o.total_ves, exchange_rate: o.exchange_rate_applied } : {}),
    });

    row.height = 22;
    row.alignment = { vertical: "middle" };

    // Formatos numéricos
    row.getCell("index").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("order_number").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("date").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("customer_phone").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("delivery_type").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("payment_method").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("status").alignment = { vertical: "middle", horizontal: "center" };
    row.getCell("items_count").alignment = { vertical: "middle", horizontal: "center" };

    row.getCell("subtotal_usd").numFmt = '"$"#,##0.00';
    row.getCell("discount_usd").numFmt = '"$"#,##0.00';
    row.getCell("delivery_fee_usd").numFmt = '"$"#,##0.00';
    row.getCell("total_usd").numFmt = '"$"#,##0.00';
    row.getCell("total_usd").font = { bold: true };

    if (isVenezuelaActive) {
      row.getCell("total_ves").numFmt = '"Bs. "#,##0.00';
      row.getCell("exchange_rate").numFmt = "#,##0.00";
      row.getCell("total_ves").font = { bold: true };
    }

    // Color condicional por estado
    const statusCell = row.getCell("status");
    if (isCompleted) {
      statusCell.font = { bold: true, color: { argb: "FF15803D" } };
    } else if (isDelivering) {
      statusCell.font = { bold: true, color: { argb: "FFEA580C" } };
    } else if (isCancelled) {
      statusCell.font = { bold: true, color: { argb: "FFDC2626" } };
    } else {
      statusCell.font = { bold: false, color: { argb: "FF475569" } };
    }

    row.eachCell((cell) => {
      cell.border = thinBorder;
    });

    if (i % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }
  });

  // Fila de TOTALES al final
  if (orders.length > 0) {
    const totalDiscount = orders.reduce((acc, o) => acc + (o.discount_usd || 0), 0);
    const totalDeliveryFee = orders.reduce((acc, o) => acc + (o.delivery_fee_usd || 0), 0);
    const totalUsdSum = orders.reduce((acc, o) => acc + o.total_usd, 0);
    const totalSubtotal = Math.max(0, totalUsdSum + totalDiscount - totalDeliveryFee);

    const totalRow = wsOrders.addRow({
      index: "",
      order_number: "TOTALES",
      date: "",
      customer_name: "",
      customer_phone: "",
      delivery_type: "",
      store_name: "",
      payment_method: "",
      reference: "",
      status: `${orders.length} pedidos`,
      items_count: orders.reduce((acc, o) => acc + (o.items?.reduce((s, it) => s + it.quantity, 0) || 0), 0),
      subtotal_usd: totalSubtotal,
      discount_usd: totalDiscount,
      delivery_fee_usd: totalDeliveryFee,
      total_usd: totalUsdSum,
      total_ves: orders.reduce((acc, o) => acc + o.total_ves, 0),
      exchange_rate: "",
    });

    totalRow.height = 24;
    totalRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
    totalRow.getCell("subtotal_usd").numFmt = '"$"#,##0.00';
    totalRow.getCell("discount_usd").numFmt = '"$"#,##0.00';
    totalRow.getCell("delivery_fee_usd").numFmt = '"$"#,##0.00';
    totalRow.getCell("total_usd").numFmt = '"$"#,##0.00';
    totalRow.getCell("total_ves").numFmt = '"Bs. "#,##0.00';

    totalRow.eachCell((cell) => {
      cell.border = totalDoubleBorder;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
    });
  }

  // ==========================================
  // PESTAÑA 3: DESGLOSE DIARIO (SI APLICA)
  // ==========================================
  if (analytics?.dailySales && analytics.dailySales.length > 0) {
    const wsDaily = workbook.addWorksheet("Ventas por Día", {
      views: [{ showGridLines: true }],
    });

    wsDaily.columns = [
      { header: "#", key: "index", width: 6 },
      { header: isVenezuelaActive ? "Fecha (Caracas)" : "Fecha", key: "date", width: 18 },
      { header: "Pedidos", key: "count", width: 14 },
      { header: "Total Ventas USD ($)", key: "total_usd", width: 22 },
      ...(isVenezuelaActive ? [{ header: "Total Ventas VES (Bs)", key: "total_ves", width: 24 }] : []),
      { header: "Ticket Promedio USD", key: "avg_ticket", width: 20 },
    ];

    styleHeaderRow(wsDaily.getRow(1), 26);

    analytics.dailySales.forEach((day, i) => {
      const avg = day.orderCount > 0 ? day.totalUsd / day.orderCount : 0;
      const ves = day.totalUsd * rateValue;
      const r = wsDaily.addRow({
        index: i + 1,
        date: day.date,
        count: day.orderCount,
        total_usd: day.totalUsd,
        ...(isVenezuelaActive ? { total_ves: ves } : {}),
        avg_ticket: avg,
      });

      r.height = 20;
      r.getCell("index").alignment = { vertical: "middle", horizontal: "center" };
      r.getCell("date").alignment = { vertical: "middle", horizontal: "center" };
      r.getCell("count").alignment = { vertical: "middle", horizontal: "center" };
      r.getCell("total_usd").numFmt = '"$"#,##0.00';
      if (isVenezuelaActive) {
        r.getCell("total_ves").numFmt = '"Bs. "#,##0.00';
      }
      r.getCell("avg_ticket").numFmt = '"$"#,##0.00';

      r.eachCell((c) => {
        c.border = thinBorder;
        if (i % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    });
  }

  // 4. Descarga Automática en el Navegador
  const dateStr = getCaracasDateKey(new Date()) || new Date().toISOString().split("T")[0];
  const safeSlug = settings.business_name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const fileName = `Reporte_Ventas_${safeSlug}_${dateRange}_${dateStr}.xlsx`;

  await downloadWorkbook(workbook, fileName);
}
