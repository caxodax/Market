// ==============================================================================
// MARKETOS - SERVICE WORKER PWA & MULTI-TENANT WEB PUSH NOTIFICATIONS
// ==============================================================================

const CACHE_NAME = 'marketos-pwa-v1';

// 1. Ciclo de vida: Instalación y Activación Inmediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'MARKETOS_SW_ACTIVATED' });
        });
      }),
    ])
  );
});

// Escucha mensajes de la aplicación web (ej. forzar activación inmediata)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 2. Recepción de Notificaciones Push (Web Push API)
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'MarketOS',
      body: event.data.text() || 'Tienes una nueva notificación de la tienda.',
    };
  }

  const title = payload.title || 'MarketOS';
  const targetUrl = payload.url || '/';

  const notificationOptions = {
    body: payload.body || 'Nuevas ofertas y actualizaciones disponibles.',
    icon: payload.icon || '/brand/logo.png',
    badge: payload.badge || '/brand/logo.png',
    vibrate: [200, 100, 200],
    tag: payload.tag || 'marketos-notification',
    renotify: true,
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 3. Clic sobre la Notificación Nativa
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si el cliente ya tiene una pestaña abierta en el mismo origen, enfocar y navegar
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Si la app está cerrada en segundo plano, abrir ventana nueva en la URL indicada
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 4. Estrategia de Caché Resiliente PWA (Stale-While-Revalidate para estáticos y Network-First para navegación)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo cachear peticiones GET del mismo origen o CDNs de assets
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Excluir llamadas API o Server Actions de Next.js
  if (url.pathname.startsWith('/api/') || request.headers.get('next-action')) {
    return;
  }

  // A. Peticiones de navegación (Páginas HTML): Network First con fallback a offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return new Response(
            '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin Conexión | MarketOS</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#a1a1aa;font-size:0.9rem;max-width:320px;line-height:1.4}button{margin-top:1.5rem;padding:10px 20px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer}</style></head><body><div><h1>Sin Conexión a Internet</h1><p>No se pudo conectar con el catálogo en este momento. Revisa tu conexión a datos o Wi-Fi.</p><button onclick="window.location.reload()">Reintentar</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // B. Archivos Estáticos (JS, CSS, imágenes, fuentes): Stale-While-Revalidate
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
