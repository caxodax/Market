export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6 p-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold tracking-wide uppercase">
          Tenant Admin Portal
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Panel de Administración
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de catálogo, inventario por sucursal, pedidos y validación de
          pagos multimoneda con aislamiento estricto por{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
            tenant_id
          </code>
          .
        </p>
      </div>
    </main>
  );
}
