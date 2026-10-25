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
import { resolveFiscalAdapter } from "../adapters/fiscal-adapter";
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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [viewingDoc, setViewingDoc] = useState<FiscalDocument | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueModalType, setIssueModalType] = useState<FiscalDocumentType>("INVOICE");
  const [issueModalInitialOrder, setIssueModalInitialOrder] = useState<Order | null>(null);

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
        </div>
      </div>

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
    </div>
  );
}
