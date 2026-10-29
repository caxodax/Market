# Catálogo y Roadmap del Ecosistema de Plugins — MarketOS

> **Filosofía de Ingeniería (ECC & Ponytail ULTRA)**:
> 1. **Core-Isolation Radical**: El núcleo del eCommerce (Auth, Carrito, Pedidos, Catálogo, RLS) permanece intacto y ultraligero. Cada plugin es un paquete modular en `packages/plugins/` que extiende capacidades mediante contratos, tablas independientes o metadatos JSONB.
> 2. **Cero Sobre-ingeniería (YAGNI)**: No creamos plugins por capricho tecnológico. Cada módulo resuelve un dolor operativo concreto que le hace ganar más dinero al comerciante o le ahorra tiempo operativo crítico.
> 3. **Monetización Clara**: Cada plugin está diseñado como un *add-on* de suscripción o diferenciador comercial para planes Pro y Enterprise.

---

## 📌 Estado Actual de Plugins en MarketOS

| Plugin ID | Nombre Comercial | Categoría | Estado | Propósito Principal |
| :--- | :--- | :--- | :---: | :--- |
| `food_service` | Gastronomía, Fast Food & Restaurantes | Restauración | **Completado** | BOM (escandallo), recetas, modificadores de salsas y extras. |
| `mto_cpq` | Make-to-Order & CPQ (Cotizador Taller) | Fabricación | **Completado** | Matrices por m²/lineal/volumen, costeo Cost-Plus, fichas de taller sin precios y anticipos. |
| `storefront_pro` | Vitrina Visual Pro & Layout Studio | Marketing | **Completado** | Maquetador de 11 bloques modulares con reordenación dinámica ⬆️/⬇️ arriba/abajo del Catálogo y layout Full-Width. |
| `local_venezuela` | Localización Oficial Venezuela | Finanzas | **Completado** | Tasa BCV automática en vivo, Pago Móvil, doble display USD/VES e IGTF. |
| `delivery_fleet` | Delivery Propio & Motorizados | Logística | **Parcial (Core)** | Zonas de despacho, tarifas fijas y asignación de choferes. |
| `promotions_coupons` | Marketing, Cupones & Descuentos | Ventas | **Parcial (Core)** | Códigos de descuento fijos o porcentuales con límites de uso. |
| `barcode_retail` | Retail, Supermercados & Bodegones | Comercio Físico | **Registrado** | Códigos EAN-13/UPC, empaques, bultos y pasillos. |
| `clothing_variants` | Moda, Calzado & Indumentaria | Retail Moda | **Registrado** | Matriz de tallas y colores independientes con stock por SKU. |
| `local_colombia` | Localización Oficial Colombia | Finanzas | **Registrado** | TRM oficial, cobro en COP, Nequi, Daviplata, PSE y NIT/DIAN. |
| `local_global` | Localización Global en Dólares | Finanzas | **Registrado** | Operación pura USD, Stripe, tarjetas de crédito internacionales y PayPal. |
| `analytics` | Analítica, Audiencia & Conversión | Marketing & Ventas | **Completado** | Tráfico web, visitantes únicos, canales (Instagram/WhatsApp/Google), páginas más vistas y conversión. |

---

## 🚀 Nuevas Opciones de Plugins por Categoría de Impacto

---

### 1. Mostrador, Caja & Operaciones Omnicanal

#### `pos_cashier` — Punto de Venta Mostrador & Ticket Térmico ESC/POS
* **Dolor de Negocio**: El 90% de los comercios tiene local físico y catálogo web. Vender en mostrador les exige registrar ventas a mano o usar un sistema paralelo que desincroniza el inventario.
* **Funcionalidades Clave**:
  - Interfaz de caja táctil de alta velocidad con teclado numérico y atajos `F1-F12`.
  - Cobro mixto en tiempo real (ej. $10 en Efectivo + $15 en Pago Móvil + $5 en Tarjeta).
  - Conversión instantánea de vuelto/cambio en bolívares o dólares a la tasa del día.
  - Impresión de ticket térmico estándar (58mm y 80mm) con 1 clic mediante WebUSB o Bluetooth nativo.
  - Control de turnos y cuadre de caja ciego (apertura, retiros y arqueo final).
* **Monetización**: Add-on de $10 - $25 USD / mes por caja activa.

#### `inventory_transfers` — Traslados Entre Sedes & Almacenes Centrales
* **Dolor de Negocio**: Comercios con más de una sede o con depósito central no pueden mover mercancía de forma controlada sin perder existencias en el camino.
* **Funcionalidades Clave**:
  - Solicitud de traslado de stock entre Sede A y Sede B.
  - Generación de Guía de Remisión/Despacho con código QR.
  - Estado "En Tránsito" (la mercancía ya salió de la Sede A pero aún no está disponible en la B).
  - Recepción con verificación ciega y resolución de faltantes o mermas.
