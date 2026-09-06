self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
