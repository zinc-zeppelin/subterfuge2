/**
 * Universal Cross-Platform Notification Manager for Project Subterfuge
 * 
 * Supports:
 * - Android Chrome (strictly requires ServiceWorkerRegistration.showNotification)
 * - Desktop Chrome / Firefox / Edge / Safari (supports ServiceWorker and new Notification)
 * - iOS Safari 16.4+ (requires PWA standalone mode and ServiceWorkerRegistration.showNotification)
 * 
 * ZERO-FETCH GUARANTEE:
 * This utility operates 100% client-side. It initiates zero HTTP requests to Vercel
 * serverless functions and consumes zero server compute.
 */

export interface NotificationResult {
  success: boolean;
  permission: NotificationPermission;
  error?: string;
}

export type ExtendedNotificationOptions = NotificationOptions & {
  vibrate?: number[];
  renotify?: boolean;
  data?: Record<string, unknown>;
};

let cachedRegistration: ServiceWorkerRegistration | null = null;

/**
 * Detects if the current user agent is iOS (iPhone, iPad, iPod)
 */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1)
  );
}

/**
 * Detects if the web application is running in PWA standalone mode
 */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    Boolean(typeof navigator !== "undefined" && (navigator as { standalone?: boolean }).standalone)
  );
}

/**
 * Checks if notifications are supported in the current environment
 */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    typeof window.Notification !== "undefined"
  );
}

/**
 * Registers the notification service worker if supported
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (cachedRegistration) {
    return cachedRegistration;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    cachedRegistration = reg;
    return reg;
  } catch (err) {
    console.warn("[Notifications] Service worker registration failed:", err);
    return null;
  }
}

/**
 * Requests browser notification permission with cross-platform support
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return "denied";
  }

  try {
    registerNotificationServiceWorker().catch(() => {});
    const permission = await window.Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("[Notifications] Permission request error:", err);
    return (window.Notification && window.Notification.permission) || "default";
  }
}

/**
 * Dispatches a covert operational notification across Android Chrome, iOS PWA, and desktop browsers
 */
export async function dispatchCovertNotification(
  title: string,
  options: ExtendedNotificationOptions = {}
): Promise<NotificationResult> {
  if (!isNotificationSupported()) {
    return {
      success: false,
      permission: "denied",
      error: "Web Notifications are not supported in this browser.",
    };
  }

  const currentPermission = window.Notification.permission;
  if (currentPermission !== "granted") {
    return {
      success: false,
      permission: currentPermission,
      error:
        currentPermission === "denied"
          ? "Notifications are blocked in your browser or site settings."
          : "Notification authorization required.",
    };
  }

  // Enhanced default options for Cold War tactical theme
  const mergedOptions: ExtendedNotificationOptions = {
    icon: "/icon.svg",
    badge: "/icon.svg",
    vibrate: [200, 100, 200],
    tag: options.tag || "subterfuge-alert",
    renotify: true,
    ...options,
  };

  // Method 1: Service Worker showNotification (Mandatory for Android Chrome & iOS PWA)
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      let reg: ServiceWorkerRegistration | null = cachedRegistration;
      if (!reg) {
        const found = await navigator.serviceWorker.getRegistration();
        reg = found || null;
      }
      if (!reg) {
        reg = await registerNotificationServiceWorker();
      }

      if (reg) {
        // Wait until service worker is active or ready
        const readyReg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<ServiceWorkerRegistration>((resolve) => setTimeout(() => resolve(reg!), 1500)),
        ]);

        if (readyReg && typeof readyReg.showNotification === "function") {
          await readyReg.showNotification(title, mergedOptions as NotificationOptions);
          return { success: true, permission: "granted" };
        }
      }
    } catch (swErr) {
      console.warn("[Notifications] Service Worker showNotification failed, trying desktop fallback:", swErr);
    }
  }

  // Method 2: Desktop window constructor fallback (Chrome, Edge, Firefox, Desktop Safari)
  try {
    const notif = new window.Notification(title, mergedOptions);
    if (options.data?.peerId && typeof window !== "undefined") {
      notif.onclick = () => {
        window.focus();
        window.postMessage({ type: "OPEN_COMMUNICATION", ...options.data }, "*");
        notif.close();
      };
    }
    return { success: true, permission: "granted" };
  } catch (constructorErr) {
    const errorMsg = constructorErr instanceof Error ? constructorErr.message : String(constructorErr);
    console.error("[Notifications] Notification constructor failed:", errorMsg);
    return {
      success: false,
      permission: "granted",
      error: `Notification dispatch failed: ${errorMsg}`,
    };
  }
}
