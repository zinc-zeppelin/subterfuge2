// Service Worker for Project Subterfuge (Notifications & PWA)
// ZERO-FETCH GUARANTEE: This service worker contains NO polling intervals, NO background fetch loops,
// and initiates ZERO network requests to backend serverless functions.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push payloads
self.addEventListener("push", (event) => {
  let data = { title: "SUBTERFUGE CENTRAL COMMAND", body: "New covert dispatch received." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    vibrate: [200, 100, 200],
    data: data.data || data,
    tag: data.tag || "subterfuge-alert",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "SUBTERFUGE CENTRAL COMMAND", options));
});

// Handle user clicking notification banner in Android/iOS/Desktop notification center
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if (notifData.peerId) {
            client.postMessage({ type: "OPEN_COMMUNICATION", ...notifData });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(notifData.url || "/");
      }
    })
  );
});
