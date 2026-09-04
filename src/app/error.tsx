"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 font-mono text-center">
      <h2 className="text-xl font-bold text-classified-crimson mb-2">
        OPERATIONAL SYSTEM ERROR // ENCRYPTION FAULT
      </h2>
      <p className="text-xs text-gray-500 mb-4">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-carbon-800 hover:bg-carbon-700 text-white rounded text-xs uppercase tracking-wider"
      >
        RE-AUTHENTICATE LINK
      </button>
    </div>
  );
}
