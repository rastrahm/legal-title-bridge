/**
 * Ensure Buffer exists for Anchor / PDA helpers in the browser.
 */

import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export { Buffer };
