export default function SuperAdminHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6 p-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold tracking-wide uppercase">
          MarketOS Platform Master
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Super Admin Console
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión centralizada de inquilinos, métricas globales, cuotas de
          almacenamiento y aprovisionamiento SaaS.
        </p>
      </div>
    </main>
  );
}
