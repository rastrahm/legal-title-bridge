"use client";

export interface NetworkBannerProps {
  visible: boolean;
  message: string;
}

/**
 * Shown when wallet chain / genesis does not match configured network (W2).
 */
export function NetworkBanner({ visible, message }: NetworkBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="border-b border-amber-700/50 bg-amber-950/40 px-6 py-3 text-sm text-amber-100"
      data-testid="network-banner"
    >
      {message}
    </div>
  );
}
