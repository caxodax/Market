import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaUpdateManager } from "../components/pwa/pwa-update-manager";

export const viewport: Viewport = {
  themeColor: "#DC2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "MarketOS | Digital Commerce",
  description: "Plataforma SaaS Multi-Tenant de Comercio Digital",
  applicationName: "MarketOS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MarketOS",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <body className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden w-full max-w-full">
        {children}
        <PwaUpdateManager />
      </body>
    </html>
  );
}