* **Monetización**: Incluido en planes multi-sede (Planes Enterprise).

#### `smart_weight_scale` — Balanza Digital & Venta por Peso / Granel
* **Dolor de Negocio**: Fruterías, carnicerías, charcuterías, pescaderías y reposterías venden productos fraccionados por kilogramos o gramos, no por unidad fija.
* **Funcionalidades Clave**:
  - Conexión con balanzas electrónicas mediante Web Serial API o Bluetooth.
  - Decodificación automática de códigos de barra generados por balanzas de mostrador (formato `20XXXXXPPPPC` donde se codifica peso o importe).
  - Ajuste de tara automático y cálculo de precio por peso en fracciones decimales.
* **Monetización**: Add-on de $15 USD / mes para retail de alimentos y frescos.

---

### 2. Canales de Venta, Marketing & Conversión Directa

#### `whatsapp_commerce` — Automatización de Ventas & Bot de WhatsApp
* **Dolor de Negocio**: Los clientes en Latinoamérica exigen atención inmediata por WhatsApp. El comerciante pierde hasta 5 horas al día respondiendo las mismas preguntas y confirmando comprobantes.
* **Funcionalidades Clave**:
  - Notificaciones automáticas de pedidos: *"Tu pedido #1042 ya fue aceptado"*, *"Está en preparación"*, *"El repartidor va en camino"*.
  - Envío automático de ticket de compra en PDF con QR de rastreo.
  - Recuperación de carritos abandonados: mensaje recordatorio automático a las 2 horas con link para completar pedido.
  - Botón de recompra rápida: *"¿Quieres pedir lo mismo de la semana pasada con 1 clic?"*.
* **Monetización**: Add-on de $15 - $30 USD / mes (según volumen de mensajes).

#### `social_catalog_sync` — Sincronización Meta, TikTok & Google Shopping
* **Dolor de Negocio**: Los comerciantes quieren que sus productos se muestren en Instagram Shopping, Facebook Shop, TikTok Shop y Google Shopping sin tener que cargar la información manualmente en cada plataforma.
* **Funcionalidades Clave**:
  - Generación dinámica de feeds estandarizados en XML y CSV (Google Merchant RSS / Meta Catalog).
  - Sincronización automática de precios, fotos, descripciones y disponibilidad de stock en tiempo real.
  - Atribución de tráfico mediante parámetros UTM en los enlaces del catálogo.
* **Monetización**: Incluido en planes Pro / Growth.

#### `affiliates_referrals` — Red de Afiliados, Embajadores & Comisiones
* **Dolor de Negocio**: Las marcas quieren pagar a influencers o clientes solo cuando generen ventas reales, en lugar de gastar presupuestos en publicidad a ciegas.
* **Funcionalidades Clave**:
  - Generación de enlaces y cupones únicos por embajador (`?ref=mariana`).
  - Tracking de cookies de atribución (15 a 30 días).
  - Panel privado para el embajador: visualización de clics, ventas referidas y comisiones ganadas.
  - Liquidación de comisiones periódicas con comprobante de pago.
* **Monetización**: Comisión del 2% al 5% sobre ventas referidas o add-on mensual.

#### `review_social_proof` — Reseñas con Fotos & Prueba Social Verificada
* **Dolor de Negocio**: La desconfianza frena compras online de marcas locales. Los testimonios con fotos reales de clientes multiplican la tasa de conversión por 3.
* **Funcionalidades Clave**:
  - Solicitud automática de reseña por WhatsApp/email 24 horas después de la entrega.
  - Carga de fotos reales del producto recibido.
  - Insignia de "Comprador Verificado" vinculada a un pedido real.
  - Carrusel de prueba social para fichas de producto y página principal.
* **Monetización**: Módulo de conversión para planes Pro.

---

### 3. Logística & Despachos Avanzados

#### `live_tracking_geo` — Rastreo en Vivo del Motorizado (Estilo Uber)
* **Dolor de Negocio**: Los clientes saturan al comercio con llamadas y mensajes preguntando: *"¿Por dónde viene el delivery?"*.
* **Funcionalidades Clave**:
  - PWA ultra-ligera para el motorizado: transmite coordenadas GPS en segundo plano solo durante entregas activas.
  - Pantalla interactiva de rastreo para el cliente usando Leaflet y OpenStreetMap (**100% gratuito sin pagar API de Google Maps**).
  - Visualización del motorizado en movimiento con cálculo de tiempo estimado de llegada.
* **Monetización**: Add-on de $10 - $20 USD / mes.

