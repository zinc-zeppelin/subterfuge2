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
        <div className="relative min-h-[100dvh] flex flex-col">
          <main className="flex-1 flex flex-col px-2 sm:px-4 max-w-7xl mx-auto w-full overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
