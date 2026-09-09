"use client";

import React, { useEffect, useState, useCallback } from "react";
import { soundscape } from "@/lib/utils/soundscape";
import { getStoredTheme, applyTheme, ThemeMode } from "@/lib/utils/theme";
import {
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Bell,
  BellRing,
  X,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  requestNotificationPermission,
  dispatchCovertNotification,
  isIos,
  isStandalonePwa,
  isNotificationSupported,
} from "@/lib/utils/notifications";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [testAlertToast, setTestAlertToast] = useState<string | null>(null);

  // Sync state on mount and open
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAudioEnabled(soundscape.isAudioEnabled());
      setThemeMode(getStoredTheme());
      if (isNotificationSupported()) {
        setNotifPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  // Escape key listener for dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleAudio = () => {
    const next = soundscape.toggleAudio();
    setAudioEnabled(next);
  };

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    soundscape.playClick();
  };

  const handleRequestNotifications = async () => {
    if (!isNotificationSupported()) {
      setTestAlertToast("Web Notifications are not supported in this browser.");
      setTimeout(() => setTestAlertToast(null), 3500);
      return;
    }

    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        soundscape.playRadioChirp();
        const res = await dispatchCovertNotification("SUBTERFUGE CENTRAL COMMAND", {
          body: "Covert operational alerts enabled. Dispatches active for challenges and midpoint intercept.",
          icon: "/icon.svg",
        });

        if (res.success) {
          setTestAlertToast("OPERATIONAL DISPATCH SENT // CHECK NOTIFICATION TRAY");
        } else {
          setTestAlertToast(res.error || "DISPATCH FAILED // CHECK SITE PERMISSIONS");
        }
        setTimeout(() => setTestAlertToast(null), 4000);
      } else if (perm === "denied") {
        soundscape.playChallengeAlert();
        setTestAlertToast("NOTIFICATIONS BLOCKED IN BROWSER/SITE SETTINGS");
        setTimeout(() => setTestAlertToast(null), 4000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestAlertToast(`ALERT ERROR: ${msg}`);
      setTimeout(() => setTestAlertToast(null), 4000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="settings-modal-card"
        className="w-full max-w-lg bg-carbon-900 border-2 border-carbon-700 rounded-lg shadow-2xl p-4 sm:p-6 space-y-6 relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-700 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-classified-amber" />
            <span className="font-mono text-xs sm:text-sm font-bold tracking-widest uppercase text-classified-amber">
              STATION CONFIG // PREFERENCES
            </span>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded border border-carbon-700 hover:border-carbon-600 transition"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Test Toast Notice */}
        {testAlertToast && (
          <div className="p-2.5 bg-classified-terminal/10 border border-classified-terminal/40 text-classified-terminal font-mono text-xs rounded text-center tracking-wider animate-fadeIn">
            {testAlertToast}
          </div>
        )}

        {/* Section 1: Audio Immersion */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {audioEnabled ? (
                <Volume2 className="w-4 h-4 text-classified-terminal" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-500" />
              )}
              <span className="font-mono text-xs font-bold tracking-wider uppercase text-gray-200">
                ESPIONAGE SOUNDSCAPE
              </span>
            </div>
            <span
              id="audio-status-badge"
              className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                audioEnabled
                  ? "bg-classified-terminal/20 text-classified-terminal border border-classified-terminal/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}
            >
              {audioEnabled ? "AUDIO ACTIVE" : "MUTED"}
            </span>
          </div>

          <p className="font-mono text-[11px] text-gray-400 leading-relaxed">
            Synthesizes mechanical teletype clatter, encrypted radio chirps, radar alerts, and classified rubber stamps
            via the native Web Audio API.
          </p>

          <button
            id="toggle-audio-btn"
            onClick={handleToggleAudio}
            className={`w-full py-2.5 px-3 font-mono text-xs font-bold tracking-wider uppercase rounded border transition flex items-center justify-center gap-2 ${
              audioEnabled
                ? "bg-classified-terminal/15 border-classified-terminal/60 text-classified-terminal hover:bg-classified-terminal/25"
                : "bg-carbon-800 border-carbon-700 text-gray-300 hover:bg-carbon-750"
            }`}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-4 h-4" /> [MUTE SOUNDSCAPE]
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" /> [ENABLE SOUNDSCAPE]
              </>
            )}
          </button>

          {/* Sound Previews */}
          {audioEnabled && (
            <div className="pt-1">
              <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">
                Preview Audio Transmissions:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  id="preview-teletype-btn"
                  onClick={() => soundscape.playTeletype()}
                  className="px-2 py-1.5 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 text-gray-300 font-mono text-[10px] rounded uppercase tracking-wider transition"
                >
                  Teletype
                </button>
                <button
                  id="preview-radio-btn"
                  onClick={() => soundscape.playRadioChirp()}
                  className="px-2 py-1.5 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 text-gray-300 font-mono text-[10px] rounded uppercase tracking-wider transition"
                >
                  Radio Wire
                </button>
                <button
                  id="preview-alert-btn"
                  onClick={() => soundscape.playChallengeAlert()}
                  className="px-2 py-1.5 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 text-classified-amber font-mono text-[10px] rounded uppercase tracking-wider transition"
                >
                  Klaxon Alert
                </button>
                <button
                  id="preview-stamp-btn"
                  onClick={() => soundscape.playStamp()}
                  className="px-2 py-1.5 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 text-classified-crimson font-mono text-[10px] rounded uppercase tracking-wider transition"
                >
                  Stamp Thud
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-carbon-800" />

        {/* Section 2: Visual Theme */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {themeMode === "dark" ? (
                <Moon className="w-4 h-4 text-classified-amber" />
              ) : (
                <Sun className="w-4 h-4 text-amber-600" />
              )}
              <span className="font-mono text-xs font-bold tracking-wider uppercase text-gray-200">
                CLASSIFIED VISUAL THEME
              </span>
            </div>
            <span
              id="theme-status-badge"
              className="font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-carbon-800 text-gray-300 border border-carbon-700"
            >
              {themeMode === "dark" ? "CRT TERMINAL" : "MANILA PAPER"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="theme-dark-btn"
              onClick={() => handleSelectTheme("dark")}
              className={`p-3 rounded border text-left font-mono transition flex flex-col gap-1 ${
                themeMode === "dark"
                  ? "bg-carbon-950 border-classified-amber text-classified-amber shadow-sm"
                  : "bg-carbon-800 border-carbon-700 text-gray-400 hover:border-carbon-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5" /> CRT DARK
                </span>
                {themeMode === "dark" && <CheckCircle2 className="w-3.5 h-3.5 text-classified-amber" />}
              </div>
              <span className="text-[10px] text-gray-400">Green/amber phosphor & scanlines</span>
            </button>

            <button
              id="theme-manila-btn"
              onClick={() => handleSelectTheme("manila")}
              className={`p-3 rounded border text-left font-mono transition flex flex-col gap-1 ${
                themeMode === "manila"
                  ? "bg-[#faf7f2] border-amber-600 text-stone-900 shadow-sm"
                  : "bg-carbon-800 border-carbon-700 text-gray-400 hover:border-carbon-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-700" /> MANILA LIGHT
                </span>
                {themeMode === "manila" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />}
              </div>
              <span className="text-[10px] text-stone-600">Typewriter ink & aged dossier paper</span>
            </button>
          </div>
        </div>

        <div className="border-t border-carbon-800" />

        {/* Section 3: Covert Push Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-classified-amber" />
              <span className="font-mono text-xs font-bold tracking-wider uppercase text-gray-200">
                ASYNC MISSION ALERTS
              </span>
            </div>
            <span
              id="notif-status-badge"
              className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                notifPermission === "granted"
                  ? "bg-classified-terminal/20 text-classified-terminal border border-classified-terminal/40"
                  : notifPermission === "denied"
                  ? "bg-classified-crimson/20 text-classified-crimson border border-classified-crimson/40"
                  : "bg-classified-amber/20 text-classified-amber border border-classified-amber/40"
              }`}
            >
              {notifPermission === "granted"
                ? "AUTHORIZED"
                : notifPermission === "denied"
                ? "BLOCKED"
                : "NOT CONFIGURED"}
            </span>
          </div>

          <p className="font-mono text-[11px] text-gray-400 leading-relaxed">
            Essential for 12–24h asynchronous missions. Dispatches system alerts when:
          </p>
          <ul className="font-mono text-[10px] text-gray-400 space-y-1 list-disc list-inside">
            <li>An operative challenges your cover clearance</li>
            <li>50% midpoint theme is declassified by Central Command</li>
            <li>Teammate proposes a verdict slate awaiting consensus</li>
            <li>New encrypted private 1-on-1 dispatch arrives</li>
          </ul>

          <button
            id="request-notif-btn"
            onClick={handleRequestNotifications}
            className={`w-full py-2.5 px-3 font-mono text-xs font-bold tracking-wider uppercase rounded border transition flex items-center justify-center gap-2 ${
              notifPermission === "granted"
                ? "bg-carbon-800 border-classified-terminal/50 text-classified-terminal hover:bg-carbon-750"
                : "bg-classified-amber/15 border-classified-amber/60 text-classified-amber hover:bg-classified-amber/25"
            }`}
          >
            <BellRing className="w-4 h-4" />
            {notifPermission === "granted" ? "[DISPATCH TEST NOTIFICATION]" : "[AUTHORIZE BROWSER NOTIFICATIONS]"}
          </button>

          {/* iOS Safari PWA Guidance Banner */}
          {isIos() && !isStandalonePwa() && (
            <div
              id="ios-pwa-guidance-card"
              className="p-2.5 bg-carbon-800/80 border border-amber-500/40 rounded text-[10px] font-mono text-amber-300 space-y-1"
            >
              <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>IPHONE OPERATIVE DIRECTIVE:</span>
              </div>
              <p className="text-gray-300 leading-normal">
                iOS requires home screen installation: Tap Safari <strong>Share [↑]</strong> →{" "}
                <strong>Add to Home Screen</strong>, then launch Subterfuge to authorize notifications.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            id="done-settings-btn"
            onClick={onClose}
            className="px-4 py-2 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 text-gray-200 font-mono text-xs font-bold tracking-wider uppercase rounded transition"
          >
            CONFIRM & RETURN
          </button>
        </div>
      </div>
    </div>
  );
}
