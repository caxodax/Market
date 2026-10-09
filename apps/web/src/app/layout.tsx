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
    <html lang="es" className="overflow-x-hidden">
      <body className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden w-full max-w-full">
        {children}
      </body>
    </html>
  );
}
