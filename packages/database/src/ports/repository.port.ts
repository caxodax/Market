/**
 * ═══════════════════════════════════════════════════════════════════════
 * MarketOS — Puertos de Repositorio (Hexagonal Architecture)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Estos interfaces definen los CONTRATOS que cualquier implementación
 * de base de datos debe cumplir (Supabase, MySQL, SQL Server, MongoDB, etc.)
 *
 * La lógica de negocio depende SOLO de estos puertos.
 * Los adapters (Supabase, MySQL) implementan estos puertos.
 *
 * Estructura:
 *   - ITenantRepository     → Tenants y configuración
 *   - IStoreRepository      → Sucursales / tiendas
 *   - ICategoryRepository   → Categorías de productos
 *   - IProductRepository    → Catálogo de productos
 *   - IInventoryRepository  → Stock e inventario
 *   - IExchangeRateRepository → Tasas de cambio (BCV, manual)
 *   - IDeliveryZoneRepository → Zonas de entrega
 *   - ICouponRepository     → Cupones de descuento
 *   - IDriverRepository     → Motoristas / repartidores
 *   - IOrderRepository      → Pedidos y items
 *   - IPaymentRepository    → Comprobantes de pago
 *   - ICustomerRepository   → Clientes y fidelización
 *   - IAuditLogRepository   → Trazabilidad / auditoría
 *   - IUserRepository       → Perfiles de usuario y staff
 *   - IPushNotificationRepository → Suscripciones push y logs
 *   - IPlatformRepository   → Super Admin / SaaS multi-tenant
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
  Tenant,
  TenantSettings,
  Store,
  Category,
  Product,
  ExchangeRate,
  RateHistoryItem,
  DeliveryZone,
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
  Driver,
  Order,
  OrderItem,
  OrderStatus,
  PaymentProof,
  PaymentStatus,
  SalesAnalytics,
  Customer,
  CustomerAccountSummary,
  AuditLog,
  RecordAuditLogInput,
  AuditLogFilters,
  InventoryMovement,
  UserProfile,
  UserRole,
  InviteStaffInput,
  CreateProductInput,
  UpdateProductInput,
  PushSubscriptionRecord,
  SavePushSubscriptionInput,
  PushNotificationLog,
  PushStats,
  TenantWithDetails,
  PlatformMetrics,
  OnboardTenantInput,
  SubscriptionPlan,
  SubscriptionPlanTier,
  TenantStatus,
  PaymentMethodType,
  CreatePlatformUserInput,
  TenantSubscription,
  TenantPlanLimits,
  QuotaCheckResult,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CreateDriverInput,
  UpdateDriverInput,
} from "@marketos/types";

// ═══════════════════════════════════════════════════════════════════════
// INPUT TYPES — Definidos aquí para evitar dependencias circulares
// ═══════════════════════════════════════════════════════════════════════

export interface CreateOrderInput {
  tenantId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerIdNumber?: string;
  customerEmail?: string;
  deliveryType: import("@marketos/types").DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryFeeUsd?: number;
  couponCode?: string;
  discountUsd?: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
  }[];
  notes?: string;
  idempotencyKey?: string;
}

export interface SubmitPaymentInput {
  tenantId: string;
  orderId: string;
  method: PaymentMethodType;
  bankName?: string;
  referenceNumber: string;
  amount: number;
  currency?: "VES" | "USD";
  proofImageUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// TENANT — Gestión de inquilinos y su configuración
// ═══════════════════════════════════════════════════════════════════════

export interface ITenantRepository {
  /**
   * Buscar Tenant por ID, Slug o Dominio Personalizado
   */
  getTenant(idOrSlugOrDomain: string): Promise<Tenant | null>;

  /**
   * Obtener configuración de branding, pagos y operaciones del Tenant
   */
  getTenantSettings(tenantId: string): Promise<TenantSettings>;

  /**
   * Actualizar configuración del Tenant (branding, pagos, operaciones)
   */
  updateTenantSettings(
    tenantId: string,
    updates: Partial<TenantSettings>
  ): Promise<TenantSettings>;

  /**
   * Obtener suscripción activa del Tenant
   */
  getTenantSubscription(tenantId: string): Promise<TenantSubscription | null>;

  /**
   * Obtener plan, límites y cuotas operativas del Tenant
   */
  getTenantPlanLimits(tenantId: string): Promise<TenantPlanLimits>;
}

