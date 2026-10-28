export type { CreateOrderInput, SubmitPaymentInput } from "./repositories/order.repository.ts";

import {
  AuditRepository,
  ExchangeRateRepository,
  DeliveryRepository,
  CouponRepository,
  TenantRepository,
  CatalogRepository,
  OrderRepository,
  ProfileRepository,
  FoodServiceRepository,
  CpqRepository,
} from "./repositories/index.ts";

/**
 * Unified MarketOS Facade Repository.
 * Channels requests cleanly to specialized domain repositories,
 * eliminating monolithic duplication and context bloat.
 */
export class MarketOSRepository {
  // --- Tenant & Platform ---
  static getTenant = TenantRepository.getTenant;
  static getTenantSettings = TenantRepository.getTenantSettings;
  static updateTenantSettings = TenantRepository.updateTenantSettings;
  static getAllTenants = TenantRepository.getAllTenants;
  static getPlatformMetrics = TenantRepository.getPlatformMetrics;
  static getPlatformStorageTelemetry = TenantRepository.getPlatformStorageTelemetry;
  static getTenantStorageTelemetry = TenantRepository.getTenantStorageTelemetry;
  static getPlatformBiAnalytics = TenantRepository.getPlatformBiAnalytics;
  static getSubscriptionPlans = TenantRepository.getSubscriptionPlans;
  static onboardTenant = TenantRepository.onboardTenant;
  static updateTenantStatus = TenantRepository.updateTenantStatus;
  static renewTenantSubscription = TenantRepository.renewTenantSubscription;
  static changeTenantPlan = TenantRepository.changeTenantPlan;
  static getTenantSubscription = TenantRepository.getTenantSubscription;
  static getTenantPlan = TenantRepository.getTenantPlan;
  static getTenantPlanLimits = TenantRepository.getTenantPlanLimits;
  static getPlatformSettings = TenantRepository.getPlatformSettings;
  static updatePlatformSettings = TenantRepository.updatePlatformSettings;
  static getTenantModules = TenantRepository.getTenantModules;
  static getTenantActiveModuleIds = TenantRepository.getTenantActiveModuleIds;
  static isModuleActiveForTenant = TenantRepository.isModuleActiveForTenant;
  static setTenantModuleStatus = TenantRepository.setTenantModuleStatus;

  // --- Catalog, Products & Inventory ---
  static getStores = CatalogRepository.getStores;
  static createStore = CatalogRepository.createStore;
  static updateStore = CatalogRepository.updateStore;
  static getCategories = CatalogRepository.getCategories;
  static getProducts = CatalogRepository.getProducts;
  static createProduct = CatalogRepository.createProduct;
  static updateProduct = CatalogRepository.updateProduct;
  static deleteProduct = CatalogRepository.deleteProduct;
  static adjustStock = CatalogRepository.adjustStock;
  static getProductBarcodes = CatalogRepository.getProductBarcodes;
  static upsertProductBarcode = CatalogRepository.upsertProductBarcode;
  static deleteProductBarcode = CatalogRepository.deleteProductBarcode;
  static findProductByBarcode = CatalogRepository.findProductByBarcode;
  static updateInventoryLocation = CatalogRepository.updateInventoryLocation;

  // --- Orders, Payments & Checkout ---
  static createOrder = OrderRepository.createOrder;
  static submitPaymentProof = OrderRepository.submitPaymentProof;
  static getTenantOrders = OrderRepository.getTenantOrders;
  static getSalesAnalytics = OrderRepository.getSalesAnalytics;
  static getTenantPayments = OrderRepository.getTenantPayments;
  static reviewPayment = OrderRepository.reviewPayment;
  static restoreOrderInventoryStock = OrderRepository.restoreOrderInventoryStock;
  static updateOrderStatus = OrderRepository.updateOrderStatus;
  static registerPhysicalFiscalInvoice = OrderRepository.registerPhysicalFiscalInvoice;
  static getCustomerOrdersAndPoints = OrderRepository.getCustomerOrdersAndPoints;
  static getCustomerOrders = OrderRepository.getCustomerOrders;

