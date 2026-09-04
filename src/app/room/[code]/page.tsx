"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientGameState } from "@/lib/types/game";
import { Users, ShieldCheck, Clock, Terminal, CheckCircle2, Circle } from "lucide-react";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingReady, setIsTogglingReady] = useState(false);

  const fetchState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}/state`);
      if (!res.ok) {
        if (res.status === 401) {
          // No session credentials, redirect to home with room code prefilled
          router.push(`/?joinCode=${code}`);
          return;
        }
        const data = await res.json();
        throw new Error(data.error || "Failed to load operational state");
      }
      const data: ClientGameState = await res.json();
      setGameState(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [code, router]);

  useEffect(() => {
    fetchState();
    // Poll for updates every 2 seconds in lobby
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

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

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-carbon-900 border border-red-800 p-6 rounded-lg max-w-md w-full font-mono text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
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

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
      {/* Top Intelligence Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-carbon-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-white tracking-wider">
              OPERATION: <span className="text-classified-amber">{room.code}</span>
            </h1>
            <span className="classified-stamp text-xs text-classified-terminal border-classified-terminal">
              {room.phase}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-1">
            ENCRYPTED FIELD TRANSMISSION // CALL-SIGN: <span className="text-gray-200 font-bold">{self.displayName}</span>
            {self.isHost && " (OPERATION COMMANDER)"}
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

      {/* Roster & Controls Grid */}
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
          {/* Readiness Toggle */}
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

          {/* Operation Start Requirements Dossier */}
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
                disabled={!isEven || !allReady}
                className="w-full mt-4 py-3 bg-classified-crimson hover:bg-red-800 disabled:opacity-30 text-white font-bold tracking-wider uppercase rounded transition-colors text-xs"
              >
                AUTHORIZE DEPLOYMENT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
