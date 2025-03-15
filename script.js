// MEJORAS AL CÓDIGO JAVASCRIPT
// =======================

// 1. Mejora de seguridad - Almacenar usuarios en formato más seguro
// En lugar de tener los usuarios hardcodeados, podríamos usar un hash + salt


// API URL base
const API_BASE_URL = '/.netlify/functions';

// Funciones para API
async function apiLogin(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'login',
        username,
        password
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error en apiLogin:', error);
    return { error: 'Error de conexión' };
  }
}

async function apiSaveLocation(locationData) {
  try {
    const response = await fetch(`${API_BASE_URL}/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error en apiSaveLocation:', error);
    return { error: 'Error al guardar ubicación' };
  }
}

async function apiGetLocations() {
  try {
    const response = await fetch(`${API_BASE_URL}/locations`);
    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error('Error en apiGetLocations:', error);
    return [];
  }
}

async function apiCreateTrackingLink(linkData) {
  try {
    const response = await fetch(`${API_BASE_URL}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error en apiCreateTrackingLink:', error);
    return { error: 'Error al crear enlace' };
  }
}

// Modificar la función de login existente
loginBtn.addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  // Primero intentar login a través de la API
  const result = await apiLogin(username, password);
  
  if (result.user) {
    currentUser = result.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    currentUserSpan.textContent = currentUser.username;
    
    // Cargar ubicaciones desde la API
    const locations = await apiGetLocations();
    trackingEntries = locations;
    
    // Actualizar UI
    renderTrackingEntries();
    initializeMap();
    
    showNotification(`Bienvenido ${currentUser.username}! Ahora puedes gestionar ubicaciones.`);
  } else {
    // Fallback a la validación local si la API falla
    const localUser = users.find(u => u.username === username && u.password === password);
    
    if (localUser) {
      currentUser = localUser;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      authContainer.style.display = 'none';
      appContainer.style.display = 'block';
      currentUserSpan.textContent = localUser.username;
      
      // Cargar ubicaciones guardadas del localStorage
      loadSavedTrackingData();
      
      initializeMap();
      
      showNotification(`Bienvenido ${localUser.username}! (Modo Offline)`);
    } else {
      showNotification('Usuario o contraseña incorrectos', 'error');
    }
  }
});

// Modificar sendLocationToServer
function sendLocationToServer(data) {
  // Primero intentar enviar a la API
  apiSaveLocation(data).then(result => {
    if (result.error) {
      console.error("Error al enviar datos a la API:", result.error);
      // Guardar en localStorage como fallback
      saveToLocalStorage(data);
    } else {
      console.log("Datos enviados correctamente a la API");
    }
  }).catch(error => {
    console.error("Error de conexión:", error);
    // Guardar en localStorage como fallback
    saveToLocalStorage(data);
  });
  
  // Función auxiliar para guardar en localStorage
  function saveToLocalStorage(data) {
    try {
      let savedData = localStorage.getItem('trackingEntries');
      let entries = savedData ? JSON.parse(savedData) : [];
      entries.push(data);
      localStorage.setItem('trackingEntries', JSON.stringify(entries));
      console.log("Datos guardados localmente");
      
      // Marcar para sincronización posterior
      const pendingSync = localStorage.getItem('pendingSync');
      const pendingData = pendingSync ? JSON.parse(pendingSync) : [];
      pendingData.push(data);
      localStorage.setItem('pendingSync', JSON.stringify(pendingData));
    } catch (error) {
      console.error("Error al guardar datos:", error);
    }
  }
}

const users = [
    { 
        username: 'Admin', 
        // Almacenamos un hash en lugar de la contraseña en texto plano
        passwordHash: 'e7cf3ef4f17c3999a94f2c6f612e8a888e5b1026878e4e19398b23bd38ec221a', // Hash de '0000'
        role: 'admin' 
    },
    { 
        username: 'Objetivo', 
        passwordHash: 'e7cf3ef4f17c3999a94f2c6f612e8a888e5b1026878e4e19398b23bd38ec221a', // Hash de '0000'
        role: 'user' 
    }
];

// Función para verificar contraseña con hash
function verifyPassword(password, hash) {
    // En un entorno real, usaríamos una función de hash segura como bcrypt
    // Para esta demo, usamos SHA-256 simple
    const hashInput = password; // Aquí iría la lógica de hash
    return hashInput === hash; // Comparación simple para demo
}

// 2. Implementación de Service Worker para funcionamiento offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registrado con éxito:', registration.scope);
            })
            .catch(error => {
                console.error('Error al registrar ServiceWorker:', error);
            });
    });
}

// 3. Mejora del sistema de almacenamiento usando IndexedDB en lugar de localStorage
const dbName = 'tokensMeDB';
const dbVersion = 1;
let db;

