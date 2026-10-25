"use client";

import React, { useState, useId, useEffect, useRef } from "react";
import { Store, TenantSettings, Order, DeliveryZone } from "@marketos/types";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes, compressImage, formatFileSize } from "@marketos/utils";
import { validatePagoMovilInput } from "@marketos/plugin-local-venezuela";
import {
  createOrderWithPaymentAction,
  validateCouponAction,
  uploadPaymentProofToR2Action,
} from "../app/actions";
import { savePushSubscriptionAction } from "../app/admin/push-actions";
import { CheckoutStepDelivery } from "./checkout/checkout-step-delivery";
import { CheckoutStepPayment } from "./checkout/checkout-step-payment";
import {
  X,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  QrCode,
  DollarSign,
  Receipt,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll position to top when switching between wizard steps
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [step]);

  // Form states - Step 1: Customer Data & Delivery (Fresh start on every checkout for shared phone privacy)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [ciPrefix, setCiPrefix] = useState<"V" | "E" | "J" | "G">("V");
  const [ciNumber, setCiNumber] = useState("");

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

  // Robust mobile body scroll lock preventing window panning and keyboard displacement
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const resetWindowScroll = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resetWindowScroll);
      window.visualViewport.addEventListener("scroll", resetWindowScroll);
    }
    window.addEventListener("focus", resetWindowScroll);
    window.addEventListener("orientationchange", resetWindowScroll);

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", resetWindowScroll);
        window.visualViewport.removeEventListener("scroll", resetWindowScroll);
      }
      window.removeEventListener("focus", resetWindowScroll);
      window.removeEventListener("orientationchange", resetWindowScroll);
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
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(15); } catch {}
      }
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
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
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

      // Clean up any customer keys in localStorage so shared phones start completely blank
      try {
        localStorage.removeItem(`marketos_customer_ci_${settings.tenant_id}`);
        localStorage.removeItem(`marketos_customer_phone_${settings.tenant_id}`);
        localStorage.removeItem(`marketos_customer_name_${settings.tenant_id}`);
        localStorage.removeItem("marketos_customer_ci");
        localStorage.removeItem("marketos_customer_phone");
        localStorage.removeItem("marketos_customer_name");

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

      // Reset form states so next order starts 100% clean
      setCustomerName("");
      setCustomerPhone("");
      setCiPrefix("V");
      setCiNumber("");
      setDeliveryAddress("");
      setDeliveryReference("");
      setGpsCoords(null);
      setReferenceNumber("");
      setProofFile(null);
      setProofPreview(null);
      setCashTenderedInput("");
      setStep(1);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden touch-none sm:touch-auto">
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
        className="relative z-10 bg-card w-full max-w-lg rounded-t-[28px] sm:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 touch-auto"
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

        {/* Wizard Form Shell */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable Step Content Container */}
          <div
            ref={scrollContainerRef}
            className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0 overscroll-contain"
          >
          {step === 1 ? (
            <CheckoutStepDelivery
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              ciPrefix={ciPrefix}
              setCiPrefix={setCiPrefix}
              ciNumber={ciNumber}
              setCiNumber={setCiNumber}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              selectedZoneId={selectedZoneId}
              setSelectedZoneId={setSelectedZoneId}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              deliveryReference={deliveryReference}
              setDeliveryReference={setDeliveryReference}
              deliveryZones={deliveryZones}
              selectedStore={selectedStore}
              gpsCoords={gpsCoords}
              setGpsCoords={setGpsCoords}
              isLocatingGps={isLocatingGps}
              gpsError={gpsError}
              onGetGpsCoordinates={handleCaptureGps}
              isDeliveryActive={isDeliveryActive}
              isVenezuelaActive={isVenezuelaActive}
              subtotalUsd={subtotalUsd}
              exchangeRate={exchangeRate}
              baseCurrency={settings.currency_settings?.base_currency || "USD"}
            />
          ) : (
            <CheckoutStepPayment
              customerName={customerName}
              deliveryType={deliveryType}
              onBack={() => setStep(1)}
              itemsCount={items.length}
              subtotalUsd={subtotalUsd}
              appliedCoupon={appliedCoupon}
              discountUsd={discountUsd}
              deliveryFeeUsd={deliveryFeeUsd}
              selectedZoneName={selectedZone?.name}
              isDeliveryActive={isDeliveryActive}
              totalUsd={totalUsd}
              totalVes={totalVes}
              isVenezuelaActive={isVenezuelaActive}
              isCouponsActive={isCouponsActive}
              couponCode={couponCode}
              setCouponCode={setCouponCode}
              couponLoading={couponLoading}
              couponMessage={couponMessage}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              availablePaymentMethods={availablePaymentMethods}
              settings={settings}
              exchangeRate={exchangeRate}
              pmData={pmData}
              btData={btData}
              zelleData={zelleData}
              copiedField={copiedField}
              onCopy={handleCopy}
              cashInstructions={cashInstructions}
              cashTenderedInput={cashTenderedInput}
              setCashTenderedInput={setCashTenderedInput}
              bankName={bankName}
              setBankName={setBankName}
              referenceNumber={referenceNumber}
              setReferenceNumber={setReferenceNumber}
              fileInputId={fileInputId}
              isCompressingProof={isCompressingProof}
              proofFile={proofFile}
              proofPreview={proofPreview}
              proofCompressionInfo={proofCompressionInfo}
              onFileChange={handleFileChange}
            />
          )}
          </div>

          {/* Sticky Bottom Action Bar (Pinned, Ergonomic Mobile Thumb-Zone) */}
          <div className="p-3.5 sm:p-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-lg">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate(12); } catch {}
                  }
                  handleProceedToStep2();
                }}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-md cursor-pointer touch-manipulation"
              >
                <span>Continuar al Pago</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && "vibrate" in navigator) {
                      try { navigator.vibrate(10); } catch {}
                    }
                    setStep(1);
                  }}
                  className="w-1/3 h-12 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || isSubmittingRef.current}
                  onClick={() => {
                    if (typeof window !== "undefined" && "vibrate" in navigator) {
                      try { navigator.vibrate(20); } catch {}
                    }
                  }}
                  className="w-2/3 h-12 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md cursor-pointer touch-manipulation"
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
