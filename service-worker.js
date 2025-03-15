// CÓDIGO SERVICE WORKER (service-worker.js)
// ========================================


// service-worker.js
const CACHE_NAME = 'tokens-me-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de caché: Network First, con fallback a caché
self.addEventListener('fetch', event => {
  // Excluir peticiones a APIs externas o analíticas
  if (
    event.request.url.includes('api.ipify.org') ||
    event.request.url.includes('analytics')
  ) {
    return;
  }
  
  // Manejar peticiones de tiles de mapa específicamente
  if (event.request.url.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('map-tiles-cache').then(cache => {
        return cache.match(event.request).then(response => {
          // Si está en caché, usar ese resultado
          if (response) {
            // Aún así, intentar actualizar la caché en segundo plano
            fetch(event.request).then(networkResponse => {
              cache.put(event.request, networkResponse.clone());
            }).catch(() => {
              console.log('No se pudo actualizar el tile del mapa');
            });
            return response;
          }
          
          // Si no está en caché, intentar la red
          return fetch(event.request).then(networkResponse => {
            // Guardar en caché para uso futuro
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Si la red falla y no hay caché, mostrar un tile genérico
            return new Response('Tile no disponible', {
              status: 404,
              headers: {'Content-Type': 'text/plain'}
            });
          });
        });
      })
    );
    return;
  }
  
  // Para el resto de recursos, usar strategy network-first
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar la respuesta para guardarla en caché y devolverla
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Solo cachear respuestas válidas
          if (response.status === 200) {
            cache.put(event.request, responseClone);
          }
        });
        return response;
      })
      .catch(() => {
        // Si la red falla, intentar usar la caché
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Si el recurso no está en caché y estamos offline, mostrar página offline
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          
          // Para otros recursos, devolver error
          return new Response('Recurso no disponible sin conexión', {
            status: 503,
            headers: {'Content-Type': 'text/plain'}
          });
        });
      })
  );
});

// Manejar notificaciones push
self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Nueva notificación de Tokens.ME',
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tokens.ME', options)
  );
});

// Manejar clic en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
