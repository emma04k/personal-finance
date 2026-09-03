import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Presupuesto EDOG",
    short_name: "Presupuesto",
    description: "Organiza tu presupuesto personal con claridad.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f6",
    theme_color: "#16645a",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
