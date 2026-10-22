"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  PaymentMethodType,
  PaymentAccountSettings,
  StoreOperationalSettings,
  TenantBillingSettings,
  FiscalBillingMode,
  FiscalTaxPayerType,
  FiscalProvider,
  TenantModuleId,
} from "@marketos/types";
import { updateTenantSettingsAction, uploadStoreLogoAction } from "../app/admin/actions";
import { compressImage } from "@marketos/utils";
import { VENEZUELAN_BANK_NAMES, SeniatFiscalSettings } from "@marketos/plugin-local-venezuela";
import {
  Store,
  CreditCard,
  Palette,
  Settings2,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  Trash2,
  Eye,
  Check,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  DollarSign,
  Truck,
  MessageCircle,
  HelpCircle,
  Landmark,
  Smartphone,
  Banknote,
  QrCode,
  Globe,
  Copy,
  ExternalLink,
  Link2,
  Receipt,
  Scale,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface StoreSettingsTabProps {
  settings: TenantSettings;
  onUpdateSuccess?: (updated: TenantSettings) => void;
  activeModuleIds?: TenantModuleId[];
  isSuperAdmin?: boolean;
}

const AVAILABLE_PAYMENT_METHODS: {
  id: PaymentMethodType;
  label: string;
  description: string;
  icon: any;
}[] = [
  {
    id: "PAGO_MOVIL",
    label: "Pago Móvil (Bs.)",
    description: "Recepción inmediata por banca móvil en Bolívares",
    icon: Smartphone,
  },
  {
    id: "BANK_TRANSFER",
    label: "Transferencia Bancaria (Bs.)",
    description: "Depósitos y transferencias a cuenta corriente/ahorro",
    icon: Landmark,
  },
  {
    id: "ZELLE",
    label: "Zelle (USD)",
    description: "Pagos directos en divisas electrónicas",
    icon: CreditCard,
  },
  {
    id: "CASH_USD",
    label: "Efectivo en Dólares (USD)",
    description: "Pago físico en efectivo al retirar o en delivery",
    icon: Banknote,
  },
  {
    id: "CASH_VES",
    label: "Efectivo en Bolívares (Bs.)",
    description: "Pago físico en billetes en moneda nacional",
    icon: Banknote,
  },
  {
    id: "POS",
    label: "Punto de Venta (Tarjeta en Tienda)",
    description: "Cobro con tarjeta de débito en caja física",
    icon: CreditCard,
  },
];

const PRESET_COLORS = [
  { name: "Rojo Carmesí", hex: "#DC2626" },
  { name: "Azul Real", hex: "#2563EB" },
  { name: "Verde Esmeralda", hex: "#059669" },
  { name: "Violeta Tech", hex: "#7C3AED" },
  { name: "Ámbar / Naranja", hex: "#EA580C" },
  { name: "Negro Elegante", hex: "#18181B" },
  { name: "Cian / Turquesa", hex: "#0891B2" },
  { name: "Rosa Vibrante", hex: "#DB2777" },
];

const PRESET_FONTS = [
  { id: "Inter", name: "Inter", description: "Moderna, limpia y altamente legible" },
  { id: "Poppins", name: "Poppins", description: "Geométrica, comercial y llamativa" },
  { id: "Montserrat", name: "Montserrat", description: "Elegante, premium y contundente" },
  { id: "Plus Jakarta Sans", name: "Plus Jakarta Sans", description: "Fresca, tecnológica y actual" },
  { id: "Roboto", name: "Roboto", description: "Clásica, balanceada y confiable" },
  { id: "Outfit", name: "Outfit", description: "Minimalista, estilizada y moderna" },
];

export function StoreSettingsTab({
  settings,
  onUpdateSuccess,
  activeModuleIds = [],
  isSuperAdmin = false,
}: StoreSettingsTabProps) {
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  const [activeSubTab, setActiveSubTab] = useState<"GENERAL" | "DOMAINS" | "PAYMENTS" | "BRANDING" | "OPERATIONS" | "FISCAL">("GENERAL");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State: General & Custom Domain
  const [customDomain, setCustomDomain] = useState(settings.custom_domain || "");
  const [copiedDnsKey, setCopiedDnsKey] = useState<string | null>(null);

  const copyDnsValue = (val: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(val);
      setCopiedDnsKey(key);
      setTimeout(() => setCopiedDnsKey(null), 2500);
    }
  };
  const [businessName, setBusinessName] = useState(settings.business_name || "");
  const [category, setCategory] = useState(settings.category || "Minimarket");
  const [address, setAddress] = useState(settings.address || "");
  const [phone, setPhone] = useState(settings.phone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsapp_number || "");
  const [email, setEmail] = useState(settings.email || "");
  const [instagram, setInstagram] = useState(settings.social_links?.instagram || "");
  const [facebook, setFacebook] = useState(settings.social_links?.facebook || "");
  const [tiktok, setTiktok] = useState(settings.social_links?.tiktok || "");

  // Form State: Payments
  const defaultPaymentSettings: PaymentAccountSettings = settings.payment_settings || {
    enabled_methods: ["ZELLE", "CASH_USD"],
    pago_movil: {
      bank: "",
      phone: "",
      id_doc: "",
      name: settings.business_name || "",
    },
    bank_transfer: {
      bank: "",
      account_number: "",
      account_type: "Corriente",
      id_doc: "",
      name: settings.business_name || "",
    },
    zelle: {
      email: "",
      name: settings.business_name || "",
    },
    cash_usd: {
      instructions: "Pago en efectivo al retirar en tienda o contra entrega.",
    },
    cash_ves: {
      instructions: "Efectivo en moneda nacional en caja según tasa oficial.",
    },
    pos: {
      instructions: "Punto de venta disponible en caja para tarjetas.",
    },
  };

  const [enabledMethods, setEnabledMethods] = useState<PaymentMethodType[]>(
    defaultPaymentSettings.enabled_methods || ["CASH_USD"]
  );

  // Pago Móvil fields
  const [pmBank, setPmBank] = useState(defaultPaymentSettings.pago_movil?.bank || "");
  const [pmPhone, setPmPhone] = useState(defaultPaymentSettings.pago_movil?.phone || "");
  const [pmIdDoc, setPmIdDoc] = useState(defaultPaymentSettings.pago_movil?.id_doc || "");
  const [pmName, setPmName] = useState(defaultPaymentSettings.pago_movil?.name || settings.business_name || "");

  // Bank Transfer fields
  const [btBank, setBtBank] = useState(defaultPaymentSettings.bank_transfer?.bank || "");
  const [btAccountNumber, setBtAccountNumber] = useState(defaultPaymentSettings.bank_transfer?.account_number || "");
  const [btAccountType, setBtAccountType] = useState(defaultPaymentSettings.bank_transfer?.account_type || "Corriente");
  const [btIdDoc, setBtIdDoc] = useState(defaultPaymentSettings.bank_transfer?.id_doc || "");
  const [btName, setBtName] = useState(defaultPaymentSettings.bank_transfer?.name || settings.business_name || "");

  // Zelle fields
  const [zelleEmail, setZelleEmail] = useState(defaultPaymentSettings.zelle?.email || "");
  const [zelleName, setZelleName] = useState(defaultPaymentSettings.zelle?.name || settings.business_name || "");

  // Cash / POS fields
  const [cashUsdInstructions, setCashUsdInstructions] = useState(
    defaultPaymentSettings.cash_usd?.instructions ||
      "Billetes en buen estado sin roturas ni marcas. Pago al retirar en caja o contra entrega."
  );
  const [cashVesInstructions, setCashVesInstructions] = useState(
    defaultPaymentSettings.cash_ves?.instructions || "Efectivo en Bolívares en caja según tasa oficial."
  );

  // Form State: Branding & Logo
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || "#DC2626");
  const [secondaryColor, setSecondaryColor] = useState(settings.secondary_color || "#09090B");
  const [fontFamily, setFontFamily] = useState(settings.font_family || "Inter");
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logo_url || null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);

  // Form State: Operations
  const defaultOps: StoreOperationalSettings = settings.operational_settings || {
    is_open: true,
    closed_message: "Actualmente nos encontramos fuera de horario de atención comercial. Tomaremos tu pedido a primera hora.",
    schedule: "Lunes a Sábado: 8:00 AM - 9:00 PM | Domingos: 9:00 AM - 6:00 PM",
    min_order_usd: 0,
    announcement_banner: "¡Bienvenidos a nuestra tienda digital! Envíos rápidos y seguros 🛵",
    estimated_delivery_time: "30 a 60 minutos",
    custom_whatsapp_message: "Hola, acabo de realizar este pedido en la tienda web:",
    show_ticket_qr: true,
  };

  const [isOpen, setIsOpen] = useState(defaultOps.is_open ?? true);
  const [closedMessage, setClosedMessage] = useState(defaultOps.closed_message || "");
  const [schedule, setSchedule] = useState(defaultOps.schedule || "");
  const [minOrderUsd, setMinOrderUsd] = useState(defaultOps.min_order_usd || 0);
  const [announcementBanner, setAnnouncementBanner] = useState(defaultOps.announcement_banner || "");
  const [showAnnouncementBanner, setShowAnnouncementBanner] = useState(
    defaultOps.show_announcement_banner ?? Boolean(defaultOps.announcement_banner?.trim())
  );
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(defaultOps.estimated_delivery_time || "30 a 60 minutos");
  const [customWhatsappMessage, setCustomWhatsappMessage] = useState(defaultOps.custom_whatsapp_message || "");
  const [showTicketQr, setShowTicketQr] = useState(defaultOps.show_ticket_qr ?? true);

  // Form State: SENIAT Fiscal Compliance & Facturación Digital (Providencia 00071)
  const defaultBilling: TenantBillingSettings = settings.billing_settings || {
    fiscal_billing_enabled: false,
    billing_mode: "TICKET_ONLY",
    tax_payer_type: "ORDINARY",
    apply_igtf: false,
    default_iva_rate: 16.0,
    fiscal_provider: "THE_FACTORY_HKA",
    emitter_fiscal_data: {
      rif: "",
      business_name: settings.business_name || "",
      fiscal_address: settings.address || "",
      phone: settings.phone || "",
    },
    provider_credentials: {
      api_key: "",
      token: "",
      environment: "SANDBOX",
    },
  };

  const [fiscalBillingEnabled, setFiscalBillingEnabled] = useState(defaultBilling.fiscal_billing_enabled ?? false);
  const [billingMode, setBillingMode] = useState<FiscalBillingMode>(defaultBilling.billing_mode || "TICKET_ONLY");
  const [taxPayerType, setTaxPayerType] = useState<FiscalTaxPayerType>(defaultBilling.tax_payer_type || "ORDINARY");
  const [applyIgtf, setApplyIgtf] = useState(defaultBilling.apply_igtf ?? false);
  const [defaultIvaRate, setDefaultIvaRate] = useState(defaultBilling.default_iva_rate ?? 16.0);
  const [fiscalProvider, setFiscalProvider] = useState<FiscalProvider>(defaultBilling.fiscal_provider || "THE_FACTORY_HKA");
  const [emitterRif, setEmitterRif] = useState(defaultBilling.emitter_fiscal_data?.rif || "");
  const [emitterBusinessName, setEmitterBusinessName] = useState(defaultBilling.emitter_fiscal_data?.business_name || settings.business_name || "");
  const [emitterFiscalAddress, setEmitterFiscalAddress] = useState(defaultBilling.emitter_fiscal_data?.fiscal_address || settings.address || "");
  const [emitterPhone, setEmitterPhone] = useState(defaultBilling.emitter_fiscal_data?.phone || settings.phone || "");
  const [providerApiKey, setProviderApiKey] = useState(defaultBilling.provider_credentials?.api_key || "");
  const [providerToken, setProviderToken] = useState(defaultBilling.provider_credentials?.token || "");
  const [providerEnv, setProviderEnv] = useState<"SANDBOX" | "PRODUCTION">(defaultBilling.provider_credentials?.environment || "SANDBOX");
  const [fiscalMachineSerial, setFiscalMachineSerial] = useState(defaultBilling.fiscal_machine_serial || "");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(defaultBilling.next_invoice_number || 1);
  const [nextControlNumber, setNextControlNumber] = useState(defaultBilling.next_control_number || 1);
  const [controlPrefix, setControlPrefix] = useState(defaultBilling.control_prefix || "00-");
  const [nonFiscalWarningLegend, setNonFiscalWarningLegend] = useState(defaultBilling.non_fiscal_warning_legend || "DOCUMENTO NO FISCAL - EXIJA SU FACTURA FISCAL EN CAJA");

  // Toggle payment method
  const togglePaymentMethod = (methodId: PaymentMethodType) => {
    setEnabledMethods((prev) => {
      if (prev.includes(methodId)) {
        if (prev.length === 1) {
          alert("Debe haber al menos un método de pago activo para que los clientes puedan pagar.");
          return prev;
        }
        return prev.filter((m) => m !== methodId);
      } else {
        return [...prev, methodId];
      }
    });
  };

  // Handle Logo Upload with client compression and permanent Cloudflare R2 storage
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingLogo(true);
    try {
      // 1. Compress to optimal web dimensions (max 512x512 WebP)
      const compressed = await compressImage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.9,
        targetFormat: "image/webp",
      });

      // 2. Upload to Cloudflare R2
      const formData = new FormData();
      formData.append("file", compressed.file);
      formData.append("tenantId", settings.tenant_id);

      const uploadRes = await uploadStoreLogoAction(formData);
      if (uploadRes.success && uploadRes.url) {
        setLogoUrl(uploadRes.url);
      } else {
        // Fallback to base64 preview if R2 upload fails
        console.warn("R2 upload fallback to data URL:", uploadRes.error);
        const reader = new FileReader();
        reader.onload = () => {
          setLogoUrl(reader.result as string);
        };
        reader.readAsDataURL(compressed.blob);
      }
    } catch (err) {
      console.error("Error processing logo image:", err);
      // Fallback direct read
      const reader = new FileReader();
      reader.onload = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingLogo(false);
    }
  };

  // Save Settings Action
  const handleSaveAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    const updatedPaymentSettings: PaymentAccountSettings = {
      enabled_methods: enabledMethods,
      pago_movil: {
        bank: pmBank,
        phone: pmPhone.trim(),
        id_doc: pmIdDoc.trim(),
        name: pmName.trim(),
      },
      bank_transfer: {
        bank: btBank,
        account_number: btAccountNumber.trim(),
        account_type: btAccountType,
        id_doc: btIdDoc.trim(),
        name: btName.trim(),
      },
      zelle: {
        email: zelleEmail.trim(),
        name: zelleName.trim(),
      },
      cash_usd: {
        instructions: cashUsdInstructions.trim(),
      },
      cash_ves: {
        instructions: cashVesInstructions.trim(),
      },
      pos: {
        instructions: "Punto de venta disponible en caja física.",
      },
    };

    const updatedOperationalSettings: StoreOperationalSettings = {
      is_open: isOpen,
      closed_message: closedMessage.trim(),
      schedule: schedule.trim(),
      min_order_usd: Number(minOrderUsd) || 0,
      announcement_banner: announcementBanner.trim(),
      show_announcement_banner: showAnnouncementBanner,
      estimated_delivery_time: estimatedDeliveryTime.trim(),
      custom_whatsapp_message: customWhatsappMessage.trim(),
      show_ticket_qr: showTicketQr,
    };

    const updatedBillingSettings: TenantBillingSettings = {
      fiscal_billing_enabled: fiscalBillingEnabled,
      billing_mode: billingMode,
      tax_payer_type: taxPayerType,
      apply_igtf: applyIgtf,
      default_iva_rate: Number(defaultIvaRate) || 16.0,
      fiscal_provider: fiscalProvider,
      emitter_fiscal_data: {
        rif: emitterRif.trim(),
        business_name: emitterBusinessName.trim(),
        fiscal_address: emitterFiscalAddress.trim(),
        phone: emitterPhone.trim(),
      },
      fiscal_machine_serial: fiscalMachineSerial.trim(),
      next_invoice_number: Number(nextInvoiceNumber) || 1,
      next_control_number: Number(nextControlNumber) || 1,
      control_prefix: controlPrefix.trim(),
      non_fiscal_warning_legend: nonFiscalWarningLegend.trim(),
      provider_credentials: {
        api_key: providerApiKey.trim(),
        token: providerToken.trim(),
        environment: providerEnv,
      },
    };

    const payload: Partial<TenantSettings> = {
      business_name: businessName.trim(),
      category: category.trim(),
      address: address.trim(),
      phone: phone.trim(),
      whatsapp_number: whatsappNumber.trim(),
      email: email.trim(),
      social_links: {
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        tiktok: tiktok.trim(),
      },
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_family: fontFamily,
      logo_url: logoUrl,
      custom_domain: customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null,
      payment_settings: updatedPaymentSettings,
      operational_settings: updatedOperationalSettings,
      billing_settings: updatedBillingSettings,
    };

    try {
      const res = await updateTenantSettingsAction(settings.tenant_id, payload);
      if (res.success && res.settings) {
        setStatusMessage({
          type: "success",
          text: "¡Configuración guardada exitosamente! Los cambios ya se reflejan en la tienda y checkout.",
        });
        if (onUpdateSuccess) {
          onUpdateSuccess(res.settings);
        }
      } else {
        throw new Error(res.error || "No se pudo actualizar la configuración.");
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: "error",
        text: err.message || "Error al guardar los ajustes.",
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in w-full max-w-full overflow-x-hidden">
      {/* Top Header & Save Button Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-foreground tracking-tight">
              Ajustes de Tienda & Personalización
            </h2>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              100% Autogestionable
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura tu dirección, cuentas receptoras, métodos de pago activos, colores y logo sin tocar código.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Guardando Cambios...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </>
          )}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border border-destructive/30 text-destructive"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${isVenezuelaActive ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-2 border-b border-border pb-3`}>
        <button
          type="button"
          onClick={() => setActiveSubTab("GENERAL")}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "GENERAL"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Dirección & Negocio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("DOMAINS")}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "DOMAINS"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Dominio Web</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("PAYMENTS")}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "PAYMENTS"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cuentas & Pagos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("BRANDING")}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "BRANDING"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Marca & Colores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("OPERATIONS")}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "OPERATIONS"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Operatividad</span>
        </button>

        {isVenezuelaActive && (
          <button
            type="button"
            onClick={() => setActiveSubTab("FISCAL")}
            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "FISCAL"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>SENIAT & Fiscal</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${
                fiscalBillingEnabled
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {fiscalBillingEnabled ? "ON" : "OFF"}
            </span>
          </button>
        )}
      </div>

      {/* SUBTAB 1: GENERAL & ADDRESS */}
      {activeSubTab === "GENERAL" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Store className="w-4 h-4 text-primary" />
              <span>Información Comercial Principal</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Nombre Comercial del Negocio *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Mi Comercio C.A."
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Categoría o Ramo Comercial
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej: Minimarket, Bodegón, Farmacia, Víveres"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1.5">
                Dirección Física de la Tienda (Visible para clientes en cabecera y retiro) *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto, Edo. Lara"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Teléfono de Atención Local
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+58 424-5919577"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  WhatsApp para Despachos y Pedidos (Formato: 584XXXXXXXXX) *
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 text-emerald-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="584245919577"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  A este número los clientes enviarán su confirmación de pedido por WhatsApp.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Correo Electrónico de Contacto
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@shopmarket.com"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Redes Sociales de la Marca</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Instagram (@usuario)
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@shopmarketca"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Facebook (Nombre o enlace)
                </label>
                <input
                  type="text"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="facebook.com/shopmarket"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  TikTok (@usuario)
                </label>
                <input
                  type="text"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@shopmarket"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: CUSTOM WEB DOMAIN & DNS SETUP */}
      {activeSubTab === "DOMAINS" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span>Dominio Web Propio (Tu Marca en Internet)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conecta tu propio dominio (ej. <strong>tiendasanpedro.com</strong> o <strong>pedidos.fruteria.com</strong>) para que tus clientes naveguen directamente en tu marca con certificado de seguridad SSL (HTTPS).
                </p>
              </div>

              {customDomain ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Dominio Asignado</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-bold shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Usando Dominio Plataforma</span>
                </div>
              )}
            </div>

            {!isSuperAdmin && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Infraestructura de Dominios Web (Gestionado por Super Admin)</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Por seguridad técnica y prevención de errores críticos en registros DNS o caídas de certificados SSL, la delegación de dominios propios es aprovisionada y auditada exclusivamente por el Administrador de Plataforma.
                  </p>
                </div>
              </div>
            )}

            {/* Input & Action */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-foreground block">
                Nombre de tu Dominio Web o Subdominio
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                    https://
                  </span>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
                    placeholder={
                      isSuperAdmin
                        ? "ej. tiendasanpedro.com o pedidos.fruteria.com"
                        : "Sin dominio propio (operando bajo subdominio de plataforma)"
                    }
                    className="w-full h-11 pl-20 pr-4 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-medium focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-muted-foreground disabled:opacity-70 disabled:bg-muted/40 disabled:cursor-not-allowed"
                  />
                </div>

                {isSuperAdmin && customDomain && (
                  <button
                    type="button"
                    onClick={() => setCustomDomain("")}
                    className="px-3 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    title="Desvincular dominio"
                  >
                    Limpiar
                  </button>
                )}

                {customDomain && (
                  <a
                    href={`https://${customDomain.replace(/^https?:\/\//, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <span>Probar Enlace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {!isSuperAdmin && (
                  <a
                    href={`https://wa.me/${(settings.whatsapp_number || settings.phone || "584120000000").replace(/\D/g, "")}?text=${encodeURIComponent(
                      customDomain
                        ? `Hola, soy el dueño de "${settings.business_name}". Quisiera solicitar una modificación en el dominio asignado: ${customDomain}.`
                        : `Hola, soy el dueño de "${settings.business_name}". Me gustaría conectar un dominio propio para mi tienda en MarketOS.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{customDomain ? "Solicitar Cambio" : "Solicitar Dominio"}</span>
                  </a>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isSuperAdmin
                  ? "Como Super Admin, puedes escribir el dominio exacto. No incluyas https:// ni diagonales al final."
                  : "Para conectar o cambiar tu dominio propio (.com, .net, .ve), solicita la vinculación al soporte técnico."}
              </p>
            </div>
          </div>

          {/* DNS Configuration Guide Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <span>Instrucciones de Conexión DNS (En tu proveedor de dominio)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ingresa al panel donde compraste tu dominio (GoDaddy, Namecheap, Nic.ve, DonDominio, Cloudflare, etc.) y agrega <strong>UNO</strong> de los siguientes registros en la sección de Gestión DNS:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Option A: Subdomain CNAME */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    Opción A • Recomendada
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">Para Subdominios</span>
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  Subdominio (ej: pedidos.tudominio.com)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground font-mono text-[11px]">Tipo de Registro:</span>
                    <strong className="font-mono text-foreground font-bold">CNAME</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground font-mono text-[11px]">Nombre / Host:</span>
                    <strong className="font-mono text-foreground font-bold">pedidos (o tu subdominio)</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border gap-2">
                    <span className="text-muted-foreground font-mono text-[11px]">Valor / Destino:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="font-mono text-primary font-bold text-[11px]">cname.vercel-dns.com</strong>
                      <button
                        type="button"
                        onClick={() => copyDnsValue("cname.vercel-dns.com", "cname")}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copiar valor CNAME"
                      >
                        {copiedDnsKey === "cname" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option B: Apex Domain A Record */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-md">
                    Opción B
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">Para Dominio Raíz</span>
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  Dominio Principal (ej: tudominio.com)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground font-mono text-[11px]">Tipo de Registro:</span>
                    <strong className="font-mono text-foreground font-bold">A</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground font-mono text-[11px]">Nombre / Host:</span>
                    <strong className="font-mono text-foreground font-bold">@ (o en blanco)</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border gap-2">
                    <span className="text-muted-foreground font-mono text-[11px]">Valor / Destino:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="font-mono text-primary font-bold text-[11px]">76.76.21.21</strong>
                      <button
                        type="button"
                        onClick={() => copyDnsValue("76.76.21.21", "a")}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copiar dirección IP"
                      >
                        {copiedDnsKey === "a" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification note */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-foreground font-bold block">
                  Propagación Automática y Certificados SSL Gratuitos:
                </strong>
                <p className="text-muted-foreground leading-relaxed">
                  Una vez guardados los registros en tu registrador DNS, la propagación suele tardar entre 5 y 30 minutos. Vercel emitirá y renovará automáticamente tu certificado de seguridad SSL HTTPS de forma gratuita.
                </p>
                {isSuperAdmin && (
                  <p className="text-[11px] text-primary font-medium pt-1 border-t border-primary/10">
                    💡 <strong>Paso de Aprovisionamiento Super Admin:</strong> Recuerda dar de alta también este dominio en tu panel de Vercel (<em>Project Settings &gt; Domains</em>) para que la red de Vercel enrute el tráfico y emita el SSL.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PAYMENT METHODS & ACCOUNTS */}
      {activeSubTab === "PAYMENTS" && (
        <div className="space-y-6">
          {/* Method Selector Checkboxes */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Métodos de Pago Activos en tu Tienda</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tilda o destilda las opciones que aceptas. <strong>Solo los métodos marcados aparecerán para el cliente al momento de pagar en el carrito.</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {AVAILABLE_PAYMENT_METHODS.filter((m) => {
                if (!isVenezuelaActive && (m.id === "PAGO_MOVIL" || m.id === "BANK_TRANSFER" || m.id === "CASH_VES")) {
                  return false;
                }
                return true;
              }).map((m) => {
                const Icon = m.icon;
                const isChecked = enabledMethods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePaymentMethod(m.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isChecked
                        ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                        : "bg-muted/40 border-border opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isChecked
                          ? "bg-primary text-primary-foreground"
                          : "border border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                        <span>{m.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {m.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pago Móvil Account Details */}
          {isVenezuelaActive && enabledMethods.includes("PAGO_MOVIL") && (
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span>Datos de Pago Móvil (Bs.)</span>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                  Activo en Carrito
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Banco Receptor
                  </label>
                  <select
                    value={pmBank}
                    onChange={(e) => setPmBank(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    {VENEZUELAN_BANK_NAMES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Teléfono Celular Registrado
                  </label>
                  <input
                    type="text"
                    value={pmPhone}
                    onChange={(e) => setPmPhone(e.target.value)}
                    placeholder="04245919577"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Cédula / RIF del Titular
                  </label>
                  <input
                    type="text"
                    value={pmIdDoc}
                    onChange={(e) => setPmIdDoc(e.target.value)}
                    placeholder="J-50123456-7 ó V-12345678"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Nombre del Titular / Comercio
                  </label>
                  <input
                    type="text"
                    value={pmName}
                    onChange={(e) => setPmName(e.target.value)}
                    placeholder="Ej. Razón Social / Titular"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bank Transfer Details */}
          {isVenezuelaActive && enabledMethods.includes("BANK_TRANSFER") && (
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span>Datos de Transferencia Bancaria en Bolívares</span>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                  Activo en Carrito
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Banco de la Cuenta
                  </label>
                  <select
                    value={btBank}
                    onChange={(e) => setBtBank(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    {VENEZUELAN_BANK_NAMES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Número de Cuenta (20 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={btAccountNumber}
                    onChange={(e) => setBtAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="01720111551100012345"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold tracking-wider focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={btAccountType}
                    onChange={(e) => setBtAccountType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="Corriente">Cuenta Corriente</option>
                    <option value="Ahorro">Cuenta de Ahorros</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    RIF o Cédula del Titular
                  </label>
                  <input
                    type="text"
                    value={btIdDoc}
                    onChange={(e) => setBtIdDoc(e.target.value)}
                    placeholder="J-50123456-7"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Razón Social / Nombre del Titular
                  </label>
                  <input
                    type="text"
                    value={btName}
                    onChange={(e) => setBtName(e.target.value)}
                    placeholder="Ej. Razón Social / Titular"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Zelle Account Details */}
          {enabledMethods.includes("ZELLE") && (
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>Datos de Zelle (Dólares USD)</span>
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-600 font-bold px-2 py-0.5 rounded-full">
                  Activo en Carrito
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Correo Electrónico de Zelle
                  </label>
                  <input
                    type="email"
                    value={zelleEmail}
                    onChange={(e) => setZelleEmail(e.target.value)}
                    placeholder="pagos@micomercio.com"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Nombre o Titular de la Cuenta Zelle
                  </label>
                  <input
                    type="text"
                    value={zelleName}
                    onChange={(e) => setZelleName(e.target.value)}
                    placeholder="Ej. Nombre o Razón Social del Titular"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cash Instructions */}
          {enabledMethods.includes("CASH_USD") && (
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Instrucciones para Pago en Efectivo USD</span>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                  Activo en Carrito
                </span>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1 text-xs">
                  Condiciones visibles para el cliente
                </label>
                <textarea
                  rows={2}
                  value={cashUsdInstructions}
                  onChange={(e) => setCashUsdInstructions(e.target.value)}
                  placeholder="Billetes en buen estado sin roturas ni marcas. Pago al retirar en caja o contra entrega."
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: BRANDING, COLORS, LOGO & FONTS */}
      {activeSubTab === "BRANDING" && (
        <div className="space-y-6">
          {/* Logo Upload Section */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  <span>Logo Oficial de la Marca</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sube la imagen de tu logo por archivo (PNG transparente, JPG o WebP). Se optimiza automáticamente para web.
                </p>
              </div>

              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar Logo</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Preview Box */}
              <div className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center p-2 overflow-hidden shadow-xs shrink-0">
                {isProcessingLogo ? (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-[10px] font-bold">Procesando...</span>
                  </div>
                ) : logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-muted-foreground">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-xs mb-1">
                      {businessName ? businessName.substring(0, 2).toUpperCase() : "SM"}
                    </div>
                    <span className="text-[10px]">Sin archivo</span>
                  </div>
                )}
              </div>

              {/* Upload Input */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors cursor-pointer shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar Archivo de Logo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Recomendado: Imagen cuadrada o rectangular con fondo transparente (PNG o WebP). Máximo 5 MB.
                </p>
                {logoUrl && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Logo cargado y listo para guardar</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Brand Colors */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <span>Colores de la Marca</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                El color primario se aplica dinámicamente a botones de compra, badges, etiquetas de precios y acentos de la tienda.
              </p>
            </div>

            {/* Quick Preset Swatches */}
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-2">
                Paleta Rápida Sugerida:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPrimaryColor(c.hex)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      primaryColor.toUpperCase() === c.hex.toUpperCase()
                        ? "border-foreground ring-2 ring-foreground/20 font-bold bg-muted"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                    {primaryColor.toUpperCase() === c.hex.toUpperCase() && (
                      <Check className="w-3 h-3 text-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                <label className="font-bold text-foreground block">
                  Color Primario (Botones, Acciones, Badges)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#DC2626"
                    className="flex-1 h-9 px-3 rounded-lg border border-input font-mono font-bold text-xs uppercase"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                <label className="font-bold text-foreground block">
                  Color Secundario (Fondos Oscuros / Textos)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#09090B"
                    className="flex-1 h-9 px-3 rounded-lg border border-input font-mono font-bold text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography / Font Definition */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Definición de Tipografía / Letras de la Marca</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selecciona la fuente que mejor representa la personalidad y estilo visual de tu comercio.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {PRESET_FONTS.map((f) => {
                const isSelected = fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontFamily(f.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-primary/10 border-primary ring-2 ring-primary/30"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-foreground">{f.name}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">{f.description}</p>

                    {/* Font Preview sample */}
                    <div
                      className="p-2 rounded-lg bg-card border border-border/60 text-xs font-semibold text-foreground tracking-tight"
                      style={{ fontFamily: f.id }}
                    >
                      {businessName || "Mi Comercio"} • {isVenezuelaActive ? "Bs. 875,65" : "$45.00"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: OPERATIONS & ADVANCED AUTO-MANAGEMENT */}
      {activeSubTab === "OPERATIONS" && (
        <div className="space-y-6">
          {/* Store Open / Closed Switch */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Estado Comercial de la Tienda</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Controla con un clic si tu tienda está recibiendo pedidos o pausada temporalmente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOpen ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isOpen ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                isOpen
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              <span>
                {isOpen
                  ? "🟢 Tienda Abierta: Los clientes pueden agregar productos y pagar libremente."
                  : "🔴 Tienda Pausada: Se mostrará un aviso de horario y pedidos diferidos."}
              </span>
            </div>

            {!isOpen && (
              <div className="text-xs space-y-1.5">
                <label className="font-semibold text-muted-foreground block">
                  Mensaje para clientes cuando esté cerrada:
                </label>
                <input
                  type="text"
                  value={closedMessage}
                  onChange={(e) => setClosedMessage(e.target.value)}
                  placeholder="Actualmente estamos fuera de horario. Tu pedido será procesado en el próximo turno."
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Schedule & Operational Limits */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              <span>Horarios, Pedido Mínimo y Tiempos de Entrega</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Horario de Atención Comercial (Visible en tienda)
                </label>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="Lun-Sáb: 8am - 9pm | Dom: 9am - 6pm"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Monto Mínimo de Pedido (USD)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={minOrderUsd}
                    onChange={(e) => setMinOrderUsd(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Coloca 0 si no deseas exigir monto mínimo.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Tiempo Estimado de Entrega
                </label>
                <div className="relative">
                  <Truck className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="text"
                    value={estimatedDeliveryTime}
                    onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                    placeholder="30 a 60 minutos"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Announcement Banner Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-xs text-foreground block">
                    Banner de Anuncio Superior (Barra Promocional Roja)
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Activa o desactiva con un clic el cintillo superior de la tienda para promociones o avisos de delivery.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAnnouncementBanner(!showAnnouncementBanner)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showAnnouncementBanner ? "bg-emerald-600" : "bg-muted-foreground/30"
                  }`}
                  aria-label="Activar o desactivar banner de anuncio"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      showAnnouncementBanner ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {showAnnouncementBanner && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={announcementBanner}
                    onChange={(e) => setAnnouncementBanner(e.target.value)}
                    placeholder="Ej. ¡Envíos gratis en Barquisimeto en compras mayores a $30! 🛵🎉"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">
                      Vista previa de cómo se ve en la tienda:
                    </span>
                    {announcementBanner && (
                      <button
                        type="button"
                        onClick={() => setAnnouncementBanner("")}
                        className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar texto
                      </button>
                    )}
                  </div>
                  {announcementBanner && (
                    <div className="bg-primary text-primary-foreground text-xs py-1.5 px-3 rounded-lg text-center font-bold shadow-xs truncate">
                      {announcementBanner}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tickets & QR Settings Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  <span>Código QR en Tickets y Comprobantes de Pedido</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Controla con un clic si el comprobante digital e impreso incluye el código QR para escaneo y rastreo automático del pedido.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTicketQr(!showTicketQr)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showTicketQr ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    showTicketQr ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold ${
                showTicketQr
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              <span>
                {showTicketQr
                  ? "🟢 Código QR Activado: Se incluirá en el ticket un QR inteligente que, al ser escaneado con la cámara de cualquier teléfono, abre automáticamente el rastreador en vivo del pedido."
                  : "⚪ Código QR Desactivado: Los tickets se imprimirán y guardarán de forma limpia sin código QR."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: SENIAT FISCAL COMPLIANCE & FACTURACIÓN DIGITAL (Plugin local_venezuela) */}
      {isVenezuelaActive && activeSubTab === "FISCAL" && (
        <SeniatFiscalSettings
          fiscalBillingEnabled={fiscalBillingEnabled}
          setFiscalBillingEnabled={setFiscalBillingEnabled}
          emitterRif={emitterRif}
          setEmitterRif={setEmitterRif}
          emitterBusinessName={emitterBusinessName}
          setEmitterBusinessName={setEmitterBusinessName}
          emitterFiscalAddress={emitterFiscalAddress}
          setEmitterFiscalAddress={setEmitterFiscalAddress}
          emitterPhone={emitterPhone}
          setEmitterPhone={setEmitterPhone}
          taxPayerType={taxPayerType}
          setTaxPayerType={setTaxPayerType}
          defaultIvaRate={defaultIvaRate}
          setDefaultIvaRate={setDefaultIvaRate}
          applyIgtf={applyIgtf}
          setApplyIgtf={setApplyIgtf}
          billingMode={billingMode}
          setBillingMode={setBillingMode}
          fiscalProvider={fiscalProvider}
          setFiscalProvider={setFiscalProvider}
          providerApiKey={providerApiKey}
          setProviderApiKey={setProviderApiKey}
          providerEnv={providerEnv}
          setProviderEnv={setProviderEnv}
          fiscalMachineSerial={fiscalMachineSerial}
          setFiscalMachineSerial={setFiscalMachineSerial}
          nextInvoiceNumber={nextInvoiceNumber}
          setNextInvoiceNumber={setNextInvoiceNumber}
          nextControlNumber={nextControlNumber}
          setNextControlNumber={setNextControlNumber}
          controlPrefix={controlPrefix}
          setControlPrefix={setControlPrefix}
          nonFiscalWarningLegend={nonFiscalWarningLegend}
          setNonFiscalWarningLegend={setNonFiscalWarningLegend}
        />
      )}


      {/* Floating Bottom Save Action Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Al guardar, todos los cambios se sincronizan en la nube y se reflejan al instante.
        </p>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar Todo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
