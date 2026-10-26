self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Bệnh nhân đang chờ", {
      body: data.body || "Vào kê đơn đi.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "nag", // gộp thông báo, không xếp chồng 10 cái
      renotify: true,
      data: { url: data.url || "/er" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
