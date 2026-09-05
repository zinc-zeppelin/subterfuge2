"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Terminal, KeyRound, Radio } from "lucide-react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callsign, setCallsign] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinCode = searchParams.get("joinCode");
    if (joinCode) {
      setRoomCode(joinCode.toUpperCase());
    }
  }, [searchParams]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim()) {
      setError("Please specify your Operative Call-sign.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: callsign }),
      });
      const data = await res.json();
      if (typeof window !== "undefined" && data.sessionToken) {
        sessionStorage.setItem(`subterfuge_session_${data.roomCode}`, data.sessionToken);
        localStorage.setItem(`subterfuge_session_${data.roomCode}`, data.sessionToken);
      }
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim()) {
      setError("Please specify your Operative Call-sign.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter the 6-character Operation Code.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const code = roomCode.trim().toUpperCase();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: callsign }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to access operation");

      if (typeof window !== "undefined" && data.sessionToken) {
        sessionStorage.setItem(`subterfuge_session_${code}`, data.sessionToken);
        localStorage.setItem(`subterfuge_session_${code}`, data.sessionToken);
      }
      router.push(`/room/${code}`);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
      {/* Dossier Header */}
      <div className="text-center mb-10 space-y-3">
        <div className="inline-block border border-classified-crimson/60 bg-classified-crimson/10 text-red-400 px-3 py-1 rounded text-xs tracking-widest font-mono uppercase">
          Department of Cryptographic Deception
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-white flex items-center justify-center gap-3">
          <Terminal className="w-10 h-10 text-classified-amber" />
          SUBTERFUGE
        </h1>
        <p className="text-sm sm:text-base text-gray-400 max-w-lg mx-auto font-mono">
          Asynchronous social deduction and strategic espionage. Two factions, embedded traitors, and a single declassified codebook.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="w-full mb-6 p-4 border border-red-800 bg-red-950/50 text-red-300 rounded text-sm font-mono flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Operative Call-sign Input Card */}
      <div className="w-full bg-carbon-900 border border-carbon-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl">
        <label className="block text-xs font-mono uppercase text-gray-400 mb-2 tracking-wider">
          Step 1: Declare Your Operative Call-Sign
        </label>
        <div className="relative">
          <input
            id="callsign-input"
            type="text"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="e.g. FALCON, NIGHTSHADE, CIPHER"
            maxLength={20}
            className="w-full bg-carbon-950 border border-carbon-700 rounded px-4 py-3 text-base sm:text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber uppercase tracking-wider min-h-[48px]"
          />
        </div>
      </div>

      {/* Dual Operational Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
        {/* Create Operation Card */}
        <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-5 sm:p-6 flex flex-col justify-between hover:border-carbon-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs font-mono text-classified-amber uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4" /> Directive Alpha
              </span>
              <span className="classified-stamp text-[10px] text-classified-amber border-classified-amber">
                ORIGINATE
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-mono text-white mb-2">Establish Operation</h2>
            <p className="text-xs text-gray-400 font-mono mb-4 sm:mb-6">
              Create a new encrypted room, configure operational duration (4h to 24h), and receive an Operation Code for your operatives.
            </p>
          </div>
          <button
            id="create-room-btn"
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full min-h-[48px] py-3.5 px-4 bg-classified-crimson hover:bg-red-800 disabled:opacity-50 text-white font-mono font-bold text-xs sm:text-sm tracking-wider uppercase rounded transition-colors active:scale-[0.99] cursor-pointer"
          >
            {isLoading ? "ESTABLISHING..." : "COMMENCE OPERATION"}
          </button>
        </div>

        {/* Join Operation Card */}
        <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-5 sm:p-6 flex flex-col justify-between hover:border-carbon-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs font-mono text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Directive Beta
              </span>
              <span className="classified-stamp text-[10px] text-blue-400 border-blue-400">
                INFILTRATE
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-mono text-white mb-2">Access Operation</h2>
            <p className="text-xs text-gray-400 font-mono mb-4">
              Enter an existing 6-character room code to join an active operational roster.
            </p>
            <input
              id="room-code-input"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE (e.g. SUB94X)"
              maxLength={6}
              className="w-full bg-carbon-950 border border-carbon-700 rounded px-4 py-2.5 text-base sm:text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 uppercase tracking-widest mb-4 sm:mb-6 min-h-[48px]"
            />
          </div>
          <button
            id="join-room-btn"
            onClick={handleJoinRoom}
            disabled={isLoading}
            className="w-full min-h-[48px] py-3.5 px-4 bg-classified-intelBlue hover:bg-blue-900 disabled:opacity-50 text-white font-mono font-bold text-xs sm:text-sm tracking-wider uppercase rounded transition-colors active:scale-[0.99] cursor-pointer"
          >
            {isLoading ? "AUTHENTICATING..." : "ACCESS CHANNEL"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono text-gray-500 text-sm">INITIALIZING COMMAND PORTAL...</div>}>
      <HomeContent />
    </Suspense>
  );
}
