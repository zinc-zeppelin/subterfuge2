"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientGameState, Message, ChannelType } from "@/lib/types/game";
import {
  Users,
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

  // Verdict Deliberation & Spymaster Lock-In State
  const [proposalInput, setProposalInput] = useState("");
  const [isProposing, setIsProposing] = useState(false);
  const [spymasterWordInput, setSpymasterWordInput] = useState("");
  const [spymasterGuesses, setSpymasterGuesses] = useState<string[]>([]);
  const [moleIndictmentId, setMoleIndictmentId] = useState<string>("");
  const [isSubmittingVerdict, setIsSubmittingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);

  const decryptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    try {
      const res = await fetch(`/api/rooms/${code}/state`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/?joinCode=${code}`);
          return;
        }
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load operational state");
      }
      const data = await res.json();
      setGameState(data);
    } catch (err: any) {
      setGameState((prev) => {
        if (!prev) setError(err.message);
        return prev;
      });
    }
  }, [code, router]);

  const fetchMessages = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Ignore polling errors
    }
  }, [code]);

  useEffect(() => {
    fetchState();
    fetchMessages();
    const interval = setInterval(() => {
      fetchState();
      fetchMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchState, fetchMessages]);

  useEffect(() => {
    return () => {
      if (decryptTimerRef.current) clearTimeout(decryptTimerRef.current);
    };
  }, []);

  // Default selected peer in DM tab
  useEffect(() => {
    if (gameState && !selectedPeerId) {
      const peers = gameState.players.filter((p) => p.id !== gameState.self.id);
      if (peers.length > 0) {
        setSelectedPeerId(peers[0].id);
      }
    }
  }, [gameState, selectedPeerId]);

  const handleToggleReady = async () => {
    if (!gameState || !code || isTogglingReady) return;
    setIsTogglingReady(true);
    try {
      const res = await fetch(`/api/rooms/${code}/ready`, {
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
      const res = await fetch(`/api/rooms/${code}/start`, {
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

    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/rooms/${code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelType,
          content: messageInput.trim(),
          recipientId,
        }),
      });
      if (res.ok) {
        setMessageInput("");
        await fetchMessages();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to transmit message");
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleBurnConversation = async () => {
    if (!selectedPeerId || !code || isBurning) return;
    setIsBurning(true);
    try {
      const res = await fetch(`/api/rooms/${code}/messages/burn`, {
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
      const res = await fetch(`/api/rooms/${code}/mole/challenge`, {
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
      const res = await fetch(`/api/rooms/${code}/mole/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, action }),
      });
      const data = await res.json();
      if (data.isMole) {
        setMoleToast({ message: data.message || "Operative Verified. Channel Secured.", isMole: true });
        setTimeout(() => setMoleToast(null), 3000);
      } else {
        setMoleToast({
          message: data.message || "Clearance Denied: Invalid Counter-Signature",
          isMole: false,
        });
        setTimeout(() => setMoleToast(null), 3000);
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
      const res = await fetch(`/api/rooms/${code}/verdict/suggest`, {
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
      const res = await fetch(`/api/rooms/${code}/verdict/vote`, {
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

  const handleAddSpymasterGuess = (wordToAdd?: string) => {
    const raw = wordToAdd || spymasterWordInput;
    const word = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!word) return;
    if (!spymasterGuesses.includes(word)) {
      if (spymasterGuesses.length >= (gameState?.players.length || 6)) {
        setVerdictError(`Cannot add more than ${gameState?.players.length} code words.`);
        return;
      }
      setSpymasterGuesses((prev) => [...prev, word]);
      setVerdictError(null);
      if (!wordToAdd) setSpymasterWordInput("");
    }
  };

  const handleRemoveSpymasterGuess = (wordToRemove: string) => {
    setSpymasterGuesses((prev) => prev.filter((w) => w !== wordToRemove));
  };

  const handleSubmitVerdict = async () => {
    if (!code || isSubmittingVerdict || spymasterGuesses.length === 0) return;
    setIsSubmittingVerdict(true);
    setVerdictError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/verdict/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guesses: spymasterGuesses,
          moleIndictmentId: moleIndictmentId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to lock in verdict");
      }
      await fetchState();
    } catch (err: any) {
      setVerdictError(err.message);
    } finally {
      setIsSubmittingVerdict(false);
    }
  };

  const handleDecryptStart = () => {
    setIsDecrypted(true);
    if (decryptTimerRef.current) clearTimeout(decryptTimerRef.current);
    decryptTimerRef.current = setTimeout(() => {
      setIsDecrypted(false);
    }, 4000);
  };

  const handleDecryptEnd = () => {
    if (decryptTimerRef.current) clearTimeout(decryptTimerRef.current);
    decryptTimerRef.current = setTimeout(() => {
      setIsDecrypted(false);
    }, 1500);
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
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-gray-500 text-sm">
        <Terminal className="w-5 h-5 animate-spin mr-3 text-classified-amber" />
        ESTABLISHING ENCRYPTED LINK...
      </div>
    );
  }

  const { room, self, players } = gameState;
  const isEven = players.length % 2 === 0 && players.length >= 4;
  const allReady = players.length >= 4 && players.every((p) => p.isReady);
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
          className="fixed top-6 right-6 z-50 bg-emerald-950 border-2 border-emerald-500 text-emerald-300 px-6 py-4 shadow-2xl rounded font-mono text-sm flex items-center gap-3 animate-pulse"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <div className="font-bold text-emerald-400 uppercase tracking-widest text-xs">
              Security Handshake Confirmed
            </div>
            <div className="font-semibold text-white">{moleToast.message}</div>
            <div className="text-[10px] text-emerald-400/70 mt-1">
              This notification will self-destruct in 3s...
            </div>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-carbon-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-white tracking-wider">
              OPERATION: <span className="text-classified-amber">{room.code}</span>
            </h1>
            <span
              id="room-phase-badge"
              className={`classified-stamp text-xs ${
                isInfiltration
                  ? "text-classified-crimson border-classified-crimson animate-pulse"
                  : "text-classified-terminal border-classified-terminal"
              }`}
            >
              {room.phase}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-1">
            ENCRYPTED LINK // OPERATIVE: <span className="text-gray-200 font-bold">{self.displayName}</span>
            {self.isHost && " ★ (OPERATION COMMANDER)"}
          </p>
        </div>

        {/* Room Metrics & Operational Timer */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs text-gray-400">
          {(isInfiltration || room.phase === "VERDICT") && (
            <div
              id="operational-timer-display"
              className="bg-carbon-950 border border-classified-crimson/50 px-3 py-1.5 rounded flex items-center gap-2 text-classified-crimson shadow"
            >
              <Clock className="w-4 h-4 animate-spin text-classified-crimson" />
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
                  {room.phase === "VERDICT" ? "VERDICT DELIBERATION:" : "MISSION TIME REMAINING:"}
                </span>
                <span id="timer-countdown" className="text-sm font-bold tracking-widest text-white">
                  {timeLeft}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span>OPERATIVES: <strong className="text-white">{players.length}/12</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>DURATION: <strong className="text-white">{room.durationHours}H</strong></span>
          </div>
        </div>
      </div>

      {/* Global Midpoint Theme Declassification Broadcast Banner */}
      {room.declassifiedTheme && (
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
              <div className="text-[11px] uppercase tracking-widest font-bold text-classified-amber/80">
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
            <div className="text-[10px] text-gray-400">UNMATCHED WORDS MAY INDICATE MOLE DECEPTION</div>
          </div>
        </div>
      )}

      {/* Midpoint Countdown Schedule Notice */}
      {isInfiltration && midpointLeft && !room.declassifiedTheme && (
        <div
          id="midpoint-countdown-badge"
          className="mb-6 px-4 py-2 bg-carbon-900 border border-carbon-800 rounded font-mono text-xs text-gray-400 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-classified-amber" />
            <span className="uppercase tracking-wider">AUTOMATED INTELLIGENCE INTERCEPT SCHEDULED:</span>
          </div>
          <span className="text-classified-amber font-bold tracking-wider">
            T-MINUS {midpointLeft}
          </span>
        </div>
      )}

      {/* PHASE 1: LOBBY VIEW */}
      {room.phase === "LOBBY" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operative Roster Panel */}
          <div className="lg:col-span-2 bg-carbon-900 border border-carbon-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 border-b border-carbon-800 pb-3">
              <span className="text-xs font-mono uppercase text-gray-400 tracking-wider">
                Active Operatives ({players.length})
              </span>
              <span className="text-xs font-mono text-gray-500">
                MIN: 4 // MAX: 12 // STRICTLY EVEN
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
                      <span className="text-[10px] bg-carbon-800 text-classified-amber px-2 py-0.5 rounded border border-carbon-700">
                        YOU
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-[10px] bg-carbon-800 text-gray-400 px-2 py-0.5 rounded border border-carbon-700">
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
                className={`w-full py-3 px-4 font-mono font-bold text-xs tracking-wider uppercase rounded transition-colors ${
                  self.isReady
                    ? "bg-carbon-800 text-gray-300 hover:bg-carbon-700 border border-carbon-600"
                    : "bg-classified-terminal text-black hover:bg-green-400"
                }`}
              >
                {self.isReady ? "CANCEL READY STATUS" : "DECLARE OPERATIONAL READY"}
              </button>
            </div>

            <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-6 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-gray-300 font-bold border-b border-carbon-800 pb-2">
                <ShieldCheck className="w-4 h-4 text-classified-amber" />
                <span>DEPLOYMENT CRITERIA</span>
              </div>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center justify-between">
                  <span>Roster Count:</span>
                  <span className={players.length >= 4 ? "text-classified-terminal" : "text-gray-500"}>
                    {players.length} (Min 4)
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Even Balance:</span>
                  <span className={isEven ? "text-classified-terminal" : "text-classified-crimson"}>
                    {isEven ? "BALANCED (EVEN)" : "UNBALANCED (ODD)"}
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
                  disabled={!isEven || !allReady || isStartingOperation}
                  className="w-full mt-4 py-3 bg-classified-crimson hover:bg-red-800 disabled:opacity-30 text-white font-bold tracking-wider uppercase rounded transition-colors text-xs"
                >
                  {isStartingOperation ? "INITIALIZING INFILTRATION..." : "AUTHORIZE DEPLOYMENT"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PHASE 2: INFILTRATION VIEW (CLASSIFIED DOSSIER + INTELLIGENCE COMMS) */
        <div className="space-y-6">
          {/* Top Secret Operative Dossier Card */}
          <div className="bg-carbon-900 border border-carbon-700 rounded-lg p-6 shadow-2xl relative overflow-hidden">
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
              {/* Apparent Cover vs True Allegiance */}
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Apparent Cover</div>
                <div className="flex items-center gap-2">
                  <span
                    id="self-apparent-team"
                    className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                      self.apparentTeam === "RED"
                        ? "bg-red-950/60 border-red-700 text-red-400"
                        : "bg-blue-950/60 border-blue-700 text-blue-400"
                    }`}
                  >
                    {self.apparentTeam} TEAM
                  </span>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">True Allegiance</div>
                  <div
                    id="self-actual-team"
                    className={`font-bold tracking-wider text-xs uppercase ${
                      self.actualTeam === "RED" ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    LOYAL TO {self.actualTeam} TEAM
                  </div>
                </div>
              </div>

              {/* Role & Objective */}
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Assigned Role</div>
                <div className="flex items-center gap-2">
                  <span
                    id="self-role"
                    className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                      self.role === "SPYMASTER"
                        ? "bg-amber-950/60 border-amber-600 text-amber-400"
                        : self.role === "MOLE"
                        ? "bg-purple-950/60 border-purple-600 text-purple-400"
                        : "bg-carbon-800 border-carbon-600 text-gray-300"
                    }`}
                  >
                    {self.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono pt-1">
                  {self.role === "SPYMASTER" &&
                    "Operation Commander. Holds exclusive lock-in authority on your team's final verdict."}
                  {self.role === "MOLE" &&
                    "Covert Traitor. Infiltrate enemy radio channels and secretly transmit intelligence to your true faction."}
                  {self.role === "AGENT" &&
                    "Field Operative. Protect your code word, extract opposing words, and uncover the mole in your ranks."}
                </p>
              </div>

              {/* Secret Code Word & Hold-to-Decrypt Anti-Peeking */}
              <div className="space-y-2 bg-carbon-950 p-4 rounded border border-carbon-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-classified-amber" /> Secret Code Word
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase">
                      {isDecrypted ? "DECRYPTED" : "REDACTED"}
                    </span>
                  </div>

                  <div className="py-2">
                    {isDecrypted ? (
                      <span
                        id="self-assigned-word"
                        className="text-xl font-bold font-mono tracking-widest text-classified-amber bg-amber-950/30 px-3 py-1 rounded border border-amber-700/50 inline-block uppercase"
                      >
                        {self.assignedWord}
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

                <button
                  id="decrypt-word-btn"
                  onMouseDown={handleDecryptStart}
                  onMouseUp={handleDecryptEnd}
                  onTouchStart={handleDecryptStart}
                  onTouchEnd={handleDecryptEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={handleDecryptStart}
                  className="w-full py-2 px-3 bg-carbon-800 hover:bg-carbon-700 active:bg-classified-amber active:text-black border border-carbon-600 rounded text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center justify-center gap-2 transition-colors select-none"
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
                        Submitted by Spymaster <strong>{gameState.teamVerdict.submittedByName}</strong>. Awaiting opponent command...
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
                  {/* Spymaster Lock-In Control vs Field Operative Status */}
                  {self.role === "SPYMASTER" ? (
                    <div className="p-4 bg-carbon-950 border border-classified-amber/50 rounded mb-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-classified-amber flex items-center gap-1.5">
                          ★ SPYMASTER EXCLUSIVE LOCK-IN AUTHORITY
                        </span>
                        <span id="guesses-count" className="text-xs font-mono text-gray-400">
                          SELECTED: <strong className="text-white">{spymasterGuesses.length}/{players.length}</strong>
                        </span>
                      </div>

                      {/* Add Word Input */}
                      <div className="flex gap-2">
                        <input
                          id="spymaster-word-input"
                          type="text"
                          value={spymasterWordInput}
                          onChange={(e) => setSpymasterWordInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSpymasterGuess()}
                          placeholder="Enter candidate code word..."
                          className="flex-1 bg-carbon-900 border border-carbon-700 rounded px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-classified-amber"
                        />
                        <button
                          id="add-guess-btn"
                          onClick={() => handleAddSpymasterGuess()}
                          className="bg-carbon-800 hover:bg-carbon-700 text-classified-amber border border-classified-amber/40 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider"
                        >
                          + ADD GUESS
                        </button>
                      </div>

                      {/* Draft Guesses Badges */}
                      <div className="flex flex-wrap gap-2 min-h-[36px] p-2 bg-carbon-900/60 rounded border border-carbon-800" id="draft-guesses-container">
                        {spymasterGuesses.length === 0 ? (
                          <span className="text-xs text-gray-600 italic">No code words added to official verdict yet. Add words or click candidate words below.</span>
                        ) : (
                          spymasterGuesses.map((w) => (
                            <span
                              key={w}
                              id={`draft-guess-${w.toLowerCase()}`}
                              className="bg-carbon-800 border border-classified-amber/60 text-classified-amber text-xs px-2.5 py-1 rounded flex items-center gap-1.5 font-bold uppercase shadow"
                            >
                              {w}
                              <button
                                onClick={() => handleRemoveSpymasterGuess(w)}
                                className="text-gray-400 hover:text-red-400 font-bold ml-1"
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
                            Mole Indictment (+2 Tiebreaker):
                          </label>
                          <select
                            id="mole-indictment-select"
                            value={moleIndictmentId}
                            onChange={(e) => setMoleIndictmentId(e.target.value)}
                            className="bg-carbon-900 border border-carbon-700 text-xs text-classified-amber rounded px-2 py-1 font-mono uppercase"
                          >
                            <option value="">-- No Indictment --</option>
                            {players
                              .filter((p) => p.apparentTeam !== self.apparentTeam)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.displayName} (OPPOSING {p.apparentTeam})
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          id="lock-in-verdict-btn"
                          disabled={isSubmittingVerdict || spymasterGuesses.length === 0}
                          onClick={handleSubmitVerdict}
                          className="bg-classified-crimson hover:bg-red-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded text-xs uppercase tracking-widest transition-colors shadow-lg border border-red-500 flex items-center justify-center gap-2"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {isSubmittingVerdict ? "TRANSMITTING VERDICT..." : "LOCK IN OFFICIAL VERDICT"}
                        </button>
                      </div>

                      {verdictError && (
                        <div className="text-xs text-red-400 bg-red-950/60 border border-red-800 p-2 rounded">
                          {verdictError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      id="awaiting-spymaster-notice"
                      className="p-3.5 bg-carbon-950 border border-carbon-800 rounded text-xs text-gray-400 mb-6 flex items-center gap-3"
                    >
                      <Lock className="w-4 h-4 text-classified-amber shrink-0" />
                      <span>
                        <strong>AWAITING SPYMASTER LOCK-IN:</strong> Only your designated Spymaster can authorize the final verdict. Propose words below and vote on team suggestions to assist their assembly.
                      </span>
                    </div>
                  )}

                  {/* Collaborative Proposal Board */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        COLLABORATIVE TEAM PROPOSALS
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {gameState?.teamSuggestions?.length || 0} WORDS ON BOARD
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        id="proposal-word-input"
                        type="text"
                        value={proposalInput}
                        onChange={(e) => setProposalInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleProposeWord()}
                        placeholder="Suggest candidate word..."
                        className="flex-1 bg-carbon-900 border border-carbon-700 rounded px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-classified-amber font-mono"
                      />
                      <button
                        id="propose-word-btn"
                        disabled={isProposing || !proposalInput.trim()}
                        onClick={handleProposeWord}
                        className="bg-carbon-800 hover:bg-carbon-700 text-white border border-carbon-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider"
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
                              className="p-2.5 bg-carbon-900 border border-carbon-800 rounded flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-white text-sm tracking-wider uppercase">
                                  {s.word}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  suggested by {s.suggestedBy}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  id={`upvote-btn-${s.id}`}
                                  onClick={() => handleVoteSuggestion(s.id)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase transition-colors ${
                                    hasVoted
                                      ? "bg-classified-amber text-black"
                                      : "bg-carbon-800 text-gray-300 hover:text-white border border-carbon-700"
                                  }`}
                                >
                                  ▲ <span id={`suggestion-votes-${s.id}`}>{s.votes.length}</span>
                                </button>

                                {self.role === "SPYMASTER" && (
                                  <button
                                    id={`adopt-word-btn-${s.id}`}
                                    onClick={() => handleAddSpymasterGuess(s.word)}
                                    className="bg-carbon-800 hover:bg-carbon-700 text-classified-amber border border-classified-amber/30 px-2 py-1 rounded text-[11px] uppercase font-bold"
                                  >
                                    + ADOPT
                                  </button>
                                )}
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
            <div className="lg:col-span-2 bg-carbon-900 border border-carbon-800 rounded-lg flex flex-col h-[520px] overflow-hidden">
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
                      className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-bold px-3 py-1 rounded text-[11px] uppercase tracking-wider transition-colors border border-emerald-500 shadow"
                    >
                      {challengeActionLoading ? "TRANSMITTING..." : "SUBMIT COUNTER-SIGNATURE"}
                    </button>
                    <button
                      id="decline-challenge-btn"
                      disabled={challengeActionLoading}
                      onClick={() =>
                        handleRespondChallenge(gameState.incomingChallenges![0].id, "DENY")
                      }
                      className="bg-carbon-800 hover:bg-carbon-700 text-gray-300 font-bold px-2 py-1 rounded text-[11px] uppercase tracking-wider transition-colors border border-carbon-600"
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
                  onClick={() => setActiveTab("PUBLIC")}
                  className={`flex-1 py-2 px-3 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "PUBLIC"
                      ? "bg-carbon-800 text-white border border-carbon-700 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-gray-400" /> Public Wire
                </button>
                <button
                  id="tab-team"
                  onClick={() => setActiveTab("TEAM")}
                  className={`flex-1 py-2 px-3 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "TEAM"
                      ? self.apparentTeam === "RED"
                        ? "bg-red-950/80 text-red-300 border border-red-800 shadow"
                        : "bg-blue-950/80 text-blue-300 border border-blue-800 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" /> {self.apparentTeam} Radio
                </button>
                <button
                  id="tab-dm"
                  onClick={() => setActiveTab("DM")}
                  className={`flex-1 py-2 px-3 rounded font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "DM"
                      ? "bg-classified-amber/20 text-classified-amber border border-classified-amber/50 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Direct Line
                </button>
              </div>

              {/* Channel Sub-Header for DM View */}
              {activeTab === "DM" && (
                <div className="border-b border-carbon-800 px-4 py-2 bg-carbon-950/40 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 uppercase">Target Operative:</span>
                    <select
                      id="dm-peer-select"
                      value={selectedPeerId || ""}
                      onChange={(e) => setSelectedPeerId(e.target.value)}
                      className="bg-carbon-900 border border-carbon-700 text-classified-amber text-xs rounded px-2.5 py-1 focus:outline-none focus:border-classified-amber uppercase font-bold"
                    >
                      {peerPlayers.map((peer) => (
                        <option key={peer.id} value={peer.id}>
                          {peer.displayName} ({peer.apparentTeam} COVER)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPeerId && gameState?.verifiedAssets?.includes(selectedPeerId) ? (
                      <span
                        id="confirmed-asset-badge"
                        className="flex items-center gap-1 text-[11px] bg-emerald-950 border border-emerald-500 text-emerald-300 px-2.5 py-1 rounded font-bold tracking-wider uppercase"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        CONFIRMED ASSET
                      </span>
                    ) : selectedPeerId && gameState?.challengeStatuses?.[selectedPeerId] === "PENDING" ? (
                      <span
                        id="challenge-pending-badge"
                        className="text-[11px] bg-amber-950 border border-amber-500/50 text-amber-300 px-2.5 py-1 rounded uppercase tracking-wider font-mono animate-pulse"
                      >
                        AWAITING RESPONSE...
                      </span>
                    ) : (
                      <button
                        id="verify-credentials-btn"
                        onClick={handleInitiateChallenge}
                        disabled={isChallenging || !selectedPeerId}
                        className="flex items-center gap-1 text-[11px] bg-carbon-900 hover:bg-carbon-800 text-classified-amber border border-classified-amber/50 px-2.5 py-1 rounded font-bold tracking-wider uppercase transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-classified-amber" />
                        {isChallenging ? "CHALLENGING..." : "VERIFY OPERATIVE CREDENTIALS"}
                      </button>
                    )}

                    <button
                      id="burn-dm-btn"
                      onClick={handleBurnConversation}
                      disabled={isBurning || !selectedPeerId}
                      className="flex items-center gap-1 text-[11px] bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-2.5 py-1 rounded font-bold tracking-wider uppercase transition-colors"
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
                  <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-bold">SECURE ASSET</span>
                </div>
              )}

              {/* Clearance Denied Alert */}
              {activeTab === "DM" && selectedPeerId && !gameState?.verifiedAssets?.includes(selectedPeerId) && gameState?.challengeStatuses?.[selectedPeerId] === "DENIED" && (
                <div
                  id="clearance-denied-badge"
                  className="bg-red-950/50 border-b border-red-500/40 px-4 py-2 text-xs font-mono text-red-300 flex items-center gap-2"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span><strong>CLEARANCE DENIED:</strong> Target operative failed counter-signature verification. Not an asset.</span>
                </div>
              )}

              {/* Burn Notice Alert */}
              {burnNotice && (
                <div className="bg-classified-crimson/20 border-b border-classified-crimson/40 px-4 py-1.5 text-xs font-mono text-red-300 flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                  <span>{burnNotice}</span>
                </div>
              )}

              {/* Message Feed */}
              <div
                id="message-list"
                className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs"
              >
                {currentTabMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <Terminal className="w-8 h-8 mb-2 opacity-40" />
                    <p className="uppercase tracking-wider text-[11px]">
                      {activeTab === "DM"
                        ? "NO RECORDED TRANSMISSIONS ON THIS FREQUENCY"
                        : "SECURE CHANNEL QUIET // NO TRANSMISSIONS"}
                    </p>
                  </div>
                ) : (
                  currentTabMessages.map((msg) => {
                    const isSelf = msg.senderId === self.id;
                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={`p-3 rounded border ${
                          isSelf
                            ? "bg-carbon-850 border-carbon-700 ml-8"
                            : msg.senderApparentTeam === "RED"
                            ? "bg-red-950/20 border-red-900/40 mr-8"
                            : "bg-blue-950/20 border-blue-900/40 mr-8"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                          <span className="font-bold flex items-center gap-1.5">
                            <span
                              className={
                                msg.senderApparentTeam === "RED"
                                  ? "text-red-400"
                                  : "text-blue-400"
                              }
                            >
                              [{msg.senderApparentTeam}]
                            </span>
                            <span className="text-white">{msg.senderName}</span>
                            {isSelf && <span className="text-classified-amber">(YOU)</span>}
                          </span>
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-gray-200 text-xs break-words">{msg.content}</p>
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
                  className="flex-1 bg-carbon-900 border border-carbon-700 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber"
                />
                <button
                  id="send-message-btn"
                  type="submit"
                  disabled={!messageInput.trim() || isSendingMessage}
                  className="px-4 py-2 bg-classified-amber hover:bg-amber-600 disabled:opacity-30 text-black font-mono font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingMessage ? "SENDING..." : "TRANSMIT"}
                </button>
              </form>
            </div>

            {/* Split Rosters (1 Column) */}
            <div className="space-y-4">
              {/* Red Team Roster */}
              <div className="bg-carbon-900 border border-red-900/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 border-b border-red-900/40 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-red-500" /> Red Team ({redApparentPlayers.length})
                  </span>
                  <span className="text-[9px] font-mono text-red-500/80 uppercase">APPARENT</span>
                </div>
                <div className="space-y-2" id="red-team-roster">
                  {redApparentPlayers.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 rounded border text-xs font-mono ${
                        player.id === self.id
                          ? "bg-red-950/40 border-red-700"
                          : "bg-carbon-950 border-carbon-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">•</span>
                        <span className="font-bold text-gray-200">{player.displayName}</span>
                        {player.id === self.id && (
                          <span className="text-[9px] bg-red-900/80 text-red-200 px-1.5 py-0.2 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 uppercase">ACTIVE</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blue Team Roster */}
              <div className="bg-carbon-900 border border-blue-900/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 border-b border-blue-900/40 pb-2">
                  <span className="text-xs font-mono font-bold uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-blue-500" /> Blue Team ({blueApparentPlayers.length})
                  </span>
                  <span className="text-[9px] font-mono text-blue-500/80 uppercase">APPARENT</span>
                </div>
                <div className="space-y-2" id="blue-team-roster">
                  {blueApparentPlayers.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 rounded border text-xs font-mono ${
                        player.id === self.id
                          ? "bg-blue-950/40 border-blue-700"
                          : "bg-carbon-950 border-carbon-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-blue-500">•</span>
                        <span className="font-bold text-gray-200">{player.displayName}</span>
                        {player.id === self.id && (
                          <span className="text-[9px] bg-blue-900/80 text-blue-200 px-1.5 py-0.2 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 uppercase">ACTIVE</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
