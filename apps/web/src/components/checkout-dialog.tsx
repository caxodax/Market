"use client";

import React, { useState, useId, useEffect, useRef } from "react";
import { Store, TenantSettings, Order, DeliveryZone } from "@marketos/types";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes, compressImage, formatFileSize } from "@marketos/utils";
import { PagoMovilCard, validatePagoMovilInput } from "@marketos/plugin-local-venezuela";
import {
  createOrderWithPaymentAction,
  validateCouponAction,
  uploadPaymentProofToR2Action,
} from "../app/actions";
import { savePushSubscriptionAction } from "../app/admin/push-actions";
import {
  X,
  CreditCard,
  Truck,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Loader2,
  Tag,
  Upload,
  Clock,
  MapPin,
  Check,
  Copy,
  ArrowLeft,
  ChevronRight,
  User,
  Phone,
  FileText,
  DollarSign,
  Receipt,
  Info,
  ShieldCheck,
  Navigation,
  ExternalLink,
} from "lucide-react";

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: number;
  activeModuleIds?: import("@marketos/types").TenantModuleId[];
  onOrderCompleted: (order: Order) => void;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  settings,
  stores,
  deliveryZones,
  exchangeRate,
  activeModuleIds = [],
  onOrderCompleted,
}: CheckoutDialogProps) {
  const isDeliveryActive = activeModuleIds.includes("delivery_fleet");
  const isCouponsActive = activeModuleIds.includes("promotions_coupons");
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");

  const { items, totalUsd: rawSubtotalUsd, clearCart } = useCart();
  const fileInputId = useId();

  // Wizard Step: 1 = Entrega & Receptor, 2 = Pago & Confirmación
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Form states - Step 1: Customer Data & Delivery
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem(`marketos_customer_name_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_name") ||
        ""
      );
    }
    return "";
  });

  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem(`marketos_customer_phone_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_phone") ||
        ""
      );
    }
    return "";
  });

  const [ciPrefix, setCiPrefix] = useState<"V" | "E" | "J" | "G">(() => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(`marketos_customer_ci_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_ci") ||
        "";
      if (saved.startsWith("E-")) return "E";
      if (saved.startsWith("J-")) return "J";
      if (saved.startsWith("G-")) return "G";
      return "V";
    }
    return "V";
  });

  const [ciNumber, setCiNumber] = useState(() => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(`marketos_customer_ci_${settings.tenant_id}`) ||
        localStorage.getItem("marketos_customer_ci") ||
        "";
      if (saved.includes("-")) {
        return saved.split("-")[1] || "";
      }
      return saved.replace(/\D/g, "");
    }
    return "";
  });

  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    deliveryZones[0]?.id || ""
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");

  // Customer GPS Pin Satellite states
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Step 2: Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountUsd: number;
    description?: string | null;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Step 2: Payment states
  const paymentSettings = settings.payment_settings;
  const defaultMethod = isVenezuelaActive ? "PAGO_MOVIL" : "CASH_USD";
  const initialPaymentMethod =
    (paymentSettings?.enabled_methods?.[0] as any) || defaultMethod;
  const [paymentMethod, setPaymentMethod] = useState<
    "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD"
  >(initialPaymentMethod);

  const [bankName, setBankName] = useState(
    paymentSettings?.pago_movil?.bank || "Banesco"
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isCompressingProof, setIsCompressingProof] = useState(false);
  const [proofCompressionInfo, setProofCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    savedPercent: number;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cashTenderedInput, setCashTenderedInput] = useState<string>("");

  // Lock body scroll when checkout dialog is open
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Available payment options
  const allPaymentMethodOptions: {
    id: "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD";
    label: string;
    icon: React.ReactNode;
  }[] = isVenezuelaActive
    ? [
        {
          id: "PAGO_MOVIL",
          label: "Pago Móvil",
          icon: <QrCode className="w-4 h-4 text-emerald-500" />,
        },
        {
          id: "BANK_TRANSFER",
          label: "Transferencia Bs.",
          icon: <CreditCard className="w-4 h-4 text-blue-500" />,
        },
        {
          id: "ZELLE",
          label: "Zelle USD",
          icon: <DollarSign className="w-4 h-4 text-purple-500" />,
        },
        {
          id: "CASH_USD",
          label: "Efectivo",
          icon: <Receipt className="w-4 h-4 text-amber-500" />,
        },
      ]
    : [
        {
          id: "ZELLE",
          label: "Zelle USD",
          icon: <DollarSign className="w-4 h-4 text-purple-500" />,
        },
        {
          id: "CASH_USD",
          label: "Efectivo",
          icon: <Receipt className="w-4 h-4 text-amber-500" />,
        },
      ];

  const enabledMethodKeys = paymentSettings?.enabled_methods;
  const availablePaymentMethods =
    enabledMethodKeys && enabledMethodKeys.length > 0
      ? allPaymentMethodOptions.filter((opt) =>
          enabledMethodKeys.includes(opt.id)
        )
      : allPaymentMethodOptions;

  const activePaymentMethod = availablePaymentMethods.some(
    (m) => m.id === paymentMethod
  )
    ? paymentMethod
    : availablePaymentMethods[0]?.id || (isVenezuelaActive ? "PAGO_MOVIL" : "CASH_USD");

  const pmData = paymentSettings?.pago_movil || {
    bank: "",
    phone: "",
    id_doc: "",
    name: settings.business_name,
  };

  const btData = paymentSettings?.bank_transfer || {
    bank: "",
    account_number: "",
    account_type: "Corriente",
    id_doc: "",
    name: settings.business_name,
  };

  const zelleData = paymentSettings?.zelle || {
    email: "",
    name: settings.business_name,
  };

  const cashInstructions =
    paymentSettings?.cash_usd?.instructions ||
    "Pagas el monto exacto en dólares o bolívares al momento de retirar tu pedido en tienda o cuando el repartidor llegue a tu domicilio.";

  // Calculations
  const selectedZone =
    deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];
  const deliveryFeeUsd =
    deliveryType === "DELIVERY" ? selectedZone?.price_usd || 0 : 0;
  const discountUsd = appliedCoupon ? appliedCoupon.discountUsd : 0;
  const subtotalUsd = rawSubtotalUsd;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd + deliveryFeeUsd);
  const totalVes = convertUsdToVes(totalUsd, exchangeRate);
  const selectedStore = stores[0] || {
    id: "default-store",
    name: settings.business_name || "Sede Principal",
  };

  // 1-Click Copy helper
  const handleCopy = (text: string, fieldId: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 1800);
    } catch (e) {
      console.warn("Could not copy to clipboard", e);
    }
  };

  // Coupon application handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMessage(null);

    const res = await validateCouponAction(
      settings.tenant_id,
      couponCode.trim(),
      subtotalUsd,
      customerPhone.trim() || undefined
    );

    setCouponLoading(false);
    if (res.valid && res.coupon) {
      setAppliedCoupon({
        code: res.coupon.code,
        discountUsd: res.discountUsd,
        description: res.coupon.description,
      });
      setCouponMessage({
        text: `Cupón "${res.coupon.code}" aplicado: -$${res.discountUsd.toFixed(2)} USD`,
        type: "success",
      });
    } else {
      setAppliedCoupon(null);
      setCouponMessage({
        text: res.message || "Cupón inválido o expirado",
        type: "error",
      });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage(null);
  };

  // 1-Tap Customer Satellite GPS Capture
  const handleCaptureGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Tu dispositivo o navegador no soporta geolocalización.");
      return;
    }

    setIsLocatingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);
        setGpsCoords({ lat, lng, accuracy });
        setIsLocatingGps(false);
        if (!deliveryAddress.trim()) {
          setDeliveryAddress("Ubicación fijada por GPS");
        }
      },
      (err) => {
        setIsLocatingGps(false);
        if (err.code === 1) {
          setGpsError("Permiso de ubicación denegado. Puedes escribir tu dirección detallada.");
        } else if (err.code === 3) {
          setGpsError("Tiempo de espera agotado buscando satélites. Intenta nuevamente.");
        } else {
          setGpsError("No se pudo obtener la posición GPS exacta en este momento.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Image upload with WebP compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingProof(true);
    setProofCompressionInfo(null);
    try {
      const result = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        targetFormat: "image/webp",
      });

      setProofFile(result.file);
      setProofPreview(result.previewUrl);
      setProofCompressionInfo({
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        savedPercent: result.savedPercent,
      });
    } catch (err) {
      console.warn("Error comprimiendo comprobante:", err);
      setProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    } finally {
      setIsCompressingProof(false);
    }
  };

  // Step 1 Validation Guard
  const handleProceedToStep2 = () => {
    setError(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const cleanPhoneDigits = trimmedPhone.replace(/\D/g, "");

    if (!trimmedName) {
      setError("Por favor ingresa tu nombre y apellido");
      return;
    }

    if (isVenezuelaActive && !ciNumber.trim()) {
      setError("Por favor ingresa tu número de cédula o RIF");
      return;
    }

    if (!trimmedPhone || cleanPhoneDigits.length < 10) {
      setError("Por favor ingresa un número de teléfono o WhatsApp válido (al menos 10 dígitos)");
      return;
    }

    if (isDeliveryActive && deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
      setError("Por favor especifica la dirección de entrega a domicilio");
      return;
    }

    const minOrder = settings.operational_settings?.min_order_usd || 0;
    if (minOrder > 0 && subtotalUsd < minOrder) {
      setError(`El pedido mínimo de la tienda es de $${minOrder.toFixed(2)} USD`);
      return;
    }

    setStep(2);
  };

  // Final Order Submission Handler (Atomic)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;
    setError(null);

    // Validation for payment proof fields
    if (paymentMethod === "PAGO_MOVIL") {
      const pmValidation = validatePagoMovilInput({
        phone: pmData.phone,
        idDoc: pmData.id_doc,
        reference: referenceNumber,
      });
      if (!pmValidation.valid) {
        setError(pmValidation.error || "Por favor verifica los datos de tu Pago Móvil");
        return;
      }
    } else if (paymentMethod === "BANK_TRANSFER" && !referenceNumber.trim()) {
      setError("Por favor ingresa los últimos 4 a 6 dígitos de tu comprobante bancario");
      return;
    } else if (paymentMethod === "ZELLE" && !referenceNumber.trim()) {
      setError("Por favor ingresa el nombre del titular o código de confirmación Zelle");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Upload proof to Cloudflare R2 if attached
      let proofImageUrl: string | undefined = undefined;
      if (proofFile) {
        const formData = new FormData();
        formData.append("file", proofFile);
        formData.append("tenantId", settings.tenant_id);

        const uploadRes = await uploadPaymentProofToR2Action(formData);
        if (uploadRes.success && uploadRes.url) {
          proofImageUrl = uploadRes.url;
        }
      }

      const gpsTag = gpsCoords
        ? ` [GPS: ${gpsCoords.lat.toFixed(6)},${gpsCoords.lng.toFixed(6)}]`
        : "";

      const fullDeliveryAddress =
        deliveryType === "DELIVERY"
          ? `${deliveryAddress} ${deliveryReference ? `(Ref: ${deliveryReference})` : ""} - Zona: ${selectedZone?.name || ""}${gpsTag}`.trim()
          : undefined;

      const fullCi =
        isVenezuelaActive && ciNumber.trim() ? `${ciPrefix}-${ciNumber.trim()}` : "N/A";

      // Calculate cash and change if cash payment
      const parsedCashTendered = parseFloat(cashTenderedInput);
      const validCashTendered = !isNaN(parsedCashTendered) && parsedCashTendered > 0 ? parsedCashTendered : undefined;
      const calculatedChangeDue = validCashTendered && validCashTendered > totalUsd
        ? Number((validCashTendered - totalUsd).toFixed(2))
        : undefined;

      // Atomic Order + Payment Submission
      const result = await createOrderWithPaymentAction({
        order: {
          tenantId: settings.tenant_id,
          storeId: selectedStore.id,
          customerName,
          customerPhone,
          customerIdNumber: fullCi,
          deliveryType,
          deliveryZoneId: deliveryType === "DELIVERY" ? selectedZone?.id : undefined,
          deliveryAddress: fullDeliveryAddress,
          deliveryLatitude: deliveryType === "DELIVERY" ? gpsCoords?.lat : undefined,
          deliveryLongitude: deliveryType === "DELIVERY" ? gpsCoords?.lng : undefined,
          deliveryFeeUsd,
          couponCode: appliedCoupon?.code,
          discountUsd,
          cashTenderedUsd: validCashTendered,
          changeRequiredUsd: calculatedChangeDue,
          idempotencyKey,
          items: items.map((i) => ({
            productId: i.product.id,
            productName: i.product.name,
            quantity: i.quantity,
            unitPriceUsd: i.unit_price_usd ?? i.product.price_usd,
            selected_modifiers: i.selected_modifiers,
          })),
          notes: `Método: ${paymentMethod} | ${
            deliveryType === "DELIVERY"
              ? `Delivery: ${selectedZone?.name}`
              : "Retiro en Tienda"
          }${validCashTendered ? ` | Paga con: $${validCashTendered.toFixed(2)} (Vuelto: $${(calculatedChangeDue || 0).toFixed(2)})` : ""}`,
        },
        payment: {
          method: paymentMethod,
          bankName:
            paymentMethod === "PAGO_MOVIL" || paymentMethod === "BANK_TRANSFER"
              ? bankName
              : undefined,
          referenceNumber:
            referenceNumber ||
            (paymentMethod === "CASH_USD" ? "EFECTIVO-TIENDA" : "PENDIENTE"),
          amount:
            paymentMethod === "ZELLE" || paymentMethod === "CASH_USD" || !isVenezuelaActive
              ? totalUsd
              : totalVes,
          currency:
            paymentMethod === "ZELLE" || paymentMethod === "CASH_USD" || !isVenezuelaActive
              ? "USD"
              : "VES",
          proofImageUrl,
        },
      });

      if (!result.success || !result.order) {
        throw new Error(result.error || "No se pudo procesar tu pedido");
      }

      // Persist customer data locally for subsequent visits
      try {
        localStorage.setItem(`marketos_customer_ci_${settings.tenant_id}`, fullCi);
        localStorage.setItem(`marketos_customer_phone_${settings.tenant_id}`, customerPhone);
        localStorage.setItem(`marketos_customer_name_${settings.tenant_id}`, customerName);
        localStorage.setItem("marketos_customer_ci", fullCi);
        localStorage.setItem("marketos_customer_phone", customerPhone);

        if (
          typeof window !== "undefined" &&
          "serviceWorker" in navigator &&
          "PushManager" in window
        ) {
          navigator.serviceWorker.ready
            .then(async (reg) => {
              try {
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                  const subJson = sub.toJSON();
                  if (subJson.endpoint && subJson.keys) {
                    await savePushSubscriptionAction({
                      tenantId: settings.tenant_id,
                      endpoint: subJson.endpoint,
                      p256dh: subJson.keys.p256dh,
                      auth: subJson.keys.auth,
                      customerId: customerPhone,
                      userAgent: navigator.userAgent,
                    });
                  }
                }
              } catch {}
            })
            .catch(() => {});
        }
      } catch {}

      clearCart();
      onOrderCompleted(result.order);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al procesar el pedido. Intenta nuevamente.");
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div
        className="fixed inset-0 bg-transparent cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Dialog Shell (Mobile Bottom Sheet / Desktop Modal) */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-card w-full max-w-lg rounded-t-[28px] sm:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        {/* Mobile drag handle bar */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header: Ergonomic Stepper Navigation */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Step 1 Pill */}
            <button
              type="button"
              onClick={() => step === 2 && setStep(1)}
              className={`flex items-center gap-2 text-xs font-bold transition-all ${
                step === 1
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground cursor-pointer"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 1
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {step === 1 ? "1" : "✓"}
              </span>
              <span>Entrega & Datos</span>
            </button>

            <span className="text-muted-foreground/30 text-xs select-none">─────</span>

            {/* Step 2 Pill */}
            <div
              className={`flex items-center gap-2 text-xs font-bold transition-all ${
                step === 2 ? "text-primary" : "text-muted-foreground opacity-60"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 2
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </span>
              <span>Pago & Resumen</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-destructive/80 hover:text-destructive cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Wizard Form Container */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain"
        >
          {step === 1 ? (
            /* ============================================================== */
            /* STEP 1: DESTINATARIO Y MODALIDAD DE ENTREGA                   */
            /* ============================================================== */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Customer Information Card */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5 text-primary" />
                    Datos del Cliente
                  </label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Requeridos para tu orden
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carmen Rodríguez"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div
                    className={`grid gap-2.5 ${
                      isVenezuelaActive ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {/* Cédula / RIF (Solo si local_venezuela activo) */}
                    {isVenezuelaActive && (
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                          Cédula o RIF *
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={ciPrefix}
                            onChange={(e) =>
                              setCiPrefix(e.target.value as "V" | "E" | "J" | "G")
                            }
                            className="h-11 px-2.5 rounded-xl border border-input bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-primary shrink-0 cursor-pointer"
                            title="Prefijo documento"
                          >
                            <option value="V">V-</option>
                            <option value="E">E-</option>
                            <option value="J">J-</option>
                            <option value="G">G-</option>
                          </select>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                            placeholder="Ej. 12345678"
                            value={ciNumber}
                            onChange={(e) =>
                              setCiNumber(e.target.value.replace(/\D/g, ""))
                            }
                            className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}

                    {/* Teléfono / WhatsApp */}
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                        Teléfono / WhatsApp *
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3.5" />
                        <input
                          type="tel"
                          inputMode="tel"
                          required
                          placeholder="Ej. 04121234567"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Mode Card */}
              {isDeliveryActive ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    Modalidad de Entrega
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Retiro en Tienda Pill */}
                    <button
                      type="button"
                      onClick={() => setDeliveryType("PICKUP")}
                      className={`min-h-[58px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        deliveryType === "PICKUP"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <StoreIcon className="w-4 h-4" />
                        <span className="text-xs">Retiro en Tienda</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Sin costo adicional
                      </span>
                    </button>

                    {/* Delivery a Domicilio Pill */}
                    <button
                      type="button"
                      onClick={() => setDeliveryType("DELIVERY")}
                      className={`min-h-[58px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        deliveryType === "DELIVERY"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4" />
                        <span className="text-xs">Delivery a Domicilio</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {deliveryZones.length > 0
                          ? `Zonas desde $${Math.min(...deliveryZones.map((z) => z.price_usd || 0)).toFixed(2)}`
                          : "Tarifa estándar"}
                      </span>
                    </button>
                  </div>

                  {/* Pickup Store Info */}
                  {deliveryType === "PICKUP" && (
                    <div className="p-3 rounded-xl bg-background border border-border flex items-start gap-2.5 animate-in fade-in">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <StoreIcon className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-foreground block">
                          {selectedStore.name}
                        </span>
                        <span className="text-muted-foreground text-[11px] leading-tight block mt-0.5">
                          {selectedStore.address || "Tu pedido estará listo para retiro tras la confirmación del pago."}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Delivery Address & Zone Selectors */}
                  {deliveryType === "DELIVERY" && (
                    <div className="space-y-3 pt-1 animate-in fade-in">
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                          Zona de Cobertura *
                        </label>
                        <select
                          value={selectedZoneId}
                          onChange={(e) => setSelectedZoneId(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          {deliveryZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name} —{" "}
                              {zone.price_usd === 0
                                ? "GRATIS"
                                : `$${zone.price_usd.toFixed(2)} USD`}{" "}
                              {zone.estimated_time ? `(${zone.estimated_time})` : ""}
                            </option>
                          ))}
                        </select>
                        {selectedZone?.coverage_description && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary shrink-0" />
                            <span>{selectedZone.coverage_description}</span>
                          </p>
                        )}
                      </div>

                      {/* 1-Tap Customer Satellite GPS Capture */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-semibold text-foreground/80">
                            Ubicación Satelital (GPS)
                          </label>
                          {gpsCoords && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              ±{gpsCoords.accuracy}m precisión
                            </span>
                          )}
                        </div>

                        {!gpsCoords ? (
                          <button
                            type="button"
                            onClick={handleCaptureGps}
                            disabled={isLocatingGps}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all active:scale-[0.99] cursor-pointer"
                          >
                            {isLocatingGps ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span>Buscando señal satelital GPS...</span>
                              </>
                            ) : (
                              <>
                                <Navigation className="w-4 h-4 text-primary" />
                                <span>📍 Fijar mi Ubicación GPS Actual</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-xs truncate">
                                  Pin GPS capturado para el motorizado
                                </p>
                                <a
                                  href={`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-emerald-600 dark:text-emerald-400 underline font-medium hover:text-emerald-700 flex items-center gap-1"
                                >
                                  <span>Ver mi punto en Google Maps</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setGpsCoords(null)}
                              className="text-xs text-muted-foreground hover:text-rose-500 px-2 py-1 font-semibold rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Descartar coordenada"
                            >
                              ✕ Quitar
                            </button>
                          </div>
                        )}

                        {gpsError && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{gpsError}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                          Dirección Exacta *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Urbanización, Avenida/Calle, Edificio o N° de casa"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                          Punto de Referencia (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Color de reja, negocio cercano o indicaciones al motorizado"
                          value={deliveryReference}
                          onChange={(e) => setDeliveryReference(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <StoreIcon className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-foreground block">
                      Modalidad: Retiro en Tienda
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {selectedStore.name}
                    </span>
                  </div>
                </div>
              )}

              {/* Subtotal preview banner */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Subtotal de compra:</span>
                <div className="text-right">
                  <span className="font-black text-sm text-foreground">
                    {formatCurrency(subtotalUsd, "USD")}
                  </span>
                  {isVenezuelaActive && (
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      Bs. {convertUsdToVes(subtotalUsd, exchangeRate).toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Next Step Button */}
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-md cursor-pointer"
              >
                <span>Continuar al Pago</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ============================================================== */
            /* STEP 2: METODO DE PAGO, CUPONES Y CONFIRMACIÓN                 */
            /* ============================================================== */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back button and recipient pill */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Volver a Datos</span>
                </button>
                <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[200px]">
                  {customerName} • {deliveryType === "DELIVERY" ? "Delivery" : "Retiro"}
                </span>
              </div>

              {/* Order Financial Breakdown Card */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-foreground pb-1 border-b border-border/60">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-primary" />
                    Resumen del Pedido
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {items.length} {items.length === 1 ? "artículo" : "artículos"}
                  </span>
                </div>

                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Subtotal productos:</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(subtotalUsd, "USD")}
                  </span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Cupón ({appliedCoupon.code}):</span>
                    <span>-{formatCurrency(discountUsd, "USD")}</span>
                  </div>
                )}

                {isDeliveryActive && deliveryType === "DELIVERY" && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery ({selectedZone?.name}):</span>
                    <span className="font-semibold text-foreground">
                      {deliveryFeeUsd === 0
                        ? "GRATIS"
                        : formatCurrency(deliveryFeeUsd, "USD")}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-border flex justify-between items-baseline font-black">
                  <span className="text-foreground text-sm">Total a Pagar:</span>
                  <div className="text-right">
                    <span className="text-primary font-bold text-lg">
                      {formatCurrency(totalUsd, "USD")}
                    </span>
                    {isVenezuelaActive && (
                      <span className="block text-xs font-semibold text-muted-foreground font-mono">
                        Bs.{" "}
                        {totalVes.toLocaleString("es-VE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coupon / Discount Code Section */}
              {isCouponsActive && (
                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    ¿Tienes un Cupón de Descuento?
                  </label>

                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. BIENVENIDO o PROMO10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        disabled={couponLoading || !couponCode.trim()}
                        onClick={handleApplyCoupon}
                        className="px-4 h-10 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {couponLoading ? "Validando..." : "Aplicar"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>
                          {appliedCoupon.code}: -${appliedCoupon.discountUsd.toFixed(2)} USD
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-[11px] font-semibold underline hover:text-emerald-700 cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  )}

                  {couponMessage && !appliedCoupon && (
                    <p
                      className={`text-[11px] font-medium ${
                        couponMessage.type === "success"
                          ? "text-emerald-600"
                          : "text-destructive"
                      }`}
                    >
                      {couponMessage.text}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Method Selector Grid */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Selecciona tu Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {availablePaymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`min-h-[50px] p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activePaymentMethod === m.id
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {m.icon}
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Details & Instructions with 1-Click Copy */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-3">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-primary" />
                    <span>Datos de Pago ({settings.business_name})</span>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    {activePaymentMethod === "PAGO_MOVIL"
                      ? `${pmData.bank || "Pago Móvil"}`
                      : activePaymentMethod === "BANK_TRANSFER"
                      ? `${btData.bank || "Transferencia"}`
                      : activePaymentMethod === "ZELLE"
                      ? "Zelle USD"
                      : "Efectivo"}
                  </span>
                </div>

                {/* Pago Móvil Details */}
                {activePaymentMethod === "PAGO_MOVIL" && (
                  <PagoMovilCard
                    data={pmData}
                    amountBs={totalVes}
                    exchangeRate={exchangeRate}
                  />
                )}

                {/* Bank Transfer Details */}
                {activePaymentMethod === "BANK_TRANSFER" && (
                  <div className="space-y-2 pt-1">
                    {/* Account Number */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          N° Cuenta {btData.account_type || "Corriente"} ({btData.bank})
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground tracking-wide">
                          {btData.account_number}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            btData.account_number.replace(/\D/g, ""),
                            "bank_account"
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "bank_account"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "bank_account" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* RIF */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          RIF / Titular
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {btData.id_doc} ({btData.name || settings.business_name})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            btData.id_doc.replace(/[^A-Za-z0-9]/g, ""),
                            "bank_rif"
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "bank_rif"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "bank_rif" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Exact amount in VES */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold block">
                          Monto a transferir
                        </span>
                        <span className="font-mono font-black text-sm text-foreground">
                          Bs.{" "}
                          {totalVes.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(totalVes.toFixed(2), "bank_amount")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          copiedField === "bank_amount"
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {copiedField === "bank_amount" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Monto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Zelle Details */}
                {activePaymentMethod === "ZELLE" && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Correo Zelle
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {zelleData.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(zelleData.email, "zelle_email")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "zelle_email"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "zelle_email" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Titular de la Cuenta
                      </span>
                      <span className="font-bold text-xs text-foreground">
                        {zelleData.name || settings.business_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold block">
                          Monto exacto USD
                        </span>
                        <span className="font-mono font-black text-sm text-foreground">
                          {formatCurrency(totalUsd, "USD")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(totalUsd.toFixed(2), "zelle_amount")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          copiedField === "zelle_amount"
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {copiedField === "zelle_amount" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Monto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cash Details */}
                {activePaymentMethod === "CASH_USD" && (
                  <div className="text-muted-foreground leading-relaxed pt-1 p-3.5 rounded-2xl bg-background border border-border space-y-3">
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <Receipt className="w-3.5 h-3.5 text-amber-500" />
                        Pago en efectivo contra entrega / tienda física:
                      </p>
                      <p className="mt-1 text-[11px]">{cashInstructions}</p>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between font-bold text-foreground">
                      <span className="text-xs">Total exacto de la orden:</span>
                      <span className="font-mono text-primary font-black text-sm">
                        {formatCurrency(totalUsd, "USD")}
                      </span>
                    </div>

                    {/* Cash Tendered & Change calculator */}
                    <div className="pt-2 border-t border-border space-y-2">
                      <label className="block text-[11px] font-bold text-foreground">
                        💵 ¿Con qué denominación o billete pagarás? (Opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min={totalUsd}
                          placeholder={totalUsd.toFixed(2)}
                          value={cashTenderedInput}
                          onChange={(e) => setCashTenderedInput(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 rounded-xl border border-input bg-card text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      {parseFloat(cashTenderedInput) > totalUsd && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
                          <span className="font-semibold">🔄 Cambio que debe llevar el repartidor:</span>
                          <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-200">
                            ${(parseFloat(cashTenderedInput) - totalUsd).toFixed(2)} USD
                          </span>
                        </div>
                      )}
                      {parseFloat(cashTenderedInput) < totalUsd && parseFloat(cashTenderedInput) > 0 && (
                        <p className="text-[11px] text-destructive font-semibold">
                          ⚠️ El monto ingresado (${parseFloat(cashTenderedInput).toFixed(2)}) no cubre el total del pedido (${totalUsd.toFixed(2)}).
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Proof fields and R2 file upload (for electronic payments) */}
              {(paymentMethod === "PAGO_MOVIL" ||
                paymentMethod === "BANK_TRANSFER" ||
                paymentMethod === "ZELLE") && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Datos del Comprobante
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                        Banco Emisor
                      </label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                        <option value="Bancamiga">Bancamiga</option>
                        <option value="Banesco">Banesco</option>
                        <option value="Mercantil">Mercantil</option>
                        <option value="BBVA Provincial">BBVA Provincial</option>
                        <option value="BDV">Banco de Venezuela</option>
                        <option value="Bancaribe">Bancaribe</option>
                        <option value="BNC">BNC</option>
                        <option value="Otro">Otro Banco</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                        N° Referencia *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Últimos 4 a 6 dígitos"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Cloudflare R2 Proof Screenshot Upload with WebP compression */}
                  <div className="pt-1">
                    <label className="text-[11px] font-semibold text-foreground/80 block mb-1">
                      Adjuntar Captura / Screenshot (Opcional)
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label
                        htmlFor={fileInputId}
                        className={`cursor-pointer flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-input bg-background hover:bg-muted text-xs font-medium text-foreground transition-all active:scale-[0.98] ${
                          isCompressingProof ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        {isCompressingProof ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 text-primary" />
                        )}
                        <span>
                          {isCompressingProof
                            ? "Optimizando imagen..."
                            : proofFile
                            ? proofFile.name
                            : "Subir comprobante"}
                        </span>
                      </label>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isCompressingProof}
                        className="sr-only"
                      />

                      {proofPreview && !isCompressingProof && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>
                            {proofCompressionInfo
                              ? `WebP (${formatFileSize(
                                  proofCompressionInfo.compressedSize
                                )})`
                              : "Comprobante listo"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Confirmation Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 h-12 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || isSubmittingRef.current}
                  className="w-2/3 h-12 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando pedido...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pedido</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
