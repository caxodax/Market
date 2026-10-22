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
