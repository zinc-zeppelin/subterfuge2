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

  const decryptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}/state`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/?joinCode=${code}`);
          return;
        }
        const data = await res.json();
        throw new Error(data.error || "Failed to load operational state");
      }
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
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
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

        {/* Room Metrics */}
        <div className="flex items-center gap-6 font-mono text-xs text-gray-400">
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

      {/* PHASE 1: LOBBY VIEW */}
      {!isInfiltration ? (
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

          {/* INTELLIGENCE COMMUNICATIONS & FIELD SUITE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Communication Panel (2 Columns) */}
            <div className="lg:col-span-2 bg-carbon-900 border border-carbon-800 rounded-lg flex flex-col h-[520px]">
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
                <div className="border-b border-carbon-800 px-4 py-2 bg-carbon-950/40 flex items-center justify-between font-mono text-xs">
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
