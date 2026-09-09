import type { MetadataRoute } from "next";

/**
 * Web App Manifest for Project Subterfuge
 * Configures Progressive Web App (PWA) installation for Android Chrome, iOS Safari, and desktop platforms.
 *
 * @returns MetadataRoute.Manifest configuration object
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SUBTERFUGE // Intelligence Operative Portal",
    short_name: "Subterfuge",
    description: "Asynchronous social deduction and strategic espionage.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
