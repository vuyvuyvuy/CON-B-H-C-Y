"use client";
/** Danh tính thiết bị + Web Push. Chỉ chạy trên client. */

const KEY = "cbcc.deviceId";

export function detectKind(): "phone" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  // iPadOS báo UA như Mac; phân biệt bằng màn hình cảm ứng
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Android(?!.*Mobile)/.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/.test(ua)) return "phone";
  return "desktop";
}

function label() {
  const k = detectKind();
  return { phone: "Điện thoại", tablet: "iPad / tablet", desktop: "Máy tính" }[k];
}

export function getDeviceId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function registerDevice(pushSubscription?: PushSubscriptionJSON | null): Promise<string | null> {
  const res = await fetch("/api/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: getDeviceId(),
      kind: detectKind(),
      label: label(),
      ...(pushSubscription !== undefined && { pushSubscription }),
    }),
  });
  if (!res.ok) return null;
  const { id } = await res.json();
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  return id;
}

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export async function pushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // iOS Safari chỉ có PushManager khi mở từ icon ngoài màn hình chính
    const ios = /iPhone|iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    return ios ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }));
  await registerDevice(sub.toJSON());
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  await registerDevice(null);
  return "off";
}
