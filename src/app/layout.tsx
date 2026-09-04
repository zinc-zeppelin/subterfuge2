import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUBTERFUGE // Intelligence Operative Portal",
  description: "Asynchronous social deduction and strategic espionage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-carbon-950 text-gray-200 min-h-screen selection:bg-classified-amber selection:text-black">
        <div className="fixed inset-0 crt-overlay opacity-30 pointer-events-none z-50" />
        <div className="relative min-h-screen flex flex-col">
          {/* Header Bar */}
          <header className="border-b border-carbon-800 bg-carbon-900/90 backdrop-blur px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-classified-crimson animate-pulse" />
              <span className="font-bold tracking-widest text-sm text-gray-300">
                PROJECT SUBTERFUGE // CLASSIFIED
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono text-gray-500">
              <span>SECURITY LEVEL: TOP SECRET</span>
              <span className="border border-classified-crimson text-classified-crimson px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]">
                NEED TO KNOW ONLY
              </span>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col">{children}</main>

          {/* Footer */}
          <footer className="border-t border-carbon-800 bg-carbon-900/50 px-6 py-3 text-center text-xs text-gray-600 font-mono">
            DIRECTORATE OF ESPIONAGE OPERATIONS // SYSTEM TIME SECURED
          </footer>
        </div>
      </body>
    </html>
  );
}
