import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PwaUpdateManager } from "../components/pwa/pwa-update-manager";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

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
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${outfit.variable} overflow-x-clip`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-clip w-full max-w-full">
        {children}
        <Toaster position="top-right" richColors closeButton />
        <PwaUpdateManager />
      </body>
    </html>
  );
}