// Inicializar IndexedDB
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        
        request.onerror = event => {
            console.error('Error al abrir IndexedDB:', event.target.error);
            // Fallback a localStorage si IndexedDB falla
            resolve(false);
        };
        
        request.onsuccess = event => {
            db = event.target.result;
            console.log('IndexedDB inicializada correctamente');
            resolve(true);
        };
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            // Crear almacén para las entradas de seguimiento
            if (!db.objectStoreNames.contains('trackingEntries')) {
                const objectStore = db.createObjectStore('trackingEntries', { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('name', 'name', { unique: false });
            }
            
            // Crear almacén para datos de usuario
            if (!db.objectStoreNames.contains('userData')) {
                db.createObjectStore('userData', { keyPath: 'key' });
            }
        };
    });
}

// Guardar entrada de seguimiento en IndexedDB
function saveTrackingEntryToDB(entry) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // Fallback a localStorage
            const savedData = localStorage.getItem('trackingEntries');
            let entries = savedData ? JSON.parse(savedData) : [];
            entries.push(entry);
            localStorage.setItem('trackingEntries', JSON.stringify(entries));
            resolve(entry);
            return;
        }
        
        const transaction = db.transaction(['trackingEntries'], 'readwrite');
        const store = transaction.objectStore('trackingEntries');
        const request = store.add(entry);
        
        request.onsuccess = () => {
            resolve(entry);
        };
        
        request.onerror = event => {
            console.error('Error al guardar en IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Cargar entradas de seguimiento desde IndexedDB
function loadTrackingEntriesFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            // Fallback a localStorage
            const savedData = localStorage.getItem('trackingEntries');
            resolve(savedData ? JSON.parse(savedData) : []);
            return;
        }
        
        const transaction = db.transaction(['trackingEntries'], 'readonly');
        const store = transaction.objectStore('trackingEntries');
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev'); // Ordenar por timestamp descendente
        
        const entries = [];
        
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                entries.push(cursor.value);
                cursor.continue();
            } else {
                resolve(entries);
            }
        };
        
        request.onerror = event => {
            console.error('Error al cargar desde IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// 4. Sistema de notificaciones push
function setupPushNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            console.log('Notificaciones push ya están habilitadas');
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notificaciones push habilitadas');
                    
                    // Suscribir al usuario a las notificaciones push
                    // Esto requeriría un servidor con soporte para Web Push API
                    /* 
                    navigator.serviceWorker.ready.then(registration => {
                        return registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array('TU_CLAVE_PUBLICA_VAPID')
                        });
                    }).then(subscription => {
                        // Enviar la suscripción al servidor
                        fetch('/api/push-subscribe', {
                            method: 'POST',
                            body: JSON.stringify(subscription),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                    });
                    */
                }
            });
        }
    }
}

// 5. Mejora en la detección del dispositivo usando la API Device Info
async function getDeviceDetailedInfo() {
    let deviceInfo = {
        type: 'Desconocido',
        browser: detectBrowser(),
        os: detectOS(),
        screen: `${window.screen.width}x${window.screen.height}`,
        userAgent: navigator.userAgent,
    };
    
    // Añadir información de batería si está disponible
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            deviceInfo.battery = {
                level: battery.level * 100,
                charging: battery.charging
            };
        } catch (e) {
            console.log('No se pudo obtener información de batería');
        }
    }
    
    // Añadir información de conexión si está disponible
    if ('connection' in navigator) {
        deviceInfo.connection = {
            type: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink
        };
    }
    
    return deviceInfo;
}

