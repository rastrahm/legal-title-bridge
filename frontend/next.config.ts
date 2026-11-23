import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Lab UI is fully client-interactive (wallets/demo); Cache Components instant
  // validation fights Playwright hydration. Re-enable when pages are static.
  cacheComponents: false,
  transpilePackages: ["@legal-title-bridge/shared"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    // Next.js dev / Turbopack injects inline bootstrap scripts; production keeps a
    // strict script-src without unsafe-inline (W1 / CSP hardening).
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self'"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      // Testnet DvP / registry reads need public RPCs (browser fetch); keep localhost for lab.
      "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://api.devnet.solana.com wss://api.devnet.solana.com https://ethereum-sepolia-rpc.publicnode.com",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(rootDir, ".."),
    resolveAlias: {
      "@legal-title-bridge/shared": path.join(
        rootDir,
        "../shared/src/index.ts",
      ),
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
