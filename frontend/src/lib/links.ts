/**
 * Safe external link validation (W1): only https: URLs are allowed in UI links.
 */

import { z } from "zod";

export const HttpsUrlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("https:"), {
    message: "Only https: links are allowed",
  });

/**
 * Returns the URL if it is a valid https link; otherwise null.
 */
export function sanitizeHttpsUrl(raw: string): string | null {
  const parsed = HttpsUrlSchema.safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
}
