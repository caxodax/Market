import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketOS | Portal de Administración",
  description: "Panel de control para comerciantes y administradores de tienda",
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