  // --- Profiles & Staff ---
  static getAllProfiles = ProfileRepository.getAllProfiles;
  static createPlatformUser = ProfileRepository.createPlatformUser;
  static updateUserProfile = ProfileRepository.updateUserProfile;
  static deleteUserProfile = ProfileRepository.deleteUserProfile;
  static getTenantStaff = ProfileRepository.getTenantStaff;
  static inviteStaffMember = ProfileRepository.inviteStaffMember;
  static updateStaffRole = ProfileRepository.updateStaffRole;
  static getUserProfile = ProfileRepository.getUserProfile;
  static savePushSubscription = ProfileRepository.savePushSubscription;
  static getPushSubscriptions = ProfileRepository.getPushSubscriptions;
  static deletePushSubscription = ProfileRepository.deletePushSubscription;
  static recordPushNotificationLog = ProfileRepository.recordPushNotificationLog;
  static getPushNotificationLogs = ProfileRepository.getPushNotificationLogs;
  static getPushStats = ProfileRepository.getPushStats;

  // --- Food Service ---
  static getRawMaterials = FoodServiceRepository.getRawMaterials;
  static saveRawMaterial = FoodServiceRepository.saveRawMaterial;
  static deleteRawMaterial = FoodServiceRepository.deleteRawMaterial;
  static getProductRecipe = FoodServiceRepository.getProductRecipe;
  static getProductRecipes = FoodServiceRepository.getProductRecipes;
  static saveProductRecipe = FoodServiceRepository.saveProductRecipe;
  static getProductModifierGroups = FoodServiceRepository.getProductModifierGroups;
  static saveProductModifierGroup = FoodServiceRepository.saveProductModifierGroup;
  static deductRecipeInventoryForOrder = FoodServiceRepository.deductRecipeInventoryForOrder;
  static restoreRecipeInventoryForOrder = FoodServiceRepository.restoreRecipeInventoryForOrder;

  // --- CPQ ---
  static getTenantCpqSettings = CpqRepository.getTenantCpqSettings;
  static saveTenantCpqSettings = CpqRepository.saveTenantCpqSettings;
  static getCpqPricingMatrices = CpqRepository.getCpqPricingMatrices;
  static saveCpqPricingMatrix = CpqRepository.saveCpqPricingMatrix;
  static getCpqMatrixAttributeOptions = CpqRepository.getCpqMatrixAttributeOptions;
  static createCpqQuote = CpqRepository.createCpqQuote;
  static getCpqQuotes = CpqRepository.getCpqQuotes;
  static convertQuoteToOrder = CpqRepository.convertQuoteToOrder;
  static getCpqOrderMilestone = CpqRepository.getCpqOrderMilestone;
  static recordCpqMilestonePayment = CpqRepository.recordCpqMilestonePayment;
  static updateCpqMilestoneDispatchAllowance = CpqRepository.updateCpqMilestoneDispatchAllowance;

  // --- Exchange Rates ---
  static getExchangeRate = ExchangeRateRepository.getExchangeRate;
  static getExchangeRateHistory = ExchangeRateRepository.getExchangeRateHistory;
  static syncBcvRateFromApi = ExchangeRateRepository.syncBcvRateFromApi;
  static saveManualExchangeRate = ExchangeRateRepository.saveManualExchangeRate;

  // --- Delivery & Drivers ---
  static getDeliveryZones = DeliveryRepository.getDeliveryZones;
  static createDeliveryZone = DeliveryRepository.createDeliveryZone;
  static updateDeliveryZone = DeliveryRepository.updateDeliveryZone;
  static toggleDeliveryZoneStatus = DeliveryRepository.toggleDeliveryZoneStatus;
  static getDrivers = DeliveryRepository.getDrivers;
  static createDriver = DeliveryRepository.createDriver;
  static updateDriver = DeliveryRepository.updateDriver;
  static toggleDriverStatus = DeliveryRepository.toggleDriverStatus;

  // --- Coupons ---
  static validateCoupon = CouponRepository.validateCoupon;
  static getCoupons = CouponRepository.getCoupons;
  static createCoupon = CouponRepository.createCoupon;
  static updateCoupon = CouponRepository.updateCoupon;
  static toggleCoupon = CouponRepository.toggleCoupon;
  static deleteCoupon = CouponRepository.deleteCoupon;

  // --- Audit ---
  static recordAuditLog = AuditRepository.recordAuditLog;
  static getAuditLogs = AuditRepository.getAuditLogs;
  static getGlobalAuditLogs = AuditRepository.getGlobalAuditLogs;
}