// ═══════════════════════════════════════════════════════════════════════
// STORE — Sucursales / tiendas físicas
// ═══════════════════════════════════════════════════════════════════════

export interface IStoreRepository {
  /**
   * Listar sucursales del Tenant
   */
  getStores(tenantId: string, includeInactive?: boolean): Promise<Store[]>;

  /**
   * Crear nueva sucursal
   */
  createStore(input: {
    tenantId: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    isActive?: boolean;
  }): Promise<Store>;

  /**
   * Actualizar datos de sucursal
   */
  updateStore(
    storeId: string,
    updates: Partial<Store>
  ): Promise<Store | null>;
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY — Categorías del catálogo de productos
// ═══════════════════════════════════════════════════════════════════════

export interface ICategoryRepository {
  /**
   * Listar categorías activas del Tenant, ordenadas por sort_order
   */
  getCategories(tenantId: string): Promise<Category[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// PRODUCT — Catálogo de productos
// ═══════════════════════════════════════════════════════════════════════

export interface IProductRepository {
  /**
   * Listar productos activos con stock, filtro opcional por categoría y búsqueda
   */
  getProducts(
    tenantId: string,
    categoryId?: string,
    query?: string
  ): Promise<(Product & { stock: number })[]>;

  /**
   * Crear nuevo producto con stock inicial
   */
  createProduct(input: CreateProductInput): Promise<Product>;

  /**
   * Actualizar producto existente
   */
  updateProduct(input: UpdateProductInput): Promise<Product | null>;

  /**
   * Eliminar producto (soft delete o hard delete)
   */
  deleteProduct(tenantId: string, productId: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// INVENTORY — Stock e inventario por sucursal
// ═══════════════════════════════════════════════════════════════════════

export interface IInventoryRepository {
  /**
   * Ajustar stock de un producto (positivo = restock, negativo = venta)
   * Retorna la cantidad final
   */
  adjustStock(
    tenantId: string,
    productId: string,
    delta: number,
    storeId?: string,
    reason?: string
  ): Promise<number>;

  /**
   * Restaurar stock cuando un pedido es cancelado o pago rechazado
   */
  restoreOrderInventoryStock(
    tenantId: string,
    orderId: string
  ): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════
// EXCHANGE RATE — Tasas de cambio (BCV, manual, historial)
// ═══════════════════════════════════════════════════════════════════════

export interface IExchangeRateRepository {
  /**
   * Obtener tasa de cambio activa del Tenant
   */
  getExchangeRate(tenantId: string): Promise<ExchangeRate>;

  /**
   * Obtener historial de tasas de cambio
   */
  getExchangeRateHistory(
    tenantId?: string,
    limit?: number
  ): Promise<RateHistoryItem[]>;

  /**
   * Sincronizar tasa BCV desde API externa
   */
  syncBcvRateFromApi(tenantId: string): Promise<ExchangeRate>;

  /**
   * Guardar tasa de cambio manual (contingencia)
   */
  saveManualExchangeRate(
    tenantId: string,
    data: {
      date_rate: string;
      usd_rate: number;
      eur_rate?: number;
      usdt_rate?: number;
      source?: string;
    }
  ): Promise<ExchangeRate>;
}

// ═══════════════════════════════════════════════════════════════════════
// DELIVERY ZONE — Zonas de entrega
// ═══════════════════════════════════════════════════════════════════════

export interface IDeliveryZoneRepository {
  /**
   * Listar zonas de entrega del Tenant (por defecto sólo activas, o todas si includeInactive = true)
   */
  getDeliveryZones(tenantId: string, includeInactive?: boolean): Promise<DeliveryZone[]>;

  /**
   * Crear nueva zona de entrega
   */
  createDeliveryZone(input: CreateDeliveryZoneInput): Promise<DeliveryZone>;

  /**
   * Actualizar datos y tarifa de zona de entrega
   */
  updateDeliveryZone(input: UpdateDeliveryZoneInput): Promise<DeliveryZone | null>;

  /**
   * Desactivar (soft-delete) o reactivar zona de entrega
   */
  toggleDeliveryZoneStatus(
    tenantId: string,
    zoneId: string,
    isActive: boolean
  ): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// COUPON — Cupones de descuento
// ═══════════════════════════════════════════════════════════════════════

export interface ICouponRepository {
  /**
   * Validar un cupón para un monto de pedido
   */
  validateCoupon(
    tenantId: string,
    code: string,
    orderAmountUsd: number
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discountUsd: number;
    message?: string;
  }>;

  /**
   * Listar todos los cupones del Tenant
   */
  getCoupons(tenantId: string): Promise<Coupon[]>;

  /**
   * Crear nuevo cupón
   */
  createCoupon(input: CreateCouponInput): Promise<Coupon>;

  /**
   * Actualizar cupón existente
   */
  updateCoupon(input: UpdateCouponInput): Promise<Coupon | null>;

  /**
   * Activar/desactivar cupón
   */
  toggleCoupon(
    tenantId: string,
    couponId: string,
    isActive: boolean
  ): Promise<Coupon | null>;

  /**
   * Eliminar cupón
   */
  deleteCoupon(tenantId: string, couponId: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// DRIVER — Motoristas / repartidores
// ═══════════════════════════════════════════════════════════════════════

export interface IDriverRepository {
  /**
   * Listar repartidores del Tenant (por defecto sólo activos, o todos si includeInactive = true)
   */
  getDrivers(tenantId: string, includeInactive?: boolean): Promise<Driver[]>;

  /**
   * Registrar nuevo repartidor
   */
  createDriver(input: CreateDriverInput): Promise<Driver>;

  /**
   * Actualizar datos del repartidor
   */
  updateDriver(input: UpdateDriverInput): Promise<Driver | null>;

  /**
   * Desactivar (soft-delete) o reactivar repartidor
   */
  toggleDriverStatus(
    tenantId: string,
    driverId: string,
    isActive: boolean
  ): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// ORDER — Pedidos, items y estado operativo
// ═══════════════════════════════════════════════════════════════════════


export interface IOrderRepository {
  /**
   * Crear un pedido con items, descuentos, delivery y customer lookup
   */
  createOrder(input: CreateOrderInput): Promise<Order>;

  /**
   * Listar pedidos del Tenant con enrichment (items, customer, payment, store)
   */
  getTenantOrders(tenantId: string): Promise<Order[]>;

  /**
   * Actualizar estado del pedido (y asignar motorista si aplica)
   */
  updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    driverId?: string,
    actorId?: string
  ): Promise<Order | null>;

  /**
   * Buscar pedidos de un cliente por teléfono, cédula, email o número de orden
   */
  getCustomerOrders(
    tenantId: string,
    phoneOrId: string
  ): Promise<Order[]>;

  /**
   * Calcular analytics de ventas con filtros de rango y sucursal
   */
  getSalesAnalytics(
    tenantId: string,
    filter?: {
      dateRange?: "today" | "week" | "month" | "all";
      storeId?: string;
    }
  ): Promise<SalesAnalytics>;
}

// ═══════════════════════════════════════════════════════════════════════
// PAYMENT — Comprobantes de pago y revisión
// ═══════════════════════════════════════════════════════════════════════


export interface IPaymentRepository {
  /**
   * Registrar comprobante de pago para un pedido
   */
  submitPaymentProof(input: SubmitPaymentInput): Promise<PaymentProof>;

  /**
   * Listar pagos del Tenant
   */
  getTenantPayments(tenantId: string): Promise<PaymentProof[]>;

  /**
   * Aprobar o rechazar un pago (actualiza orden automáticamente)
   */
  reviewPayment(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    rejectionReason?: string,
    actorId?: string
  ): Promise<PaymentProof | null>;
}

// ═══════════════════════════════════════════════════════════════════════
// CUSTOMER — Clientes, fidelización y consulta de cuenta
// ═══════════════════════════════════════════════════════════════════════

export interface ICustomerRepository {
  /**
   * Obtener perfil, historial de pedidos y puntos de fidelización
   */
  getCustomerOrdersAndPoints(
    tenantId: string,
    phoneOrEmail: string
  ): Promise<CustomerAccountSummary | null>;
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT LOG — Trazabilidad y auditoría
// ═══════════════════════════════════════════════════════════════════════

export interface IAuditLogRepository {
  /**
   * Registrar evento de auditoría
   */
  recordAuditLog(input: RecordAuditLogInput): Promise<AuditLog>;

  /**
   * Listar logs de auditoría del Tenant
   */
  getAuditLogs(tenantId: string, limit?: number): Promise<AuditLog[]>;

  /**
   * Listar logs de auditoría globales de toda la red con filtros avanzados
   */
  getGlobalAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// USER — Perfiles de usuario y gestión de staff
// ═══════════════════════════════════════════════════════════════════════

export interface IUserRepository {
  /**
   * Obtener perfil de usuario por UUID o email
   */
  getUserProfile(userIdOrEmail: string): Promise<UserProfile | null>;

  /**
   * Listar todos los perfiles de la plataforma (Super Admin)
   */
  getAllProfiles(): Promise<UserProfile[]>;

  /**
   * Listar staff del Tenant
   */
  getTenantStaff(tenantId: string): Promise<UserProfile[]>;

  /**
   * Invitar nuevo miembro del staff
   */
  inviteStaffMember(input: InviteStaffInput): Promise<UserProfile>;

  /**
   * Crear o invitar usuario de plataforma / comercio (Super Admin)
   */
  createPlatformUser(input: CreatePlatformUserInput): Promise<UserProfile>;

  /**
   * Actualizar perfil de usuario (rol, datos o asignación de tenant)
   */
  updateUserProfile(
    userId: string,
    data: Partial<UserProfile>
  ): Promise<UserProfile | null>;

  /**
   * Cambiar rol de un miembro del staff
   */
  updateStaffRole(
    tenantId: string,
    userId: string,
    newRole: UserRole
  ): Promise<UserProfile | null>;

  /**
   * Eliminar o revocar acceso de un usuario
   */
  deleteUserProfile(userId: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Suscripciones y logs de notificaciones push
// ═══════════════════════════════════════════════════════════════════════

export interface IPushNotificationRepository {
  /**
   * Guardar o actualizar suscripción push del navegador
   */
  savePushSubscription(
    input: SavePushSubscriptionInput
  ): Promise<PushSubscriptionRecord>;

  /**
   * Obtener suscripciones push del Tenant
   */
  getPushSubscriptions(tenantId: string): Promise<PushSubscriptionRecord[]>;

  /**
   * Eliminar suscripción push por endpoint
   */
  deletePushSubscription(endpoint: string): Promise<void>;

  /**
   * Registrar log de notificación push enviada
   */
  recordPushNotificationLog(input: {
    tenantId: string;
    title: string;
    body: string;
    url: string;
    targetType: string;
    sentCount: number;
    createdBy?: string | null;
  }): Promise<PushNotificationLog>;

  /**
   * Listar logs de notificaciones push del Tenant
   */
  getPushNotificationLogs(
    tenantId: string,
    limit?: number
  ): Promise<PushNotificationLog[]>;

  /**
   * Obtener estadísticas de push del Tenant
   */
  getPushStats(tenantId: string): Promise<PushStats>;
}

// ═══════════════════════════════════════════════════════════════════════
// PLATFORM — Super Admin SaaS (multi-tenant management)
// ═══════════════════════════════════════════════════════════════════════

export interface IPlatformRepository {
  /**
   * Listar todos los tenants con detalles (stores, products, orders, revenue)
   */
  getAllTenants(): Promise<TenantWithDetails[]>;

  /**
   * Obtener métricas globales de la plataforma
   */
  getPlatformMetrics(): Promise<PlatformMetrics>;

  /**
   * Obtener planes de suscripción disponibles
   */
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;

  /**
   * Onboarding de nuevo tenant (crear tenant, settings, store, suscripción)
   */
  onboardTenant(input: OnboardTenantInput): Promise<TenantWithDetails>;

  /**
   * Cambiar estado de un tenant (active, suspended, inactive)
   */
  updateTenantStatus(
    tenantId: string,
    status: TenantStatus,
    actorId?: string
  ): Promise<Tenant | null>;

  /**
   * Renovar o registrar pago de suscripción de un tenant
   */
  renewTenantSubscription(
    tenantId: string,
    durationDays: number,
    paymentMethod: string,
    reference?: string
  ): Promise<TenantSubscription>;

  /**
   * Cambiar plan de suscripción de un tenant
   */
  changeTenantPlan(
    tenantId: string,
    planTier: SubscriptionPlanTier
  ): Promise<TenantSubscription>;

  /**
   * Obtener suscripción de un tenant
   */
  getTenantSubscription(tenantId: string): Promise<TenantSubscription | null>;

  /**
   * Obtener límites y cuotas operativas de un tenant
   */
  getTenantPlanLimits(tenantId: string): Promise<TenantPlanLimits>;
}

// ═══════════════════════════════════════════════════════════════════════
// AUTH PROVIDER — Autenticación (independiente de Supabase Auth)
// ═══════════════════════════════════════════════════════════════════════

export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export interface IAuthProvider {
  /**
   * Autenticar usuario con email y contraseña
   */
  signIn(email: string, password: string): Promise<AuthResult>;

  /**
   * Cerrar sesión del usuario actual
   */
  signOut(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════
// STORAGE PROVIDER — Subida de archivos (independiente de Supabase Storage)
// ═══════════════════════════════════════════════════════════════════════

export type StorageFolder = "products" | "proofs" | "branding" | "documents";

export interface UploadFileInput {
  tenantId: string;
  folder: StorageFolder;
  fileName: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType: string;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface IStorageProvider {
  /**
   * Subir archivo al almacenamiento
   */
  upload(input: UploadFileInput): Promise<UploadResult>;

  /**
   * Eliminar archivo por key
   */
  delete(key: string): Promise<void>;

  /**
   * Obtener URL pública de un archivo
   */
  getUrl(key: string): string;

  /**
   * Listar archivos de un tenant
   */
  listFiles(tenantId: string, folder?: StorageFolder): Promise<{ key: string; size?: number }[]>;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE — Agrupa todos los repositorios en una sola interfaz
// ═══════════════════════════════════════════════════════════════════════

/**
 * Interfaz principal que agrupa todos los repositorios.
 * El Factory crea la implementación concreta según la configuración.
 *
 * Uso:
 *   const repos = createRepositories({ driver: 'supabase' });
 *   const tenant = await repos.tenants.getTenant('shop-market-ca');
 */
export interface IMarketOSRepositories {
  tenants: ITenantRepository;
  stores: IStoreRepository;
  categories: ICategoryRepository;
  products: IProductRepository;
  inventory: IInventoryRepository;
  exchangeRates: IExchangeRateRepository;
  deliveryZones: IDeliveryZoneRepository;
  coupons: ICouponRepository;
  drivers: IDriverRepository;
  orders: IOrderRepository;
  payments: IPaymentRepository;
  customers: ICustomerRepository;
  auditLogs: IAuditLogRepository;
  users: IUserRepository;
  pushNotifications: IPushNotificationRepository;
  platform: IPlatformRepository;
  auth: IAuthProvider;
  storage: IStorageProvider;
}