#### `carrier_aggregators` — Encomiendas Nacionales & Couriers
* **Dolor de Negocio**: Tiendas que hacen envíos fuera de su ciudad tienen que ir a la agencia de envíos a llenar planillas a mano y escribir los números de guía uno a uno.
* **Funcionalidades Clave**:
  - Integración o exportación estandarizada para couriers (MRW, Zoom, Tealca en Venezuela; Servientrega, Coordinadora en Colombia; DHL/FedEx).
  - Generación de etiquetas de despacho con código de barras en formato térmico adhesivo (4x6 pulgadas).
  - Cálculo de costo de flete según peso real y peso volumétrico ($L \times W \times H / 5000$).
  - Campo de tracking oficial para que el cliente consulte el estado directamente en la web del courier.
* **Monetización**: Tarifa fija por guía emitida o add-on mensual.

---

### 4. Fidelización, LTV & Retención de Clientes

#### `loyalty_wallet` — Monedero Virtual, Puntos & Cashback
* **Dolor de Negocio**: El cliente compra una sola vez y no regresa. El comercio necesita una palanca de recompra sin regalar márgenes en publicidad.
* **Funcionalidades Clave**:
  - Sistema de Cashback configurable (ej. *Recibe el 5% de tu compra en saldo monedero*).
  - Monedero virtual visible en el perfil del cliente en el PWA.
  - Canje de saldo en el checkout como forma de pago parcial o total.
  - Niveles de fidelidad (Bronce, Plata, Oro) con delivery gratis o regalos sorpresa en cumpleaños.
* **Monetización**: Add-on de fidelización de $15 USD / mes.

#### `recurring_subscriptions` — Suscripciones & Pedidos Programados
* **Dolor de Negocio**: Comercios de consumo recurrente (café en grano, alimento para mascotas, botellones de agua, pañales, clubes de vinos o membresías) tienen que llamar al cliente cada mes para cobrar.
* **Funcionalidades Clave**:
  - Frecuencias de entrega programadas (semanal, quincenal, mensual).
  - Generación automática de pedidos en la fecha programada.
  - Envío automático del link de pago o débito recurrente.
  - Panel para que el cliente pause, cambie de dirección o reactive su suscripción con 1 clic.
* **Monetización**: Cobro por porcentaje de facturación recurrente o add-on de $25 USD / mes.

#### `gift_cards_store_credit` — Tarjetas de Regalo & Saldo a Favor
* **Dolor de Negocio**: Clientes que quieren regalar una compra a un familiar o devoluciones donde no se entrega dinero en efectivo sino crédito de la tienda.
* **Funcionalidades Clave**:
  - Emisión de Gift Cards digitales con código alfanumérico o QR.
  - Aplicación como crédito en cuenta o nota de crédito tras una devolución de producto.
  - Control de caducidad y saldos remanentes.
* **Monetización**: Módulo disponible en planes intermedios.

---

### 5. B2B, Mayoristas & Abastecimiento

#### `b2b_wholesale` — Portal Mayorista, Precios por Escala & MOQ
* **Dolor de Negocio**: Fabricantes y distribuidores no pueden venderle a clientes finales y a tiendas revendedoras en la misma vitrina porque los precios y condiciones son confidenciales.
* **Funcionalidades Clave**:
  - Registro de clientes B2B con aprobación manual requerida por el dueño.
  - Listas de precios diferenciadas (Detalle, Revendedor, Mayorista, Gran Distribuidor).
  - Cantidades mínimas de compra (MOQ) por producto o por bulto sellado.
  - Solicitudes de crédito comercial con plazo de pago (15 / 30 / 60 días).
* **Monetización**: Add-on premium de $30 - $50 USD / mes para empresas de distribución.

#### `purchases_suppliers` — Compras, Proveedores & Cuentas por Pagar
* **Dolor de Negocio**: El comerciante sabe lo que vende, pero no sabe cuándo debe reponer mercancía ni cuánto le debe a cada proveedor.
* **Funcionalidades Clave**:
  - Directorio de proveedores con datos de contacto, condiciones de crédito y plazos.
  - Órdenes de compra (Purchase Orders) con recepción parcial o total de inventario.
  - Recálculo automático del Precio Medio Ponderado (PMP) de los productos al ingresar nueva factura de compra.
  - Alertas de inventario bajo el punto de reorden.
* **Monetización**: Módulo ERP básico para negocios en crecimiento.

---

### 6. Citas, Turnos & Servicios

#### `booking_appointments` — Reservas, Turnos & Agendamiento por Horario
* **Dolor de Negocio**: Negocios que venden servicios y tiempo (barberías, salones de belleza, spas, consultorios médicos, canchas de pádel, talleres mecánicos) no venden ítems empacados.
* **Funcionalidades Clave**:
  - Calendario de disponibilidad por profesional, sillón o cancha.
  - Selección de fecha, bloque horario y servicio deseado.
  - Pago de anticipo o seña para asegurar la cita.
  - Recordatorios automáticos por WhatsApp 2 horas antes de la cita para reducir el ausentismo (no-show).
