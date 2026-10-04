import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketOS | Digital Commerce",
  description: "Plataforma SaaS Multi-Tenant de Comercio Digital",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
