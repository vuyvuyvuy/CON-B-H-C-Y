"use client";
import { useEffect } from "react";

/**
 * Đăng ký service worker. Việc xin quyền push nằm trong nút "Bật chửi" ở Dashboard,
 * vì iOS chỉ cho xin quyền từ user gesture và chỉ khi app đã "Add to Home Screen".
 */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
