/**
 * J.A.R.V.I.S. AI Progressive Web App - Tactical Service Worker
 *
 * Cache Strategy:
 * - App Shell: Pre-caches critical UI shell assets (HTML shell, icons, favicon)
 * - Static Assets: Stale-While-Revalidate for CSS, JS, fonts, static models
 * - SENSITIVE API ROUTES: NEVER CACHED! All /api/* requests (chat, conversations, status,
 *   reminders, memories, search) bypass caching completely to preserve strict confidentiality
 *   and ensure real-time accuracy without leaking secrets or chat history.
 */

const CACHE_NAME = "jarvis-shell-v1";
const OFFLINE_URL = "/";

const STATIC_PRECACHE = [
  "/",
  "/favicon.png",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Install: pre-cache critical app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[JARVIS PWA SW] Install precache warning:", err);
      })
  );
});

// Activate: clean up older caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route-aware caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER cache any API requests or non-GET requests (Strict privacy & security)
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return; // Pass through to network directly
  }

  // 2. Navigation requests (HTML pages): Network-first with app-shell fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match(OFFLINE_URL);
          return (
            fallback ||
            new Response(
              "<!DOCTYPE html><html><body style='background:#010810;color:#00f0ff;font-family:monospace;padding:24px;text-align:center;'><h2>J.A.R.V.I.S. // OFFLINE MODE</h2><p>Workstation network disconnected. Please reconnect to LAN or cellular.</p></body></html>",
              { headers: { "Content-Type": "text/html" } }
            )
          );
        })
    );
    return;
  }

  // 3. Static assets (_next/static, icons, images, GLB models): Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/models/") ||
    url.pathname === "/favicon.png"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
