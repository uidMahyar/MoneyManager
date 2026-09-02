// Service Worker خزانه — نسخه‌ی کش رو عوض کن اگه فایل‌ها آپدیت شدن
// (وگرنه مرورگر نسخه‌ی قدیمی رو از کش نگه می‌داره)
const CACHE_NAME = 'khazaneh-v1';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './characters.js',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// نصب: تمام فایل‌های لازم رو یک‌جا cache کن تا آفلاین هم در دسترس باشن
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// فعال‌سازی: کش‌های نسخه‌ی قدیمی رو پاک کن
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// استراتژی cache-first: اول از کش بده (سریع + آفلاین)، اگه نبود از شبکه بگیر
// و برای دفعه‌ی بعد هم cache کن.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // اگه هم شبکه نبود و هم کش نبود، خطا برمی‌گرده (طبیعیه، اولین بارِ بدون اینترنت)
    })
  );
});
