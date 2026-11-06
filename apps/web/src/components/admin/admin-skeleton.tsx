import React from "react";

export function AdminHeaderSkeleton() {
  return (
    <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2.5">
        <div className="w-28 h-5 rounded-full skeleton-shimmer bg-muted" />
        <div className="w-64 h-8 rounded-xl skeleton-shimmer bg-muted" />
        <div className="w-80 max-w-full h-4 rounded-lg skeleton-shimmer bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-32 h-10 rounded-xl skeleton-shimmer bg-muted shrink-0" />
        <div className="w-28 h-10 rounded-xl skeleton-shimmer bg-muted shrink-0" />
      </div>
    </div>
  );
}

export function AdminKpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card p-5 rounded-2xl border border-border/80 shadow-xs relative overflow-hidden space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-24 h-3.5 rounded-md skeleton-shimmer bg-muted" />
            <div className="w-10 h-10 rounded-2xl skeleton-shimmer bg-muted" />
          </div>
          <div className="w-32 h-9 rounded-xl skeleton-shimmer bg-muted" />
          <div className="w-28 h-3 rounded-md skeleton-shimmer bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function AdminFilterBarSkeleton() {
  return (
    <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="w-full lg:w-96 h-11 rounded-xl skeleton-shimmer bg-muted" />
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="w-28 h-10 rounded-xl skeleton-shimmer bg-muted" />
          <div className="w-28 h-10 rounded-xl skeleton-shimmer bg-muted" />
          <div className="w-28 h-10 rounded-xl skeleton-shimmer bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-border/60 flex justify-between items-center bg-muted/30">
        <div className="w-36 h-5 rounded-md skeleton-shimmer bg-muted" />
        <div className="w-20 h-6 rounded-full skeleton-shimmer bg-muted" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="p-4 sm:px-6 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-2xl skeleton-shimmer bg-muted shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-xs">
                <div className="w-36 h-4 rounded-md skeleton-shimmer bg-muted" />
                <div className="w-24 h-3 rounded-md skeleton-shimmer bg-muted" />
              </div>
            </div>
            <div className="hidden sm:block w-32 h-4 rounded-md skeleton-shimmer bg-muted" />
            <div className="w-24 h-7 rounded-full skeleton-shimmer bg-muted shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPageSkeleton({
  title = "Cargando sección...",
  subtitle = "Obteniendo datos en tiempo real de la base de datos",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-6 animate-view-enter p-4 sm:p-6 lg:p-8">
      <AdminHeaderSkeleton />
      <AdminKpiGridSkeleton />
      <AdminFilterBarSkeleton />
      <AdminTableSkeleton />
    </div>
  );
}
