import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rendu dynamique classique : la langue et le thème viennent de cookies (ADR 0009).
  // Pas de badge Next.js en développement : il recouvrait l'interface.
  devIndicators: false,
  // Photos de profil GitHub et Discord affichées dans l'en-tête.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
