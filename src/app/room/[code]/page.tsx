"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientGameState, Message, ChannelType } from "@/lib/types/game";
import {
  Users,
  Shield,
  ShieldCheck,
  Clock,
  Terminal,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Radio,
  Lock,
  Flag,
  Flame,
  Send,
  MessageSquare,
  ShieldAlert,
  Award,
  RefreshCw,
  Trophy,
  BookOpen,
  ChevronDown,
  ChevronUp,
  X,
  UserX,
  Copy,
  Check,
  Link as LinkIcon,
  KeyRound,
  Bell,
  Pencil,
} from "lucide-react";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isStartingOperation, setIsStartingOperation] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(false);

  // Communication Suite State
  const [activeTab, setActiveTab] = useState<"PUBLIC" | "TEAM" | "DM">("PUBLIC");
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  // Mole Challenge & Verification State
  const [isChallenging, setIsChallenging] = useState(false);
  const [moleToast, setMoleToast] = useState<{ message: string; isMole: boolean } | null>(null);
  const [challengeActionLoading, setChallengeActionLoading] = useState(false);

  // Operational Timers
  const [timeLeft, setTimeLeft] = useState<string>("--:--:--");
  const [midpointLeft, setMidpointLeft] = useState<string | null>(null);

  // Verdict Deliberation & Team Consensus State
  const [proposalInput, setProposalInput] = useState("");
  const [isProposing, setIsProposing] = useState(false);
  const [verdictWordInput, setVerdictWordInput] = useState("");
  const [verdictGuesses, setVerdictGuesses] = useState<string[]>([]);
  const [moleIndictmentId, setMoleIndictmentId] = useState<string>("");
  const [isSubmittingVerdict, setIsSubmittingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [isRematching, setIsRematching] = useState(false);

  // Operational Field Manual State
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isConsensusExpanded, setIsConsensusExpanded] = useState(false);
  const [isMoleExpanded, setIsMoleExpanded] = useState(false);

  // In-Page Direct Join & Session Isolation State
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [unauthRoomPhase, setUnauthRoomPhase] = useState<string | null>(null);
  const [joinCallsign, setJoinCallsign] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPersonalLink, setCopiedPersonalLink] = useState(false);

  // Mid-Game Recovery Portal State
  const [recoveryTokenInput, setRecoveryTokenInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [showTokenFormInLobby, setShowTokenFormInLobby] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);

  // Unread Channels & Notification State
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, number>>({
    PUBLIC: Date.now(),
    TEAM: Date.now(),
    DM: Date.now(),
  });
  const [dmAlert, setDmAlert] = useState<{
    senderId: string;
    senderName: string;
    preview: string;
  } | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const prevMessagesRef = useRef<Message[]>([]);
  const hasFetchedInitialMessagesRef = useRef(false);

  // Dev Mode & Playtesting State
  const [isDevMode, setIsDevMode] = useState(false);
  const [isGodMode, setIsGodMode] = useState(false);
  const [godData, setGodData] = useState<any>(null);
  const [isDevActionLoading, setIsDevActionLoading] = useState(false);
  const [isStreamSafe, setIsStreamSafe] = useState(false);
  const [isConfirmingBurn, setIsConfirmingBurn] = useState(false);
  const [isConfirmingVerdict, setIsConfirmingVerdict] = useState(false);

  // Ephemeral Pre-Mission Briefing & Camouflage Word States
  const [isBriefingBurned, setIsBriefingBurned] = useState(false);
  const [briefingWordInput, setBriefingWordInput] = useState("");
  const [spoofWord, setSpoofWord] = useState<string>("");
  const [isSpoofModalOpen, setIsSpoofModalOpen] = useState(false);
  const [spoofModalInput, setSpoofModalInput] = useState("");

  const decryptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getSessionToken = useCallback(() => {
    if (typeof window === "undefined" || !code) return null;

    // 1. Check if URL has token or op query parameter (Personal Recovery Link)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token") || urlParams.get("op");
    if (tokenFromUrl) {
      sessionStorage.setItem(`subterfuge_session_${code}`, tokenFromUrl);
      localStorage.setItem(`subterfuge_session_${code}`, tokenFromUrl);
      // Immediately sanitize address bar to prevent screen share / shoulder surfing leaks
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return tokenFromUrl;
    }

    // 2. Check tab-scoped sessionStorage
    const sessionTok = sessionStorage.getItem(`subterfuge_session_${code}`);
    if (sessionTok) return sessionTok;

    return null;
  }, [code]);

  const authFetch = useCallback(
    (url: string, init?: RequestInit) => {
      const token = getSessionToken();
      const headers = new Headers(init?.headers || {});
      if (token) {
        headers.set("x-session-token", token);
      }
      return fetch(url, {
        ...init,
        headers,
      });
    },
    [getSessionToken]
  );

  useEffect(() => {
    const updateTimers = () => {
      if (!gameState) return;
      const now = Date.now();

      if (gameState.room.phase === "INFILTRATION" && gameState.room.endTime) {
        const end = new Date(gameState.room.endTime).getTime();
        const diff = Math.max(0, end - now);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        );

        if (gameState.room.midpointTime && !gameState.room.declassifiedTheme) {
          const mid = new Date(gameState.room.midpointTime).getTime();
          const midDiff = Math.max(0, mid - now);
          const mHours = Math.floor(midDiff / (1000 * 60 * 60));
          const mMins = Math.floor((midDiff % (1000 * 60 * 60)) / (1000 * 60));
          const mSecs = Math.floor((midDiff % (1000 * 60)) / 1000);
          setMidpointLeft(
            `${String(mHours).padStart(2, "0")}:${String(mMins).padStart(2, "0")}:${String(mSecs).padStart(2, "0")}`
          );
        } else {
          setMidpointLeft(null);
        }
      } else if (gameState.room.phase === "VERDICT" && gameState.room.verdictEndTime) {
        const end = new Date(gameState.room.verdictEndTime).getTime();
        const diff = Math.max(0, end - now);
        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        setMidpointLeft(null);
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const fetchState = useCallback(async () => {
    if (!code) return;
    let token = getSessionToken();

    if (!token) {
      try {
        const res = await fetch(`/api/rooms/${code}/state`);
        if (res.ok) {
          const data = await res.json();
          // If match is active (INFILTRATION/VERDICT/DEBRIEF), auto-resume station immediately
          if (data.room?.phase !== "LOBBY") {
            setGameState(data);
            setIsUnauthorized(false);
            if (data.self?.sessionToken && typeof window !== "undefined") {
              sessionStorage.setItem(`subterfuge_session_${code}`, data.self.sessionToken);
              localStorage.setItem(`subterfuge_session_${code}`, data.self.sessionToken);
            }
            return;
          } else {
            // In LOBBY, do not auto-assume session across separate tabs sharing cookies
            setHasSavedSession(true);
            setUnauthRoomPhase("LOBBY");
            setIsUnauthorized(true);
            return;
          }
        } else if (res.status === 401) {
          const errData = await res.json();
          const phase = errData.phase || "LOBBY";
          setUnauthRoomPhase(phase);

          // During INFILTRATION, VERDICT, or DEBRIEF:
          // If this device has a saved token in localStorage, auto-resume station immediately!
          if (phase !== "LOBBY" && typeof window !== "undefined") {
            const savedLocalToken = localStorage.getItem(`subterfuge_session_${code}`);
            if (savedLocalToken) {
              sessionStorage.setItem(`subterfuge_session_${code}`, savedLocalToken);
              token = savedLocalToken;
              const authRes = await fetch(`/api/rooms/${code}/state`, {
                headers: { "x-session-token": token },
              });
              if (authRes.ok) {
                const data = await authRes.json();
                setGameState(data);
                setIsUnauthorized(false);
                return;
              }
            }
          }

          if (typeof window !== "undefined" && localStorage.getItem(`subterfuge_session_${code}`)) {
            setHasSavedSession(true);
          }
        } else if (res.status === 404) {
          setError("OPERATION NOT FOUND: Operation does not exist or has been terminated.");
          return;
        }
      } catch {
        // ignore
      }
      setIsUnauthorized(true);
      return;
    }
    try {
      const res = await authFetch(`/api/rooms/${code}/state`);
      if (!res.ok) {
        if (res.status === 401) {
          const errData = await res.json().catch(() => ({}));
          if (errData.phase) setUnauthRoomPhase(errData.phase);
          if (errData.error?.includes("Unauthorized") || errData.error?.includes("UNAUTHORIZED")) {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(`subterfuge_session_${code}`);
              localStorage.removeItem(`subterfuge_session_${code}`);
            }
            setHasSavedSession(false);
          } else if (typeof window !== "undefined" && localStorage.getItem(`subterfuge_session_${code}`)) {
            setHasSavedSession(true);
          }
          setGameState(null);
          setIsUnauthorized(true);
          return;
        }
        if (res.status === 404) {
          setError("OPERATION NOT FOUND: Operation does not exist or has been terminated.");
          return;
        }
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load operational state");
      }
      const data = await res.json();
      setGameState(data);
      setIsUnauthorized(false);
      // Keep session token updated across storages
      if (data.self?.sessionToken && typeof window !== "undefined") {
        sessionStorage.setItem(`subterfuge_session_${code}`, data.self.sessionToken);
        localStorage.setItem(`subterfuge_session_${code}`, data.self.sessionToken);
      }
    } catch (err: any) {
      setGameState((prev) => {
        if (!prev) setError(err.message);
        return prev;
      });
    }
  }, [code, authFetch, getSessionToken]);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const selectedPeerIdRef = useRef(selectedPeerId);
  selectedPeerIdRef.current = selectedPeerId;
  const selfIdRef = useRef(gameState?.self?.id);
  selfIdRef.current = gameState?.self?.id;

  const playCommsChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio context error or blocked before user interaction
    }
  }, []);

  const scrollToMessagesBottom = useCallback((smooth = false) => {
    const doScroll = () => {
      const listEl = document.getElementById("message-list");
      if (listEl) {
        if (smooth) {
          listEl.scrollTo({ top: listEl.scrollHeight, behavior: "smooth" });
        } else {
          listEl.scrollTop = listEl.scrollHeight;
        }
      }
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest" });
      }
    };
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
    setTimeout(doScroll, 150);
    setTimeout(doScroll, 300);
  }, []);

  const handleOpenDMWithOperative = useCallback((peerId: string) => {
    setActiveTab("DM");
    setSelectedPeerId(peerId);
    setLastReadTimestamps((prev) => ({ ...prev, DM: Date.now() }));
    setDmAlert(null);

    const scrollToComms = () => {
      const commsEl = document.getElementById("comms-panel");
      if (commsEl) {
        commsEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const inputEl = document.getElementById("message-input");
        if (inputEl) inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const listEl = document.getElementById("message-list");
      if (listEl) {
        listEl.scrollTop = listEl.scrollHeight;
      }
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
      const inputEl = document.getElementById("message-input");
      if (inputEl) {
        try {
          inputEl.focus({ preventScroll: true });
        } catch {
          // focus error fallback
        }
      }
    };

    requestAnimationFrame(scrollToComms);
    setTimeout(scrollToComms, 60);
    setTimeout(scrollToComms, 200);
    setTimeout(scrollToComms, 450);
  }, []);

  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const triggerPushNotification = useCallback(
    (title: string, options: NotificationOptions & { data?: any }) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      // Try Service Worker registration first (mandatory for mobile Safari & Android Chrome)
      const reg = swRegistrationRef.current;
      if (reg && reg.showNotification) {
        reg.showNotification(title, options).catch(() => {
          try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
              window.focus();
              if (options.data?.peerId) handleOpenDMWithOperative(options.data.peerId);
              notif.close();
            };
          } catch {
            // fallback
          }
        });
        return;
      }

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistration()
          .then((activeReg) => {
            if (activeReg && activeReg.showNotification) {
              swRegistrationRef.current = activeReg;
              activeReg.showNotification(title, options).catch(() => {
                try {
                  const notif = new Notification(title, options);
                  notif.onclick = () => {
                    window.focus();
                    if (options.data?.peerId) handleOpenDMWithOperative(options.data.peerId);
                    notif.close();
                  };
                } catch {
                  // fallback
                }
              });
            } else {
              try {
                const notif = new Notification(title, options);
                notif.onclick = () => {
                  window.focus();
                  if (options.data?.peerId) handleOpenDMWithOperative(options.data.peerId);
                  notif.close();
                };
              } catch {
                // fallback
              }
            }
          })
          .catch(() => {
            try {
              const notif = new Notification(title, options);
              notif.onclick = () => {
                window.focus();
                if (options.data?.peerId) handleOpenDMWithOperative(options.data.peerId);
                notif.close();
              };
            } catch {
              // fallback
            }
          });
      } else {
        try {
          const notif = new Notification(title, options);
          notif.onclick = () => {
            window.focus();
            if (options.data?.peerId) handleOpenDMWithOperative(options.data.peerId);
            notif.close();
          };
        } catch {
          // fallback
        }
      }
    },
    [handleOpenDMWithOperative]
  );

  const fetchMessages = useCallback(async () => {
    if (!code) return;
    try {
      const res = await authFetch(`/api/rooms/${code}/messages`);
      if (res.ok) {
        const data = await res.json();
        const newMessages: Message[] = data.messages || [];
        setMessages(newMessages);

        if (!hasFetchedInitialMessagesRef.current) {
          hasFetchedInitialMessagesRef.current = true;
          prevMessagesRef.current = newMessages;
        } else {
          // Detect brand new incoming messages for background Push Notification and in-page alert
          const prevIds = new Set(prevMessagesRef.current.map((m) => m.id));
          const brandNew = newMessages.filter((m) => !prevIds.has(m.id));

          if (brandNew.length > 0) {
            const currentSelfId = selfIdRef.current;
            const currentTab = activeTabRef.current;
            const currentPeerId = selectedPeerIdRef.current;

            for (const msg of brandNew) {
              if (msg.senderId !== currentSelfId) {
                playCommsChime();

                // Background Notification (when in another tab, another app, or unfocused window)
                const isUnfocused =
                  typeof window !== "undefined" && (!document.hasFocus() || document.hidden);

                if (isUnfocused) {
                  document.title = `🔴 [NEW TRANSMISSION] ${msg.senderName} - SUBTERFUGE`;

                  const notifTitle =
                    msg.channelType === "DM"
                      ? `[Subterfuge DM] ${msg.senderName}`
                      : msg.channelType.startsWith("TEAM")
                      ? `[Subterfuge Radio] ${msg.senderName}`
                      : `[Subterfuge Wire] ${msg.senderName}`;

                  triggerPushNotification(notifTitle, {
                    body: msg.content,
                    icon: "/apple-touch-icon.png",
                    badge: "/favicon-32x32.png",
                    tag: msg.id,
                    vibrate: [200, 100, 200],
                    data: {
                      peerId: msg.senderId,
                      channelType: msg.channelType,
                    },
                  } as any);
                }

                // In-page clickable transmission alert for DMs
                if (
                  msg.channelType === "DM" &&
                  msg.recipientId === currentSelfId &&
                  (currentTab !== "DM" || currentPeerId !== msg.senderId)
                ) {
                  setDmAlert({
                    senderId: msg.senderId,
                    senderName: msg.senderName,
                    preview: msg.content.length > 60 ? msg.content.slice(0, 60) + "..." : msg.content,
                  });
                }
              }
            }
          }
        }
        prevMessagesRef.current = newMessages;
      }
    } catch {
      // Ignore polling errors
    }
  }, [code, authFetch, playCommsChime, triggerPushNotification]);

  const handleDirectJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCallsign.trim() || !code || isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: joinCallsign.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to infiltrate operation");
      }
      if (typeof window !== "undefined" && data.sessionToken) {
        sessionStorage.setItem(`subterfuge_session_${code}`, data.sessionToken);
        localStorage.setItem(`subterfuge_session_${code}`, data.sessionToken);
      }
      setIsUnauthorized(false);
      await fetchState();
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleTokenRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryTokenInput.trim() || !code || isRecovering) return;
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      let token = recoveryTokenInput.trim();
      if (token.includes("token=")) {
        const match = token.match(/[?&]token=([^&]+)/);
        if (match) token = decodeURIComponent(match[1]);
      } else if (token.includes("op=")) {
        const match = token.match(/[?&]op=([^&]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(`subterfuge_session_${code}`, token);
        localStorage.setItem(`subterfuge_session_${code}`, token);
      }

      const res = await fetch(`/api/rooms/${code}/state`, {
        headers: { "x-session-token": token },
      });
      if (!res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`subterfuge_session_${code}`);
          localStorage.removeItem(`subterfuge_session_${code}`);
        }
        throw new Error(data.error || "OPERATIVE NOT RECOGNIZED: Invalid recovery credentials.");
      }
      const data = await res.json();
      setGameState(data);
      setIsUnauthorized(false);
    } catch (err: any) {
      setRecoveryError(err.message);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDisconnectStation = () => {
    if (typeof window !== "undefined" && code) {
      sessionStorage.removeItem(`subterfuge_session_${code}`);
      localStorage.removeItem(`subterfuge_session_${code}`);
    }
    setGameState(null);
    setIsUnauthorized(true);
  };

  const hasGameSession = !!gameState?.self?.id;

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!hasGameSession) return;
    fetchMessages();
    const interval = setInterval(() => {
      fetchState();
      fetchMessages();
    }, 2000);

    // Web Worker unthrottled background timer to defeat browser 60s background throttling
    let bgWorker: Worker | null = null;
    try {
      const workerBlob = new Blob(
        [
          `let timer = null;
           self.onmessage = function(e) {
             if (e.data === 'start') {
               if (!timer) timer = setInterval(function() { self.postMessage('tick'); }, 2000);
             } else if (e.data === 'stop') {
               if (timer) { clearInterval(timer); timer = null; }
             }
           };`,
        ],
        { type: "application/javascript" }
      );
      const workerUrl = URL.createObjectURL(workerBlob);
      bgWorker = new Worker(workerUrl);
      bgWorker.onmessage = () => {
        if (typeof window !== "undefined" && (!document.hasFocus() || document.hidden)) {
          fetchState();
          fetchMessages();
        }
      };
      bgWorker.postMessage("start");
    } catch {
      // Worker fallback
    }

    return () => {
      clearInterval(interval);
      if (bgWorker) {
        try {
          bgWorker.postMessage("stop");
          bgWorker.terminate();
        } catch {
          // cleanup fallback
        }
      }
    };
  }, [hasGameSession, fetchState, fetchMessages]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          swRegistrationRef.current = reg;
        })
        .catch(() => {});

      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === "OPEN_COMMUNICATION" && event.data?.peerId) {
          handleOpenDMWithOperative(event.data.peerId);
        }
      };
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      };
    }
  }, [handleOpenDMWithOperative]);

  // Auto-scroll comms message list to bottom on new transmissions or channel switch
  useEffect(() => {
    scrollToMessagesBottom(false);
  }, [activeTab, selectedPeerId, messages.length, scrollToMessagesBottom]);

  useEffect(() => {
    const handleFocus = () => {
      document.title = "SUBTERFUGE // Intelligence Operative Portal";
      fetchState();
      fetchMessages();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        document.title = "SUBTERFUGE // Intelligence Operative Portal";
        fetchState();
        fetchMessages();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (decryptTimerRef.current) clearTimeout(decryptTimerRef.current);
    };
  }, [fetchState, fetchMessages]);

  // Default selected peer in DM tab
  useEffect(() => {
    if (gameState && !selectedPeerId) {
      const peers = gameState.players.filter((p) => p.id !== gameState.self.id);
      if (peers.length > 0) {
        setSelectedPeerId(peers[0].id);
      }
    }
  }, [gameState, selectedPeerId]);

  const handleOpenManual = () => {
    setIsConsensusExpanded(false);
    if (gameState?.self.role === "MOLE") {
      setIsMoleExpanded(true);
    } else {
      setIsMoleExpanded(false);
    }
    setIsManualOpen(true);
  };

  // Auto-expand relevant role section in Field Manual when role is assigned
  useEffect(() => {
    if (gameState?.self.role === "MOLE") {
      setIsMoleExpanded(true);
    }
  }, [gameState?.self.role]);

  // Keyboard shortcut: Escape dismisses Field Manual, spoof modal & confirmation modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsManualOpen(false);
        setIsConfirmingBurn(false);
        setIsConfirmingVerdict(false);
        setIsSpoofModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Restore or reset briefing and spoof word state
  useEffect(() => {
    if (typeof window !== "undefined" && code && gameState?.self?.id) {
      if (gameState.room.phase === "LOBBY") {
        sessionStorage.removeItem(`subterfuge_briefing_burned_${code}_${gameState.self.id}`);
        localStorage.removeItem(`subterfuge_spoof_word_${code}_${gameState.self.id}`);
        setIsBriefingBurned(false);
        setSpoofWord("");
      } else {
        const isBurned = sessionStorage.getItem(`subterfuge_briefing_burned_${code}_${gameState.self.id}`);
        setIsBriefingBurned(isBurned === "true");
        const savedSpoof = localStorage.getItem(`subterfuge_spoof_word_${code}_${gameState.self.id}`);
        if (savedSpoof) setSpoofWord(savedSpoof);
      }
    }
  }, [code, gameState?.self?.id, gameState?.room?.phase]);

  // Dev mode initialization from query param or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("dev") === "true" || localStorage.getItem("subterfuge_dev") === "true") {
        setIsDevMode(true);
      }
    }
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D toggles Dev Mode
  useEffect(() => {
    const handleDevKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsDevMode((prev) => {
          const next = !prev;
          if (typeof window !== "undefined") {
            if (next) localStorage.setItem("subterfuge_dev", "true");
            else localStorage.removeItem("subterfuge_dev");
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleDevKeyDown);
    return () => window.removeEventListener("keydown", handleDevKeyDown);
  }, []);

  // Web Notifications API permission state & auto-request
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (
        Notification.permission === "default" &&
        gameState?.room?.phase &&
        gameState.room.phase !== "LOBBY"
      ) {
        Notification.requestPermission()
          .then((p) => setNotifPermission(p))
          .catch(() => {});
      }
    }
  }, [gameState?.room?.phase]);

  const handleRequestNotifPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      // Permission error
    }
  };

  // Auto-dismiss for incoming DM toast
  useEffect(() => {
    if (!dmAlert) return;
    const timer = setTimeout(() => {
      setDmAlert(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [dmAlert]);

  // Auto-dismiss for clearance challenge status alerts (DENIED / DECLINED)
  useEffect(() => {
    if (!selectedPeerId || !gameState?.challengeStatuses?.[selectedPeerId]) return;
    const status = gameState.challengeStatuses[selectedPeerId];
    if (status === "DENIED" || status === "DECLINED") {
      const key = `${status.toLowerCase()}_${selectedPeerId}`;
      const timer = setTimeout(() => {
        setDismissedAlerts((prev) => ({ ...prev, [key]: true }));
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [selectedPeerId, gameState?.challengeStatuses]);

  const handleToggleReady = async () => {
    if (!gameState || !code || isTogglingReady) return;
    setIsTogglingReady(true);
    try {
      const res = await authFetch(`/api/rooms/${code}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: gameState.self.id }),
      });
      if (res.ok) {
        await fetchState();
      }
    } finally {
      setIsTogglingReady(false);
    }
  };

  const handleStartOperation = async () => {
    if (!gameState || !code || isStartingOperation) return;
    setIsStartingOperation(true);
    try {
      const res = await authFetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to authorize deployment");
      await fetchState();
      await fetchMessages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStartingOperation(false);
    }
  };

  const handleLeaveOperation = async () => {
    if (!gameState || !code) return;
    try {
      const token = gameState.self?.sessionToken || getSessionToken();
      await authFetch(`/api/rooms/${code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token }),
      });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined" && code) {
      sessionStorage.removeItem(`subterfuge_session_${code}`);
      localStorage.removeItem(`subterfuge_session_${code}`);
    }
    setGameState(null);
    setIsUnauthorized(true);
  };

  const handleKickPlayer = async (targetPlayerId: string) => {
    if (!gameState || !code) return;
    try {
      const token = gameState.self?.sessionToken || getSessionToken();
      const res = await authFetch(`/api/rooms/${code}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerId, sessionToken: token }),
      });
      if (res.ok) {
        await fetchState();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to dismiss operative");
      }
    } catch (err: any) {
      setError(err.message || "Failed to dismiss operative");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !gameState || isSendingMessage) return;

    let channelType: ChannelType = "PUBLIC";
    let recipientId: string | undefined = undefined;

    if (activeTab === "TEAM") {
      channelType = gameState.self.apparentTeam === "RED" ? "TEAM_RED" : "TEAM_BLUE";
    } else if (activeTab === "DM") {
      channelType = "DM";
      if (!selectedPeerId) {
        setError("Please select a recipient operative for direct communications.");
        return;
      }
      recipientId = selectedPeerId;
    }

    const contentToSend = messageInput.trim();
    setMessageInput("");
    setIsSendingMessage(true);

    // Optimistic teletype rendering
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      roomId: gameState.room.code,
      senderId: gameState.self.id,
      senderName: gameState.self.displayName,
      senderApparentTeam: gameState.self.apparentTeam,
      channelType,
      content: contentToSend,
      recipientId,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToMessagesBottom(true);

    try {
      const res = await authFetch(`/api/rooms/${code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelType,
          content: contentToSend,
          recipientId,
        }),
      });
      if (res.ok) {
        await fetchMessages();
        scrollToMessagesBottom(true);
      } else {
        const data = await res.json();
        // Rollback optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setMessageInput(contentToSend);
        setError(data.error || "Failed to transmit message");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(contentToSend);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleBurnConversation = () => {
    if (!selectedPeerId || !code || isBurning) return;
    setIsConfirmingBurn(true);
  };

  const executeBurnDM = async () => {
    if (!selectedPeerId || !code || isBurning) return;
    setIsBurning(true);
    setIsConfirmingBurn(false);
    try {
      const res = await authFetch(`/api/rooms/${code}/messages/burn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: selectedPeerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBurnNotice(`Conversation purged. ${data.count} messages shredded.`);
        setTimeout(() => setBurnNotice(null), 3000);
        await fetchMessages();
      }
    } finally {
      setIsBurning(false);
    }
  };

  const handleInitiateChallenge = async () => {
    if (!selectedPeerId || !code || isChallenging) return;
    setIsChallenging(true);
    try {
      const res = await authFetch(`/api/rooms/${code}/mole/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerId: selectedPeerId }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsChallenging(false);
    }
  };

  const handleRespondChallenge = async (challengeId: string, action: "ACCEPT" | "DENY") => {
    if (!code || challengeActionLoading) return;
    setChallengeActionLoading(true);
    try {
      const res = await authFetch(`/api/rooms/${code}/mole/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, action }),
      });
      const data = await res.json();
      if (data.isMole) {
        setMoleToast({ message: data.message || "Operative Verified. Channel Secured.", isMole: true });
        setTimeout(() => setMoleToast(null), 3000);
      } else {
        if (action === "DENY") {
          setMoleToast({
            message: "Clearance Declined: You have declined the verification request.",
            isMole: false,
          });
        } else {
          setMoleToast({
            message: data.message || "Clearance Denied: Invalid Counter-Signature",
            isMole: false,
          });
        }
        setTimeout(() => setMoleToast(null), 4000);
      }
      await fetchState();
    } catch (e) {
      console.error(e);
    } finally {
      setChallengeActionLoading(false);
    }
  };

  const handleProposeWord = async () => {
    if (!code || !proposalInput.trim() || isProposing) return;
    setIsProposing(true);
    try {
      const res = await authFetch(`/api/rooms/${code}/verdict/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: proposalInput }),
      });
      if (res.ok) {
        setProposalInput("");
        await fetchState();
      }
    } finally {
      setIsProposing(false);
    }
  };

  const handleVoteSuggestion = async (suggestionId: string) => {
    if (!code) return;
    try {
      const res = await authFetch(`/api/rooms/${code}/verdict/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddVerdictGuess = (wordToAdd?: string) => {
    const raw = wordToAdd || verdictWordInput;
    const word = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!word) return;
    if (!verdictGuesses.includes(word)) {
      if (verdictGuesses.length >= (gameState?.players.length || 6)) {
        setVerdictError(`Cannot add more than ${gameState?.players.length} code words.`);
        return;
      }
      setVerdictGuesses((prev) => [...prev, word]);
      setVerdictError(null);
      if (!wordToAdd) setVerdictWordInput("");
    }
  };

  const handleRemoveVerdictGuess = (wordToRemove: string) => {
    setVerdictGuesses((prev) => prev.filter((w) => w !== wordToRemove));
  };

  const handleSubmitVerdict = () => {
    if (!code || isSubmittingVerdict || verdictGuesses.length === 0) return;
    setIsConfirmingVerdict(true);
  };

  const executeSubmitVerdict = async (confirmOnly: boolean = false) => {
    if (!code || isSubmittingVerdict) return;
    if (!confirmOnly && verdictGuesses.length === 0) return;
    setIsSubmittingVerdict(true);
    setIsConfirmingVerdict(false);
    setVerdictError(null);
    try {
      const res = await authFetch(`/api/rooms/${code}/verdict/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guesses: verdictGuesses,
          moleIndictmentId: moleIndictmentId || undefined,
          confirmOnly,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to transmit verdict");
      }
      await fetchState();
    } catch (err: any) {
      setVerdictError(err.message);
    } finally {
      setIsSubmittingVerdict(false);
    }
  };

  const handleRematch = async () => {
    if (!code || isRematching) return;
    setIsRematching(true);
    setError(null);
    try {
      const res = await authFetch(`/api/rooms/${code}/rematch`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to authorize rematch");
      }
      setVerdictGuesses([]);
      setVerdictWordInput("");
      setProposalInput("");
      setMoleToast(null);
      setIsDecrypted(false);
      await fetchState();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRematching(false);
    }
  };

  const handleDecryptStart = () => {
    setIsDecrypted(true);
    if (decryptTimerRef.current) {
      clearTimeout(decryptTimerRef.current);
      decryptTimerRef.current = null;
    }
  };

  const handleDecryptEnd = () => {
    if (decryptTimerRef.current) {
      clearTimeout(decryptTimerRef.current);
      decryptTimerRef.current = null;
    }
    setIsDecrypted(false);
  };

  const handleBurnBriefing = () => {
    if (!gameState?.self?.assignedWord) return;
    if (briefingWordInput.trim().toUpperCase() !== gameState.self.assignedWord.toUpperCase()) return;
    if (typeof window !== "undefined" && code && gameState.self.id) {
      sessionStorage.setItem(`subterfuge_briefing_burned_${code}_${gameState.self.id}`, "true");
    }
    setIsBriefingBurned(true);
    setBriefingWordInput("");
  };

  const handleSaveSpoofWord = () => {
    const cleanWord = spoofModalInput.trim().toUpperCase().replace(/[^A-Z]/g, "");
    setSpoofWord(cleanWord);
    if (typeof window !== "undefined" && code && gameState?.self?.id) {
      if (cleanWord) {
        localStorage.setItem(`subterfuge_spoof_word_${code}_${gameState.self.id}`, cleanWord);
      } else {
        localStorage.removeItem(`subterfuge_spoof_word_${code}_${gameState.self.id}`);
      }
    }
    setIsSpoofModalOpen(false);
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-carbon-900 border border-red-800 p-6 rounded-lg max-w-md w-full font-mono text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              router.push("/");
            }}
            className="px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded text-xs uppercase tracking-wider"
          >
            Return to Command Center
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    if (isUnauthorized) {
      const isMidGame = unauthRoomPhase === "INFILTRATION" || unauthRoomPhase === "VERDICT";

      if (isMidGame) {
        return (
          <div className="flex-1 flex items-center justify-center p-6 max-w-md mx-auto w-full font-mono">
            <div
              id="reconnect-operation-card"
              className="bg-carbon-900 border-2 border-carbon-700 rounded-lg p-6 sm:p-8 w-full shadow-2xl space-y-6"
            >
              <div className="space-y-2 border-b border-carbon-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-classified-amber">
                    <Terminal className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">OPERATION: {code}</span>
                  </div>
                  <span className="classified-stamp text-nano text-classified-crimson border-classified-crimson py-0.2 px-1 animate-pulse">
                    IN PROGRESS // {unauthRoomPhase}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">
                  Operative Recovery Portal
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This operation has commenced active deployment. Direct onboarding is closed. If you were disconnected from this match, paste your Personal Recovery Link or secret token below to resume your station.
                </p>
              </div>

              {recoveryError && (
                <div
                  id="recovery-error-banner"
                  className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{recoveryError}</span>
                </div>
              )}

              <form id="recovery-token-form" onSubmit={handleTokenRecovery} className="space-y-4">
                <div>
                  <label
                    htmlFor="recovery-token-input"
                    className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2"
                  >
                    Personal Recovery Link or Secret Token
                  </label>
                  <input
                    id="recovery-token-input"
                    type="text"
                    placeholder="Paste URL or token: e.g. /room/XYZ?token=... or uuid"
                    value={recoveryTokenInput}
                    onChange={(e) => setRecoveryTokenInput(e.target.value)}
                    disabled={isRecovering}
                    className="w-full bg-carbon-950 border border-carbon-700 rounded px-4 py-2.5 text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber font-mono min-h-[44px]"
                    required
                  />
                </div>

                <button
                  id="resume-station-btn"
                  type="submit"
                  disabled={isRecovering || !recoveryTokenInput.trim()}
                  className="w-full min-h-[48px] py-3.5 px-4 bg-classified-terminal hover:bg-green-400 disabled:opacity-50 text-black font-mono font-bold text-xs uppercase tracking-widest rounded transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isRecovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      RE-AUTHENTICATING STATION...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      RESUME OPERATIONAL STATION
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 border-t border-carbon-800 text-center">
                <button
                  onClick={() => router.push("/")}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-wider"
                >
                  ← Return to Central Command
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex items-center justify-center p-6 max-w-md mx-auto w-full font-mono">
          <div className="bg-carbon-900 border-2 border-carbon-700 rounded-lg p-6 sm:p-8 w-full shadow-2xl space-y-6">
            <div className="space-y-2 border-b border-carbon-800 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-classified-amber">
                  <Terminal className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">OPERATION: {code}</span>
                </div>
                <span className="classified-stamp text-nano text-classified-amber border-classified-amber py-0.2 px-1">
                  CLEARANCE REQUIRED
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">
                {showTokenFormInLobby ? "Resume Operative Station" : "Operative Onboarding"}
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                {showTokenFormInLobby
                  ? "Paste your Personal Recovery Link or secret token to restore your existing terminal."
                  : "You have reached an encrypted operation gateway. Enter your operative call-sign to establish an encrypted uplink and infiltrate this operation."}
              </p>
            </div>

            {joinError && !showTokenFormInLobby && (
              <div
                id="join-error-banner"
                className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{joinError}</span>
                </div>
                {joinError.includes("OPERATIVE_EXISTS") && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTokenFormInLobby(true);
                      setJoinError(null);
                    }}
                    className="text-classified-terminal text-left underline cursor-pointer text-micro font-bold"
                  >
                    Are you this operative? Click here to enter your Recovery Link or Token.
                  </button>
                )}
              </div>
            )}

            {recoveryError && showTokenFormInLobby && (
              <div
                id="recovery-error-banner"
                className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                <span>{recoveryError}</span>
              </div>
            )}

            {showTokenFormInLobby ? (
              <form id="recovery-token-form" onSubmit={handleTokenRecovery} className="space-y-4">
                <div>
                  <label
                    htmlFor="recovery-token-input"
                    className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2"
                  >
                    Personal Recovery Link or Secret Token
                  </label>
                  <input
                    id="recovery-token-input"
                    type="text"
                    placeholder="Paste URL or token: e.g. /room/XYZ?token=... or uuid"
                    value={recoveryTokenInput}
                    onChange={(e) => setRecoveryTokenInput(e.target.value)}
                    disabled={isRecovering}
                    className="w-full bg-carbon-950 border border-carbon-700 rounded px-4 py-2.5 text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber font-mono min-h-[44px]"
                    required
                  />
                </div>

                <button
                  id="resume-station-btn"
                  type="submit"
                  disabled={isRecovering || !recoveryTokenInput.trim()}
                  className="w-full min-h-[48px] py-3.5 px-4 bg-classified-terminal hover:bg-green-400 disabled:opacity-50 text-black font-mono font-bold text-xs uppercase tracking-widest rounded transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isRecovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      RE-AUTHENTICATING STATION...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      RESUME OPERATIONAL STATION
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTokenFormInLobby(false);
                      setRecoveryError(null);
                    }}
                    className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
                  >
                    ← Infiltrate with new operative call-sign
                  </button>
                </div>
              </form>
            ) : (
              <>
                {hasSavedSession && (
                  <div
                    id="saved-session-alert"
                className="p-3 bg-carbon-950 border border-classified-terminal/60 rounded flex flex-col gap-2 font-mono"
              >
                <div className="flex items-center gap-2 text-classified-terminal text-xs">
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-bold">SAVED OPERATIVE CREDENTIALS DETECTED</span>
                </div>
                <p className="text-micro text-gray-400">
                  This device was previously deployed to this operation. You can resume your station or declare a new call-sign below.
                </p>
                <button
                  id="resume-saved-session-btn"
                  type="button"
                  onClick={() => {
                    const savedToken = localStorage.getItem(`subterfuge_session_${code}`);
                    if (savedToken) {
                      sessionStorage.setItem(`subterfuge_session_${code}`, savedToken);
                      setIsUnauthorized(false);
                      fetchState();
                    }
                  }}
                  className="w-full min-h-[44px] py-2.5 px-3 bg-classified-terminal hover:bg-green-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  RESUME PREVIOUS STATION
                </button>
              </div>
            )}

            <form id="join-operation-form" onSubmit={handleDirectJoin} className="space-y-4">
                <div>
                  <label
                    htmlFor="join-callsign-input"
                    className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2"
                  >
                    Operative Call-Sign
                  </label>
                  <input
                    id="join-callsign-input"
                    type="text"
                    placeholder="e.g. Ghost-Asset"
                    value={joinCallsign}
                    onChange={(e) => setJoinCallsign(e.target.value)}
                    disabled={isJoining}
                    maxLength={20}
                    className="w-full bg-carbon-950 border border-carbon-700 rounded px-4 py-2.5 text-base sm:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber font-mono min-h-[48px]"
                    required
                  />
                </div>

                <button
                  id="join-room-submit-btn"
                  type="submit"
                  disabled={isJoining || !joinCallsign.trim()}
                  className="w-full min-h-[48px] py-3.5 px-4 bg-classified-amber hover:bg-amber-400 disabled:opacity-50 text-black font-mono font-bold text-xs uppercase tracking-widest rounded transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isJoining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      AUTHORIZING CLEARANCE...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      COMMENCE INFILTRATION
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    id="toggle-recovery-form-btn"
                    onClick={() => {
                      setShowTokenFormInLobby(true);
                      setJoinError(null);
                    }}
                    className="text-xs text-gray-400 hover:text-classified-terminal underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-classified-terminal" />
                    <span>Already deployed? Resume with Secret Token / Link</span>
                  </button>
                </div>
              </form>
              </>
            )}

            <div className="pt-2 border-t border-carbon-800 text-center">
              <button
                onClick={() => router.push("/")}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-wider"
              >
                ← Return to Central Command
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center font-mono text-gray-500 text-sm">
        <Terminal className="w-5 h-5 animate-spin mr-3 text-classified-amber" />
        ESTABLISHING ENCRYPTED LINK...
      </div>
    );
  }

  const { room, self, players, allVerdicts, codebook } = gameState;
  const isRosterValid = players.length >= 6 && players.length <= 12;
  const allReady = isRosterValid && players.every((p) => p.isReady);
  const isInfiltration = room.phase === "INFILTRATION";

  const redApparentPlayers = players.filter((p) => p.apparentTeam === "RED");
  const blueApparentPlayers = players.filter((p) => p.apparentTeam === "BLUE");
  const peerPlayers = players.filter((p) => p.id !== self.id);
  const activePeer = peerPlayers.find((p) => p.id === selectedPeerId);

  // Filter messages for current active tab view
  const currentTabMessages = messages.filter((m) => {
    if (activeTab === "PUBLIC") return m.channelType === "PUBLIC";
    if (activeTab === "TEAM") {
      const teamChannel = self.apparentTeam === "RED" ? "TEAM_RED" : "TEAM_BLUE";
      return m.channelType === teamChannel;
    }
    if (activeTab === "DM") {
      if (!selectedPeerId) return false;
      return (
        m.channelType === "DM" &&
        ((m.senderId === self.id && m.recipientId === selectedPeerId) ||
          (m.senderId === selectedPeerId && m.recipientId === self.id))
      );
    }
    return false;
  });

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full relative">
      {/* Mole Verification Self-Destruct Toast */}
      {moleToast && moleToast.isMole && (
        <div
          id="mole-verification-toast"
          className="fixed top-6 right-6 z-50 bg-emerald-950 border-2 border-emerald-500 text-emerald-300 px-6 py-4 shadow-2xl rounded font-mono text-sm flex flex-col gap-2.5 animate-pulse overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div>
              <div className="font-bold text-emerald-400 uppercase tracking-widest text-xs">
                Security Handshake Confirmed
              </div>
              <div className="font-semibold text-white">{moleToast.message}</div>
              <div className="text-nano text-emerald-400/70 mt-1">
                This notification will self-destruct in 3s...
              </div>
            </div>
          </div>
          {/* Visual self-destruct sweep bar */}
          <div className="w-full bg-emerald-950 h-1 rounded-full overflow-hidden border border-emerald-900">
            <div className="bg-emerald-400 h-full animate-shrink-width" />
          </div>
        </div>
      )}

      {moleToast && !moleToast.isMole && (
        <div
          id="denied-verification-toast"
          className="fixed top-6 right-6 z-50 bg-red-950 border-2 border-red-500 text-red-300 px-6 py-4 shadow-2xl rounded font-mono text-sm flex items-center gap-3"
        >
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <div>
            <div className="font-bold text-red-400 uppercase tracking-widest text-xs">
              Security Clearance Failed
            </div>
            <div className="font-semibold text-white">{moleToast.message}</div>
          </div>
        </div>
      )}

      {/* Top Intelligence Header */}
      <header className="border-b border-carbon-800 pb-3 mb-5 space-y-2.5">
        {/* Row 1: Operation Code, Phase Stamp & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wider flex items-center gap-1.5">
              <span className="text-gray-500 text-xs sm:text-sm font-normal">OP:</span>
              <span className="text-classified-amber">{room.code}</span>
            </h1>
            <span
              id="room-phase-badge"
              className={`classified-stamp text-nano ${
                isInfiltration
                  ? "text-classified-crimson border-classified-crimson animate-pulse"
                  : "text-classified-terminal border-classified-terminal"
              }`}
            >
              {room.phase}
            </span>
            <span className="text-micro text-gray-400 font-mono hidden sm:inline-block">
              {"// "}
              <span className="text-gray-200 font-bold">{self.displayName}</span>
              {self.isHost && " ★"}
            </span>
          </div>

          {/* Action Tools Pill Strip */}
          <div className="flex items-center gap-1.5 font-mono text-micro flex-wrap">
            <button
              id="field-manual-btn"
              onClick={handleOpenManual}
              className="min-h-[44px] px-3 py-1.5 bg-carbon-900 hover:bg-carbon-850 border border-classified-amber/50 text-classified-amber rounded text-micro font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>MANUAL</span>
            </button>

            {room.phase !== "LOBBY" && notifPermission === "default" && (
              <button
                id="enable-notifications-btn"
                onClick={handleRequestNotifPermission}
                className="min-h-[44px] px-3 py-1.5 bg-carbon-900 hover:bg-carbon-850 border border-classified-amber text-classified-amber rounded text-micro font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer animate-pulse active:scale-95"
                title="Enable comms alerts"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>ALERTS</span>
              </button>
            )}

            {room.phase !== "LOBBY" && (
              <button
                id="toggle-stream-safe-btn"
                onClick={() => setIsStreamSafe(!isStreamSafe)}
                className={`min-h-[44px] px-3 py-1.5 bg-carbon-900 hover:bg-carbon-850 border rounded text-micro font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95 ${
                  isStreamSafe
                    ? "border-classified-crimson text-classified-crimson bg-red-950/30"
                    : "border-carbon-700 text-muted hover:text-white"
                }`}
                title="Toggle Stream-Safe Redaction mode"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isStreamSafe ? "STREAM ON" : "STREAM OFF"}</span>
              </button>
            )}

            {room.phase !== "LOBBY" && (
              <button
                id="copy-personal-link-btn"
                onClick={async () => {
                  if (typeof window === "undefined") return;
                  const token = self.sessionToken || getSessionToken();
                  const url = `${window.location.origin}/room/${room.code}?token=${token}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopiedPersonalLink(true);
                    setTimeout(() => setCopiedPersonalLink(false), 3000);
                  } catch {
                    // ignore
                  }
                }}
                className="min-h-[44px] px-3 py-1.5 bg-carbon-900 hover:bg-carbon-850 border border-classified-terminal/60 text-classified-terminal rounded text-micro font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
              >
                {copiedPersonalLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-classified-terminal" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-classified-terminal" />
                    <span>RECOVERY</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Operative callsign on mobile + Unified Telemetry Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 font-mono text-micro text-gray-400">
          <div className="flex items-center gap-1.5 sm:hidden">
            <span className="text-gray-500 text-nano uppercase">OPERATIVE:</span>
            <span className="text-white font-bold">{self.displayName}</span>
            {self.isHost && <span className="text-classified-amber font-bold">★ (CMD)</span>}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5 ml-auto sm:ml-0">
            {(isInfiltration || room.phase === "VERDICT") && (
              <div
                id="operational-timer-display"
                className="flex items-center gap-1.5 text-classified-crimson font-bold"
              >
                <Clock className="w-3.5 h-3.5 animate-spin text-classified-crimson shrink-0" />
                <span className="text-gray-400 text-nano uppercase">
                  {room.phase === "VERDICT" ? "VERDICT DELIBERATION:" : "MISSION TIME REMAINING:"}
                </span>
                <span id="timer-countdown" className="text-white font-mono font-bold tracking-wider">
                  {timeLeft}
                </span>
              </div>
            )}

            <div id="operatives-count-display" className="flex items-center gap-1 text-gray-400">
              <Users className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span>OPERATIVES: <strong className="text-white">{players.length}</strong></span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-gray-400">
              <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span>DURATION: <strong className="text-white">{room.durationHours}H</strong></span>
            </div>

            {isInfiltration && midpointLeft && !room.declassifiedTheme && (
              <div
                id="midpoint-countdown-badge"
                className="flex items-center gap-1 text-classified-amber"
              >
                <Radio className="w-3 h-3 text-classified-amber animate-pulse shrink-0" />
                <span className="text-nano text-gray-400 uppercase">INTERCEPT:</span>
                <span className="font-bold">T-{midpointLeft}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Midpoint Theme Declassification Broadcast Banner */}
      {room.declassifiedTheme && room.phase !== "DEBRIEF" && (
        <div
          id="declassified-theme-banner"
          className="mb-6 p-4 bg-classified-amber/10 border-2 border-classified-amber text-classified-amber rounded-lg font-mono shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-classified-amber text-black rounded font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 shrink-0">
              <Radio className="w-4 h-4 text-black animate-pulse" />
              DECLASSIFIED INTEL
            </div>
            <div>
              <div className="text-micro uppercase tracking-widest font-bold text-classified-amber/80">
                AUTOMATED INTELLIGENCE INTERCEPT // 50% TIMELINE REACHED
              </div>
              <div className="text-lg font-extrabold tracking-wider text-white">
                Operational Theme Confirmed:{" "}
                <span
                  id="declassified-theme-name"
                  className="underline decoration-classified-amber text-classified-amber uppercase"
                >
                  {room.declassifiedTheme}
                </span>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right text-xs text-classified-amber/70 font-mono shrink-0">
            <div className="font-bold text-white uppercase tracking-wider">CROSS-REFERENCE CODE WORDS</div>
            <div className="text-nano text-gray-400">UNMATCHED WORDS MAY INDICATE MOLE DECEPTION</div>
          </div>
        </div>
      )}

      {/* PHASE 1: LOBBY VIEW */}
      {room.phase === "LOBBY" ? (
        <div className="space-y-6">
          {/* Operation Secure Invite Link Banner */}
          <div
            id="room-invite-banner"
            className="bg-carbon-900 border border-classified-amber/50 rounded-lg p-4 sm:p-5 font-mono shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-classified-amber animate-ping shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Secure Uplink Link // Dispatch Operatives
                </h3>
              </div>
              <p className="text-micro text-gray-400">
                Share this direct room link or the Operation Code so other players can join this match.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-carbon-950 border border-carbon-700 px-3 py-2 rounded text-xs text-gray-300 font-mono select-all flex-1 md:flex-none">
                <LinkIcon className="w-3.5 h-3.5 text-classified-amber shrink-0" />
                <span id="room-invite-url" className="tracking-wider break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`}
                </span>
              </div>

              <button
                id="copy-invite-link-btn"
                onClick={async () => {
                  if (typeof window === "undefined") return;
                  const url = `${window.location.origin}/room/${room.code}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 3000);
                  } catch {
                    // ignore
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 bg-classified-amber/15 hover:bg-classified-amber/25 border border-classified-amber text-classified-amber rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-classified-terminal" />
                    <span className="text-classified-terminal">LINK COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY LINK</span>
                  </>
                )}
              </button>

              <button
                id="copy-room-code-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(room.code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 3000);
                  } catch {
                    // ignore
                  }
                }}
                className="px-3.5 py-2 bg-carbon-800 hover:bg-carbon-750 border border-carbon-600 text-white rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-classified-terminal" />
                    <span className="text-classified-terminal">CODE COPIED!</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-classified-amber" />
                    <span>CODE: {room.code}</span>
                  </>
                )}
              </button>

              <button
                id="copy-personal-link-btn"
                onClick={async () => {
                  if (typeof window === "undefined") return;
                  const token = self.sessionToken || getSessionToken();
                  const url = `${window.location.origin}/room/${room.code}?token=${token}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopiedPersonalLink(true);
                    setTimeout(() => setCopiedPersonalLink(false), 3000);
                  } catch {
                    // ignore
                  }
                }}
                className="px-3.5 py-2 bg-carbon-800 hover:bg-carbon-750 border border-classified-terminal/60 text-classified-terminal rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedPersonalLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-classified-terminal" />
                    <span className="text-classified-terminal">RECOVERY LINK COPIED!</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-classified-terminal" />
                    <span>MY RECOVERY LINK</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operative Roster Panel */}
          <div className="lg:col-span-2 bg-carbon-900 border border-carbon-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 border-b border-carbon-800 pb-3">
              <span className="text-xs font-mono uppercase text-gray-400 tracking-wider">
                Active Operatives ({players.length})
              </span>
              <span className="text-xs font-mono text-gray-500">
                MIN: 6 // MAX: 12 (ODD OR EVEN)
              </span>
            </div>

            <div className="space-y-3" id="player-roster">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3.5 rounded border font-mono text-sm ${
                    player.id === self.id
                      ? "bg-carbon-850 border-classified-amber/50"
                      : "bg-carbon-950 border-carbon-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 font-mono">
                      {player.isHost ? "★" : "•"}
                    </span>
                    <span className="font-bold text-white tracking-wide">
                      {player.displayName}
                    </span>
                    {player.id === self.id && (
                      <span className="text-nano bg-carbon-800 text-classified-amber px-2 py-0.5 rounded border border-carbon-700">
                        YOU
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-nano bg-carbon-800 text-gray-400 px-2 py-0.5 rounded border border-carbon-700">
                        COMMANDER
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {player.isReady ? (
                      <span className="flex items-center gap-1.5 text-xs text-classified-terminal">
                        <CheckCircle2 className="w-4 h-4" /> READY
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Circle className="w-4 h-4" /> STANDBY
                      </span>
                    )}

                    {self.isHost && player.id !== self.id && (
                      <button
                        id={`kick-player-${player.id}`}
                        onClick={() => handleKickPlayer(player.id)}
                        title={`Dismiss ${player.displayName}`}
                        className="ml-2 min-h-[44px] px-3 py-2 bg-red-950/60 hover:bg-red-900 border border-classified-crimson/50 text-classified-crimson hover:text-white rounded text-nano font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center"
                      >
                        DISMISS
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action & Status Dossier Panel */}
          <div className="space-y-6">
            <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-6">
              <h2 className="text-sm font-bold font-mono text-white mb-2 uppercase tracking-wider">
                Status Clearance
              </h2>
              <p className="text-xs text-gray-400 font-mono mb-4">
                Signal your operational readiness to Central Command.
              </p>
              <button
                id="toggle-ready-btn"
                onClick={handleToggleReady}
                disabled={isTogglingReady}
                className={`w-full min-h-[48px] py-3.5 px-4 font-mono font-bold text-xs tracking-wider uppercase rounded transition-colors active:scale-[0.99] cursor-pointer ${
                  self.isReady
                    ? "bg-carbon-800 text-gray-300 hover:bg-carbon-700 border border-carbon-600"
                    : "bg-classified-terminal text-black hover:bg-green-400"
                }`}
              >
                {self.isReady ? "CANCEL READY STATUS" : "DECLARE OPERATIONAL READY"}
              </button>

              <div className="mt-3 pt-3 border-t border-carbon-800 flex flex-col items-center gap-2 text-center">
                <button
                  id="leave-operation-btn"
                  onClick={handleLeaveOperation}
                  className="min-h-[44px] py-2 text-micro text-classified-crimson hover:text-red-400 uppercase tracking-wider font-mono transition-colors cursor-pointer"
                >
                  Leave Operation / Vacate Roster Spot
                </button>
                <button
                  id="disconnect-station-btn"
                  onClick={handleDisconnectStation}
                  className="min-h-[44px] py-2 text-micro text-gray-500 hover:text-gray-400 uppercase tracking-wider font-mono transition-colors cursor-pointer"
                >
                  Disconnect Station (Keep Roster Spot)
                </button>
              </div>
            </div>

            <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-6 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-gray-300 font-bold border-b border-carbon-800 pb-2">
                <ShieldCheck className="w-4 h-4 text-classified-amber" />
                <span>DEPLOYMENT CRITERIA</span>
              </div>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center justify-between">
                  <span>Roster Count:</span>
                  <span className={players.length >= 6 ? "text-classified-terminal" : "text-gray-500"}>
                    {players.length} (Min 6)
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Roster Quorum:</span>
                  <span className={isRosterValid ? "text-classified-terminal" : "text-gray-500"}>
                    {players.length}/6-12 (ODD OR EVEN)
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Readiness:</span>
                  <span className={allReady ? "text-classified-terminal" : "text-gray-500"}>
                    {players.filter((p) => p.isReady).length}/{players.length} READY
                  </span>
                </li>
              </ul>

              {self.isHost && (
                <button
                  id="start-operation-btn"
                  onClick={handleStartOperation}
                  disabled={!isRosterValid || !allReady || isStartingOperation}
                  className="w-full min-h-[48px] mt-4 py-3.5 bg-classified-crimson hover:bg-red-800 disabled:opacity-30 text-white font-bold tracking-wider uppercase rounded transition-colors text-xs active:scale-[0.99] cursor-pointer"
                >
                  {isStartingOperation ? "INITIALIZING INFILTRATION..." : "AUTHORIZE DEPLOYMENT"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : room.phase === "DEBRIEF" ? (
        /* PHASE 3: DEBRIEF VIEW (DECLASSIFIED MASTER CODEBOOK + UNMASKED IDENTITIES + REMATCH) */
        <div className="space-y-8" id="debrief-view">
          {/* Victory Announcement Banner */}
          <div
            id="debrief-winner-banner"
            className={`p-6 rounded-lg border-2 font-mono shadow-2xl relative overflow-hidden ${
              room.winner === "RED"
                ? "bg-red-950/30 border-red-600 text-red-100"
                : room.winner === "BLUE"
                ? "bg-blue-950/30 border-blue-600 text-blue-100"
                : "bg-carbon-900 border-classified-amber text-amber-100"
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Trophy
                  className={`w-8 h-8 ${
                    room.winner === "RED"
                      ? "text-red-500"
                      : room.winner === "BLUE"
                      ? "text-blue-500"
                      : "text-classified-amber"
                  }`}
                />
                <div>
                  <span className="text-nano uppercase tracking-widest text-gray-400 block">
                    CLASSIFIED MISSION DEBRIEF // ALL OBJECTIVES TERMINATED
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                    {room.winner === "RED"
                      ? "CRIMSON PACT VICTORY"
                      : room.winner === "BLUE"
                      ? "COBALT SYNDICATE VICTORY"
                      : "STALEMATE // OPERATIONAL DRAW"}
                  </h1>
                </div>
              </div>
              <span className="classified-stamp text-xs text-classified-crimson border-classified-crimson shrink-0">
                MISSION DECLASSIFIED
              </span>
            </div>

            {/* Tiebreaker Resolution Notice if applicable */}
            {(allVerdicts?.RED?.tiebreakerBonus || allVerdicts?.BLUE?.tiebreakerBonus) && (
              <div
                id="tiebreaker-notice"
                className="mb-4 p-3 bg-carbon-950/80 border border-classified-amber/60 rounded text-xs text-classified-amber flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {room.winner === "DRAW" ? (
                    <>
                      MUTUAL TIEBREAKER: Base word scores were tied and both commands accurately indicted the enemy mole (+20% each). Operational Stalemate maintained.
                    </>
                  ) : (
                    <>
                      TIEBREAKER RESOLVED: Base word scores were tied. The +20% Mole Indictment bonus awarded victory to{" "}
                      <strong className="underline uppercase">{room.winner} FACTION</strong>!
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Final Scoreboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Red Final Score */}
              <div
                id="red-final-score"
                className={`p-4 rounded border font-mono ${
                  room.winner === "RED"
                    ? "bg-red-950/60 border-red-500 ring-1 ring-red-500"
                    : "bg-carbon-950 border-red-900/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-red-400 text-sm flex items-center gap-2">
                    <Flag className="w-4 h-4" /> RED FACTION
                  </span>
                  <span className="text-xs text-gray-400">
                    Verified by: {allVerdicts?.RED?.confirmedByNames?.join(", ") || allVerdicts?.RED?.submittedByName || "Consensus"}
                  </span>
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  {allVerdicts?.RED?.score ?? 0}%{" "}
                  <span className="text-xs font-normal text-gray-400">RATING</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1 border-t border-red-900/40 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Enemy Extraction:</span>
                    <span className="text-classified-terminal font-bold">
                      +{allVerdicts?.RED?.enemyExtractionScore ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Internal Sabotage Penalty:</span>
                    <span className={(allVerdicts?.RED?.internalDeductionScore ?? 0) > 0 ? "text-red-400 font-bold" : "text-gray-400"}>
                      -{allVerdicts?.RED?.internalDeductionScore ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mole Indictment Bonus:</span>
                    <span className={(allVerdicts?.RED?.moleBonusScore ?? 0) > 0 ? "text-classified-terminal font-bold" : "text-gray-400"}>
                      +{(allVerdicts?.RED?.moleBonusScore ?? 0)}%
                    </span>
                  </div>
                  {allVerdicts?.RED?.moleIndictmentName && (
                    <div className="flex justify-between text-micro text-gray-400 border-t border-red-900/20 pt-1">
                      <span>Indicted Operative:</span>
                      <span className="text-red-300">{allVerdicts.RED.moleIndictmentName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Blue Final Score */}
              <div
                id="blue-final-score"
                className={`p-4 rounded border font-mono ${
                  room.winner === "BLUE"
                    ? "bg-blue-950/60 border-blue-500 ring-1 ring-blue-500"
                    : "bg-carbon-950 border-blue-900/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-blue-400 text-sm flex items-center gap-2">
                    <Flag className="w-4 h-4" /> BLUE FACTION
                  </span>
                  <span className="text-xs text-gray-400">
                    Verified by: {allVerdicts?.BLUE?.confirmedByNames?.join(", ") || allVerdicts?.BLUE?.submittedByName || "Consensus"}
                  </span>
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  {allVerdicts?.BLUE?.score ?? 0}%{" "}
                  <span className="text-xs font-normal text-gray-400">RATING</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1 border-t border-blue-900/40 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Enemy Extraction:</span>
                    <span className="text-classified-terminal font-bold">
                      +{allVerdicts?.BLUE?.enemyExtractionScore ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Internal Sabotage Penalty:</span>
                    <span className={(allVerdicts?.BLUE?.internalDeductionScore ?? 0) > 0 ? "text-red-400 font-bold" : "text-gray-400"}>
                      -{allVerdicts?.BLUE?.internalDeductionScore ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mole Indictment Bonus:</span>
                    <span className={(allVerdicts?.BLUE?.moleBonusScore ?? 0) > 0 ? "text-classified-terminal font-bold" : "text-gray-400"}>
                      +{(allVerdicts?.BLUE?.moleBonusScore ?? 0)}%
                    </span>
                  </div>
                  {allVerdicts?.BLUE?.moleIndictmentName && (
                    <div className="flex justify-between text-micro text-gray-400 border-t border-blue-900/20 pt-1">
                      <span>Indicted Operative:</span>
                      <span className="text-blue-300">{allVerdicts.BLUE.moleIndictmentName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Master Codebook Declassification Matrix */}
          <div id="debrief-codebook" className="bg-carbon-900 border border-carbon-800 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between mb-4 border-b border-carbon-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-classified-amber" />
                <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                  Master Codebook Declassification Matrix
                </h3>
              </div>
              <span className="text-xs text-gray-500">
                ALL {players.length} ENCRYPTED CIPHERS UNLOCKED
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-carbon-800 text-gray-400 uppercase tracking-wider bg-carbon-950/60">
                    <th className="py-2.5 px-3">Secret Code Word</th>
                    <th className="py-2.5 px-3">Assigned Operative</th>
                    <th className="py-2.5 px-3">Cover / True Allegiance</th>
                    <th className="py-2.5 px-3 text-center">Red Verdict</th>
                    <th className="py-2.5 px-3 text-center">Blue Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-800">
                  {players.map((p) => {
                    const word = p.assignedWord || codebook?.[p.id] || "UNKNOWN";
                    const normalizeWord = (w: string) => w.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
                    const redGuessed = allVerdicts?.RED?.guesses?.some(
                      (g) => normalizeWord(g) === normalizeWord(word)
                    );
                    const blueGuessed = allVerdicts?.BLUE?.guesses?.some(
                      (g) => normalizeWord(g) === normalizeWord(word)
                    );

                    return (
                      <tr key={p.id} className="hover:bg-carbon-850/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-classified-amber tracking-wider text-sm uppercase">
                          {word.toUpperCase()}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {p.displayName}
                            {p.id === self.id && (
                              <span className="text-nano bg-carbon-800 text-classified-amber px-1.5 py-0.2 rounded border border-carbon-700">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-nano font-bold ${
                                p.apparentTeam === "RED"
                                  ? "bg-red-950/80 text-red-400 border border-red-800"
                                  : "bg-blue-950/80 text-blue-400 border border-blue-800"
                              }`}
                            >
                              {p.apparentTeam} COVER
                            </span>
                            {p.role === "MOLE" && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-nano font-bold ${
                                  p.actualTeam === "RED"
                                    ? "bg-red-900 text-red-200"
                                    : "bg-blue-900 text-blue-200"
                                }`}
                              >
                                ACTUAL: {p.actualTeam}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {redGuessed ? (
                            <span className="inline-flex items-center gap-1 text-classified-terminal font-bold bg-green-950/40 px-2 py-0.5 rounded border border-green-800/60">
                              <CheckCircle2 className="w-3 h-3" /> HIT (+1)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500 bg-carbon-950 px-2 py-0.5 rounded border border-carbon-800">
                              MISSED (0)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {blueGuessed ? (
                            <span className="inline-flex items-center gap-1 text-classified-terminal font-bold bg-green-950/40 px-2 py-0.5 rounded border border-green-800/60">
                              <CheckCircle2 className="w-3 h-3" /> HIT (+1)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500 bg-carbon-950 px-2 py-0.5 rounded border border-carbon-800">
                              MISSED (0)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* True Operative Roster & Traitor Unmasking */}
          <div id="debrief-roster" className="bg-carbon-900 border border-carbon-800 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between mb-4 border-b border-carbon-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                  True Operative Roster & Counter-Intelligence File
                </h3>
              </div>
              <span className="text-xs text-gray-500">
                ALL COVERT IDENTITIES REVEALED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((p) => {
                const isSelf = p.id === self.id;
                const isMole = p.role === "MOLE";
                const won = room.winner !== "DRAW" && p.actualTeam === room.winner;
                const draw = room.winner === "DRAW";

                return (
                  <div
                    key={p.id}
                    id={`operative-dossier-${p.id}`}
                    className={`p-4 rounded-lg border relative transition-all ${
                      isMole
                        ? "bg-red-950/20 border-classified-crimson/80"
                        : "bg-carbon-950 border-carbon-800"
                    }`}
                  >
                    {isMole && (
                      <div className="mb-2">
                        <span
                          id={`mole-reveal-${p.id}`}
                          className="classified-stamp text-nano text-classified-crimson border-classified-crimson bg-red-950/70 block text-center"
                        >
                          TRAITOR UNMASKED // ENEMY MOLE
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        {p.displayName}
                        {isSelf && (
                          <span className="text-nano bg-carbon-800 text-classified-amber px-1.5 py-0.2 rounded border border-carbon-700">
                            YOU
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-nano font-bold px-2 py-0.5 rounded uppercase ${
                          p.role === "MOLE"
                            ? "bg-red-900 text-red-200 border border-red-700"
                            : "bg-gray-800 text-gray-300 border border-gray-700"
                        }`}
                      >
                        {p.role}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-400 border-t border-carbon-800/80 pt-2 mb-3">
                      <div className="flex justify-between">
                        <span>Apparent Cover:</span>
                        <span className={p.apparentTeam === "RED" ? "text-red-400" : "text-blue-400"}>
                          {p.apparentTeam} FACTION
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>True Allegiance:</span>
                        <span className={p.actualTeam === "RED" ? "text-red-400" : "text-blue-400"}>
                          {p.actualTeam} FACTION
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned Code Word:</span>
                        <span className="text-classified-amber font-bold uppercase">
                          {(p.assignedWord || codebook?.[p.id] || "N/A").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Individual Outcome: Moles win if and only if their ACTUAL team wins */}
                    <div className="border-t border-carbon-800/80 pt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-500 uppercase text-nano">Operative Result:</span>
                      {draw ? (
                        <span className="font-bold text-classified-amber">STALEMATE (DRAW)</span>
                      ) : won ? (
                        <span
                          id={`operative-outcome-${p.id}`}
                          className="font-bold text-classified-terminal flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> VICTORY
                        </span>
                      ) : (
                        <span
                          id={`operative-outcome-${p.id}`}
                          className="font-bold text-red-400 flex items-center gap-1"
                        >
                          DEFEAT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rematch Section */}
          <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-6 font-mono text-center">
            {self.isHost ? (
              <div className="max-w-md mx-auto space-y-3">
                <h4 className="text-sm font-bold uppercase text-white tracking-wider">
                  Operation Debrief Concluded
                </h4>
                <p className="text-xs text-gray-400">
                  As Operation Commander, you may authorize a new deployment. All operatives will remain connected and return to the ready briefing lobby.
                </p>
                <button
                  id="rematch-btn"
                  onClick={handleRematch}
                  disabled={isRematching}
                  className="w-full py-3 bg-classified-crimson hover:bg-red-800 disabled:opacity-40 text-white font-bold tracking-wider uppercase rounded transition-colors text-xs flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isRematching ? "animate-spin" : ""}`} />
                  {isRematching ? "RESETTING OPERATIONS..." : "COMMENCE REMATCH // RETURN TO LOBBY"}
                </button>
              </div>
            ) : (
              <div id="rematch-standby-notice" className="text-xs text-gray-400 space-y-1">
                <div className="text-classified-amber font-bold uppercase tracking-wider">
                  STANDBY FOR FURTHER DIRECTIVES
                </div>
                <p>Awaiting Operation Commander to authorize new mission deployment...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PHASE 2: INFILTRATION VIEW (CLASSIFIED DOSSIER + INTELLIGENCE COMMS) */
        <div className="space-y-6">
          {/* Top Secret Operative Dossier Card */}
          <div id="top-secret-dossier" className="bg-carbon-900 border border-carbon-700 rounded-lg p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-2">
              <span className="classified-stamp text-xs text-classified-crimson border-classified-crimson opacity-80">
                TOP SECRET // EYES ONLY
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Radio className="w-5 h-5 text-classified-amber" />
              <h2 className="text-base font-bold font-mono text-white uppercase tracking-wider">
                Classified Operative Dossier
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-sm border-t border-carbon-800 pt-4">
              {/* Apparent Cover & Clearance Station */}
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Apparent Cover</div>
                  <p className="text-nano text-gray-400 font-mono mt-0.5">Assigned Operational Faction</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    id="self-apparent-team"
                    data-apparent-team={self.apparentTeam}
                    className={`px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-widest border ${
                      self.apparentTeam === "RED"
                        ? "bg-red-950/40 border-red-800 text-red-400"
                        : "bg-blue-950/40 border-blue-800 text-blue-400"
                    }`}
                  >
                    {self.apparentTeam} TEAM
                  </span>
                </div>

                {/* Preserves data attributes for automated harness with zero visible allegiance on screen */}
                <span id="self-actual-team" data-actual-team={self.actualTeam} className="sr-only" aria-hidden="true">
                  {self.actualTeam}
                </span>

                <div className="pt-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Clearance Status</div>
                  <p className="text-nano text-gray-400 font-mono mt-0.5">Verified Station Connection</p>
                  <div className="font-bold tracking-wider text-xs uppercase text-emerald-400 flex items-center gap-1.5 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>AUTHENTICATED OPERATIVE</span>
                  </div>
                </div>
              </div>

              {/* Symmetrical Role & Objective */}
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Assigned Role</div>
                <div className="flex items-center gap-2">
                  <span
                    id="self-role"
                    data-actual-role={self.role}
                    className="px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider border bg-carbon-850 border-carbon-700 text-gray-300"
                  >
                    AGENT
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono pt-1">
                  Field Operative. Protect your code word, extract opposing words, and uncover the mole in your ranks.
                </p>
              </div>

              {/* Secret Code Word & Hold-to-Decrypt Anti-Peeking */}
              <div className="space-y-2 bg-carbon-950/70 p-3.5 sm:p-4 rounded-sm border border-carbon-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-classified-amber" /> Secret Code Word
                    </span>
                    <span className="text-nano text-gray-500 uppercase">
                      {isDecrypted ? "DECRYPTED" : "REDACTED"}
                    </span>
                  </div>

                  <div className="py-2 min-h-[40px] flex items-center">
                    {isDecrypted ? (
                      <span
                        id="self-assigned-word"
                        data-authentic-word={self.assignedWord}
                        className="text-xl font-bold font-mono tracking-widest text-classified-amber bg-amber-950/30 px-3 py-1 rounded-sm border border-amber-700/50 inline-block uppercase"
                      >
                        {isStreamSafe ? "•••••••• (STREAM-SAFE)" : (spoofWord || self.assignedWord)}
                      </span>
                    ) : (
                      <span
                        id="self-word-redacted"
                        className="redacted-bar px-4 py-1 text-sm font-mono tracking-widest border border-carbon-700"
                      >
                        ██████████
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    id="decrypt-word-btn"
                    tabIndex={0}
                    role="button"
                    aria-label="Hold Space, Enter, or pointer to decrypt secret code word"
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        if (!isDecrypted) handleDecryptStart();
                      }
                    }}
                    onKeyUp={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleDecryptEnd();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleDecryptStart();
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      handleDecryptEnd();
                    }}
                    onPointerCancel={() => handleDecryptEnd()}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleDecryptStart();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleDecryptEnd();
                    }}
                    onTouchCancel={() => handleDecryptEnd()}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleDecryptStart();
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      handleDecryptEnd();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                      touchAction: "manipulation",
                    }}
                    className={`w-full min-h-[44px] py-2.5 px-3 bg-carbon-850 hover:bg-carbon-800 active:bg-classified-amber active:text-black border border-carbon-700 rounded-sm text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center justify-center gap-2 transition-colors select-none cursor-pointer ${
                      isDecrypted ? "hold-progress-active" : ""
                    }`}
                  >
                    {isDecrypted ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> RELEASE TO CONCEAL
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> HOLD TO DECRYPT
                      </>
                    )}
                  </button>

                  <button
                    id="configure-spoof-word-btn"
                    type="button"
                    onClick={() => {
                      setSpoofModalInput(spoofWord || "");
                      setIsSpoofModalOpen(true);
                    }}
                    className="w-full min-h-[44px] py-2 px-3 bg-carbon-900 hover:bg-carbon-850 active:scale-[0.99] border border-carbon-700/80 hover:border-carbon-600 rounded-sm text-xs font-mono font-bold uppercase tracking-wider text-gray-400 hover:text-classified-amber flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-classified-amber" />
                    <span>CONFIGURE DECOY WORD</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CLASSIFIED TEAM VERDICT DELIBERATION BOARD */}
          {room.phase === "VERDICT" && (
            <div
              id="verdict-board"
              className={`mb-6 p-6 rounded-lg border font-mono ${
                self.apparentTeam === "RED"
                  ? "bg-red-950/20 border-red-800/80 shadow-red-950/40"
                  : "bg-blue-950/20 border-blue-800/80 shadow-blue-950/40"
              } shadow-2xl`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-carbon-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${
                        self.apparentTeam === "RED" ? "bg-red-500" : "bg-blue-500"
                      }`}
                    />
                    TEAM VERDICT DELIBERATION // {self.apparentTeam} COMMAND
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Target: Assemble all {players.length} global code words. Score: +1 per correct word, 0 for incorrect guesses.
                  </p>
                </div>
                <div className="text-xs text-right">
                  <span className="text-gray-500">MAX GUESSES: </span>
                  <strong className="text-classified-amber">{players.length} WORDS</strong>
                </div>
              </div>

              {/* Already Submitted Verdict Display */}
              {gameState?.teamVerdict ? (
                <div
                  id="verdict-locked-badge"
                  className="p-4 bg-emerald-950/80 border border-emerald-500 rounded text-emerald-300 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                    <div>
                      <div className="font-bold uppercase tracking-wider text-xs text-emerald-400">
                        OFFICIAL VERDICT LOCKED IN
                      </div>
                      <div className="text-sm">
                        Verified by <strong>{gameState.teamVerdict.submittedByName}</strong> and{" "}
                        <strong>{gameState.teamVerdict.confirmedByNames?.filter((n) => n !== gameState.teamVerdict?.submittedByName).join(", ") || "Teammate"}</strong>. Awaiting opponent command...
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" id="locked-guesses-list">
                    {gameState.teamVerdict.guesses.map((g, i) => (
                      <span
                        key={i}
                        className="bg-emerald-900/60 border border-emerald-600 text-emerald-200 px-2 py-0.5 rounded text-xs font-bold uppercase"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Two-Member Consensus Pending Proposal Banner */}
                  {gameState?.proposedVerdict && (
                    <div
                      id="pending-proposal-card"
                      className="p-4 bg-carbon-900 border-2 border-classified-amber rounded mb-6 space-y-3 shadow-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-carbon-800 pb-2">
                        <div className="flex items-center gap-2 text-classified-amber font-bold text-xs uppercase tracking-wider">
                          <Users className="w-4 h-4" />
                          <span>PENDING TEAM VERDICT PROPOSAL</span>
                          <span className="bg-amber-950 border border-amber-800 px-2 py-0.5 rounded text-nano text-amber-300 font-bold">
                            {gameState.proposedVerdict.confirmedBy.length}/2 CONFIRMED
                          </span>
                        </div>
                        <span className="text-nano text-gray-400">
                          Proposed by <strong className="text-white">{gameState.proposedVerdict.proposedByName}</strong>
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-micro text-gray-400 uppercase font-bold tracking-wider block">
                          Proposed Code Words ({gameState.proposedVerdict.guesses.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5" id="proposed-guesses-list">
                          {gameState.proposedVerdict.guesses.map((w, idx) => (
                            <span
                              key={idx}
                              className="bg-carbon-950 border border-classified-amber/60 text-classified-amber px-2.5 py-1 rounded text-xs font-bold uppercase"
                            >
                              {isStreamSafe ? "••••••••" : w}
                            </span>
                          ))}
                        </div>
                      </div>

                      {gameState.proposedVerdict.moleIndictmentName && (
                        <div className="text-xs text-gray-300 flex items-center gap-2">
                          <span className="text-micro text-gray-500 uppercase font-bold">Suspected Mole Indictment:</span>
                          <span className="text-red-400 font-bold bg-red-950/60 border border-red-800 px-2 py-0.5 rounded text-micro">
                            {gameState.proposedVerdict.moleIndictmentName}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-carbon-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-nano text-gray-400">
                          Confirmed by: <strong className="text-white">{gameState.proposedVerdict.confirmedByNames.join(", ")}</strong>
                        </span>

                        {gameState.proposedVerdict.confirmedBy.includes(self.id) ? (
                          <span className="text-xs text-classified-terminal font-bold flex items-center gap-1.5">
                            <Check className="w-4 h-4" /> YOU CONFIRMED — AWAITING TEAMMATE (1/2)
                          </span>
                        ) : (
                          <button
                            id="confirm-verdict-btn"
                            disabled={isSubmittingVerdict}
                            onClick={() => executeSubmitVerdict(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded text-xs uppercase tracking-widest transition-colors shadow-lg border border-emerald-400 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer active:scale-95"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            {isSubmittingVerdict ? "LOCKING IN..." : "CONFIRM & LOCK IN VERDICT (2/2)"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Collaborative Verdict Builder */}
                  <div className="p-4 bg-carbon-950 border border-carbon-700/80 rounded mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-classified-amber flex items-center gap-1.5">
                        <Users className="w-4 h-4" /> ASSEMBLE VERDICT SLATE (TWO-MEMBER CONSENSUS)
                      </span>
                      <span id="guesses-count" className="text-xs font-mono text-gray-400">
                        SELECTED: <strong className="text-white">{verdictGuesses.length}/{players.length}</strong>
                      </span>
                    </div>

                    {/* Add Word Input */}
                    <div className="flex gap-2">
                      <input
                        id="verdict-word-input"
                        type={isStreamSafe ? "password" : "text"}
                        value={verdictWordInput}
                        onChange={(e) => setVerdictWordInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddVerdictGuess()}
                        placeholder="Enter candidate code word..."
                        className="flex-1 bg-carbon-900 border border-carbon-700 rounded px-3 py-2 text-base sm:text-xs text-white uppercase focus:outline-none focus:border-classified-amber min-h-[44px]"
                      />
                      <button
                        id="add-guess-btn"
                        onClick={() => handleAddVerdictGuess()}
                        className="bg-carbon-800 hover:bg-carbon-700 text-classified-amber border border-classified-amber/40 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider min-h-[44px] active:scale-95 cursor-pointer"
                      >
                        + ADD GUESS
                      </button>
                    </div>

                    {/* Draft Guesses Badges */}
                    <div className="flex flex-wrap gap-2 min-h-[36px] p-2 bg-carbon-900/60 rounded border border-carbon-800" id="draft-guesses-container">
                      {verdictGuesses.length === 0 ? (
                        <span className="text-xs text-gray-600 italic">No code words added to your draft slate yet. Add words or click candidate words below.</span>
                      ) : (
                        verdictGuesses.map((w) => (
                          <span
                            key={w}
                            id={`draft-guess-${w.toLowerCase()}`}
                            className="bg-carbon-800 border border-classified-amber/60 text-classified-amber text-xs px-2.5 py-1.5 rounded flex items-center gap-1.5 font-bold uppercase shadow min-h-[44px]"
                          >
                            <span>{isStreamSafe ? "••••••••" : w}</span>
                            <button
                              onClick={() => handleRemoveVerdictGuess(w)}
                              className="text-gray-400 hover:text-red-400 font-bold ml-1 cursor-pointer p-1 -m-1"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Tiebreaker Mole Indictment */}
                    <div className="pt-2 border-t border-carbon-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor="mole-indictment-select" className="text-xs text-gray-400 uppercase">
                          Mole Indictment (+20% Bonus):
                        </label>
                        <select
                          id="mole-indictment-select"
                          value={moleIndictmentId}
                          onChange={(e) => setMoleIndictmentId(e.target.value)}
                          className="bg-carbon-900 border border-carbon-700 text-xs text-classified-amber rounded px-3 py-2 font-mono uppercase min-h-[44px]"
                        >
                          <option value="">-- No Indictment --</option>
                          {players
                            .filter((p) => p.id !== self.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.displayName} ({p.apparentTeam})
                              </option>
                            ))}
                        </select>
                      </div>

                      <button
                        id="lock-in-verdict-btn"
                        disabled={isSubmittingVerdict || verdictGuesses.length === 0}
                        onClick={handleSubmitVerdict}
                        className="bg-classified-crimson hover:bg-red-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded text-xs uppercase tracking-widest transition-colors shadow-lg border border-red-500 flex items-center justify-center gap-2 min-h-[44px] active:scale-95 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {isSubmittingVerdict ? "TRANSMITTING PROPOSAL..." : "PROPOSE TEAM VERDICT"}
                      </button>
                    </div>

                    {verdictError && (
                      <div className="text-xs text-red-400 bg-red-950/60 border border-red-800 p-2 rounded">
                        {verdictError}
                      </div>
                    )}
                  </div>

                  {/* Collaborative Proposal Board */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        COLLABORATIVE TEAM PROPOSALS
                      </span>
                      <span className="text-micro text-gray-500">
                        {gameState?.teamSuggestions?.length || 0} WORDS ON BOARD
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        id="proposal-word-input"
                        type={isStreamSafe ? "password" : "text"}
                        value={proposalInput}
                        onChange={(e) => setProposalInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleProposeWord()}
                        placeholder="Suggest candidate word..."
                        className="flex-1 bg-carbon-900 border border-carbon-700 rounded px-3 py-2 text-base sm:text-xs text-white uppercase focus:outline-none focus:border-classified-amber font-mono min-h-[44px]"
                      />
                      <button
                        id="propose-word-btn"
                        disabled={isProposing || !proposalInput.trim()}
                        onClick={handleProposeWord}
                        className="bg-carbon-800 hover:bg-carbon-700 text-white border border-carbon-600 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider min-h-[44px] active:scale-95 cursor-pointer"
                      >
                        {isProposing ? "ADDING..." : "+ PROPOSE WORD"}
                      </button>
                    </div>

                    {/* Suggestions List */}
                    <div className="space-y-2 mt-3" id="suggestions-list">
                      {!gameState?.teamSuggestions || gameState.teamSuggestions.length === 0 ? (
                        <div className="text-center py-4 text-gray-600 text-xs italic">
                          No candidate words suggested yet. Type a word above to propose it to your team.
                        </div>
                      ) : (
                        gameState.teamSuggestions.map((s) => {
                          const hasVoted = s.votes.includes(self.id);
                          return (
                            <div
                              key={s.id}
                              id={`suggestion-item-${s.word.toLowerCase()}`}
                              className="p-2.5 bg-carbon-900 border border-carbon-800 rounded flex items-center justify-between gap-3 text-xs min-h-[48px]"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-white text-sm tracking-wider uppercase">
                                  {isStreamSafe ? "••••••••" : s.word}
                                </span>
                                <span className="text-nano text-gray-500">
                                  suggested by {s.suggestedBy}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  id={`upvote-btn-${s.id}`}
                                  onClick={() => handleVoteSuggestion(s.id)}
                                  className={`flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded text-xs font-bold uppercase transition-colors cursor-pointer ${
                                    hasVoted
                                      ? "bg-classified-amber text-black"
                                      : "bg-carbon-800 text-gray-300 hover:text-white border border-carbon-700"
                                  }`}
                                >
                                  ▲ <span id={`suggestion-votes-${s.id}`}>{s.votes.length}</span>
                                </button>

                                <button
                                  id={`adopt-word-btn-${s.id}`}
                                  onClick={() => handleAddVerdictGuess(s.word)}
                                  className="bg-carbon-800 hover:bg-carbon-700 text-classified-amber border border-classified-amber/30 px-3 py-2 rounded text-micro uppercase font-bold min-h-[44px] flex items-center justify-center cursor-pointer"
                                >
                                  + ADOPT
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* INTELLIGENCE COMMUNICATIONS & FIELD SUITE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Communication Panel (2 Columns) */}
            <div
              id="comms-panel"
              className="lg:col-span-2 bg-carbon-900 border-2 border-carbon-800 rounded-lg flex flex-col h-[480px] sm:h-[520px] lg:h-[560px] overflow-hidden scroll-mt-24 shadow-2xl"
            >
              {/* Incoming Clearance Challenge Modal/Banner */}
              {gameState?.incomingChallenges && gameState.incomingChallenges.length > 0 && (
                <div
                  id="clearance-challenge-modal"
                  className="bg-amber-950/80 border-b border-amber-500/60 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono text-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                    <div>
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        Security Clearance Challenge:
                      </span>{" "}
                      Received from{" "}
                      <strong className="text-white">
                        {gameState.incomingChallenges[0].requesterName}
                      </strong>
                      . Submit counter-signature?
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="submit-counter-signature-btn"
                      disabled={challengeActionLoading}
                      onClick={() =>
                        handleRespondChallenge(gameState.incomingChallenges![0].id, "ACCEPT")
                      }
                      className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-bold px-3.5 py-2 rounded text-micro uppercase tracking-wider transition-colors border border-emerald-500 shadow min-h-[44px] flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      {challengeActionLoading ? "TRANSMITTING..." : "SUBMIT COUNTER-SIGNATURE"}
                    </button>
                    <button
                      id="decline-challenge-btn"
                      disabled={challengeActionLoading}
                      onClick={() =>
                        handleRespondChallenge(gameState.incomingChallenges![0].id, "DENY")
                      }
                      className="bg-carbon-800 hover:bg-carbon-700 text-gray-300 font-bold px-3.5 py-2 rounded text-micro uppercase tracking-wider transition-colors border border-carbon-600 min-h-[44px] flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              )}

              {/* Channel Tabs */}
              <div className="flex border-b border-carbon-800 bg-carbon-950/60 p-1.5 gap-1.5 font-mono text-xs">
                <button
                  id="tab-public"
                  onClick={() => {
                    setActiveTab("PUBLIC");
                    setLastReadTimestamps((prev) => ({ ...prev, PUBLIC: Date.now() }));
                  }}
                  className={`flex-1 py-2 px-2 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer whitespace-nowrap text-micro sm:text-xs ${
                    activeTab === "PUBLIC"
                      ? "bg-carbon-800 text-white border border-carbon-700 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">PUBLIC</span>
                  {messages.some(
                    (m) =>
                      m.channelType === "PUBLIC" &&
                      m.senderId !== self.id &&
                      new Date(m.createdAt).getTime() > (lastReadTimestamps["PUBLIC"] || 0) &&
                      activeTab !== "PUBLIC"
                  ) && (
                    <span
                      id="unread-badge-public"
                      className="w-2 h-2 rounded-full bg-classified-amber animate-pulse shrink-0 ml-0.5"
                      title="Unread transmissions"
                    />
                  )}
                </button>
                <button
                  id="tab-team"
                  onClick={() => {
                    setActiveTab("TEAM");
                    setLastReadTimestamps((prev) => ({ ...prev, TEAM: Date.now() }));
                  }}
                  className={`flex-1 py-2 px-2 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer whitespace-nowrap text-micro sm:text-xs ${
                    activeTab === "TEAM"
                      ? self.apparentTeam === "RED"
                        ? "bg-red-950/80 text-red-300 border border-red-800 shadow"
                        : "bg-blue-950/80 text-blue-300 border border-blue-800 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{self.apparentTeam} RADIO</span>
                  {messages.some(
                    (m) =>
                      m.channelType.startsWith("TEAM") &&
                      m.senderId !== self.id &&
                      new Date(m.createdAt).getTime() > (lastReadTimestamps["TEAM"] || 0) &&
                      activeTab !== "TEAM"
                  ) && (
                    <span
                      id="unread-badge-team"
                      className="w-2 h-2 rounded-full bg-classified-amber animate-pulse shrink-0 ml-0.5"
                      title="Unread transmissions"
                    />
                  )}
                </button>
                <button
                  id="tab-dm"
                  onClick={() => {
                    setActiveTab("DM");
                    setLastReadTimestamps((prev) => ({ ...prev, DM: Date.now() }));
                  }}
                  className={`flex-1 py-2 px-2 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer whitespace-nowrap text-micro sm:text-xs ${
                    activeTab === "DM"
                      ? "bg-classified-amber/20 text-classified-amber border border-classified-amber/50 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">DIRECT LINE</span>
                  {messages.some(
                    (m) =>
                      m.channelType === "DM" &&
                      m.recipientId === self.id &&
                      m.senderId !== self.id &&
                      new Date(m.createdAt).getTime() > (lastReadTimestamps["DM"] || 0) &&
                      (activeTab !== "DM" || selectedPeerId !== m.senderId)
                  ) && (
                    <span
                      id="unread-badge-dm"
                      className="w-2 h-2 rounded-full bg-classified-amber animate-pulse shrink-0 ml-0.5"
                      title="Unread direct transmissions"
                    />
                  )}
                </button>
              </div>

              {/* Channel Sub-Header for DM View */}
              {activeTab === "DM" && (
                <div className="border-b border-carbon-800 px-4 py-2.5 bg-carbon-950/40 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 uppercase">Target Operative:</span>
                    <select
                      id="dm-peer-select"
                      value={selectedPeerId || ""}
                      onChange={(e) => {
                        setSelectedPeerId(e.target.value);
                        setLastReadTimestamps((prev) => ({ ...prev, DM: Date.now() }));
                      }}
                      className="bg-carbon-900 border border-carbon-700 text-classified-amber text-xs rounded px-3 py-2 focus:outline-none focus:border-classified-amber uppercase font-bold min-h-[44px]"
                    >
                      {peerPlayers.map((peer) => (
                        <option key={peer.id} value={peer.id}>
                          {peer.displayName} ({peer.apparentTeam} COVER)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPeerId && activePeer && activePeer.apparentTeam !== self.apparentTeam ? (
                      gameState?.verifiedAssets?.includes(selectedPeerId) ? (
                        <span
                          id="confirmed-asset-badge"
                          className="flex items-center gap-1 text-micro bg-emerald-950 border border-emerald-500 text-emerald-300 px-3 py-2 rounded font-bold tracking-wider uppercase min-h-[44px]"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          CONFIRMED ASSET
                        </span>
                      ) : gameState?.challengeStatuses?.[selectedPeerId] === "PENDING" ? (
                        <span
                          id="challenge-pending-badge"
                          className="text-micro bg-amber-950 border border-amber-500/50 text-amber-300 px-3 py-2 rounded uppercase tracking-wider font-mono animate-pulse min-h-[44px] flex items-center"
                        >
                          AWAITING RESPONSE...
                        </span>
                      ) : (
                        <button
                          id="verify-credentials-btn"
                          onClick={handleInitiateChallenge}
                          disabled={isChallenging || !selectedPeerId}
                          className="flex items-center justify-center gap-1 text-micro bg-carbon-900 hover:bg-carbon-800 text-classified-amber border border-classified-amber/50 px-3.5 py-2 rounded font-bold tracking-wider uppercase transition-colors min-h-[44px] active:scale-95 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-classified-amber" />
                          {isChallenging ? "CHALLENGING..." : "VERIFY OPERATIVE CREDENTIALS"}
                        </button>
                      )
                    ) : null}

                    <button
                      id="burn-dm-btn"
                      onClick={handleBurnConversation}
                      disabled={isBurning || !selectedPeerId}
                      className="flex items-center justify-center gap-1 text-micro bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-3.5 py-2 rounded font-bold tracking-wider uppercase transition-colors min-h-[44px] active:scale-95 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5 text-red-400" />
                      {isBurning ? "BURNING..." : "BURN CONVERSATION"}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmed Asset Cryptographic Receipt */}
              {activeTab === "DM" && selectedPeerId && gameState?.verifiedAssets?.includes(selectedPeerId) && (
                <div
                  id="confirmed-asset-receipt"
                  className="bg-emerald-950/70 border-b border-emerald-500/40 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>
                      <strong>CONFIRMED ASSET:</strong> {activePeer?.displayName} is cryptographically verified as an embedded Mole loyal to your command.
                    </span>
                  </div>
                  <span className="text-nano text-emerald-400/60 uppercase tracking-widest font-bold">SECURE ASSET</span>
                </div>
              )}

              {/* Clearance Denied Alert */}
              {activeTab === "DM" &&
                selectedPeerId &&
                !gameState?.verifiedAssets?.includes(selectedPeerId) &&
                gameState?.challengeStatuses?.[selectedPeerId] === "DENIED" &&
                !dismissedAlerts[`denied_${selectedPeerId}`] && (
                  <div
                    id="clearance-denied-badge"
                    className="bg-red-950/50 border-b border-red-500/40 px-4 py-2 text-xs font-mono text-red-300 flex items-center justify-between animate-in fade-in duration-200"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span><strong>CLEARANCE DENIED:</strong> Target operative failed counter-signature verification. Not an asset.</span>
                    </div>
                    <button
                      onClick={() => setDismissedAlerts((prev) => ({ ...prev, [`denied_${selectedPeerId}`]: true }))}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-white ml-2 cursor-pointer rounded"
                      aria-label="Dismiss alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

              {/* Clearance Declined Alert */}
              {activeTab === "DM" &&
                selectedPeerId &&
                !gameState?.verifiedAssets?.includes(selectedPeerId) &&
                gameState?.challengeStatuses?.[selectedPeerId] === "DECLINED" &&
                !dismissedAlerts[`declined_${selectedPeerId}`] && (
                  <div
                    id="clearance-declined-badge"
                    className="bg-amber-950/50 border-b border-amber-500/40 px-4 py-2 text-xs font-mono text-amber-300 flex items-center justify-between animate-in fade-in duration-200"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span><strong>CLEARANCE DECLINED:</strong> Target operative declined verification credentials.</span>
                    </div>
                    <button
                      onClick={() => setDismissedAlerts((prev) => ({ ...prev, [`declined_${selectedPeerId}`]: true }))}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-amber-400 hover:text-white ml-2 cursor-pointer rounded"
                      aria-label="Dismiss alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

              {/* Burn Notice Alert */}
              {burnNotice && (
                <div className="bg-classified-crimson/20 border-b border-classified-crimson/40 px-4 py-1.5 text-xs font-mono text-red-300 flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-classified-crimson animate-pulse" />
                  <span>{burnNotice}</span>
                </div>
              )}

              {/* Message Feed */}
              <div
                id="message-list"
                className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs touch-scroll"
              >
                {currentTabMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <Terminal className="w-8 h-8 mb-2 opacity-40" />
                    <p className="uppercase tracking-wider text-micro">
                      {activeTab === "DM"
                        ? "NO RECORDED TRANSMISSIONS ON THIS FREQUENCY"
                        : "SECURE CHANNEL QUIET // NO TRANSMISSIONS"}
                    </p>
                  </div>
                ) : (
                  currentTabMessages.map((msg) => {
                    const isSelf = msg.senderId === self.id;
                    const isRed = msg.senderApparentTeam === "RED";
                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={`p-2.5 sm:p-3 rounded-sm border-t border-r border-b transition-colors ${
                          isSelf
                            ? "bg-carbon-900/90 border-carbon-800 border-l-2 border-l-classified-amber"
                            : isRed
                            ? "bg-carbon-900/60 border-carbon-800/80 border-l-2 border-l-red-500"
                            : "bg-carbon-900/60 border-carbon-800/80 border-l-2 border-l-blue-500"
                        }`}
                      >
                        <div className="flex items-baseline justify-between text-nano text-gray-500 mb-1 gap-2 font-mono">
                          <span className="font-bold flex items-center gap-1.5 min-w-0">
                            <span
                              className={`shrink-0 ${
                                isRed ? "text-red-400" : "text-blue-400"
                              }`}
                            >
                              [{msg.senderApparentTeam}]
                            </span>
                            <span className="text-gray-200 truncate">{msg.senderName}</span>
                            {isSelf && (
                              <span className="text-classified-amber text-nano px-1 py-0.5 border border-amber-500/40 rounded-sm shrink-0 font-bold">
                                YOU
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-gray-500 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-gray-200 text-xs break-words leading-relaxed pl-0.5 font-mono">{msg.content}</p>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Transmission Bar */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-carbon-800 p-3 bg-carbon-950 flex gap-2"
              >
                <input
                  id="message-input"
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    activeTab === "DM"
                      ? `Transmit to ${activePeer?.displayName || "operative"}...`
                      : activeTab === "TEAM"
                      ? `Transmit to ${self.apparentTeam} Team Radio...`
                      : "Broadcast to Public Wire..."
                  }
                  maxLength={500}
                  className="flex-1 bg-carbon-900 border border-carbon-700 rounded-sm px-3 py-2 text-base sm:text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber min-h-[44px]"
                />
                <button
                  id="send-message-btn"
                  type="submit"
                  disabled={!messageInput.trim() || isSendingMessage}
                  className="px-4 py-2 bg-classified-amber hover:bg-amber-600 disabled:opacity-30 text-black font-mono font-bold text-xs uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors min-h-[44px] active:scale-95 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingMessage ? "SENDING..." : "TRANSMIT"}
                </button>
              </form>
            </div>

            {/* Split Rosters (1 Column) */}
            <div id="roster-panel" className="space-y-4 scroll-mt-24">
              {/* Red Team Roster */}
              <div className="bg-carbon-900 border border-red-900/50 rounded-sm p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-3 border-b border-red-900/40 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-red-500" /> Red Team ({redApparentPlayers.length})
                  </span>
                  <span className="text-nano font-mono text-red-500/80 uppercase">APPARENT</span>
                </div>
                <div className="space-y-2" id="red-team-roster">
                  {redApparentPlayers.map((player) => {
                    const isSelf = player.id === self.id;
                    return (
                      <div
                        key={player.id}
                        id={`roster-player-${player.id}`}
                        onClick={() => {
                          if (!isSelf) handleOpenDMWithOperative(player.id);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-sm border text-xs font-mono transition-all min-h-[44px] ${
                          isSelf
                            ? "bg-red-950/40 border-red-700"
                            : "bg-carbon-950 border-carbon-800 hover:border-classified-amber/70 hover:bg-carbon-850 cursor-pointer active:scale-[0.98] group"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-red-500 shrink-0">•</span>
                          <span
                            className={`font-bold truncate ${
                              isSelf ? "text-gray-200" : "text-gray-200 group-hover:text-classified-amber"
                            }`}
                          >
                            {player.displayName}
                          </span>
                          {isSelf ? (
                            <span className="text-nano bg-red-900/80 text-red-200 border border-red-700/60 px-1.5 py-0.5 rounded-sm font-bold shrink-0">
                              YOU
                            </span>
                          ) : (
                            <span className="text-nano text-gray-400 group-hover:text-classified-amber flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity shrink-0">
                              <MessageSquare className="w-3 h-3 text-classified-amber" />
                              <span className="hidden sm:inline">DIRECT LINE →</span>
                            </span>
                          )}
                        </div>
                        <span className="text-nano text-gray-500 uppercase shrink-0">ACTIVE</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blue Team Roster */}
              <div className="bg-carbon-900 border border-blue-900/50 rounded-sm p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-3 border-b border-blue-900/40 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-blue-500" /> Blue Team ({blueApparentPlayers.length})
                  </span>
                  <span className="text-nano font-mono text-blue-500/80 uppercase">APPARENT</span>
                </div>
                <div className="space-y-2" id="blue-team-roster">
                  {blueApparentPlayers.map((player) => {
                    const isSelf = player.id === self.id;
                    return (
                      <div
                        key={player.id}
                        id={`roster-player-${player.id}`}
                        onClick={() => {
                          if (!isSelf) handleOpenDMWithOperative(player.id);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-sm border text-xs font-mono transition-all min-h-[44px] ${
                          isSelf
                            ? "bg-blue-950/40 border-blue-700"
                            : "bg-carbon-950 border-carbon-800 hover:border-classified-amber/70 hover:bg-carbon-850 cursor-pointer active:scale-[0.98] group"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-blue-500 shrink-0">•</span>
                          <span
                            className={`font-bold truncate ${
                              isSelf ? "text-gray-200" : "text-gray-200 group-hover:text-classified-amber"
                            }`}
                          >
                            {player.displayName}
                          </span>
                          {isSelf ? (
                            <span className="text-nano bg-blue-900/80 text-blue-200 border border-blue-700/60 px-1.5 py-0.5 rounded-sm font-bold shrink-0">
                              YOU
                            </span>
                          ) : (
                            <span className="text-nano text-gray-400 group-hover:text-classified-amber flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity shrink-0">
                              <MessageSquare className="w-3 h-3 text-classified-amber" />
                              <span className="hidden sm:inline">DIRECT LINE →</span>
                            </span>
                          )}
                        </div>
                        <span className="text-nano text-gray-500 uppercase shrink-0">ACTIVE</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL FIELD MANUAL MODAL */}
      {isManualOpen && (
        <div
          id="field-manual-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsManualOpen(false);
          }}
        >
          <div className="bg-carbon-900 border-2 border-carbon-700 rounded-lg max-w-2xl w-full max-h-[90vh] max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden font-mono">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-carbon-950 border-b border-carbon-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-classified-amber shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                      Operational Field Manual
                    </h3>
                    <span className="classified-stamp text-nano text-classified-amber border-classified-amber py-0.2 px-1">
                      TOP SECRET
                    </span>
                  </div>
                  <p className="text-nano sm:text-micro text-gray-500">
                    DIRECTORATE OF ESPIONAGE OPERATIONS // STANDARD OPERATING DIRECTIVES
                  </p>
                </div>
              </div>
              <button
                id="close-field-manual-btn"
                onClick={() => setIsManualOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-carbon-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close Field Manual"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-gray-300 touch-scroll">
              {/* SECTION 1: FIELD AGENT DIRECTIVES (Always open & visible to all) */}
              <div
                id="field-agent-directives"
                className="border border-carbon-700 bg-carbon-950/60 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-carbon-800 pb-2">
                  <div className="flex items-center gap-2 font-bold text-classified-terminal uppercase tracking-wider text-sm">
                    <Users className="w-4 h-4" />
                    <h4>Field Agent Directives (General Operations)</h4>
                  </div>
                  <span className="text-nano bg-green-950 text-classified-terminal border border-green-800 px-2 py-0.5 rounded font-bold">
                    STANDARD PROTOCOL
                  </span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  All operatives are deployed into either{" "}
                  <strong className="text-red-400">Crimson Pact (Red)</strong> or{" "}
                  <strong className="text-blue-400">Cobalt Alliance (Blue)</strong>. Each operative is secretly assigned exactly one classified code word.
                </p>
                <ul className="space-y-2 list-disc list-inside text-gray-300 pl-1 leading-relaxed">
                  <li>
                    <strong className="text-white">Primary Mission Objective:</strong> Assemble all{" "}
                    <strong>{players.length || 6}</strong> secret code words across both factions (your team&apos;s words + enemy words). Assembling the full codebook requires earning teammates&apos; trust to share allied words AND using your embedded mole (and covert interrogations) to discover opposing code words.
                  </li>
                  <li>
                    <strong className="text-white">Redaction & Anti-Peeking:</strong> Your secret code word is blacked out by default. Use the{" "}
                    <span className="text-classified-amber font-bold">&quot;Hold to Decrypt&quot;</span> button to reveal it. Release immediately to re-conceal. Never share your word carelessly!
                  </li>
                  <li>
                    <strong className="text-white">Beware The Embedded Mole:</strong> One of your apparent teammates is an enemy double-agent! They have full access to your Team Radio, but are secretly feeding intel to their true opposing TEAM (via covert 1-on-1 Direct Line comms).
                  </li>
                  <li>
                    <strong className="text-white">50% Midpoint Theme Intercept:</strong> Halfway through the mission timeline, Central Command declassifies the{" "}
                    <span className="text-classified-amber font-bold">Secret Theme</span> uniting all genuine words. Cross-reference all claimed words against this theme to identify false leads and expose liars.
                  </li>
                  <li>
                    <strong className="text-white">Universal Mole Verification:</strong> Any operative can request clearance verification in 1-on-1 Direct Line chats with operatives on the opposing apparent team. If they are your faction&apos;s embedded double-agent, they can confirm their allegiance to establish an authenticated covert line and receive a permanent Confirmed Asset receipt.
                  </li>
                  <li>
                    <strong className="text-white">Verdict Deliberation & Scoring (20% Mechanics):</strong> In the final 60-minute Verdict phase, any teammate can propose the official verdict slate. Teams score based on enemy words extracted (0% to 100%), penalized by <strong className="text-classified-crimson">-20%</strong> for each missed own word, and awarded <strong className="text-classified-terminal">+20%</strong> for accurately indicting the enemy mole. Two teammates must agree to lock the verdict.
                  </li>
                </ul>
              </div>

              {/* SECTION 2: CONSENSUS & VERDICT PROTOCOL (Collapsible) */}
              <div
                id="consensus-directives"
                className="border border-amber-900/60 bg-carbon-950/60 rounded-lg overflow-hidden"
              >
                <button
                  id="consensus-directives-toggle"
                  onClick={() => setIsConsensusExpanded(!isConsensusExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-carbon-850/60 transition-colors text-left min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-classified-amber uppercase tracking-wider text-sm">
                    <Users className="w-4 h-4" />
                    <h4>Team Consensus & Verdict Protocol</h4>
                    <span className="text-nano bg-amber-950/80 text-classified-amber border border-amber-800 px-2 py-0.5 rounded font-bold ml-2">
                      TWO-MEMBER CONSENSUS
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{isConsensusExpanded ? "COLLAPSE" : "EXPAND PROTOCOL"}</span>
                    {isConsensusExpanded ? (
                      <ChevronUp className="w-4 h-4 text-classified-amber" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-classified-amber" />
                    )}
                  </div>
                </button>

                {isConsensusExpanded && (
                  <div
                    id="consensus-directives-content"
                    className="p-4 border-t border-carbon-800 space-y-3 bg-carbon-900/50 animate-in fade-in duration-150"
                  >
                    <p className="text-gray-400 leading-relaxed">
                      Every operative holds full deliberation and submission agency. To prevent rogue agents or saboteurs from hijacking your mission, final verdicts strictly require a two-member quorum.
                    </p>
                    <ul className="space-y-2 list-disc list-inside text-gray-300 pl-1 leading-relaxed">
                      <li>
                        <strong className="text-white">Collaborative Proposals:</strong> Any teammate can assemble candidate words and propose the official team verdict slate.
                      </li>
                      <li>
                        <strong className="text-white">Two-Member Confirmation Quorum:</strong> A proposed slate is only locked into Central Command once a second teammate reviews and confirms it.
                      </li>
                      <li>
                        <strong className="text-white">Enemy Word Extraction (0% to 100%):</strong> Your team earns points proportional to the enemy authentic code words you successfully deduce.
                      </li>
                      <li>
                        <strong className="text-white">Internal Sabotage Penalty (-20% Flat):</strong> For every authentic code word from your own squad that was missed or replaced by a decoy, your rating drops by 20%. Protect your authentic words!
                      </li>
                      <li>
                        <strong className="text-white">Mole Indictment Bonus (+20% Flat):</strong> Accurately identifying the enemy sleeper mole embedded in your squad awards an immediate +20% rating boost, neutralizing the damage of a sabotaged word.
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* SECTION 3: COVERT MOLE DIRECTIVES (Collapsible // For Deep-Cover Infiltrators) */}
              <div
                id="mole-directives"
                className="border border-red-900/60 bg-carbon-950/60 rounded-lg overflow-hidden"
              >
                <button
                  id="mole-directives-toggle"
                  onClick={() => setIsMoleExpanded(!isMoleExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-carbon-850/60 transition-colors text-left min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-red-400 uppercase tracking-wider text-sm">
                    <UserX className="w-4 h-4 text-red-500" />
                    <h4>Covert Mole Directives</h4>
                    <span className="text-nano bg-red-950/80 text-red-300 border border-red-800 px-2 py-0.5 rounded font-bold ml-2">
                      DEEP-COVER INFILTRATION
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{isMoleExpanded ? "COLLAPSE" : "EXPAND DIRECTIVES"}</span>
                    {isMoleExpanded ? (
                      <ChevronUp className="w-4 h-4 text-red-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </button>

                {isMoleExpanded && (
                  <div
                    id="mole-directives-content"
                    className="p-4 border-t border-carbon-800 space-y-3 bg-carbon-900/50 animate-in fade-in duration-150"
                  >
                    <p className="text-gray-400 leading-relaxed">
                      You are a deep-cover sleeper operative. Your apparent cover places you on the enemy faction, but your true allegiance belongs to your home team.
                    </p>
                    <ul className="space-y-2 list-disc list-inside text-gray-300 pl-1 leading-relaxed">
                      <li>
                        <strong className="text-white">The Golden Rule of Victory:</strong>{" "}
                        <span className="text-classified-terminal font-bold">You win if and only if your ACTUAL faction wins!</span> Helping your apparent cover team win will result in your defeat.
                      </li>
                      <li>
                        <strong className="text-white">Extract & Transmit Genuine Intel:</strong> Your primary operational focus is to discover your apparent team&apos;s genuine code words and secretly transmit them to your true teammates via private 1-on-1 Direct Line comms.
                      </li>
                      <li>
                        <strong className="text-white">Disinformation & Sabotage:</strong> Blend in on your apparent team&apos;s Team Radio. Actively feed them convincing false intel and decoy candidate words to derail their deliberations, waste their guess slots, and protect your true team&apos;s secrets.
                      </li>
                      <li>
                        <strong className="text-white">Cover Identity Masking & Screen-Share Safety:</strong> When your device is resting or idle, your screen displays an innocent Agent dossier identical to your apparent teammates. Only while pressing and holding &quot;Hold to Decrypt&quot; does your covert role and true allegiance flash into view. When your true teammates challenge your credentials via 1-on-1 DM, click{" "}
                        <span className="text-classified-terminal font-bold">&quot;Transmit Counter-Signature&quot;</span>. An emerald confirmation toast will appear and self-destruct after 3 seconds with zero persistent UI traces.
                      </li>
                      <li>
                        <strong className="text-white">Anti-Forensic Burn Protocol:</strong> After transmitting secrets in 1-on-1 DMs, click the{" "}
                        <span className="text-red-400 font-bold">&quot;Burn Conversation&quot;</span> button to incinerate all message logs for your station.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-carbon-950 border-t border-carbon-800 flex items-center justify-between text-micro text-gray-500">
              <span>SECURITY LEVEL: TOP SECRET // OPERATIONAL ARCHIVE</span>
              <button
                onClick={() => setIsManualOpen(false)}
                className="min-h-[44px] px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded font-mono uppercase text-xs tracking-wider transition-colors flex items-center justify-center cursor-pointer"
              >
                DISMISS MANUAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BURN CONVERSATION CONFIRMATION MODAL */}
      {isConfirmingBurn && (
        <div
          id="burn-confirmation-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="burn-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConfirmingBurn(false);
          }}
        >
          <div className="bg-carbon-900 border-2 border-classified-crimson rounded-lg max-w-md w-full p-5 sm:p-6 shadow-2xl font-mono space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-950/80 border border-red-800 rounded">
                <Flame className="w-6 h-6 text-classified-crimson" />
              </div>
              <div>
                <h3 id="burn-modal-title" className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Authorize Forensic Incineration
                </h3>
                <span className="text-nano text-red-400 uppercase tracking-widest font-bold">
                  DESTRUCTIVE ACTION // ZERO RECOVERY
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              This protocol will permanently shred and purge all encrypted telegraph logs between your station and{" "}
              <strong className="text-white">{activePeer?.displayName || "this operative"}</strong>.
              Incineration cannot be undone by Central Command.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="cancel-burn-btn"
                type="button"
                onClick={() => setIsConfirmingBurn(false)}
                className="min-h-[44px] px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded font-mono uppercase text-xs tracking-wider transition-colors cursor-pointer"
              >
                ABORT // KEEP LOGS
              </button>
              <button
                id="confirm-burn-btn"
                type="button"
                onClick={executeBurnDM}
                className="min-h-[44px] px-4 py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded font-mono font-bold uppercase text-xs tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Flame className="w-4 h-4 text-red-400" />
                EXECUTE INCINERATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERDICT AUTHENTICATION CONFIRMATION MODAL (TWO-MAN RULE) */}
      {isConfirmingVerdict && (
        <div
          id="verdict-confirmation-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verdict-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConfirmingVerdict(false);
          }}
        >
          <div className="bg-carbon-900 border-2 border-classified-amber rounded-lg max-w-lg w-full p-5 sm:p-6 shadow-2xl font-mono space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-950/80 border border-amber-800 rounded">
                <Lock className="w-6 h-6 text-classified-amber" />
              </div>
              <div>
                <h3 id="verdict-modal-title" className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Two-Member Quorum // Propose Slate
                </h3>
                <span className="text-nano text-classified-amber uppercase tracking-widest font-bold">
                  OFFICIAL VERDICT PROPOSAL
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              You are about to transmit a proposed intelligence verdict slate for the{" "}
              <strong className="text-white">{self.apparentTeam} FACTION</strong>. At least one teammate must confirm this proposal to lock in Central Command.
            </p>

            {/* Verdict Summary Review */}
            <div className="bg-carbon-950 border border-carbon-800 rounded p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-carbon-800 pb-1.5">
                <span className="text-gray-500 uppercase tracking-wider">Target Words ({verdictGuesses.length}):</span>
                <span className="text-classified-amber font-bold">{verdictGuesses.join(", ")}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-gray-500 uppercase tracking-wider">Indicted Mole:</span>
                <span className={moleIndictmentId ? "text-classified-crimson font-bold" : "text-gray-400 font-bold"}>
                  {moleIndictmentId ? (players.find((p) => p.id === moleIndictmentId)?.displayName || "DECLARED") : "NONE DECLARED"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="cancel-verdict-btn"
                type="button"
                onClick={() => setIsConfirmingVerdict(false)}
                className="min-h-[44px] px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded font-mono uppercase text-xs tracking-wider transition-colors cursor-pointer"
              >
                REVIEW VERDICT
              </button>
              <button
                id="confirm-verdict-btn"
                type="button"
                onClick={() => executeSubmitVerdict(false)}
                className="min-h-[44px] px-4 py-2 bg-classified-amber text-black hover:bg-amber-400 font-mono font-bold uppercase text-xs tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Lock className="w-4 h-4" />
                TRANSMIT PROPOSAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EPHEMERAL PRE-MISSION OPERATIONAL BRIEFING MODAL ("BURN AFTER READING") */}
      {room.phase === "INFILTRATION" && !isBriefingBurned && self.role && self.assignedWord && (
        <div
          id="operational-briefing-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="briefing-title"
          data-assigned-word={self.assignedWord}
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 pb-24 overflow-y-auto animate-in fade-in duration-300"
        >
          <div className="bg-carbon-900 border-2 border-classified-amber rounded-lg max-w-2xl w-full p-6 sm:p-8 font-mono text-sm shadow-2xl space-y-6 my-auto">
            {/* Briefing Stamp Header */}
            <div className="flex items-center justify-between border-b border-carbon-800 pb-4">
              <div className="flex items-center gap-3">
                <Radio className="w-6 h-6 text-classified-amber shrink-0 animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="briefing-title" className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                      Classified Operational Briefing
                    </h2>
                    <span className="classified-stamp text-nano text-classified-crimson border-classified-crimson py-0.2 px-1">
                      EYES ONLY
                    </span>
                  </div>
                  <p className="text-nano text-gray-400">
                    DIRECTORATE OF ESPIONAGE OPERATIONS // PRE-MISSION DIRECTIVES
                  </p>
                </div>
              </div>
              <span className="text-nano bg-carbon-800 text-classified-amber border border-carbon-700 px-2 py-1 rounded">
                PHASE: INFILTRATION
              </span>
            </div>

            {/* Role-Tailored Mission Briefing Body */}
            <div className="space-y-4 text-xs sm:text-sm text-gray-300 leading-relaxed bg-carbon-950 p-4 sm:p-5 rounded border border-carbon-800">
              {self.role === "MOLE" && (
                <>
                  <div className="flex items-center justify-between border-b border-carbon-800 pb-2 mb-3">
                    <span className="text-classified-crimson font-bold uppercase tracking-widest text-xs">
                      ROLE: EMBEDDED SLEEPER MOLE
                    </span>
                    <span className="text-nano bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                      DEEP UNDERCOVER
                    </span>
                  </div>
                  <p>
                    <strong className="text-white">Cover Identity:</strong> {self.apparentTeam} FACTION FIELD AGENT.
                    <br />
                    <strong className="text-white">True Allegiance:</strong>{" "}
                    <span className={self.actualTeam === "RED" ? "text-red-400 font-bold" : "text-blue-400 font-bold"}>
                      LOYAL TO {self.actualTeam} FACTION
                    </span>.
                  </p>
                  <p className="text-classified-amber font-semibold pt-1">
                    WIN CONDITION: You win if and only if your TRUE FACTION ({self.actualTeam}) wins the match!
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-400 pt-1">
                    <li>
                      <strong className="text-white">Anti-Coercion Cover:</strong> To protect you against physical screen
                      inspections, your active terminal will show 100% standard Field Agent cover. There will be ZERO
                      trace of your mole identity on your active screen.
                    </li>
                    <li>
                      <strong className="text-white">Covert Contact:</strong> Establish covert contact with operatives
                      on your true faction using private 1-on-1 DMs to secretly transmit
                      intelligence and coordinate.
                    </li>
                    <li>
                      <strong className="text-white">Anti-Forensic Burn:</strong> Always BURN your DM history after sending
                      messages to leave your telegraph logs completely blank.
                    </li>
                  </ul>
                  <p className="text-nano text-red-400 border-t border-carbon-800 pt-2 italic">
                    NOTICE: This briefing is the ONLY place your sleeper status is ever displayed. Once burned, your
                    terminal will look indistinguishable from a loyal teammate&apos;s.
                  </p>
                </>
              )}

              {self.role === "AGENT" && (
                <>
                  <div className="flex items-center justify-between border-b border-carbon-800 pb-2 mb-3">
                    <span className="text-gray-200 font-bold uppercase tracking-widest text-xs">
                      ROLE: {self.apparentTeam} FIELD AGENT
                    </span>
                    <span className="text-nano text-classified-amber font-bold uppercase">LOYAL OPERATIVE</span>
                  </div>
                  <p>
                    You are an active <strong className="text-white">Field Operative</strong> for the{" "}
                    <strong className="text-classified-amber">{self.apparentTeam} FACTION</strong>. Your mission is to
                    protect your code word from enemy extraction while collaborating on Team radio to discover enemy words.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-400 pt-1">
                    <li>
                      <strong className="text-white">Deliberation Wire:</strong> Propose and confirm candidate code words on the team
                      deliberation board to achieve two-member consensus.
                    </li>
                    <li>
                      <strong className="text-white">Vigilance:</strong> An enemy sleeper is embedded in your ranks.
                      Watch for inconsistent stories, deflections, or false leads.
                    </li>
                  </ul>
                </>
              )}
            </div>

            {/* Official Assigned Codeword Display */}
            <div className="bg-carbon-950 border border-carbon-800 rounded p-4 text-center space-y-1.5">
              <span className="text-nano text-gray-500 uppercase tracking-widest font-bold">
                YOUR OFFICIAL ASSIGNED CODE WORD:
              </span>
              <div>
                <span
                  id="briefing-assigned-word"
                  className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-classified-amber bg-amber-950/40 px-4 py-1.5 rounded border border-amber-700/60 inline-block uppercase"
                >
                  {self.assignedWord}
                </span>
              </div>
              <p className="text-nano text-gray-400 font-mono">
                All assigned code words share a single classified operational theme.
              </p>
            </div>

            {/* Commit to Memory Authentication Gate */}
            <div className="space-y-3 pt-1 border-t border-carbon-800">
              <label htmlFor="briefing-codeword-input" className="block text-xs text-gray-300 font-bold uppercase tracking-wider">
                Type your assigned code word to commit orders to memory:
              </label>
              <input
                id="briefing-codeword-input"
                type="text"
                autoComplete="off"
                spellCheck="false"
                value={briefingWordInput}
                onChange={(e) => setBriefingWordInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && briefingWordInput.trim().toUpperCase() === self.assignedWord?.toUpperCase()) {
                    handleBurnBriefing();
                  }
                }}
                placeholder="TYPE ASSIGNED CODE WORD"
                className="w-full bg-carbon-950 border border-carbon-700 focus:border-classified-amber text-white font-mono text-center text-sm font-bold uppercase tracking-widest px-4 py-3 rounded outline-none transition-colors"
              />

              <button
                id="burn-briefing-btn"
                type="button"
                disabled={briefingWordInput.trim().toUpperCase() !== self.assignedWord?.toUpperCase()}
                onClick={handleBurnBriefing}
                className="w-full min-h-[48px] px-6 py-3 bg-classified-amber text-black hover:bg-amber-400 font-mono font-bold uppercase text-xs tracking-wider rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-lg"
              >
                <Flame className="w-4 h-4 text-black" />
                AUTHENTICATE CODEWORD & BURN BRIEFING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TACTICAL DECOY WORD CONFIGURATION MODAL */}
      {isSpoofModalOpen && (
        <div
          id="spoof-word-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spoof-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSpoofModalOpen(false);
          }}
        >
          <div className="bg-carbon-900 border-2 border-classified-amber rounded-lg max-w-md w-full p-5 sm:p-6 shadow-2xl font-mono space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-950/60 border border-amber-800 rounded">
                <Shield className="w-5 h-5 text-classified-amber" />
              </div>
              <div>
                <h3 id="spoof-modal-title" className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Tactical Decoy Word
                </h3>
                <span className="text-nano text-classified-amber uppercase tracking-widest font-bold">
                  SCREEN CAMOUFLAGE
                </span>
              </div>
            </div>

            {/* Critical Explanatory Callout */}
            <div className="bg-carbon-950 border border-carbon-800 rounded p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-classified-amber font-bold uppercase tracking-wider text-micro">
                <Lock className="w-3.5 h-3.5" /> Authentic Code Word Unchanged
              </div>
              <p className="text-gray-300 leading-relaxed">
                Configuring a decoy word <strong className="text-white">only changes the display</strong> on this station when holding to decrypt. Use this to protect your station against shoulder-surfing or to feed false leads.
              </p>
              <p className="text-gray-400 text-micro leading-relaxed border-t border-carbon-800 pt-2">
                Your <strong className="text-white">original code word remains unchanged</strong> in Central Command&apos;s master codebook, and is what will be scored during the final Verdict &amp; Debrief phases.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="spoof-word-input" className="block text-micro text-gray-300 uppercase tracking-wider font-bold">
                Decoy Display Word:
              </label>
              <input
                id="spoof-word-input"
                type="text"
                autoComplete="off"
                spellCheck="false"
                value={spoofModalInput}
                onChange={(e) => setSpoofModalInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSpoofWord();
                }}
                placeholder="ENTER DECOY WORD (OR LEAVE BLANK)"
                className="w-full bg-carbon-950 border border-carbon-700 focus:border-classified-amber text-white font-mono text-sm uppercase tracking-widest px-3 py-2.5 rounded outline-none"
              />
              <span className="text-nano text-gray-500 block">
                Clear this field or enter your authentic word to remove the decoy.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-carbon-800">
              <button
                id="cancel-spoof-word-btn"
                type="button"
                onClick={() => setIsSpoofModalOpen(false)}
                className="min-h-[44px] px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded font-mono uppercase text-xs tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                id="save-spoof-word-btn"
                type="button"
                onClick={handleSaveSpoofWord}
                className="min-h-[44px] px-4 py-2 bg-classified-amber text-black hover:bg-amber-400 font-mono font-bold uppercase text-xs tracking-wider rounded transition-colors cursor-pointer active:scale-95"
              >
                APPLY DECOY WORD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING DM NOTIFICATION TOAST */}
      {dmAlert && (
        <div
          id="incoming-dm-toast"
          onClick={() => {
            handleOpenDMWithOperative(dmAlert.senderId);
            setDmAlert(null);
          }}
          className="fixed top-20 right-4 z-40 max-w-sm w-full bg-carbon-900/95 border-2 border-classified-amber rounded-lg p-3.5 shadow-2xl font-mono cursor-pointer animate-in slide-in-from-top-3 duration-200 hover:bg-carbon-850 backdrop-blur-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-classified-amber text-xs font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> INCOMING DIRECT TRANSMISSION
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDmAlert(null);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white cursor-pointer rounded"
              aria-label="Dismiss transmission alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-white font-bold mb-0.5">{dmAlert.senderName}</div>
          <p className="text-xs text-gray-300 line-clamp-2 italic">&quot;{dmAlert.preview}&quot;</p>
          <div className="text-nano text-classified-amber uppercase tracking-wider mt-2 flex items-center justify-between border-t border-carbon-800 pt-1.5">
            <span>CLICK TO OPEN DIRECT LINE</span>
            <span>→</span>
          </div>
        </div>
      )}

      {/* DEV OPS PLAYTESTING HUD */}
      {isDevMode && (
        <aside
          id="dev-controls-hud"
          aria-label="Developer Operations Console"
          className="fixed bottom-0 left-0 right-0 z-50 bg-carbon-950/95 border-t-2 border-classified-amber p-2.5 sm:px-6 font-mono text-xs shadow-2xl backdrop-blur-md"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-classified-amber animate-pulse"></span>
              <span className="font-bold text-classified-amber uppercase tracking-wider">DEV OPS CONSOLE</span>
              <span className="text-nano bg-carbon-800 text-gray-400 px-1.5 py-0.5 rounded border border-carbon-700">
                PHASE: {room.phase}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Fill Bots in Lobby */}
              {room.phase === "LOBBY" && (
                <button
                  id="dev-fill-bots-btn"
                  disabled={isDevActionLoading || players.length >= 6}
                  onClick={async () => {
                    setIsDevActionLoading(true);
                    try {
                      const res = await fetch(`/api/rooms/${code}/dev`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "fill_bots" }),
                      });
                      if (res.ok) await fetchState();
                    } finally {
                      setIsDevActionLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-carbon-800 hover:bg-carbon-700 text-classified-terminal border border-green-700 rounded font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer min-h-[36px] flex items-center justify-center"
                >
                  [BOT+5] Fill 5 Bots ({players.length}/6)
                </button>
              )}

              {/* Warp to Midpoint */}
              {room.phase === "INFILTRATION" && (
                <button
                  id="dev-warp-midpoint-btn"
                  disabled={isDevActionLoading}
                  onClick={async () => {
                    setIsDevActionLoading(true);
                    try {
                      const res = await fetch(`/api/rooms/${code}/timer/warp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-subterfuge-dev": "true" },
                        body: JSON.stringify({ target: "MIDPOINT" }),
                      });
                      if (res.ok) await fetchState();
                    } finally {
                      setIsDevActionLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-carbon-800 hover:bg-carbon-700 text-classified-amber border border-amber-700 rounded font-bold uppercase tracking-wider cursor-pointer min-h-[36px] flex items-center justify-center"
                >
                  [WARP: 50%] Midpoint
                </button>
              )}

              {/* Warp to Verdict */}
              {room.phase === "INFILTRATION" && (
                <button
                  id="dev-warp-verdict-btn"
                  disabled={isDevActionLoading}
                  onClick={async () => {
                    setIsDevActionLoading(true);
                    try {
                      const res = await fetch(`/api/rooms/${code}/timer/warp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-subterfuge-dev": "true" },
                        body: JSON.stringify({ target: "VERDICT" }),
                      });
                      if (res.ok) await fetchState();
                    } finally {
                      setIsDevActionLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-carbon-800 hover:bg-carbon-700 text-yellow-400 border border-yellow-700 rounded font-bold uppercase tracking-wider cursor-pointer min-h-[36px] flex items-center justify-center"
                >
                  [WARP: VERDICT]
                </button>
              )}

              {/* Fast-Forward to Debrief */}
              {(room.phase === "INFILTRATION" || room.phase === "VERDICT") && (
                <button
                  id="dev-warp-debrief-btn"
                  disabled={isDevActionLoading}
                  onClick={async () => {
                    setIsDevActionLoading(true);
                    try {
                      const res = await fetch(`/api/rooms/${code}/timer/warp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-subterfuge-dev": "true" },
                        body: JSON.stringify({ target: "DEBRIEF" }),
                      });
                      if (res.ok) await fetchState();
                    } finally {
                      setIsDevActionLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-carbon-800 hover:bg-carbon-700 text-red-400 border border-red-700 rounded font-bold uppercase tracking-wider cursor-pointer min-h-[36px] flex items-center justify-center"
                >
                  [WARP: DEBRIEF] Complete Match
                </button>
              )}

              {/* God Mode Toggle */}
              <button
                id="dev-god-mode-btn"
                onClick={async () => {
                  if (!isGodMode) {
                    try {
                      const res = await fetch(`/api/rooms/${code}/dev`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "god_mode" }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setGodData(data);
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }
                  setIsGodMode(!isGodMode);
                }}
                className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider border cursor-pointer min-h-[36px] flex items-center justify-center ${
                  isGodMode
                    ? "bg-classified-amber text-black border-classified-amber"
                    : "bg-carbon-800 hover:bg-carbon-700 text-gray-300 border-carbon-600"
                }`}
              >
                [GOD: REVEAL] {isGodMode ? "ACTIVE" : "STANDBY"}
              </button>

              {/* Reset Lobby */}
              <button
                id="dev-reset-lobby-btn"
                disabled={isDevActionLoading}
                onClick={async () => {
                  setIsDevActionLoading(true);
                  try {
                    const res = await fetch(`/api/rooms/${code}/dev`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "reset_lobby" }),
                    });
                    if (res.ok) {
                      setIsGodMode(false);
                      setGodData(null);
                      await fetchState();
                    }
                  } finally {
                    setIsDevActionLoading(false);
                  }
                }}
                className="px-3 py-1.5 bg-carbon-800 hover:bg-red-950 text-muted hover:text-classified-crimson border border-carbon-700 rounded font-bold uppercase tracking-wider cursor-pointer min-h-[36px] flex items-center justify-center"
              >
                [RST: LOBBY] Reset Lobby
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
