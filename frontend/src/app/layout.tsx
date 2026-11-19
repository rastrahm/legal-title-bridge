import type { Metadata } from "next";

import { Providers } from "@/components/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Title Bridge",
  description:
    "Puente Ethereum–Solana para títulos legales tokenizados (módulo 22).",
};

/**
 * Root layout — CSP/frame guards live in next.config.ts headers.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
