import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isIos,
  isStandalonePwa,
  isNotificationSupported,
  requestNotificationPermission,
  dispatchCovertNotification,
} from "@/lib/utils/notifications";

describe("Universal Notifications Utility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Environment Detection", () => {
    it("detects iOS user agent correctly", () => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      });
      expect(isIos()).toBe(true);

      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      });
      expect(isIos()).toBe(false);
    });

    it("detects standalone PWA mode correctly", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      });
      vi.stubGlobal("navigator", {});
      expect(isStandalonePwa()).toBe(true);

      vi.stubGlobal("window", {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      });
      vi.stubGlobal("navigator", { standalone: true });
      expect(isStandalonePwa()).toBe(true);

      vi.stubGlobal("navigator", { standalone: false });
      expect(isStandalonePwa()).toBe(false);
    });

    it("checks notification support", () => {
      vi.stubGlobal("window", { Notification: {} });
      expect(isNotificationSupported()).toBe(true);

      vi.stubGlobal("window", {});
      expect(isNotificationSupported()).toBe(false);
    });
  });

  describe("Permission Requesting", () => {
    it("returns denied if Notification is not supported", async () => {
      vi.stubGlobal("window", {});
      const perm = await requestNotificationPermission();
      expect(perm).toBe("denied");
    });

    it("requests permission when Notification is available", async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");
      vi.stubGlobal("window", {
        Notification: {
          requestPermission: mockRequestPermission,
          permission: "default",
        },
      });
      vi.stubGlobal("navigator", {});

      const perm = await requestNotificationPermission();
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(perm).toBe("granted");
    });
  });

  describe("Notification Dispatching", () => {
    it("fails gracefully when notifications are not supported", async () => {
      vi.stubGlobal("window", {});
      const res = await dispatchCovertNotification("Test Alert");
      expect(res.success).toBe(false);
      expect(res.error).toContain("not supported");
    });

    it("fails gracefully when permission is default or denied", async () => {
      vi.stubGlobal("window", {
        Notification: {
          permission: "denied",
        },
      });
      vi.stubGlobal("navigator", {});

      const res = await dispatchCovertNotification("Test Alert");
      expect(res.success).toBe(false);
      expect(res.permission).toBe("denied");
      expect(res.error).toContain("blocked");
    });

    it("dispatches via ServiceWorker showNotification on Android / SW environments", async () => {
      const mockShowNotification = vi.fn().mockResolvedValue(undefined);
      const mockRegistration = {
        showNotification: mockShowNotification,
      };

      vi.stubGlobal("window", {
        Notification: {
          permission: "granted",
        },
      });

      vi.stubGlobal("navigator", {
        serviceWorker: {
          ready: Promise.resolve(mockRegistration),
          getRegistration: vi.fn().mockResolvedValue(mockRegistration),
          register: vi.fn().mockResolvedValue(mockRegistration),
        },
      });

      const res = await dispatchCovertNotification("COVERT OPERATIONAL ALERT", {
        body: "Midpoint theme decrypted.",
      });

      expect(res.success).toBe(true);
      expect(mockShowNotification).toHaveBeenCalledWith(
        "COVERT OPERATIONAL ALERT",
        expect.objectContaining({
          body: "Midpoint theme decrypted.",
          icon: "/icon.svg",
        })
      );
    });

    it("falls back to window.Notification constructor when ServiceWorker showNotification is unavailable", async () => {
      const mockClose = vi.fn();
      const mockNotificationConstructor = vi.fn().mockImplementation(function (this: { title: string; options: unknown; close: () => void }, title: string, options: unknown) {
        this.title = title;
        this.options = options;
        this.close = mockClose;
      });
      (mockNotificationConstructor as unknown as { permission: string }).permission = "granted";

      vi.stubGlobal("window", {
        Notification: mockNotificationConstructor,
      });

      vi.stubGlobal("navigator", {});

      const res = await dispatchCovertNotification("DESKTOP FALLBACK ALERT", {
        body: "Teammate proposed a slate.",
      });

      expect(res.success).toBe(true);
      expect(mockNotificationConstructor).toHaveBeenCalledWith(
        "DESKTOP FALLBACK ALERT",
        expect.objectContaining({
          body: "Teammate proposed a slate.",
          icon: "/icon.svg",
        })
      );
    });
  });
});
