import React from "react";
import { MarketOSRepository } from "@marketos/database";
import { AdminDashboard } from "../components/admin-dashboard";

const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

export const revalidate = 0; // Dynamic data for admin dashboard

export default async function AdminHomePage() {
  const [settings, products, orders, payments, exchangeRate, deliveryZones, drivers] =
    await Promise.all([
      MarketOSRepository.getTenantSettings(TENANT_ID),
      MarketOSRepository.getProducts(TENANT_ID),
      MarketOSRepository.getTenantOrders(TENANT_ID),
      MarketOSRepository.getTenantPayments(TENANT_ID),
      MarketOSRepository.getExchangeRate(TENANT_ID),
      MarketOSRepository.getDeliveryZones(TENANT_ID),
      MarketOSRepository.getDrivers(TENANT_ID),
    ]);

  return (
    <AdminDashboard
      settings={settings}
      products={products}
      orders={orders}
      payments={payments}
      exchangeRate={exchangeRate}
      deliveryZones={deliveryZones}
      drivers={drivers}
    />
  );
}
