import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "SUBTERFUGE // Intelligence Operative Portal",
  description: "Asynchronous social deduction and strategic espionage.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Subterfuge",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="bg-carbon-950 text-gray-200 min-h-[100dvh] overscroll-none selection:bg-classified-amber selection:text-black">
        <div className="fixed inset-0 crt-overlay opacity-30 pointer-events-none z-50" />
        <div className="relative min-h-[100dvh] flex flex-col">
          {/* Header Bar */}
          <header className="border-b border-carbon-800 bg-carbon-900/90 backdrop-blur px-4 sm:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-classified-crimson animate-pulse shrink-0" />
              <span className="font-bold tracking-wider sm:tracking-widest text-xs sm:text-sm text-gray-300 truncate">
                PROJECT SUBTERFUGE // CLASSIFIED
              </span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-mono text-gray-500 shrink-0">
              <span className="hidden md:inline">SECURITY LEVEL: TOP SECRET</span>
              <span className="border border-classified-crimson text-classified-crimson px-1.5 sm:px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                NEED TO KNOW
              </span>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col px-2 sm:px-4">{children}</main>

          {/* Footer */}
          <footer className="border-t border-carbon-800 bg-carbon-900/50 px-4 sm:px-6 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-[10px] sm:text-xs text-gray-600 font-mono">
            DIRECTORATE OF ESPIONAGE OPERATIONS // SYSTEM TIME SECURED
          </footer>
        </div>
      </body>
    </html>
  );
}
