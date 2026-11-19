/**
 * Contract / program addresses — sole source is shared (D14 / W3).
 * Query params such as `?endpoint=` or `?program=` are ignored.
 */

import {
  addresses as sharedAddresses,
  type NetworkAddresses,
  type NetworkId,
} from "@/vendor/shared";

import { getActiveNetwork } from "./config/network";

/**
 * Resolve configured addresses for the active network.
 * @param searchParams - optional URL search params (ignored for address selection)
 */
export function resolveAddresses(
  networkId?: NetworkId,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>,
): NetworkAddresses {
  void searchParams; // D14: never take addresses from the URL
  const net = getActiveNetwork(networkId).networkId;
  return sharedAddresses[net];
}

/**
 * Returns true if a candidate address equals the configured bridge endpoint.
 */
export function isConfiguredBridgeEndpoint(
  candidate: string,
  networkId?: NetworkId,
): boolean {
  return (
    candidate.toLowerCase() ===
    resolveAddresses(networkId).bridgeEndpoint.toLowerCase()
  );
}