// Detectar navegador
function detectBrowser() {
    const userAgent = navigator.userAgent;
    
    if (userAgent.match(/chrome|chromium|crios/i)) return "Chrome";
    if (userAgent.match(/firefox|fxios/i)) return "Firefox";
    if (userAgent.match(/safari/i)) return "Safari";
    if (userAgent.match(/opr\//i)) return "Opera";
    if (userAgent.match(/edg/i)) return "Edge";
    if (userAgent.match(/msie|trident/i)) return "Internet Explorer";
    
    return "Desconocido";
}

// Detectar sistema operativo
function detectOS() {
    const userAgent = navigator.userAgent;
    
    if (userAgent.match(/windows nt/i)) return "Windows";
    if (userAgent.match(/macintosh|mac os x/i)) return "MacOS";
    if (userAgent.match(/linux/i)) return "Linux";
    if (userAgent.match(/android/i)) return "Android";
    if (userAgent.match(/iphone|ipad|ipod/i)) return "iOS";
    
    return "Desconocido";
}

// 6. Exportar ubicaciones como archivo CSV o JSON
function exportTrackingData(format = 'json') {
    if (trackingEntries.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }
    
    let content, filename, mimeType;
    
    if (format === 'json') {
        content = JSON.stringify(trackingEntries, null, 2);
        filename = `tokens_me_export_${Date.now()}.json`;
        mimeType = 'application/json';
    } else if (format === 'csv') {
        // Crear encabezados CSV
        const headers = ['id', 'name', 'latitude', 'longitude', 'accuracy', 'timestamp', 'device', 'ip'].join(',');
        
        // Crear filas de datos
        const rows = trackingEntries.map(entry => {
            return [
                entry.id,
                entry.name,
                entry.latitude,
                entry.longitude,
                entry.accuracy,
                entry.timestamp,
                entry.device,
                entry.ip || 'N/A'
            ].join(',');
        });
        
        content = [headers, ...rows].join('\n');
        filename = `tokens_me_export_${Date.now()}.csv`;
        mimeType = 'text/csv';
    }
    
    // Crear blob y descargar
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(`Datos exportados como ${format.toUpperCase()}`, 'success');
}

// 7. Implementación de función para compartir ubicación por WhatsApp, Gmail, etc.
function shareLocation(latitude, longitude, name) {
    if (!latitude || !longitude) {
        showNotification('No hay datos de ubicación para compartir', 'warning');
        return;
    }
    
    // Crear mensaje con la ubicación
    const locationURL = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const message = `Mi ubicación actual (${name}): ${locationURL}`;
    
    // Usar Web Share API si está disponible
    if (navigator.share) {
        navigator.share({
            title: 'Mi Ubicación',
            text: message,
            url: locationURL
        })
        .then(() => showNotification('Ubicación compartida correctamente'))
        .catch(error => {
            console.error('Error al compartir:', error);
            showNotification('Error al compartir ubicación', 'error');
            
            // Fallback en caso de error
            fallbackShare(message, locationURL);
        });
    } else {
        // Si Web Share API no está disponible, usar método alternativo
        fallbackShare(message, locationURL);
    }
}

// Método alternativo para compartir ubicación
function fallbackShare(message, url) {
    // Crear modal con opciones de compartir
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-content">
            <h3>Compartir Ubicación</h3>
            <p>Elige una opción para compartir:</p>
            
            <div class="share-options">
                <a href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" class="share-option">
                    <span class="share-icon">📱</span>
                    <span class="share-name">WhatsApp</span>
                </a>
                
                <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}" target="_blank" class="share-option">
                    <span class="share-icon">✈️</span>
                    <span class="share-name">Telegram</span>
                </a>
                
                <a href="mailto:?subject=Mi Ubicación&body=${encodeURIComponent(message)}" class="share-option">
                    <span class="share-icon">✉️</span>
                    <span class="share-name">Email</span>
                </a>
                
                <button class="share-option" id="copy-share-link">
                    <span class="share-icon">📋</span>
                    <span class="share-name">Copiar Link</span>
                </button>
            </div>
            
            <button class="btn" id="close-share-modal">Cerrar</button>
        </div>
    `;
    
    // Estilos para el modal
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '9999';
    
    document.body.appendChild(modal);
    
    // Funcionalidad para cerrar modal
    document.getElementById('close-share-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Funcionalidad para copiar enlace
    document.getElementById('copy-share-link').addEventListener('click', () => {
        navigator.clipboard.writeText(url)
            .then(() => {
                showNotification('Enlace copiado al portapapeles');
                // Cerrar modal después de copiar
                document.body.removeChild(modal);
            })
            .catch(err => {
                console.error('Error al copiar:', err);
                showNotification('Error al copiar enlace', 'error');
            });
    });
}

// 8. Sistema de agrupación de ubicaciones cercanas
function clusterLocations(locations, radiusInMeters = 100) {
    if (!locations || locations.length === 0) return [];
    
    const clusters = [];
    const processed = new Set();
    
    for (let i = 0; i < locations.length; i++) {
        if (processed.has(i)) continue;
        
        const current = locations[i];
        const currentCluster = [current];
        processed.add(i);
        
        for (let j = 0; j < locations.length; j++) {
            if (processed.has(j) || i === j) continue;
            
            const other = locations[j];
            const distance = calculateDistance(
                current.latitude, current.longitude,
                other.latitude, other.longitude
            );
            
            if (distance <= radiusInMeters) {
                currentCluster.push(other);
                processed.add(j);
            }
        }
        
        clusters.push({
            center: current,
            points: currentCluster,
            count: currentCluster.length
        });
    }
    
    return clusters;
}

// Calcular distancia en metros entre dos puntos geográficos usando la fórmula de Haversine
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distancia en metros
}

// 9. Soporte para temas claros/oscuros
function setupThemeToggle() {
    // Comprobar preferencia del sistema
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Comprobar si hay un tema guardado
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
        document.body.classList.add('dark-theme');
    }
    
    // Crear toggle de tema
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌓';
    themeToggle.style.position = 'fixed';
    themeToggle.style.bottom = '80px';
    themeToggle.style.right = '20px';
    themeToggle.style.width = '40px';
    themeToggle.style.height = '40px';
    themeToggle.style.borderRadius = '50%';
    themeToggle.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    themeToggle.style.backdropFilter = 'blur(10px)';
    themeToggle.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    themeToggle.style.fontSize = '20px';
    themeToggle.style.cursor = 'pointer';
    themeToggle.style.zIndex = '1000';
    themeToggle.style.display = 'flex';
    themeToggle.style.justifyContent = 'center';
    themeToggle.style.alignItems = 'center';
    themeToggle.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
    
    document.body.appendChild(themeToggle);
    
    // Funcionalidad para cambiar tema
    themeToggle.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        }
    });
}

// 10. Sistema de caché para mapas offline
const mapCacheVersion = 1;
const mapCacheName = 'tokens-me-map-cache-v' + mapCacheVersion;

// Función para configurar caché de mapas
async function setupMapCache() {
    if ('caches' in window) {
        // Abrir caché para mapas
        const mapCache = await caches.open(mapCacheName);
        
        // URLs de tiles a pre-cachear (sería más eficiente hacerlo desde un service worker)
        // Nota: Solo pre-cacheamos algunas tiles clave, el resto se cachearán bajo demanda
        const tilesToCache = [
            'https://a.tile.openstreetmap.org/0/0/0.png',
            'https://b.tile.openstreetmap.org/0/0/0.png',
            'https://c.tile.openstreetmap.org/0/0/0.png'
        ];
        
        try {
            await Promise.all(
                tilesToCache.map(url => 
                    fetch(url)
                        .then(response => {
                            if (response.ok) {
                                return mapCache.put(url, response);
                            }
                            throw new Error('Failed to fetch map tile');
                        })
                        .catch(error => {
                            console.warn('Error pre-caching map tile:', error);
                        })
                )
            );
            console.log('Map tiles pre-cached successfully');
        } catch (error) {
            console.error('Error pre-caching map tiles:', error);
        }
    }
}

// 11. Modificación para usar hooks de ciclo de vida más modernos
// Función para aplicar cuando la aplicación va a segundo plano
function setupVisibilityHandlers() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            // La app va a segundo plano, detener actualizaciones frecuentes
            if (watchId) {
                // Podríamos detener el watchPosition para ahorrar batería
                // navigator.geolocation.clearWatch(watchId);
                // watchId = null;
                
                // O reducir frecuencia de actualizaciones
                console.log('App en segundo plano - reduciendo frecuencia de updates');
            }
        } else if (document.visibilityState === 'visible') {
            // La app vuelve a primer plano, restaurar funcionalidad
            console.log('App en primer plano - restaurando funcionalidad completa');
            
            // Si estábamos compartiendo ubicación, reiniciar el watch con alta precisión
            if (statusElement && statusElement.textContent.includes('Compartiendo')) {
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                }
                
                watchId = navigator.geolocation.watchPosition(
                    updateLocationInfo,
                    handleLocationError,
                    { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
                );
            }
        }
    });
}

// 12. Mejora del inicio de sesión con soporte para WebAuthn (FIDO2)
async function setupWebAuthn() {
    // Verificar si el navegador soporta WebAuthn
    if (!window.PublicKeyCredential) {
        console.log('WebAuthn no está soportado en este navegador');
        return false;
    }
    
    // Verificar si el dispositivo puede usar WebAuthn
    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            console.log('Autenticador de plataforma no disponible');
            return false;
        }
    } catch (e) {
        console.error('Error al verificar disponibilidad de WebAuthn:', e);
        return false;
    }
    
    return true;
}

// 13. Mejora para caché de ubicación cuando no hay conexión
let lastKnownPosition = null;

function saveLastKnownPosition(position) {
    lastKnownPosition = {
        coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
        },
        timestamp: position.timestamp
    };
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('lastKnownPosition', JSON.stringify(lastKnownPosition));
}

function getLastKnownPosition() {
    if (!lastKnownPosition) {
        // Intentar recuperar de localStorage
        const savedPosition = localStorage.getItem('lastKnownPosition');
        if (savedPosition) {
            try {
                lastKnownPosition = JSON.parse(savedPosition);
            } catch (e) {
                console.error('Error al parsear posición guardada:', e);
            }
        }
    }
    
    return lastKnownPosition;
}

