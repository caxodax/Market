import type { StorefrontConfig, StorefrontBlock } from "@marketos/types";

export interface CreateStorefrontConfigOptions {
  businessName?: string;
  preset?: "global" | "venezuela";
}

export function createDefaultStorefrontConfig(
  businessNameOrOptions: string | CreateStorefrontConfigOptions = "Nuestra Tienda"
): StorefrontConfig {
  const options: CreateStorefrontConfigOptions =
    typeof businessNameOrOptions === "string"
      ? { businessName: businessNameOrOptions, preset: "global" }
      : { businessName: businessNameOrOptions.businessName || "Nuestra Tienda", preset: businessNameOrOptions.preset || "global" };

  const businessName = options.businessName || "Nuestra Tienda";
  const isVenezuela = options.preset === "venezuela";

  const marqueeMessages = isVenezuela
    ? [
        "⚡ Envíos express en menos de 45 minutos",
        "💵 Pagos en Bolívares a Tasa Oficial BCV",
        "💳 Aceptamos Pago Móvil, Zelle, Efectivo y Binance",
        "🎉 Delivery GRATIS en compras seleccionadas",
      ]
    : [
        "⚡ Envíos express directos a tu puerta",
        "💳 Múltiples métodos de pago seguros y protegidos",
        "🛡️ Garantía de satisfacción y atención directa",
        "🎉 Envío GRATIS en órdenes seleccionadas",
      ];

  const trustBadges = isVenezuela
    ? [
        {
          id: "badge_1",
          icon: "Truck" as const,
          title: "Delivery Rápido",
          description: "Envíos directos a tu dirección.",
        },
        {
          id: "badge_2",
          icon: "CreditCard" as const,
          title: "Múltiples Pagos",
          description: "Pago Móvil, Zelle y Efectivo.",
        },
        {
          id: "badge_3",
          icon: "ShieldCheck" as const,
          title: "Tasa Oficial BCV",
          description: "Actualizada automáticamente en cada pedido.",
        },
        {
          id: "badge_4",
          icon: "MessageCircle" as const,
          title: "Soporte WhatsApp",
          description: "Atención directa ante cualquier consulta.",
        },
      ]
    : [
        {
          id: "badge_1",
          icon: "Truck" as const,
          title: "Envío Rápido y Seguro",
          description: "Despacho directo y seguimiento de orden.",
        },
        {
          id: "badge_2",
          icon: "CreditCard" as const,
          title: "Pagos 100% Protegidos",
          description: "Tarjetas, transferencias y pagos digitales.",
        },
        {
          id: "badge_3",
          icon: "ShieldCheck" as const,
          title: "Calidad Garantizada",
          description: "Productos seleccionados con los más altos estándares.",
        },
        {
          id: "badge_4",
          icon: "MessageCircle" as const,
          title: "Atención Personalizada",
          description: "Soporte directo y respuesta inmediata a tus consultas.",
        },
      ];

  const testimonials = isVenezuela
    ? [
        {
          id: "rev_1",
          authorName: "Carlos Mendoza",
          authorLocation: "Zona Este",
          rating: 5,
          comment: "Excelente servicio, el pedido llegó en menos de 30 minutos y los productos perfectamente embalados.",
          verifiedBuyer: true,
          dateText: "Ayer",
        },
        {
          id: "rev_2",
          authorName: "Mariana Silva",
          authorLocation: "Centro Urbano",
          rating: 5,
          comment: "Pagar con Pago Móvil a la tasa del día es súper transparente y el seguimiento por WhatsApp funciona de maravilla.",
          verifiedBuyer: true,
          dateText: "Hace 3 días",
        },
        {
          id: "rev_3",
          authorName: "Roberto González",
          authorLocation: "Sede Norte",
          rating: 5,
          comment: "Los mejores precios de la zona y la atención al cliente es A1. 100% recomendados.",
          verifiedBuyer: true,
          dateText: "Esta semana",
        },
      ]
    : [
        {
          id: "rev_1",
          authorName: "Carlos Mendoza",
          authorLocation: "Cliente Verificado",
          rating: 5,
          comment: "Excelente servicio, el pedido llegó súper rápido y los productos perfectamente embalados y frescos.",
          verifiedBuyer: true,
          dateText: "Ayer",
        },
        {
          id: "rev_2",
          authorName: "Mariana Silva",
          authorLocation: "Cliente Frecuente",
          rating: 5,
          comment: "La experiencia de compra digital fue intuitiva, rápida y el seguimiento en vivo del pedido funciona excelente.",
          verifiedBuyer: true,
          dateText: "Hace 3 días",
        },
        {
          id: "rev_3",
          authorName: "Roberto González",
          authorLocation: "Comprador Registrado",
          rating: 5,
          comment: "Gran variedad, precios competitivos y una atención al cliente de primera calidad. Totalmente recomendados.",
          verifiedBuyer: true,
          dateText: "Esta semana",
        },
      ];

  const faqItems = isVenezuela
    ? [
        {
          id: "faq_1",
          question: "¿Cuáles son los métodos de pago aceptados?",
          answer: "Aceptamos Pago Móvil interbancario, Transferencias bancarias nacionales, Efectivo en Bolívares o Dólares, Zelle y Binance Pay.",
        },
        {
          id: "faq_2",
          question: "¿A qué tasa se calculan los precios en Bolívares?",
          answer: "Todos los montos en Bolívares se calculan automáticamente con la tasa oficial publicada por el Banco Central de Venezuela (BCV) del día.",
        },
        {
          id: "faq_3",
          question: "¿Cómo funciona el servicio de Delivery?",
          answer: "Despachamos tu pedido con nuestra flota o aliados motorizados tan pronto como se confirma tu comprobante de pago.",
        },
        {
          id: "faq_4",
          question: "¿Puedo retirar mi pedido personalmente en la tienda?",
          answer: "¡Sí! Puedes seleccionar la opción 'Retiro en Tienda' (Pick-up) sin ningún costo adicional y recoger tu pedido listo en nuestra sede.",
        },
      ]
    : [
        {
          id: "faq_1",
          question: "¿Cuáles son los métodos de pago aceptados?",
          answer: "Aceptamos tarjetas de débito/crédito, transferencias bancarias, pagos móviles digitales y efectivo al momento de la entrega o retiro.",
        },
        {
          id: "faq_2",
          question: "¿Cómo funciona el servicio de envío o delivery?",
          answer: "Preparamos tu orden al instante y la despachamos de manera express hacia tu dirección seleccionada con seguimiento en tiempo real.",
        },
        {
          id: "faq_3",
          question: "¿Puedo retirar mi pedido personalmente en la tienda?",
          answer: "¡Por supuesto! Puedes elegir la modalidad de retiro en tienda (Pick-up) sin costos adicionales y pasar por ella cuando esté lista.",
        },
        {
          id: "faq_4",
          question: "¿Qué garantía tengo sobre los productos?",
          answer: "Garantizamos la frescura y estado óptimo de cada producto. Si tienes cualquier inconveniente, nuestro equipo de soporte te atiende de inmediato.",
        },
      ];

  const blocks: StorefrontBlock[] = [
    // 1. Ticker / Marquesina
    {
      id: "block_announcement_marquee",
      type: "announcement_marquee",
      label: "Marquesina de Anuncios",
      enabled: true,
      order: 1,
      config: {
        messages: marqueeMessages,
        speedSeconds: 22,
        bgVariant: "primary",
        iconName: "Zap",
      },
    },

    // 2. Hero Slider
    {
      id: "block_hero_slider",
      type: "hero_slider",
      label: "Banners Principales (Hero Slider)",
      enabled: true,
      order: 2,
      config: {
        autoplayIntervalMs: 5000,
        aspectRatio: "21:9",
        slides: [
          {
            id: "slide_1",
            title: `¡Bienvenido a ${businessName}!`,
            subtitle: "Calidad prémium, precios justos y entrega rápida en tu puerta.",
            imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1600&auto=format&fit=crop&q=80",
            ctaText: "Explorar Catálogo",
            ctaLink: "catalog",
            badgeText: "PROMOCIÓN DESTACADA",
            textAlignment: "left",
            overlayOpacity: 45,
          },
          {
            id: "slide_2",
            title: "Ahorra con Nuestros Combos Especiales",
            subtitle: "Aprovecha descuentos exclusivos diseñados para ti y tu negocio.",
            imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=80",
            ctaText: "Ver Ofertas",
            ctaLink: "category:promociones",
            badgeText: "HASTA 25% OFF",
            textAlignment: "left",
            overlayOpacity: 50,
          },
        ],
      },
    },

    // 3. Category Bubbles / Stories
    {
      id: "block_category_bubbles",
      type: "category_bubbles",
      label: "Historias de Categorías (Stories)",
      enabled: true,
      order: 3,
      config: {
        useAutoCategories: true,
        showLabels: true,
        bubbleShape: "circle",
      },
    },

    // 4. Flash Sale Countdown
    {
      id: "block_flash_sale",
      type: "flash_sale",
      label: "Oferta Relámpago con Cuenta Regresiva",
      enabled: true,
      order: 4,
      config: {
        title: "⚡ Venta Flash de Temporada",
        subtitle: "Precios de liquidación en productos seleccionados por tiempo limitado.",
        endsAt: new Date(Date.now() + 24 * 3600 * 1000 * 2).toISOString(),
        discountBadgeText: "HASTA 40% OFF",
      },
    },

    // 5. Featured Rails
    {
      id: "block_featured_rails",
      type: "featured_rails",
      label: "Rieles de Productos Curados",
      enabled: true,
      order: 5,
      config: {
        rails: [
          {
            id: "rail_bestsellers",
            title: "🔥 Los Más Vendidos",
            subtitle: "Los favoritos elegidos por nuestros clientes esta semana",
            filterType: "bestsellers",
            maxItems: 8,
          },
        ],
      },
    },

    // 6. Product Reels (Short Videos)
    {
      id: "block_product_reels",
      type: "product_reels",
      label: "Videos Cortos / Reels de Productos",
      enabled: false,
      order: 6,
      config: {
        autoplayOnHover: true,
        reels: [],
      },
    },

    // 7. Trust Badges
    {
      id: "block_trust_badges",
      type: "trust_badges",
      label: "Cintillo de Beneficios y Confianza",
      enabled: true,
      order: 7,
      config: {
        columns: 4,
        badges: trustBadges,
      },
    },

    // 8. Testimonials / Social Proof
    {
      id: "block_testimonials",
      type: "testimonials",
      label: "Reseñas de Clientes (Prueba Social)",
      enabled: true,
      order: 8,
      config: {
        title: "Lo que opinan nuestros clientes",
        subtitle: "Comentarios reales y verificados de compradores recientes",
        items: testimonials,
      },
    },

    // 9. Brand Story / Physical Presence
    {
      id: "block_brand_story",
      type: "brand_story",
      label: "Nuestra Historia & Local Físico",
      enabled: true,
      order: 9,
      config: {
        title: "Comprometidos con la Calidad",
        subtitle: "Conoce más sobre nuestro local y equipo de trabajo",
        storyContent:
          "Nacimos con la misión de ofrecer los mejores productos, precios competitivos y una experiencia de compra rápida y moderna para todos los hogares y comercios de la región.",
        imageUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80",
        businessHours: "Lunes a Sábado: 8:00 AM - 7:00 PM | Domingos: 8:00 AM - 2:00 PM",
        showBranchAddress: true,
      },
    },

    // 10. FAQ Accordion
    {
      id: "block_faq_accordion",
      type: "faq_accordion",
      label: "Preguntas Frecuentes (FAQ)",
      enabled: true,
      order: 10,
      config: {
        title: "Preguntas Frecuentes",
        subtitle: "Todo lo que necesitas saber antes de realizar tu compra",
        items: faqItems,
      },
    },
  ];

  return {
    version: "1.0.0",
    catalogDensity: "comfortable",
    containerWidth: "standard",
    blocks,
  };
}

export function createVenezuelaStorefrontConfig(businessName: string = "Nuestra Tienda"): StorefrontConfig {
  return createDefaultStorefrontConfig({ businessName, preset: "venezuela" });
}
