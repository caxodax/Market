"use client";

import React, { useState, useMemo } from "react";
import type {
  FiscalDocument,
  FiscalDocumentType,
  TenantSettings,
  CreateFiscalDocumentInput,
  Order,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { PrintableDocumentModal } from "./printable-document-modal";
import { IssueDocumentModal } from "./issue-document-modal";
import { SalesBookModal } from "./sales-book-modal";
import { resolveFiscalAdapter } from "../adapters/fiscal-adapter";
import { recordCustomerPayment } from "../services/invoicing-service";
import {
  Receipt,
  FileText,
  RotateCcw,
  Truck,
  Plus,
  Search,
  Printer,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileSpreadsheet,
  CreditCard,
  DollarSign,
  Clock,
  X,
} from "lucide-react";

export interface InvoicingManagerAdminProps {
  tenantId: string;
  settings: TenantSettings;
  activeModuleIds?: string[];
  initialDocuments?: FiscalDocument[];
  onIssueDocument: (input: CreateFiscalDocumentInput) => Promise<{ success: boolean; error?: string; document?: FiscalDocument }>;
  availableDrivers?: Array<{ id: string; name: string; phone: string; vehicle_plate?: string }>;
  orders?: Order[];
}

export function InvoicingManagerAdmin({
  tenantId,
  settings,
  activeModuleIds = [],
  initialDocuments = [],
  onIssueDocument,
  availableDrivers = [],
  orders = [],
}: InvoicingManagerAdminProps) {
  const adapter = resolveFiscalAdapter(undefined, activeModuleIds);

  const [documents, setDocuments] = useState<FiscalDocument[]>(initialDocuments);
  const [mainTab, setMainTab] = useState<"DOCUMENTS" | "CXC">("DOCUMENTS");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [cxcStatusFilter, setCxcStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [viewingDoc, setViewingDoc] = useState<FiscalDocument | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueModalType, setIssueModalType] = useState<FiscalDocumentType>("INVOICE");
  const [issueModalInitialOrder, setIssueModalInitialOrder] = useState<Order | null>(null);
  const [isSalesBookModalOpen, setIsSalesBookModalOpen] = useState(false);

  // CxC Payment Modal state
  const [paymentDoc, setPaymentDoc] = useState<FiscalDocument | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("TRANSFERENCIA");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Sync documents when initialDocuments updates
  React.useEffect(() => {
    if (initialDocuments && initialDocuments.length > 0) {
      setDocuments(initialDocuments);
    }
  }, [initialDocuments]);

  // Metrics calculation
  const stats = useMemo(() => {
    const totalInvoiced = documents
      .filter((d) => d.document_type === "INVOICE" && d.status === "ISSUED")
      .reduce((acc, d) => acc + d.total_amount, 0);

    const creditNotesAmount = documents
      .filter((d) => d.document_type === "CREDIT_NOTE" && d.status === "ISSUED")
      .reduce((acc, d) => acc + d.total_amount, 0);

    const dispatchGuidesCount = documents.filter((d) => d.document_type === "DISPATCH_GUIDE").length;

    return {
      totalInvoiced,
      creditNotesAmount,
      dispatchGuidesCount,
      totalDocumentsCount: documents.length,
    };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Type filter
      if (selectedTypeFilter !== "ALL" && doc.document_type !== selectedTypeFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = doc.customer_name.toLowerCase().includes(q);
        const matchesDocId = doc.customer_id_doc.toLowerCase().includes(q);
        const matchesNumber = doc.document_number.toLowerCase().includes(q);
        const matchesControl = doc.control_number?.toLowerCase().includes(q);
        const matchesAffected = doc.affected_document_number?.toLowerCase().includes(q);

        return matchesClient || matchesDocId || matchesNumber || matchesControl || matchesAffected;
      }

      return true;
    });
  }, [documents, selectedTypeFilter, searchQuery]);

  // CxC Metrics
  const cxcStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const creditInvoices = documents.filter(
      (d) => d.document_type === "INVOICE" && d.payment_condition === "CREDIT"
    );

    const totalReceivable = creditInvoices.reduce(
      (sum, d) => sum + (d.amount_due ?? (d.payment_status === "PAID" ? 0 : d.total_amount)),
      0
    );
    const totalCollected = creditInvoices.reduce(
      (sum, d) => sum + (d.amount_paid ?? 0),
      0
    );
    const totalOverdue = creditInvoices
      .filter((d) => {
        const isPast = d.due_date && d.due_date < today;
        const hasBalance = (d.amount_due ?? d.total_amount) > 0.005;
        return (d.payment_status === "OVERDUE" || isPast) && hasBalance;
      })
      .reduce((sum, d) => sum + (d.amount_due ?? d.total_amount), 0);

    return {
      creditInvoicesCount: creditInvoices.length,
      totalReceivable,
      totalCollected,
      totalOverdue,
    };
  }, [documents]);

  // Filtered CxC Invoices
  const filteredCxCInvoices = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return documents.filter((d) => {
      if (d.document_type !== "INVOICE" || d.payment_condition !== "CREDIT") return false;
      const isPast = d.due_date && d.due_date < today;
      const computedStatus = (d.amount_due ?? d.total_amount) <= 0.005
        ? "PAID"
        : isPast || d.payment_status === "OVERDUE"
        ? "OVERDUE"
        : (d.amount_paid && d.amount_paid > 0)
        ? "PARTIALLY_PAID"
        : "PENDING";

      if (cxcStatusFilter !== "ALL" && computedStatus !== cxcStatusFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.customer_name.toLowerCase().includes(q) ||
        d.customer_id_doc.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        (d.control_number && d.control_number.toLowerCase().includes(q))
      );
    });
  }, [documents, cxcStatusFilter, searchQuery]);

  const handleOpenPaymentModal = (doc: FiscalDocument) => {
    setPaymentDoc(doc);
    setPaymentAmount(String(doc.amount_due ?? doc.total_amount));
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("TRANSFERENCIA");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError(null);
  };

  const handleRegisterPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDoc) return;
    setPaymentError(null);
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    try {
      const updated = recordCustomerPayment(paymentDoc, {
        amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
      });

      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setPaymentDoc(null);
    } catch (err: any) {
      setPaymentError(err?.message || "Error al registrar el cobro.");
    }
  };

  const handleDocumentCreated = async (input: CreateFiscalDocumentInput) => {
    const res = await onIssueDocument(input);
    if (res.success && res.document) {
      setDocuments((prev) => [res.document!, ...prev]);
      // Open the printable view immediately
      setViewingDoc(res.document);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const getBadgeForType = (type: FiscalDocumentType) => {
    switch (type) {
      case "INVOICE":
        return { label: "Factura", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
      case "CREDIT_NOTE":
        return { label: "Nota Crédito", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
      case "DEBIT_NOTE":
        return { label: "Nota Débito", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "DISPATCH_GUIDE":
        return { label: "Guía Despacho", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "DELIVERY_NOTE":
        return { label: "Orden Entrega", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
      default:
        return { label: "Doc", color: "bg-muted text-muted-foreground border-border" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Issue Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-foreground">Facturación, Notas & Guías de Despacho</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Régimen {adapter.countryName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestión de comprobantes mercantiles, anulaciones con reposición de inventario y guías de transporte en ruta.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setIssueModalType("INVOICE");
              setIssueModalInitialOrder(null);
              setIsIssueModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Emitir Factura</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIssueModalType("DISPATCH_GUIDE");
              setIssueModalInitialOrder(null);
              setIsIssueModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Guía Despacho</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIssueModalType("CREDIT_NOTE");
              setIssueModalInitialOrder(null);
              setIsIssueModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Nota de Crédito</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSalesBookModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Libro de Ventas</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs: Documentos Fiscales vs Cuentas por Cobrar (CxC) */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setMainTab("DOCUMENTS")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            mainTab === "DOCUMENTS"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Comprobantes Mercantiles</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-inherit font-mono">
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab("CXC")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            mainTab === "CXC"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cuentas por Cobrar (CxC)</span>
          {cxcStats.creditInvoicesCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-inherit font-mono">
              {cxcStats.creditInvoicesCount}
            </span>
          )}
        </button>
      </div>

      {mainTab === "DOCUMENTS" ? (
        <>
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                <span>Total Facturado</span>
              </p>
              <p className="text-xl font-black font-mono text-foreground">
                {formatCurrency(stats.totalInvoiced, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Ventas legales emitidas</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span>Notas de Crédito</span>
              </p>
              <p className="text-xl font-black font-mono text-rose-500">
                -{formatCurrency(stats.creditNotesAmount, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Devoluciones con reposición</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-500" />
                <span>Guías de Despacho</span>
              </p>
              <p className="text-xl font-black font-mono text-foreground">{stats.dispatchGuidesCount}</p>
              <p className="text-[10px] text-muted-foreground">Mercancía amparada en tránsito</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Comprobantes Totales</span>
              </p>
              <p className="text-xl font-black font-mono text-foreground">{stats.totalDocumentsCount}</p>
              <p className="text-[10px] text-muted-foreground">Historial consolidado</p>
            </div>
          </div>

          {/* Filter Tabs and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "Todos" },
                { id: "INVOICE", label: "Facturas" },
                { id: "CREDIT_NOTE", label: "Notas de Crédito" },
                { id: "DEBIT_NOTE", label: "Notas de Débito" },
                { id: "DISPATCH_GUIDE", label: "Guías Despacho" },
                { id: "DELIVERY_NOTE", label: "Órdenes Entrega" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedTypeFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por cliente, RIF/RUT, Nº o control..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Documents Table View */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Nº Documento</th>
                    <th className="p-3">Nº Control</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cliente / Receptor</th>
                    <th className="p-3">Afecta Factura</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground space-y-2">
                        <FileText className="w-8 h-8 mx-auto opacity-30" />
                        <p className="font-semibold text-xs">No se encontraron documentos fiscales emitidos</p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Emite una Factura o Guía de Despacho con los botones superiores.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => {
                      const b = getBadgeForType(doc.document_type);
                      return (
                        <tr key={doc.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3">
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${b.color}`}>
                              {b.label}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground">{doc.document_number}</td>
                          <td className="p-3 font-mono text-muted-foreground">{doc.control_number || "—"}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(doc.created_at).toLocaleDateString("es-ES")}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-foreground truncate max-w-[160px]">{doc.customer_name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">{doc.customer_id_doc}</p>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {doc.affected_document_number ? (
                              <span className="text-amber-600 font-bold">{doc.affected_document_number}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(doc.total_amount, "USD")}
                            {doc.total_ves && doc.total_ves > 0 && (
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                Bs. {doc.total_ves.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingDoc(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                                title="Ver e Imprimir Documento"
                              >
                                <Printer className="w-3 h-3 text-primary" />
                                <span>Imprimir</span>
                              </button>

                              {doc.document_type === "INVOICE" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIssueModalType("CREDIT_NOTE");
                                    setSelectedTypeFilter("ALL");
                                    setIsIssueModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-rose-600 transition-colors cursor-pointer"
                                  title="Emitir Nota de Crédito para esta factura"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* CxC Section */
        <>
          {/* CxC Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Total por Cobrar (Saldo)</span>
              </p>
              <p className="text-xl font-black font-mono text-amber-500">
                {formatCurrency(cxcStats.totalReceivable, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Créditos pendientes de cobro</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Total Cobrado</span>
              </p>
              <p className="text-xl font-black font-mono text-emerald-500">
                {formatCurrency(cxcStats.totalCollected, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Abonos recibidos en créditos</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Saldo Vencido</span>
              </p>
              <p className="text-xl font-black font-mono text-rose-500">
                {formatCurrency(cxcStats.totalOverdue, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Créditos con plazo expirado</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Facturas a Crédito</span>
              </p>
              <p className="text-xl font-black font-mono text-foreground">
                {cxcStats.creditInvoicesCount}
              </p>
              <p className="text-[10px] text-muted-foreground">Emitidas a plazo</p>
            </div>
          </div>

          {/* Filter Pills and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "Todas" },
                { id: "PENDING", label: "Pendientes" },
                { id: "PARTIALLY_PAID", label: "Abonadas" },
                { id: "OVERDUE", label: "Vencidas" },
                { id: "PAID", label: "Cobradas" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCxcStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    cxcStatusFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar cliente, RIF o factura..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* CxC Table View */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3">Factura Nº</th>
                    <th className="p-3">Cliente / Receptor</th>
                    <th className="p-3">Emisión</th>
                    <th className="p-3">Vencimiento</th>
                    <th className="p-3 text-right">Total Factura</th>
                    <th className="p-3 text-right">Cobrado</th>
                    <th className="p-3 text-right">Saldo Deudor</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCxCInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground space-y-2">
                        <CreditCard className="w-8 h-8 mx-auto opacity-30" />
                        <p className="font-semibold text-xs">No hay facturas a crédito registradas</p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Al emitir una factura, selecciona la opción "Crédito (CxC)" para gestionar su cobro.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCxCInvoices.map((doc) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isPast = doc.due_date && doc.due_date < today;
                      const balance = doc.amount_due ?? (doc.payment_status === "PAID" ? 0 : doc.total_amount);
                      const isPaid = balance <= 0.005;
                      const isOverdue = !isPaid && (doc.payment_status === "OVERDUE" || isPast);

                      return (
                        <tr key={doc.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3">
                            <p className="font-mono font-bold text-foreground">{doc.document_number}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{doc.control_number || "—"}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-foreground">{doc.customer_name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{doc.customer_id_doc}</p>
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString("es-ES") : "—"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <p className={`font-mono font-semibold ${isOverdue ? "text-rose-500" : "text-foreground"}`}>
                              {doc.due_date || "—"}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {doc.credit_term_days ? `${doc.credit_term_days} días` : "Plazo"}
                              {isOverdue && " • Vencida"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(doc.total_amount, "USD")}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                            {formatCurrency(doc.amount_paid ?? 0, "USD")}
                          </td>
                          <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                            <span className={balance > 0 ? (isOverdue ? "text-rose-600" : "text-amber-600") : "text-emerald-600"}>
                              {formatCurrency(balance, "USD")}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {isPaid ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                Cobrado
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-600 border-rose-500/20">
                                Vencida
                              </span>
                            ) : (doc.amount_paid && doc.amount_paid > 0) ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                Abono Parcial
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 border-blue-500/20">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {balance > 0.005 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                                  title="Registrar Abono o Cobro"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>Abonar</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setViewingDoc(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                                title="Ver e Imprimir Factura"
                              >
                                <Printer className="w-3 h-3 text-primary" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payment / Abono Modal for CxC */}
      {paymentDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Registrar Cobro / Abono</h3>
                  <p className="text-[11px] text-muted-foreground">Factura {paymentDoc.document_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentDoc(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPaymentSubmit} className="p-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]">{paymentDoc.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Factura:</span>
                  <span className="font-mono font-semibold">{formatCurrency(paymentDoc.total_amount, "USD")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cobrado Previo:</span>
                  <span className="font-mono text-emerald-600 font-semibold">{formatCurrency(paymentDoc.amount_paid ?? 0, "USD")}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1 font-bold">
                  <span className="text-foreground">Saldo Pendiente:</span>
                  <span className="font-mono text-amber-600">
                    {formatCurrency(paymentDoc.amount_due ?? paymentDoc.total_amount, "USD")}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Monto a Abonar ($) *</label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(paymentDoc.amount_due ?? paymentDoc.total_amount))}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Saldo Total
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentDoc.amount_due ?? paymentDoc.total_amount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background font-mono text-xs font-bold text-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Método</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  >
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="PAGO_MOVIL">Pago Móvil</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="ZELLE">Zelle</option>
                    <option value="DEBITO">Punto / Débito</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Referencia / Comprobante</label>
                <input
                  type="text"
                  placeholder="Ej: 12345678"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-mono text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notas / Observación</label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial acordado"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setPaymentDoc(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Document Modal */}
      <PrintableDocumentModal
        document={viewingDoc}
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
      />

      {/* Issue Document Modal */}
      <IssueDocumentModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        onDocumentCreated={handleDocumentCreated}
        settings={settings}
        activeModuleIds={activeModuleIds}
        initialType={issueModalType}
        initialOrder={issueModalInitialOrder}
        existingInvoices={documents.filter((d) => d.document_type === "INVOICE")}
        availableDrivers={availableDrivers}
      />

      {/* Official Sales Book Modal */}
      <SalesBookModal
        isOpen={isSalesBookModalOpen}
        onClose={() => setIsSalesBookModalOpen(false)}
        documents={documents}
        settings={settings}
        tenantId={tenantId}
      />
    </div>
  );
}
