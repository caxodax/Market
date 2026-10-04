export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6 p-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
          Fase 0 Foundation
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          MarketOS
        </h1>
        <p className="text-sm text-muted-foreground">
          Arquitectura Multi-Tenant preparada para más de 100 comercios.
          Inquilino inicial:{" "}
          <span className="font-semibold text-foreground">
            Shop Market C.A.
          </span>
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <div className="h-6 w-6 rounded-full bg-brand-red border border-black/10" title="Shop Market Red" />
          <div className="h-6 w-6 rounded-full bg-brand-black border border-white/20" title="Shop Market Black" />
          <div className="h-6 w-6 rounded-full bg-brand-white border border-gray-300" title="Shop Market White" />
        </div>
      </div>
    </main>
  );
}