* **Monetización**: Add-on de $15 - $25 USD / mes (abre todo el mercado de servicios a MarketOS).

#### `digital_tickets_events` — Entradas a Eventos con Validación QR
* **Dolor de Negocio**: Discotecas, bares, conferencias, masterclasses y eventos quieren vender entradas por internet sin pagar comisiones abusivas a tiqueteras externas.
* **Funcionalidades Clave**:
  - Venta de entradas por zonas (General, VIP, Mesa).
  - Generación de boleto digital descargable con código QR criptográfico firmado.
  - Scanner PWA para el personal en la puerta: validación instantánea con la cámara ("Ticket Válido", "Ticket Ya Escaneado").
* **Monetización**: Comisión del 2% al 4% por boleto vendido.

---

### 7. Finanzas Avanzadas & Inteligencia de Negocio

#### `ai_business_copilot` — Copiloto de Inteligencia & Predicción de Stock
* **Dolor de Negocio**: Los dueños de pequeños comercios no tienen tiempo de analizar gráficos ni tablas de Excel para tomar decisiones comerciales.
* **Funcionalidades Clave**:
  - Análisis proactivo de tendencias con IA: *"Tu producto estrella se quedará sin inventario en 4 días al ritmo actual de ventas; contacta al proveedor hoy"*.
  - Detección de horarios pico y sugerencias de campañas flash.
  - Alerta de reactivación de clientes inactivos: *"50 clientes habituales no han comprado en los últimos 20 días; presiona aquí para enviarles un cupón por WhatsApp"*.
* **Monetización**: Add-on de $20 USD / mes o incluido en planes Enterprise.

#### `fiscal_invoicing` — Facturación Fiscal Electrónica & Control Tributario
* **Dolor de Negocio**: Cumplimiento legal exigido por el fisco en cada país (SENIAT e impresoras fiscales en Venezuela; DIAN en Colombia; SAT en México).
* **Funcionalidades Clave**:
  - Módulo puente para impresoras fiscales Bixolon, The Factory HKA y Dascom (Venezuela).
  - Generación de comprobante fiscal digital con número de factura, número de control y reporte Z diario.
  - Emisión de facturas electrónicas XML firmadas con código QR reglamentario.
* **Monetización**: Add-on de $20 - $40 USD / mes por la complejidad técnica y legal que resuelve.

---

## 📊 Matriz de Priorización Estratégica (Impacto vs Esfuerzo)

```mermaid
quadrantChart
    title Priorización de Plugins para MarketOS
    x-axis Esfuerzo de Desarrollo (Bajo --> Alto)
    y-axis Impacto en Ventas y Monetización (Bajo --> Alto)
    quadrant-1 Prioridad Inmediata (Quick Wins)
    quadrant-2 Grandes Proyectos Estratégicos
    quadrant-3 Evaluar a Demanda
    quadrant-4 Complejidad Alta / Menor Retorno
    "whatsapp_commerce": [0.35, 0.95]
    "pos_cashier": [0.45, 0.92]
    "loyalty_wallet": [0.30, 0.80]
    "b2b_wholesale": [0.40, 0.85]
    "live_tracking_geo": [0.55, 0.78]
    "booking_appointments": [0.50, 0.75]
    "social_catalog_sync": [0.25, 0.70]
    "inventory_transfers": [0.48, 0.65]
    "smart_weight_scale": [0.52, 0.60]
    "recurring_subscriptions": [0.58, 0.72]
    "purchases_suppliers": [0.65, 0.68]
    "ai_business_copilot": [0.45, 0.70]
    "fiscal_invoicing": [0.80, 0.88]
    "digital_tickets_events": [0.35, 0.58]
    "affiliates_referrals": [0.38, 0.62]
```

---

## 🎯 Recomendación de Secuencia de Implementación

1. **Paso 1 (Omnicanal Inmediato)**: Desarrollar `pos_cashier` (Punto de Venta Mostrador con ticket térmico).
   - *Razón*: El comercio físico no puede vivir solo del eCommerce; necesita cobrar en mostrador con el mismo inventario.
2. **Paso 2 (Automatización de Ventas)**: Desarrollar `whatsapp_commerce` (Notificaciones automáticas y carritos abandonados).
   - *Razón*: Reduce el tiempo del comerciante a la mitad y dispara la conversión un 30%.
3. **Paso 3 (Retención & Frecuencia)**: Desarrollar `loyalty_wallet` (Cashback en monedero virtual).
   - *Razón*: Convierte compradores ocasionales en clientes recurrentes sin gastar en marketing.
