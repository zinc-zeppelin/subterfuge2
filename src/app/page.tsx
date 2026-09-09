"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Terminal, KeyRound, Radio, Sliders } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { soundscape } from "@/lib/utils/soundscape";
import { initTheme } from "@/lib/utils/theme";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callsign, setCallsign] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [durationHours, setDurationHours] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    initTheme();
  }, []);

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
        body: JSON.stringify({ hostName: callsign, durationHours }),
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full font-mono">
      {/* Top Station Utilities */}
      <div className="w-full flex justify-end mb-2">
        <button
          id="settings-toggle-btn"
          onClick={() => {
            soundscape.playClick();
            setIsSettingsOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-900 border border-carbon-700 hover:border-carbon-600 text-gray-300 hover:text-white font-mono text-xs rounded transition shadow-sm"
          aria-label="Operational Settings"
        >
          <Sliders className="w-3.5 h-3.5 text-classified-amber" />
          <span className="tracking-wider uppercase text-[11px]">CONFIG // SETTINGS</span>
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-white flex items-center justify-center gap-2.5">
          <Terminal className="w-8 h-8 text-classified-amber" />
          SUBTERFUGE
        </h1>
        <p className="text-xs sm:text-sm text-gray-400">
          Asynchronous social deduction and strategic espionage.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="w-full mb-4 p-3 border border-red-800 bg-red-950/60 text-red-300 rounded text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Operative Call-sign */}
      <div className="w-full bg-carbon-900 border border-carbon-800 rounded-lg p-4 sm:p-5 mb-4 shadow-lg">
        <label className="block text-xs uppercase text-gray-400 mb-2 font-bold tracking-wider">
          Operative Callsign
        </label>
        <input
          id="callsign-input"
          type="text"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          placeholder="e.g. FALCON, NIGHTSHADE"
          maxLength={20}
          className="w-full bg-carbon-950 border border-carbon-700 rounded px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-classified-amber uppercase tracking-wider min-h-[44px]"
        />
      </div>

      {/* Action Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {/* Create Operation */}
        <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-1">
              Create Room
            </div>
            <p className="text-micro text-gray-400">
              Host an encrypted match with your group.
            </p>
          </div>

          {/* Mission Duration Selector */}
          <div className="space-y-1.5 pt-2 border-t border-carbon-800">
            <div className="flex items-center justify-between text-micro text-gray-400">
              <span className="uppercase font-bold tracking-wider">MISSION DURATION:</span>
              <span id="create-duration-display" className="text-classified-amber font-bold font-mono">
                {durationHours} {durationHours === 1 ? "HOUR" : "HOURS"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                id="create-duration-minus-btn"
                type="button"
                onClick={() => setDurationHours((h) => Math.max(1, h - 1))}
                className="w-8 h-8 flex items-center justify-center bg-carbon-800 hover:bg-carbon-700 text-gray-200 rounded border border-carbon-700 text-xs font-bold transition-colors cursor-pointer"
                title="Decrease duration by 1 hour"
              >
                -
              </button>
              <input
                id="create-duration-slider"
                type="range"
                min="1"
                max="24"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-carbon-950 rounded"
              />
              <button
                id="create-duration-plus-btn"
                type="button"
                onClick={() => setDurationHours((h) => Math.min(24, h + 1))}
                className="w-8 h-8 flex items-center justify-center bg-carbon-800 hover:bg-carbon-700 text-gray-200 rounded border border-carbon-700 text-xs font-bold transition-colors cursor-pointer"
                title="Increase duration by 1 hour"
              >
                +
              </button>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <button
                type="button"
                onClick={() => setDurationHours(2)}
                className={`hover:text-amber-400 transition-colors cursor-pointer ${durationHours === 2 ? "text-classified-amber font-bold" : ""}`}
              >
                2H
              </button>
              <button
                type="button"
                onClick={() => setDurationHours(6)}
                className={`hover:text-amber-400 transition-colors cursor-pointer ${durationHours === 6 ? "text-classified-amber font-bold" : ""}`}
              >
                6H
              </button>
              <button
                type="button"
                onClick={() => setDurationHours(12)}
                className={`hover:text-amber-400 transition-colors cursor-pointer ${durationHours === 12 ? "text-classified-amber font-bold" : ""}`}
              >
                12H (DEF)
              </button>
              <button
                type="button"
                onClick={() => setDurationHours(24)}
                className={`hover:text-amber-400 transition-colors cursor-pointer ${durationHours === 24 ? "text-classified-amber font-bold" : ""}`}
              >
                24H
              </button>
            </div>
          </div>

          <button
            id="create-room-btn"
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full min-h-[44px] py-2.5 px-3 bg-carbon-800 hover:bg-carbon-700 active:bg-classified-amber active:text-black border border-carbon-600 hover:border-classified-amber text-classified-amber font-bold text-xs tracking-wider uppercase rounded transition-colors cursor-pointer"
          >
            {isLoading ? "CREATING..." : "CREATE OPERATION"}
          </button>
        </div>

        {/* Join Operation */}
        <div className="bg-carbon-900 border border-carbon-800 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-1">
              Join Room
            </div>
            <input
              id="room-code-input"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="w-full bg-carbon-950 border border-carbon-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-classified-intelBlue uppercase tracking-widest min-h-[38px] mt-1"
            />
          </div>
          <button
            id="join-room-btn"
            onClick={handleJoinRoom}
            disabled={isLoading}
            className="w-full min-h-[44px] py-2.5 px-3 bg-carbon-800 hover:bg-carbon-700 active:bg-blue-600 active:text-white border border-carbon-600 hover:border-blue-500 text-blue-400 font-bold text-xs tracking-wider uppercase rounded transition-colors cursor-pointer"
          >
            {isLoading ? "JOINING..." : "JOIN OPERATION"}
          </button>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
